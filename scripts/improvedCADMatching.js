#!/usr/bin/env node

/**
 * Improved CAD File Matching
 *
 * Uses fuzzy matching to connect CAD files to products
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRODUCTS_FILE = path.join(__dirname, '../orbus_catalog/products_with_all_files.json');
const DOWNLOADS_FILE = path.join(__dirname, '../orbus_catalog/downloadable_resources.json');
const OUTPUT_FILE = path.join(__dirname, '../orbus_catalog/products_with_improved_cad.json');

// Load data
const productsData = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));
const downloadsData = JSON.parse(readFileSync(DOWNLOADS_FILE, 'utf-8'));

// Get CAD files
const cadFiles = downloadsData.files.filter(f => f.url.toLowerCase().includes('/cad/'));

console.log('🔍 Improved CAD Matching\n');
console.log(`Products: ${productsData.products.filter(p => p.sku).length}`);
console.log(`CAD files: ${cadFiles.length}\n`);

/**
 * Normalize SKU for matching
 */
function normalizeSKU(sku) {
  return sku
    .toUpperCase()
    .replace(/[_\s-]/g, '') // Remove separators
    .replace(/ESS/g, 'E')    // ESS → E
    .replace(/ESSENTIAL/g, 'E')
    .replace(/FRM/g, 'FRAME')
    .replace(/TL/g, '')      // Remove TL suffix
    .replace(/M$/g, '');     // Remove M suffix
}

/**
 * Extract SKU-like pattern from CAD filename
 */
function extractCADSKU(filename) {
  // Remove CAD_ prefix and .zip
  let name = filename
    .replace(/^CAD_/i, '')
    .replace(/^cad_/i, '')
    .replace('.zip', '');

  return normalizeSKU(name);
}

/**
 * Calculate similarity score between two strings
 */
function similarity(s1, s2) {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  // Count matching characters
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }

  return matches / longer.length;
}

/**
 * Find best product match for CAD file
 */
function findBestMatch(cadFile, products) {
  const cadSKU = extractCADSKU(cadFile.link_text);

  let bestMatch = null;
  let bestScore = 0;

  for (const product of products) {
    if (!product.sku) continue;

    const productSKU = normalizeSKU(product.sku);
    const score = similarity(cadSKU, productSKU);

    // Also check product name
    const nameScore = similarity(
      cadSKU,
      normalizeSKU(product.name || '')
    );

    const finalScore = Math.max(score, nameScore * 0.7);

    if (finalScore > bestScore && finalScore > 0.5) {
      bestScore = finalScore;
      bestMatch = product;
    }
  }

  return { product: bestMatch, score: bestScore };
}

// Match CAD files to products
let stats = {
  matched: 0,
  unmatched: 0,
  productsUpdated: 0
};

const matchedProducts = new Set();

for (const cadFile of cadFiles) {
  const { product, score } = findBestMatch(cadFile, productsData.products);

  if (product) {
    // Initialize additional_downloads if needed
    if (!product.additional_downloads) {
      product.additional_downloads = [];
    }

    // Add CAD file if not already present
    const exists = product.additional_downloads.some(d => d.url === cadFile.url);
    if (!exists) {
      product.additional_downloads.push({
        url: cadFile.url,
        filename: cadFile.link_text,
        asset_type: 'cad',
        downloaded: false,
        match_score: score
      });

      matchedProducts.add(product.sku);
    }

    stats.matched++;
  } else {
    stats.unmatched++;
    console.log(`❌ No match for: ${cadFile.link_text}`);
  }
}

stats.productsUpdated = matchedProducts.size;

// Save updated data
writeFileSync(OUTPUT_FILE, JSON.stringify(productsData, null, 2));

console.log('\n✅ Matching Complete!\n');
console.log('📊 Results:');
console.log(`   CAD files matched: ${stats.matched}`);
console.log(`   CAD files unmatched: ${stats.unmatched}`);
console.log(`   Products with CAD: ${stats.productsUpdated}`);
console.log(`   Match rate: ${((stats.matched / cadFiles.length) * 100).toFixed(1)}%`);
console.log(`\n💾 Saved to: ${OUTPUT_FILE}`);
