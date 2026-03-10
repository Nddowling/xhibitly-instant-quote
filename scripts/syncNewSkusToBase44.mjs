/**
 * Sync newly discovered SKUs to Base44
 *
 * Creates Product stubs in Base44 for SKUs found in the catalog scan
 * that don't yet have full product entries in products.json.
 *
 * Usage: node scripts/syncNewSkusToBase44.mjs
 */

import { readFileSync } from 'fs';
import { createClient } from '@base44/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const base44 = createClient({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false
});

const SUPABASE_BASE = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';
const CATALOG_PAGE_OFFSET = 2;

// Load mapping (print page numbers)
const mapping = JSON.parse(readFileSync('orbus_catalog/product_catalog_page_mapping.json', 'utf-8'));
const scanLog = JSON.parse(readFileSync('orbus_catalog/catalog_scan_log.json', 'utf-8'));

// Load existing products
const productsRaw = JSON.parse(readFileSync('orbus_catalog/products.json', 'utf-8'));
const products = productsRaw.products || productsRaw;
const existingSkus = new Set(Array.isArray(products) ? products.map(p => p.sku).filter(Boolean) : []);

// Build name lookup from scan log
const skuNames = {};
const skuCategories = {};
for (const [printPage, entry] of Object.entries(scanLog)) {
  if (entry.skus && entry.skus.length > 0) {
    for (const { sku, name } of entry.skus) {
      if (sku && !skuNames[sku]) {
        skuNames[sku] = name;
      }
    }
  }
}

// Get category from mapping
for (const p of mapping.product_page_mapping) {
  if (p.product_sku) skuCategories[p.product_sku] = p.category || 'Trade Show Displays';
}

// Find SKUs in mapping but not in products.json
const newSkuEntries = mapping.product_page_mapping
  .filter(p => p.product_sku && !existingSkus.has(p.product_sku))
  .reduce((acc, p) => {
    if (!acc.find(x => x.sku === p.product_sku)) acc.push(p);
    return acc;
  }, []);

console.log(`\nSyncing ${newSkuEntries.length} new SKUs to Base44...\n`);

// Fetch existing Base44 products to avoid duplicates
let existingBase44Skus = new Set();
try {
  const existing = await base44.entities.Product.list({ limit: 1000 });
  existingBase44Skus = new Set((existing || []).map(p => p.sku).filter(Boolean));
  console.log(`Found ${existingBase44Skus.size} existing products in Base44\n`);
} catch (e) {
  console.log('Could not fetch existing Base44 products:', e.message);
}

let created = 0, skipped = 0, failed = 0;

for (const entry of newSkuEntries) {
  const sku = entry.product_sku;
  const printPage = entry.primary_page;
  const pdfPage = printPage + CATALOG_PAGE_OFFSET;

  if (existingBase44Skus.has(sku)) {
    skipped++;
    continue;
  }

  const name = entry.product_name || skuNames[sku] || sku;
  const category = skuCategories[sku] || entry.category || 'Trade Show Displays';
  const catalogPageImageUrl = `${SUPABASE_BASE}/catalog/pages/page-${String(pdfPage).padStart(3, '0')}.jpg`;

  try {
    await base44.entities.Product.create({
      sku,
      name,
      category,
      catalog_page: printPage,
      primary_image_url: catalogPageImageUrl,
      images: [catalogPageImageUrl],
      is_active: true,
      source: 'catalog-scan-2026',
      imported_at: new Date().toISOString(),
    });
    process.stdout.write(`  ✅ ${sku} — ${name.slice(0, 50)}\n`);
    created++;
  } catch (e) {
    process.stdout.write(`  ❌ ${sku}: ${e.message?.slice(0, 80)}\n`);
    failed++;
  }

  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 100));
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Created: ${created}`);
console.log(`  Skipped (already in Base44): ${skipped}`);
console.log(`  Failed:  ${failed}`);
console.log(`${'═'.repeat(50)}\n`);
