#!/usr/bin/env node

/**
 * Resume Failed Imports
 *
 * Retries only the products that failed in the previous import run.
 * Use this after hitting rate limits to finish importing remaining products.
 *
 * Usage: node scripts/resumeImport.js
 */

import { readFileSync, existsSync } from 'fs';
import { createClient } from '@base44/sdk';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const base44 = createClient({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  functionsVersion: 'latest',
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false
});

const CATALOG_PATH = './orbus_catalog/products_transformed.json';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, maxRetries = 5, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimit = error.message?.includes('Rate limit') || error.message?.includes('429');

      if (!isRateLimit || i === maxRetries - 1) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, i);
      console.log(`   ⏳ Rate limited. Waiting ${delay / 1000}s before retry ${i + 1}/${maxRetries}...`);
      await sleep(delay);
    }
  }
}

async function resumeImport() {
  console.log('🔄 Resuming failed imports...\n');

  // Load catalog
  if (!existsSync(CATALOG_PATH)) {
    console.error(`❌ Catalog file not found: ${CATALOG_PATH}`);
    process.exit(1);
  }

  const catalogData = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'));
  const products = catalogData.products || [];

  // Get existing products from Base44
  console.log('🔍 Checking existing products...');
  const existing = await base44.entities.Product.list();
  const existingSkus = new Set(existing.map(p => p.sku).filter(Boolean));
  console.log(`   Found ${existingSkus.size} existing products\n`);

  // Find products that need importing
  const toImport = products.filter(p => p.sku && !existingSkus.has(p.sku) && p.name?.length > 2);

  console.log(`📦 Found ${toImport.length} products to import`);
  console.log(`   (${existingSkus.size} already imported, ${products.length - existingSkus.size - toImport.length} skipped)\n`);

  if (toImport.length === 0) {
    console.log('✅ All products already imported!');
    return;
  }

  // Import remaining products
  console.log('⏱️  Using 500ms delay (slower but safer)\n');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < toImport.length; i++) {
    const product = toImport[i];
    const progress = `[${i + 1}/${toImport.length}]`;

    try {
      await retryWithBackoff(async () => {
        await base44.entities.Product.create(product);
      });

      console.log(`${progress} ✅ ${product.name} (${product.sku})`);
      successCount++;

      // Slower rate limiting
      await sleep(500);

    } catch (error) {
      console.error(`${progress} ❌ Failed: ${product.name}`);
      console.error(`          ${error.message}`);
      errorCount++;

      // Longer pause after error
      await sleep(1000);
    }
  }

  console.log('\n\n🎉 Resume complete!\n');
  console.log('📊 Statistics:');
  console.log(`   ✅ Imported:  ${successCount}`);
  console.log(`   ❌ Failed:    ${errorCount}`);
  console.log(`   📝 Total:     ${toImport.length}`);
  console.log(`\n   Overall: ${existingSkus.size + successCount}/${products.length} products imported`);
}

resumeImport().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
