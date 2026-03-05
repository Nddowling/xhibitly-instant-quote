#!/usr/bin/env node

/**
 * Transform Orbus Catalog to Base44 Product Schema
 *
 * Converts the scraped orbus_catalog/products.json to the Product entity schema
 * with proper dimensional conversions and field mappings.
 *
 * Usage: node scripts/transformOrbusToSchema.js
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '../orbus_catalog/products.json');
const OUTPUT_FILE = path.join(__dirname, '../orbus_catalog/products_transformed.json');

/**
 * Parse dimensions from strings like "31.25\"W x 60\"H x 14.5\"D"
 * Returns dimensions in feet
 */
function parseDimensions(dimString) {
  if (!dimString) return null;

  const result = {
    width_ft: null,
    height_ft: null,
    depth_ft: null
  };

  // Normalize quotes (handle curly quotes, straight quotes, and primes)
  // \u201C = " \u201D = " \u2018 = ' \u2019 = '
  const normalized = dimString.replace(/[\u201C\u201D"]/g, '"').replace(/[\u2018\u2019']/g, "'");

  // Match patterns like: 31.25"W or 60"H or 14.5"D
  // Also handle space variations and case insensitivity
  const widthMatch = normalized.match(/(\d+\.?\d*)\s*["']?\s*W/i);
  const heightMatch = normalized.match(/(\d+\.?\d*)\s*["']?\s*H/i);
  const depthMatch = normalized.match(/(\d+\.?\d*)\s*["']?\s*D/i);

  if (widthMatch) {
    result.width_ft = parseFloat(widthMatch[1]) / 12; // Convert inches to feet
  }
  if (heightMatch) {
    result.height_ft = parseFloat(heightMatch[1]) / 12;
  }
  if (depthMatch) {
    result.depth_ft = parseFloat(depthMatch[1]) / 12;
  }

  return result;
}

/**
 * Extract booth sizes from product name/description
 */
function extractBoothSizes(product) {
  const boothSizes = [];
  const text = `${product.name} ${product.description}`.toLowerCase();

  // Common booth size patterns
  const sizePatterns = [
    /10\s*x\s*10/g,
    /10\s*x\s*20/g,
    /20\s*x\s*20/g,
    /10\s*x\s*30/g,
    /8\s*x\s*10/g,
    /tabletop/gi
  ];

  sizePatterns.forEach(pattern => {
    if (text.match(pattern)) {
      const match = text.match(pattern)[0].trim();
      if (!boothSizes.includes(match)) {
        boothSizes.push(match);
      }
    }
  });

  return boothSizes;
}

/**
 * Determine price tier based on category
 */
function determinePriceTier(product) {
  const category = product.category?.toLowerCase() || '';
  const name = product.name?.toLowerCase() || '';

  if (category.includes('modular') || name.includes('modular')) {
    return 'Modular';
  }
  if (category.includes('hybrid') || name.includes('hybrid')) {
    return 'Hybrid';
  }
  if (category.includes('custom') || name.includes('custom')) {
    return 'Custom';
  }

  return 'Modular'; // Default
}

/**
 * Determine pricing category
 */
function determinePricingCategory(product) {
  const name = product.name?.toLowerCase() || '';
  const category = product.category?.toLowerCase() || '';

  if (name.includes('backwall') || category.includes('backwall')) {
    return 'backwall';
  }
  if (name.includes('counter')) {
    return 'counter';
  }
  if (name.includes('hanging') || category.includes('hanging')) {
    return 'hanging_structure';
  }
  if (name.includes('banner') || name.includes('stand')) {
    return 'banner';
  }
  if (name.includes('kiosk')) {
    return 'kiosk';
  }
  if (name.includes('table')) {
    return 'table';
  }

  return 'display'; // Default
}

/**
 * Determine render kind based on product type
 */
function determineRenderKind(product) {
  const name = product.name?.toLowerCase() || '';

  if (name.includes('banner') && name.includes('stand')) {
    return 'billboard';
  }
  if (name.includes('counter') || name.includes('kiosk')) {
    return 'box';
  }

  return 'box'; // Default
}

/**
 * Extract design styles
 */
function extractDesignStyles(product) {
  const styles = [];
  const text = `${product.name} ${product.description} ${product.category}`.toLowerCase();

  const styleKeywords = {
    'modern': /modern/gi,
    'minimal': /minimal|minimalist/gi,
    'fabric': /fabric/gi,
    'modular': /modular/gi,
    'portable': /portable|collapsible/gi,
    'tension': /tension/gi,
    'backlit': /backlit|light/gi,
    'curved': /curved/gi,
  };

  Object.entries(styleKeywords).forEach(([style, pattern]) => {
    if (text.match(pattern)) {
      styles.push(style);
    }
  });

  return styles.length > 0 ? styles : ['modern'];
}

/**
 * Transform a single product to schema
 */
function transformProduct(product, index) {
  // Skip invalid products
  if (!product.sku || product.name?.includes('Whoops') || product.name?.includes('Contact Us')) {
    return null;
  }

  // Parse dimensions
  const assembledDim = product.raw_attributes?.['Assembled Dimensions'];
  const dimensions = parseDimensions(assembledDim);

  // Get primary image
  const primaryImage = product.images?.find(img => img.local_path) || product.images?.[0];

  // Determine product line from category/name
  const productLine = product.category || 'Portable Displays';

  return {
    // Core identification
    sku: product.sku,
    name: product.name,
    description: product.description || '',

    // Categorization
    category: product.category || 'Portable Displays',
    subcategory: product.subcategory || product.category,
    product_line: productLine,

    // Booth compatibility
    booth_sizes: extractBoothSizes(product),

    // Pricing (placeholders - need actual pricing data)
    price_tier: determinePriceTier(product),
    base_price: null,
    rental_price: null,
    market_value: null,
    dealer_cost: null,
    dealer_margin_percent: null,
    retail_price: null,
    pricing_category: determinePricingCategory(product),

    // Product info
    handbook_page: null,
    is_rental: false,

    // Dimensions (converted to feet)
    dimensions: assembledDim || '',
    footprint_w_ft: dimensions?.width_ft || null,
    footprint_d_ft: dimensions?.depth_ft || null,
    height_ft: dimensions?.height_ft || null,

    // Features
    features: product.features || [],

    // Media
    image_url: primaryImage?.url || '',
    image_cached_url: primaryImage?.local_path ? `/${primaryImage.local_path}` : null,
    template_urls: product.downloads
      ?.filter(d => d.asset_type === 'template')
      .map(d => d.url) || [],
    instruction_urls: product.downloads
      ?.filter(d => d.asset_type === 'other')
      .map(d => d.url) || [],

    // Customization
    customizable: true,
    design_style: extractDesignStyles(product),

    // Status
    is_active: true,

    // Catalog reference
    catalog_pages: [],

    // Source tracking
    source: 'theexhibitorshandbook.com',
    imported_at: new Date().toISOString(),
    product_id: product.sku,
    original_url: product.url,
    tier: product.price_tier || 'Standard',

    // Raw data
    raw_attributes: product.raw_attributes || {},

    // Rendering
    model_glb_url: null,
    model_url: null,
    render_kind: determineRenderKind(product),

    // Additional fields
    sizes: product.sizes || [],
    colors: product.colors || []
  };
}

/**
 * Main transformation
 */
async function main() {
  console.log('🔄 Starting Orbus catalog transformation...\n');

  // Load source data
  console.log('📖 Loading products.json...');
  const rawData = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'));
  const products = rawData.products || [];

  console.log(`✅ Loaded ${products.length} products\n`);

  // Transform products
  console.log('⚙️  Transforming products...');
  const transformed = [];
  let skipped = 0;

  for (let i = 0; i < products.length; i++) {
    const result = transformProduct(products[i], i);
    if (result) {
      transformed.push(result);
    } else {
      skipped++;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`   Processed ${i + 1}/${products.length}...`);
    }
  }

  console.log(`\n✅ Transformed ${transformed.length} products (skipped ${skipped})\n`);

  // Statistics
  const withDimensions = transformed.filter(p => p.footprint_w_ft && p.footprint_d_ft);
  const withImages = transformed.filter(p => p.image_url);
  const withSKUs = transformed.filter(p => p.sku);

  console.log('📊 Statistics:');
  console.log(`   Total products: ${transformed.length}`);
  console.log(`   With SKUs: ${withSKUs.length} (${Math.round(withSKUs.length/transformed.length*100)}%)`);
  console.log(`   With images: ${withImages.length} (${Math.round(withImages.length/transformed.length*100)}%)`);
  console.log(`   With dimensions: ${withDimensions.length} (${Math.round(withDimensions.length/transformed.length*100)}%)`);
  console.log('');

  // Save transformed data
  console.log(`💾 Saving to ${OUTPUT_FILE}...`);
  const output = {
    metadata: {
      source: 'theexhibitorshandbook.com',
      transformed_at: new Date().toISOString(),
      total_products: transformed.length,
      original_total: products.length,
      skipped: skipped,
      schema_version: '1.0'
    },
    products: transformed
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log('✅ Transformation complete!\n');
  console.log(`📄 Output file: ${OUTPUT_FILE}`);
  console.log(`📦 File size: ${(writeFileSync.length || 0)} bytes\n`);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
