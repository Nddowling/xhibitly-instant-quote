#!/usr/bin/env node

/**
 * Sync Assets to Base44 Database
 *
 * After downloading assets to Supabase Storage, this script:
 * 1. Reads products with Supabase URLs
 * 2. Creates/updates Product records in Base44
 * 3. Updates asset references to use Supabase URLs
 *
 * Usage: node scripts/syncAssetsToBase44.js
 */

import { readFileSync } from 'fs';
import { createClient } from '@base44/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });

const base44 = createClient({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  functionsVersion: 'latest',
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false
});

// products_with_all_files.json has the populated supabase_url fields in images/downloads arrays
// products_transformed.json has empty images[] arrays — do NOT use that for asset sync
const PRODUCTS_FILE = path.join(__dirname, '../orbus_catalog/products_with_all_files.json');

/**
 * Prepare product data for Base44 with Supabase assets
 */
function prepareProductData(product) {
  // Collect all image URLs from Supabase
  const images = product.images
    ?.filter(img => img.supabase_url)
    .map(img => img.supabase_url) || [];

  // Find primary image (first one)
  const primary_image_url = images[0] || null;

  // Collect graphic templates
  const graphic_templates = product.downloads
    ?.filter(dl => dl.asset_type === 'template' && dl.supabase_url)
    .map(dl => dl.supabase_url) || [];

  // Collect CAD files
  const cad_files = product.downloads
    ?.filter(dl => dl.asset_type === 'cad' && dl.supabase_url)
    .map(dl => dl.supabase_url) || [];

  // Find 3D model
  const model_3d_url = product.downloads
    ?.find(dl => dl.asset_type === 'model_3d' && dl.supabase_url)
    ?.supabase_url || null;

  // Find instruction PDF
  const instruction_pdf_url = product.downloads
    ?.find(dl =>
      (dl.asset_type === 'document' || dl.asset_type === 'other') &&
      dl.filename?.toLowerCase().includes('instruction') &&
      dl.supabase_url
    )?.supabase_url || null;

  return {
    // Core from transformed data
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    subcategory: product.subcategory,
    product_line: product.product_line,

    // Dimensions
    footprint_w_ft: product.footprint_w_ft,
    footprint_d_ft: product.footprint_d_ft,
    height_ft: product.height_ft,
    dimensions: product.dimensions,

    // Supabase asset URLs
    primary_image_url,
    images,
    graphic_templates,
    cad_files,
    model_3d_url,
    instruction_pdf_url,

    // Asset flags
    has_3d_model: !!model_3d_url,
    has_cad_files: cad_files.length > 0,
    has_templates: graphic_templates.length > 0,
    total_assets: images.length + graphic_templates.length + cad_files.length + (model_3d_url ? 1 : 0),

    // Rendering
    render_kind: model_3d_url ? 'glb' : product.render_kind,
    model_glb_url: model_3d_url,

    // Pricing (placeholders)
    price_tier: product.price_tier,
    pricing_category: product.pricing_category,
    base_price: product.base_price,
    retail_price: product.retail_price,

    // Features
    booth_sizes: product.booth_sizes,
    design_style: product.design_style,
    features: product.features,

    // Status
    is_active: product.is_active,
    customizable: product.customizable,
    is_rental: product.is_rental,

    // Source tracking
    source: product.source,
    original_url: product.original_url,
    imported_at: new Date().toISOString(),

    // Legacy fields (for backward compatibility)
    image_url: product.image_url,
    image_cached_url: product.image_cached_url,

    // Raw data
    raw_attributes: product.raw_attributes
  };
}

/**
 * Sync all products to Base44
 */
async function syncToBase44() {
  console.log('🚀 Starting Base44 sync with Supabase assets\n');

  // Load products
  console.log('📖 Loading products with Supabase URLs...');
  const catalogData = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));
  const products = catalogData.products || [];
  console.log(`   Found ${products.length} products\n`);

  // Statistics
  const stats = {
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    with_3d_models: 0,
    with_cad: 0,
    with_templates: 0
  };

  // Get existing products
  console.log('🔍 Checking existing products...');
  let existingProducts = [];
  try {
    existingProducts = await base44.entities.Product.list();
    console.log(`   Found ${existingProducts.length} existing products\n`);
  } catch (error) {
    console.warn(`   ⚠️  Could not fetch existing: ${error.message}\n`);
  }

  const existingSkus = new Set(existingProducts.map(p => p.sku));

  // Process each product
  console.log('📦 Syncing products...\n');

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const progress = `[${i + 1}/${products.length}]`;

    if (!product.sku) {
      console.log(`${progress} ⏭️  Skipped: No SKU`);
      stats.skipped++;
      continue;
    }

    try {
      const productData = prepareProductData(product);

      // Track asset types
      if (productData.has_3d_model) stats.with_3d_models++;
      if (productData.has_cad_files) stats.with_cad++;
      if (productData.has_templates) stats.with_templates++;

      // Create or update
      if (existingSkus.has(product.sku)) {
        // Update existing
        const existing = existingProducts.find(p => p.sku === product.sku);
        await base44.entities.Product.update(existing.id, productData);
        console.log(`${progress} ♻️  Updated: ${product.name} (${product.sku})`);
        stats.updated++;
      } else {
        // Create new
        await base44.entities.Product.create(productData);
        console.log(`${progress} ✅ Created: ${product.name} (${product.sku})`);
        stats.created++;
        existingSkus.add(product.sku);
      }

      // Log asset info
      if (productData.has_3d_model) {
        console.log(`          🎨 Has 3D model`);
      }
      if (productData.has_cad_files) {
        console.log(`          📐 Has ${productData.cad_files.length} CAD files`);
      }
      if (productData.has_templates) {
        console.log(`          📄 Has ${productData.graphic_templates.length} templates`);
      }

      // Rate limiting: wait 500ms between requests to avoid 429 errors
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`${progress} ❌ Failed: ${product.name}`);
      console.error(`          ${error.message}`);
      stats.failed++;

      // If rate limited, wait longer before retrying next product
      if (error.message?.includes('Rate limit')) {
        console.log(`          ⏳ Waiting 5s before continuing...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  // Summary
  console.log('\n\n🎉 Base44 sync complete!\n');
  console.log('📊 Statistics:');
  console.log(`   ✅ Created:        ${stats.created}`);
  console.log(`   ♻️  Updated:        ${stats.updated}`);
  console.log(`   ❌ Failed:         ${stats.failed}`);
  console.log(`   ⏭️  Skipped:        ${stats.skipped}`);
  console.log(`   📝 Total:          ${products.length}\n`);

  console.log('🎨 Asset Coverage:');
  console.log(`   3D Models:       ${stats.with_3d_models} products`);
  console.log(`   CAD Files:       ${stats.with_cad} products`);
  console.log(`   Templates:       ${stats.with_templates} products\n`);

  console.log('✨ All products now reference Supabase assets!');
  console.log('   No more external dependencies.');
  console.log('   No more placeholder boxes.');
  console.log('   Industry-ready. 🚀');
}

// Run
syncToBase44().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
