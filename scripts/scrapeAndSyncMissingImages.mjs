/**
 * scrapeAndSyncMissingImages.mjs
 *
 * For catalog SKUs that still have no verified Supabase image:
 *   1. Finds matching image ZIPs on s3cdn.theexhibitorshandbook.com
 *      (same CDN used by orbus.com/downloads/downloadable-resources)
 *   2. Downloads and extracts the best product photo from each ZIP
 *   3. Uploads to Supabase: products/{SKU}/image/{filename}
 *   4. Updates Base44 Product entity with Supabase URL
 *   5. Appends new entries to src/data/skuImageMap.js
 *
 * Usage:
 *   node scripts/scrapeAndSyncMissingImages.mjs             # full run
 *   node scripts/scrapeAndSyncMissingImages.mjs --dry-run   # audit only
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream } from 'fs';
import { unlink, readdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join, extname, basename } from 'path';
import { createClient as supabaseClient } from '@supabase/supabase-js';
import { createClient as createBase44 } from '@base44/sdk';
import AdmZip from 'adm-zip';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, '.env') });
dotenv.config({ path: join(ROOT, '.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase = supabaseClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const base44 = createBase44({
  appId:      process.env.BASE44_APP_ID   || process.env.VITE_BASE44_APP_ID,
  token:      process.env.BASE44_API_KEY  || process.env.VITE_BASE44_API_KEY,
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl:  process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false,
});

const BUCKET       = 'orbus-assets';
const SUPABASE_PUB = process.env.VITE_SUPABASE_URL;
const MAP_FILE     = join(ROOT, 'src/data/skuImageMap.js');
const TMP_DIR      = join(ROOT, 'orbus_catalog/downloads/_zip_tmp');

// ── Load data ─────────────────────────────────────────────────────────────────
const report = JSON.parse(readFileSync(join(ROOT, 'catalog-sync-report.json'), 'utf8'));
const resources = JSON.parse(readFileSync(join(ROOT, 'orbus_catalog/downloadable_resources.json'), 'utf8'));

// ── Identify target SKUs ──────────────────────────────────────────────────────
const BAD_PATTERNS = ['exhb-catalog-cover', 'carry_bag', 'recycled', 'rental_product',
                      'lifetime_warranty', 'graphics_1_year', 'feature-icon'];
function isBad(url) {
  if (!url) return true;
  const l = url.toLowerCase();
  return BAD_PATTERNS.some(p => l.includes(p));
}

const targetSkus = new Set(
  Object.entries(report.skus)
    .filter(([, s]) => {
      const goodSupa  = s.supabase_primary_image && !isBad(s.supabase_primary_image);
      const goodB44   = s.base44_image_url && s.base44_image_url.includes('supabase.co') && !isBad(s.base44_image_url);
      return !goodSupa && !goodB44;
    })
    .map(([sku]) => sku)
);

// ── Build ZIP → SKU map from downloadable_resources.json ─────────────────────
const imageZips = resources.files.filter(f =>
  f.file_type === 'archive' && f.url.includes('/images/')
);

const zipBySku = {};
for (const f of imageZips) {
  const fn = f.url.split('/').pop();
  if (fn.startsWith('img_')) {
    const sku = fn.replace(/^img_/, '').replace(/\.zip$/i, '').toUpperCase();
    zipBySku[sku] = f.url;
  }
}

// Match target SKUs to ZIPs
const workItems = [];
for (const sku of targetSkus) {
  if (zipBySku[sku]) {
    workItems.push({ sku, zipUrl: zipBySku[sku] });
  }
}

// ── Image quality scorer (pick best photo from ZIP) ───────────────────────────
const JUNK_PATTERNS = ['carry_bag', 'recycled', 'rental', 'warranty', 'instruction',
                       'guide', 'feature', 'icon', 'logo', 'silhouette'];
function imageScore(filename) {
  const f = filename.toLowerCase();
  if (JUNK_PATTERNS.some(p => f.includes(p))) return 99;
  if (/_left[_-]1[._]/.test(f) || f.includes('_left_1.')) return 0;
  if (/_left[_-]2/.test(f)) return 1;
  if (/_left/.test(f)) return 2;
  if (/_front[_-]1/.test(f)) return 3;
  if (/_front/.test(f)) return 4;
  if (/_full[_-]graphic/.test(f)) return 5;
  if (/_right_1/.test(f)) return 6;
  if (/_right/.test(f)) return 7;
  return 20;
}

function pickBestFromZip(zip) {
  const entries = zip.getEntries()
    .filter(e => !e.isDirectory && /\.(png|jpg|jpeg)$/i.test(e.entryName))
    .sort((a, b) => imageScore(a.entryName) - imageScore(b.entryName));
  return entries[0] || null;
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(62)}`);
console.log(`  SCRAPE & SYNC MISSING IMAGES`);
console.log(`  Source: s3cdn.theexhibitorshandbook.com (Orbus CDN)`);
console.log(`  Mode:   ${DRY_RUN ? '🟡 DRY RUN' : '🔴 LIVE'}`);
console.log(`${'═'.repeat(62)}`);
console.log(`  Target SKUs with no verified image: ${targetSkus.size}`);
console.log(`  Matched to downloadable ZIPs:       ${workItems.length}`);
console.log(`  No ZIP match (will stay unmapped):  ${targetSkus.size - workItems.length}`);
console.log('');

if (workItems.length === 0) {
  console.log('  Nothing to do.\n');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('  Sample work items:');
  for (const { sku, zipUrl } of workItems.slice(0, 15)) {
    console.log(`    ${sku} → ${zipUrl.split('/').pop()}`);
  }
  console.log(`\n  Run without --dry-run to process all ${workItems.length} ZIPs.\n`);
  process.exit(0);
}

// ── Process ZIPs ──────────────────────────────────────────────────────────────
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

let uploaded   = 0;
let b44Updated = 0;
let b44Created = 0;
let failed     = 0;
const synced   = {}; // sku → supabase public URL

console.log(`Processing ${workItems.length} ZIPs...\n`);

for (let i = 0; i < workItems.length; i++) {
  const { sku, zipUrl } = workItems[i];
  const skuStatus = report.skus[sku];
  process.stdout.write(`[${i + 1}/${workItems.length}] ${sku}... `);

  // 1. Download ZIP
  let zipBuffer;
  try {
    const res = await fetch(zipUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; catalog-sync/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    zipBuffer = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    process.stdout.write(`❌ Download: ${e.message}\n`);
    failed++;
    continue;
  }

  // 2. Extract best image
  let bestEntry;
  try {
    const zip = new AdmZip(zipBuffer);
    bestEntry = pickBestFromZip(zip);
    if (!bestEntry) throw new Error('no image in ZIP');

    // Get image buffer from zip entry
    const imgBuffer = zip.readFile(bestEntry);
    const filename  = basename(bestEntry.entryName);
    const storagePath = `products/${sku}/image/${filename}`;
    const publicUrl   = `${SUPABASE_PUB}/storage/v1/object/public/${BUCKET}/${storagePath}`;

    // 3. Upload to Supabase
    const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, imgBuffer, { contentType, upsert: true });

    if (uploadErr) throw new Error(`Supabase: ${uploadErr.message}`);
    synced[sku] = publicUrl;
    uploaded++;

    // 4. Update Base44
    let b44Attempts = 0;
    let b44Success  = false;
    while (b44Attempts < 3 && !b44Success) {
      try {
        if (skuStatus?.base44_id) {
          await base44.entities.Product.update(skuStatus.base44_id, {
            primary_image_url: publicUrl,
            image_url: publicUrl,
          });
          b44Updated++;
        } else {
          await base44.entities.Product.create({
            sku,
            name: skuStatus?.name || sku,
            primary_image_url: publicUrl,
            image_url: publicUrl,
          });
          b44Created++;
        }
        b44Success = true;
      } catch (e) {
        b44Attempts++;
        if (b44Attempts < 3 && e.message?.includes('Rate limit')) {
          await new Promise(r => setTimeout(r, 2000 * b44Attempts));
        } else {
          throw e;
        }
      }
    }

    process.stdout.write(`✅ ${filename}\n`);
  } catch (e) {
    process.stdout.write(`❌ ${e.message}\n`);
    failed++;
  }

  await new Promise(r => setTimeout(r, 250)); // polite rate limit
}

// ── Update skuImageMap.js ─────────────────────────────────────────────────────
console.log('\nUpdating src/data/skuImageMap.js...');
const mapContent = readFileSync(MAP_FILE, 'utf8');
const entries = {};
for (const m of mapContent.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) entries[m[1]] = m[2];

let mapAdded = 0;
for (const [sku, url] of Object.entries(synced)) {
  if (!entries[sku] || !entries[sku].includes('supabase.co')) {
    entries[sku] = url;
    mapAdded++;
  }
}

if (mapAdded > 0) {
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
  const total  = Object.keys(sorted).length;
  let out = `// Auto-generated — Orbus CDN + Supabase bucket\n`;
  out += `// ${total} product SKUs mapped to their primary product image URL\n`;
  out += `export const SKU_TO_IMAGE = {\n`;
  for (const [k, v] of Object.entries(sorted)) out += `  "${k}": "${v}",\n`;
  out += `};\n`;
  writeFileSync(MAP_FILE, out);
  console.log(`  ${mapAdded} entries added/updated → ${total} total`);
}

// ── Final summary ─────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(62)}`);
console.log(`  DONE`);
console.log(`  ZIPs processed:        ${workItems.length}`);
console.log(`  Images uploaded:       ${uploaded}`);
console.log(`  Base44 updated:        ${b44Updated}`);
console.log(`  Base44 created:        ${b44Created}`);
console.log(`  Failed:                ${failed}`);
console.log(`  skuImageMap entries:   +${mapAdded}`);
const remaining = targetSkus.size - uploaded;
if (remaining > 0) {
  console.log(`\n  ${remaining} SKUs still have no image (no ZIP found on CDN)`);
}
console.log(`${'═'.repeat(62)}\n`);
