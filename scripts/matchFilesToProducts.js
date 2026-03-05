#!/usr/bin/env node

/**
 * Match Downloadable Files to Products
 *
 * Takes the 5,539 files from downloadable_resources.json and matches them
 * to products in products.json based on SKU patterns and filenames.
 *
 * Updates products.json with additional downloads for each product.
 *
 * Usage: node scripts/matchFilesToProducts.js
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESOURCES_FILE = path.join(__dirname, '../orbus_catalog/downloadable_resources.json');
const PRODUCTS_FILE = path.join(__dirname, '../orbus_catalog/products.json');
const OUTPUT_FILE = path.join(__dirname, '../orbus_catalog/products_with_all_files.json');

/**
 * Extract product identifier from filename
 */
function extractProductId(filename, url) {
  // Remove file extension
  const base = filename.replace(/\.(pdf|zip|ai|eps|png|jpg|jpeg)$/i, '');

  // Common patterns:
  // GT_Advance_banner.pdf → "advance"
  // GT_Barracuda600_banner.pdf → "barracuda 600"
  // IS_Barracuda.pdf → "barracuda"
  // img_adv-800-s.zip → "adv 800 s"
  // img_bcd-1200-s.zip → "bcd 1200 s"

  // Pattern 1: GT_ProductName_* or GT_ProductName
  let match = base.match(/^GT_([^_\.]+)(?:_|$)/i);
  if (match) {
    // Extract product name, handle numbers (Barracuda600 → barracuda 600)
    let name = match[1];
    // Insert space before numbers
    name = name.replace(/([a-z])(\d)/gi, '$1 $2');
    return name.toLowerCase();
  }

  // Pattern 2: IS_ProductName_* or IS_ProductName
  match = base.match(/^IS_([^_\.]+)(?:_|$)/i);
  if (match) {
    let name = match[1];
    name = name.replace(/([a-z])(\d)/gi, '$1 $2');
    return name.toLowerCase();
  }

  // Pattern 3: img_product-code
  match = base.match(/^img[_-]([a-z0-9-]+)/i);
  if (match) {
    // Convert dashes to spaces for better matching
    return match[1].toLowerCase().replace(/-/g, ' ');
  }

  // Pattern 4: Just the base filename (remove common prefixes/suffixes)
  let cleaned = base
    .replace(/^(GT|IS|img)[_-]/i, '')
    .replace(/[_-](banner|PREMIUMFABRIC|cassette|installation)$/i, '')
    .toLowerCase();

  if (cleaned.length >= 3) {
    // Insert space before numbers
    cleaned = cleaned.replace(/([a-z])(\d)/gi, '$1 $2');
    return cleaned;
  }

  // Pattern 5: From URL path (category name)
  const urlParts = url.split('/');
  if (urlParts.length > 2) {
    const lastPart = urlParts[urlParts.length - 2];
    if (lastPart && lastPart !== 'images' && lastPart !== 'graphictemplates' && lastPart !== 'instructionsheets') {
      return lastPart.toLowerCase().replace(/-/g, ' ');
    }
  }

  return null;
}

/**
 * Categorize file by URL and name
 */
function categorizeFile(url, filename) {
  const lowerUrl = url.toLowerCase();
  const lowerFilename = filename.toLowerCase();

  // CAD files (zip packages with DWG/DXF)
  if (lowerUrl.includes('/cad/') || lowerFilename.startsWith('cad_')) {
    return 'cad';
  }

  // Graphic templates
  if (lowerUrl.includes('/graphictemplates/') || lowerFilename.startsWith('gt_')) {
    return 'template';
  }

  // Instruction sheets
  if (lowerUrl.includes('/instructionsheets/') || lowerFilename.startsWith('is_')) {
    return 'instruction';
  }

  // Image packages (high-res zips)
  if ((lowerUrl.includes('/images/') && lowerFilename.includes('.zip')) || lowerFilename.startsWith('img_')) {
    return 'image_package';
  }

  // PDF documents
  if (lowerFilename.endsWith('.pdf')) {
    return 'document';
  }

  return 'other';
}

/**
 * Normalize string for fuzzy matching
 */
function normalize(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric
    .replace(/\s+/g, '');
}

/**
 * Check if strings are similar (fuzzy match)
 */
function isSimilar(str1, str2) {
  const norm1 = normalize(str1);
  const norm2 = normalize(str2);

  // Exact match
  if (norm1 === norm2) return true;

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check word overlap
  const words1 = str1.toLowerCase().split(/[\s-_]+/).filter(w => w.length > 2);
  const words2 = str2.toLowerCase().split(/[\s-_]+/).filter(w => w.length > 2);

  // If 2+ significant words match, consider similar
  const overlap = words1.filter(w => words2.includes(w));
  if (overlap.length >= 2) return true;

  return false;
}

/**
 * Match file to product (improved algorithm)
 */
function matchFileToProduct(file, products) {
  const filename = file.url.split('/').pop();
  const productId = extractProductId(filename, file.url);

  if (!productId) return null;

  // Strategy 1: Exact SKU/ID match
  let matches = products.filter(p => {
    const sku = (p.sku || '').toLowerCase();
    const name = (p.name || '').toLowerCase();

    // Direct SKU match
    if (sku && sku.includes(productId)) return true;

    // Product ID is in SKU (handle variations)
    const skuParts = sku.replace(/[^a-z0-9]/g, '');
    const idParts = productId.replace(/[^a-z0-9]/g, '');
    if (skuParts && skuParts.includes(idParts)) return true;

    return false;
  });

  if (matches.length > 0) return matches[0];

  // Strategy 2: Fuzzy name matching
  matches = products.filter(p => {
    const name = (p.name || '').toLowerCase();

    // Name similarity
    if (isSimilar(name, productId)) return true;

    // Product ID words in name
    const idWords = productId.split(/[-_]+/).filter(w => w.length > 2);
    const nameWords = name.split(/\s+/).filter(w => w.length > 2);
    const overlap = idWords.filter(w => nameWords.some(nw => nw.includes(w) || w.includes(nw)));

    if (overlap.length >= 1 && idWords.length <= 2) return true;
    if (overlap.length >= 2) return true;

    return false;
  });

  if (matches.length > 0) return matches[0];

  // Strategy 3: Partial SKU match (first part)
  const idParts = productId.split(/[-_]/);
  if (idParts.length > 1) {
    const firstPart = idParts[0];
    if (firstPart.length >= 3) {
      matches = products.filter(p => {
        const sku = (p.sku || '').toLowerCase();
        const name = (p.name || '').toLowerCase();

        // SKU starts with first part
        if (sku && sku.startsWith(firstPart)) return true;

        // Name contains first part as word
        const nameWords = name.split(/\s+/);
        if (nameWords.some(w => w.includes(firstPart))) return true;

        return false;
      });

      if (matches.length > 0) return matches[0];
    }
  }

  return null;
}

/**
 * Main matching logic
 */
async function matchFiles() {
  console.log('🔗 Starting file-to-product matching\n');

  // Load data
  console.log('📖 Loading files...');
  const resources = JSON.parse(readFileSync(RESOURCES_FILE, 'utf-8'));
  const files = resources.files || [];
  console.log(`   Found ${files.length} files\n`);

  console.log('📖 Loading products...');
  const catalogData = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));
  const products = catalogData.products || [];
  console.log(`   Found ${products.length} products\n`);

  // Statistics
  const stats = {
    total_files: files.length,
    matched: 0,
    unmatched: 0,
    by_category: {}
  };

  // Match files to products
  console.log('🔗 Matching files to products...\n');

  const unmatchedFiles = [];

  files.forEach((file, i) => {
    const filename = file.url.split('/').pop();
    const category = categorizeFile(file.url, filename);

    stats.by_category[category] = (stats.by_category[category] || 0) + 1;

    const product = matchFileToProduct(file, products);

    if (product) {
      stats.matched++;

      // Add file to product
      if (!product.additional_downloads) {
        product.additional_downloads = [];
      }

      product.additional_downloads.push({
        url: file.url,
        filename,
        asset_type: category,
        link_text: file.link_text || filename,
        downloaded: false
      });

      if ((i + 1) % 500 === 0) {
        console.log(`   Processed ${i + 1}/${files.length}...`);
      }
    } else {
      stats.unmatched++;
      unmatchedFiles.push({ filename, url: file.url });
    }
  });

  console.log('\n✅ Matching complete!\n');

  // Summary
  console.log('📊 Statistics:');
  console.log(`   Total files:     ${stats.total_files}`);
  console.log(`   Matched:         ${stats.matched} (${Math.round(stats.matched/stats.total_files*100)}%)`);
  console.log(`   Unmatched:       ${stats.unmatched} (${Math.round(stats.unmatched/stats.total_files*100)}%)\n`);

  console.log('📁 By Category:');
  Object.entries(stats.by_category)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`   ${cat.padEnd(20)} ${count}`);
    });

  // Count products with new files
  const productsWithFiles = products.filter(p => p.additional_downloads?.length > 0);
  console.log(`\n🎯 Products enriched: ${productsWithFiles.length}/${products.length}`);

  // Show sample enriched products
  console.log('\n📦 Sample enriched products:');
  productsWithFiles.slice(0, 5).forEach((p, i) => {
    console.log(`\n${i + 1}. ${p.name} (${p.sku})`);
    console.log(`   Added ${p.additional_downloads.length} files:`);
    p.additional_downloads.slice(0, 3).forEach(f => {
      console.log(`   - ${f.asset_type}: ${f.filename}`);
    });
  });

  // Save updated products
  console.log(`\n💾 Saving to ${OUTPUT_FILE}...`);
  catalogData.metadata.files_matched_at = new Date().toISOString();
  catalogData.metadata.total_downloadable_files = stats.matched;
  writeFileSync(OUTPUT_FILE, JSON.stringify(catalogData, null, 2));

  console.log('✅ Saved!\n');

  // Show unmatched samples
  if (unmatchedFiles.length > 0) {
    console.log('⚠️  Sample unmatched files (first 10):');
    unmatchedFiles.slice(0, 10).forEach(f => {
      console.log(`   ${f.filename}`);
    });
    console.log(`\n   These may be general resources not product-specific.`);
  }

  console.log('\n🎉 Complete!');
  console.log(`   Products with files: ${productsWithFiles.length}`);
  console.log(`   Average files per product: ${Math.round(stats.matched / productsWithFiles.length)}`);
}

matchFiles().catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
