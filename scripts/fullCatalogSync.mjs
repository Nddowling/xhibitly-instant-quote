/**
 * Full Catalog Sync + Audit
 *
 * 1. Lists every image file physically present in Supabase (orbus-assets bucket)
 * 2. Queries Base44 for all existing Product records
 * 3. Cross-references against product_catalog_page_mapping.json (927 SKUs)
 * 4. Creates/updates Product records in Base44 for every SKU that has real data
 * 5. Writes a detailed audit report to catalog-sync-report.json
 *
 * Usage:
 *   node scripts/fullCatalogSync.mjs            # dry run (read-only audit)
 *   node scripts/fullCatalogSync.mjs --sync     # write to Base44
 */

import { readFileSync, writeFileSync } from 'fs';
import { createClient as createBase44 } from '@base44/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const SYNC = process.argv.includes('--sync');

// ── Credentials ───────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const BUCKET = 'orbus-assets';

const base44 = createBase44({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false,
});

// ── Load local data ────────────────────────────────────────────────────────────
const catalogMapping = JSON.parse(readFileSync(path.join(__dirname, '../orbus_catalog/product_catalog_page_mapping.json'), 'utf8'));
const productsJson = JSON.parse(readFileSync(path.join(__dirname, '../orbus_catalog/products.json'), 'utf8'));

// Build a map of SKU → product record (from products.json)
const productsBySku = {};
for (const p of productsJson.products) {
  if (p.sku) productsBySku[p.sku] = p;
}

// Build catalog mapping lookup
const catalogBySku = {};
for (const entry of catalogMapping.product_page_mapping) {
  if (entry.product_sku) catalogBySku[entry.product_sku] = entry;
}
const allCatalogSkus = Object.keys(catalogBySku);

console.log(`\n${'═'.repeat(60)}`);
console.log(`  FULL CATALOG SYNC & AUDIT`);
console.log(`  Mode: ${SYNC ? '🔴 LIVE SYNC (writing to Base44)' : '🟡 DRY RUN (read-only)'}`);
console.log(`${'═'.repeat(60)}`);
console.log(`  Catalog SKUs:        ${allCatalogSkus.length}`);
console.log(`  products.json SKUs:  ${Object.keys(productsBySku).length}`);
console.log('');

// ── Step 1: List all files in Supabase ────────────────────────────────────────
console.log('Step 1: Listing Supabase bucket contents...');

async function listSupabaseFolder(prefix) {
  const key = SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY;
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'apikey': key,
      },
      body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
    }
  );
  if (!res.ok) {
    console.error(`  Failed to list ${prefix}: ${res.status} ${res.statusText}`);
    return [];
  }
  return res.json();
}

// List top-level 'products/' folder to get all SKU folders
const topLevel = await listSupabaseFolder('products/');
const skuFolders = topLevel
  .filter(item => item.name && !item.metadata) // folders have no metadata
  .map(item => item.name);

console.log(`  Found ${skuFolders.length} SKU folders in Supabase`);

// Generic feature icon filenames to skip when picking primary image
const FEATURE_ICON_PATTERNS = [
  'carry_bag', 'recycled', 'rental_product', 'lifetime_warranty',
  'graphics_1_year', '1_year_warranty', 'made_in_usa', 'feature-icon',
  'shipping_dimensions',
];

function isFeatureIcon(filename) {
  const lower = filename.toLowerCase();
  return FEATURE_ICON_PATTERNS.some(p => lower.includes(p));
}

// Pick the best primary product photo from a list of image filenames
function pickPrimaryImage(_sku, images) {
  const productImages = images.filter(img => !isFeatureIcon(img.filename));
  if (productImages.length === 0) return images[0] || null;

  // Preferred patterns in order
  const preferred = [
    img => img.filename.match(/_left[_-]1/) || img.filename.match(/_left_1/),
    img => img.filename.match(/_front[_-]1/) || img.filename.match(/_front_1/),
    img => img.filename.match(/_1_1\.png$/i),
    img => img.filename.match(/-left-1_1\.png$/i),
    img => img.filename.match(/_full[_-]graphic/i),
    img => img.filename.match(/graphic.*left/i),
  ];

  for (const test of preferred) {
    const match = productImages.find(test);
    if (match) return match;
  }

  // Fallback: largest file (likely the best quality shot)
  return productImages.sort((a, b) => b.size - a.size)[0] || productImages[0];
}

// For each SKU folder, list its image/ subfolder
const supabaseImagesBySku = {};
let totalImages = 0;

for (const skuFolder of skuFolders) {
  const sku = skuFolder; // folder name IS the SKU
  const files = await listSupabaseFolder(`products/${sku}/image/`);
  const imageFiles = files.filter(f => f.metadata && f.name);
  supabaseImagesBySku[sku] = imageFiles.map(f => ({
    filename: f.name,
    url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/products/${sku}/image/${f.name}`,
    size: f.metadata?.size || 0,
  }));
  totalImages += imageFiles.length;
  await new Promise(r => setTimeout(r, 50)); // rate limit
}

console.log(`  Total product images in Supabase: ${totalImages} across ${Object.keys(supabaseImagesBySku).length} SKUs`);

// ── Step 2: Query all Base44 Product records ───────────────────────────────────
console.log('\nStep 2: Querying Base44 Product entity...');
let base44Products = [];
try {
  base44Products = await base44.entities.Product.list('sku', 2000) || [];
} catch (e) {
  console.error('  Failed to list products:', e.message);
}
const base44BySku = {};
for (const p of base44Products) {
  if (p.sku) base44BySku[p.sku] = p;
}
console.log(`  Found ${base44Products.length} Product records in Base44`);

// ── Step 3: Cross-reference ────────────────────────────────────────────────────
console.log('\nStep 3: Cross-referencing all 927 catalog SKUs...');

const report = {
  generated_at: new Date().toISOString(),
  totals: {},
  skus: {},
};

const groups = {
  fully_synced: [],       // Has Base44 record + Supabase image + catalog entry
  needs_create: [],       // In catalog + products.json, has Supabase image, but no Base44 record
  needs_update: [],       // Has Base44 record but image URL is wrong/missing
  no_supabase_image: [],  // In catalog, has products.json data, but no Supabase images
  orphaned_sku: [],       // In catalog only — no products.json data, no Supabase folder
  base44_not_in_catalog: [], // In Base44 but not in catalog mapping
};

for (const sku of allCatalogSkus) {
  const catalogEntry = catalogBySku[sku];
  const productData  = productsBySku[sku];
  const supabaseImgs = supabaseImagesBySku[sku] || [];
  const base44Record = base44BySku[sku];

  const primaryImage = pickPrimaryImage(sku, supabaseImgs);

  const status = {
    sku,
    name: productData?.name || catalogEntry?.product_name || null,
    category: productData?.category || catalogEntry?.category || null,
    primary_page: catalogEntry?.primary_page,
    has_base44_record: !!base44Record,
    base44_id: base44Record?.id || null,
    base44_image_url: base44Record?.primary_image_url || base44Record?.image_url || null,
    has_supabase_folder: !!supabaseImagesBySku[sku],
    supabase_image_count: supabaseImgs.length,
    supabase_primary_image: primaryImage?.url || null,
    has_product_json_data: !!productData,
    price: productData?.price || base44Record?.base_price || null,
    issues: [],
  };

  // Flag issues
  if (!base44Record) status.issues.push('missing_base44_record');
  if (!primaryImage) status.issues.push('no_supabase_image');
  if (base44Record && !status.base44_image_url) status.issues.push('base44_record_missing_image_url');
  if (base44Record && primaryImage && status.base44_image_url !== primaryImage.url) {
    status.issues.push('base44_image_url_mismatch');
  }

  // Classify
  if (base44Record && primaryImage && status.base44_image_url === primaryImage.url) {
    groups.fully_synced.push(sku);
  } else if (!base44Record && productData && primaryImage) {
    groups.needs_create.push(sku);
  } else if (base44Record && (status.issues.includes('base44_record_missing_image_url') || status.issues.includes('base44_image_url_mismatch'))) {
    groups.needs_update.push(sku);
  } else if (!primaryImage && productData) {
    groups.no_supabase_image.push(sku);
  } else if (!productData && !primaryImage) {
    groups.orphaned_sku.push(sku);
  }

  report.skus[sku] = status;
}

// Check Base44 records not in catalog
for (const sku of Object.keys(base44BySku)) {
  if (!catalogBySku[sku]) {
    groups.base44_not_in_catalog.push(sku);
  }
}

report.totals = {
  catalog_skus: allCatalogSkus.length,
  base44_products: base44Products.length,
  supabase_sku_folders: Object.keys(supabaseImagesBySku).length,
  supabase_total_images: totalImages,
  fully_synced: groups.fully_synced.length,
  needs_create: groups.needs_create.length,
  needs_update: groups.needs_update.length,
  no_supabase_image: groups.no_supabase_image.length,
  orphaned_catalog_sku: groups.orphaned_sku.length,
  base44_not_in_catalog: groups.base44_not_in_catalog.length,
};
report.groups = groups;

// Print summary
console.log(`\n${'═'.repeat(60)}`);
console.log(`  AUDIT RESULTS`);
console.log(`${'═'.repeat(60)}`);
console.log(`  ✅ Fully synced (Base44 + Supabase image matches):  ${groups.fully_synced.length}`);
console.log(`  🔵 Needs create (has data + image, no Base44):       ${groups.needs_create.length}`);
console.log(`  🟡 Needs update (Base44 exists, image URL wrong):    ${groups.needs_update.length}`);
console.log(`  🟠 No Supabase image (products.json data exists):    ${groups.no_supabase_image.length}`);
console.log(`  🔴 Orphaned catalog SKU (no data anywhere):          ${groups.orphaned_sku.length}`);
console.log(`  ⚪ In Base44 but not in catalog mapping:             ${groups.base44_not_in_catalog.length}`);
console.log('');

// Sample orphaned SKUs by category
const orphanedByCategory = {};
for (const sku of groups.orphaned_sku) {
  const cat = catalogBySku[sku]?.category || 'Unknown';
  orphanedByCategory[cat] = (orphanedByCategory[cat] || 0) + 1;
}
if (Object.keys(orphanedByCategory).length > 0) {
  console.log('  Orphaned SKUs by category:');
  for (const [cat, count] of Object.entries(orphanedByCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat}: ${count}`);
  }
  console.log('');
}

// ── Step 4: Sync to Base44 (if --sync flag) ────────────────────────────────────
let created = 0, updated = 0, failed = 0;

if (SYNC) {
  console.log(`\nStep 4: Syncing ${groups.needs_create.length} new + ${groups.needs_update.length} updates to Base44...`);

  // Parse price from products.json price string (e.g. "In stockSKU^^HOP-CT-2^^")
  function parsePrice(priceStr) {
    if (!priceStr) return null;
    const match = priceStr.match(/\$?([\d,]+\.?\d*)/);
    if (match) return parseFloat(match[1].replace(',', ''));
    return null;
  }

  // Create missing records
  for (const sku of groups.needs_create) {
    const p = productsBySku[sku];
    const primaryImg = pickPrimaryImage(sku, supabaseImagesBySku[sku] || []);

    const record = {
      sku,
      name: p.name,
      category: p.category || p.subcategory || null,
      description: p.description || null,
      base_price: parsePrice(p.price),
      primary_image_url: primaryImg?.url || null,
      image_url: primaryImg?.url || null,
    };

    try {
      await base44.entities.Product.create(record);
      process.stdout.write(`  ✅ Created: ${sku}\n`);
      created++;
      report.skus[sku].synced_action = 'created';
    } catch (e) {
      process.stdout.write(`  ❌ Failed create ${sku}: ${e.message?.slice(0, 60)}\n`);
      failed++;
      report.skus[sku].sync_error = e.message;
    }
    await new Promise(r => setTimeout(r, 400));
  }

  // Update records with wrong/missing image URLs
  for (const sku of groups.needs_update) {
    const primaryImg = pickPrimaryImage(sku, supabaseImagesBySku[sku] || []);
    if (!primaryImg) continue;

    const base44Record = base44BySku[sku];
    let attempts = 0;
    let success = false;
    while (attempts < 3 && !success) {
      try {
        await base44.entities.Product.update(base44Record.id, {
          primary_image_url: primaryImg.url,
          image_url: primaryImg.url,
        });
        process.stdout.write(`  🔄 Updated image: ${sku}\n`);
        updated++;
        report.skus[sku].synced_action = 'updated_image';
        success = true;
      } catch (e) {
        attempts++;
        if (attempts < 3 && e.message?.includes('Rate limit')) {
          process.stdout.write(`  ⏳ Rate limited, retrying ${sku} (attempt ${attempts})...\n`);
          await new Promise(r => setTimeout(r, 2000 * attempts));
        } else {
          process.stdout.write(`  ❌ Failed update ${sku}: ${e.message?.slice(0, 60)}\n`);
          failed++;
          report.skus[sku].sync_error = e.message;
          break;
        }
      }
    }
    await new Promise(r => setTimeout(r, 400));
  }

  report.sync_results = { created, updated, failed };
  console.log(`\n  Sync complete — Created: ${created} | Updated: ${updated} | Failed: ${failed}`);
} else {
  console.log(`  Run with --sync to write ${groups.needs_create.length + groups.needs_update.length} records to Base44.`);
}

// ── Write report ───────────────────────────────────────────────────────────────
const reportPath = path.join(__dirname, '../catalog-sync-report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n  Full report written to: catalog-sync-report.json`);
console.log(`${'═'.repeat(60)}\n`);
