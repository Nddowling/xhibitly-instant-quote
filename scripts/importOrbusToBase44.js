#!/usr/bin/env node

/**
 * Import Orbus Catalog to Base44
 *
 * Reads the transformed Orbus catalog (from transformOrbusToSchema.js) and
 * imports it into Base44's Product entity.
 *
 * Usage:
 *   1. Run: node scripts/transformOrbusToSchema.js (if not already done)
 *   2. Run: node scripts/importOrbusToBase44.js
 */

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@base44/sdk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Base44 client
const base44 = createClient({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  functionsVersion: process.env.VITE_BASE44_FUNCTIONS_VERSION || 'latest',
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false
});

const CATALOG_PATH = './orbus_catalog/products_transformed.json';

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff for rate limits
 */
async function retryWithBackoff(fn, maxRetries = 5, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.message?.includes('Rate limit') || error.message?.includes('429');

      if (!isRateLimit || i === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = baseDelay * Math.pow(2, i);
      console.log(`   ⏳ Rate limited. Waiting ${delay / 1000}s before retry ${i + 1}/${maxRetries}...`);
      await sleep(delay);
    }
  }
}

/**
 * Prepare product for Base44 import
 * (Data is already transformed to schema, just need to pass through)
 */
function prepareProduct(product) {
  // The product is already in the correct schema format from transformOrbusToSchema.js
  // Just return it as-is, the transformation script handled all the normalization
  return product;
}

/**
 * Import products to Base44
 */
async function importCatalog() {
  console.log('🚀 Starting Orbus catalog import to Base44...\n');

  // Check if catalog file exists
  if (!existsSync(CATALOG_PATH)) {
    console.error(`❌ Catalog file not found: ${CATALOG_PATH}`);
    console.error('   Run the transformation script first: node scripts/transformOrbusToSchema.js');
    process.exit(1);
  }

  // Load catalog
  console.log(`📖 Loading catalog from ${CATALOG_PATH}...`);
  const catalogData = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  const products = catalogData.products || [];

  console.log(`   Found ${products.length} products`);
  console.log(`   Source: ${catalogData.metadata.source}`);
  console.log(`   Transformed: ${catalogData.metadata.transformed_at}\n`);

  // Statistics
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  const categoryCounts = {};
  const skuDuplicates = new Set();
  const existingSkus = new Set();

  // Check for existing products
  console.log('🔍 Checking for existing products in Base44...');
  try {
    const existing = await base44.entities.Product.list();
    for (const product of existing) {
      if (product.sku) {
        existingSkus.add(product.sku);
      }
    }
    console.log(`   Found ${existingSkus.size} existing products\n`);
  } catch (error) {
    console.warn(`   ⚠️  Could not check existing products: ${error.message}\n`);
  }

  // Process each product
  console.log('📦 Processing products with rate limiting...\n');
  console.log('⏱️  250ms delay between requests to avoid rate limits\n');

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const progress = `[${i + 1}/${products.length}]`;

    try {
      // Skip products without names
      if (!product.name || product.name.length < 2) {
        console.log(`${progress} ⏭️  Skipped: No name`);
        skippedCount++;
        continue;
      }

      // Skip already imported (check local set first)
      if (product.sku && existingSkus.has(product.sku)) {
        console.log(`${progress} ⏭️  Skipped: ${product.name} (SKU ${product.sku} already imported)`);
        skuDuplicates.add(product.sku);
        skippedCount++;
        continue;
      }

      // Prepare product data (already in correct schema format)
      const productData = prepareProduct(product);

      // Create in Base44 with retry logic for rate limits
      await retryWithBackoff(async () => {
        await base44.entities.Product.create(productData);
      });

      // Track category
      if (productData.category) {
        categoryCounts[productData.category] = (categoryCounts[productData.category] || 0) + 1;
      }

      // Add to existing SKUs to prevent duplicates within this run
      if (productData.sku) {
        existingSkus.add(productData.sku);
      }

      console.log(`${progress} ✅ ${productData.name} ${productData.sku ? `(${productData.sku})` : ''}`);
      successCount++;

      // Rate limiting: wait 250ms between requests
      await sleep(250);

    } catch (error) {
      console.error(`${progress} ❌ Failed: ${product.name || 'Unknown'}`);
      console.error(`          ${error.message}`);
      errorCount++;

      // Brief pause after error before continuing
      await sleep(500);
    }
  }

  // Summary
  console.log('\n\n🎉 Import complete!\n');
  console.log('📊 Statistics:');
  console.log(`   ✅ Imported:  ${successCount}`);
  console.log(`   ⏭️  Skipped:   ${skippedCount}`);
  console.log(`   ❌ Errors:    ${errorCount}`);
  console.log(`   📝 Total:     ${products.length}\n`);

  if (Object.keys(categoryCounts).length > 0) {
    console.log('📂 Products by Category:');
    const sorted = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    for (const [category, count] of sorted) {
      console.log(`   ${category.padEnd(40)} ${count}`);
    }
    console.log();
  }

  if (skuDuplicates.size > 0) {
    console.log(`⚠️  ${skuDuplicates.size} duplicate SKUs were skipped`);
  }
}

// Run the import
importCatalog().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
