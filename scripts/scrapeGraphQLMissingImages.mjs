/**
 * scrapeGraphQLMissingImages.mjs
 *
 * Final pass for the ~265 catalog SKUs that have no image from any source.
 * Queries https://www.orbus.com/graphql (full product catalog), matches
 * those SKUs, downloads the best image, uploads to Supabase, updates Base44,
 * and appends to skuImageMap.js.
 *
 * Usage:
 *   node scripts/scrapeGraphQLMissingImages.mjs            # live run
 *   node scripts/scrapeGraphQLMissingImages.mjs --dry-run  # audit only
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename, extname } from 'path';
import { createClient as supabaseClient } from '@supabase/supabase-js';
import { createClient as createBase44 } from '@base44/sdk';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, '.env') });
dotenv.config({ path: join(ROOT, '.env.local') });

const DRY_RUN  = process.argv.includes('--dry-run');
const GQL_URL  = 'https://www.orbus.com/graphql';
const PAGE_SIZE = 200;
const BUCKET   = 'orbus-assets';
const SUPABASE_PUB = process.env.VITE_SUPABASE_URL;
const MAP_FILE = join(ROOT, 'src/data/skuImageMap.js');
const TMP_DIR  = join(ROOT, 'orbus_catalog/downloads/_gql_tmp');

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

// ── Load target SKUs ──────────────────────────────────────────────────────────
const missing = JSON.parse(readFileSync(join(ROOT, 'orbus_catalog/still_missing_skus.json'), 'utf8'));
const targetSkus = new Map(missing.map(m => [m.sku, m])); // sku → { sku, category, name }

console.log(`\n${'═'.repeat(62)}`);
console.log(`  GraphQL Image Scraper — Final Pass`);
console.log(`  Source: ${GQL_URL}`);
console.log(`  Mode:   ${DRY_RUN ? '🟡 DRY RUN' : '🔴 LIVE'}`);
console.log(`${'═'.repeat(62)}`);
console.log(`  Target SKUs: ${targetSkus.size}`);
console.log('');

// ── Image quality scorer ──────────────────────────────────────────────────────
const JUNK = ['warranty', 'instruction', 'guide', 'carry', 'bag', 'icon',
              'feature', 'logo', 'recycl', 'rental'];

function imageScore(url) {
  const f = url.toLowerCase().split('?')[0].split('/').pop();
  if (JUNK.some(j => f.includes(j))) return 99;
  if (/_left[_-]1[._]/.test(f) || f.includes('_left_1.')) return 0;
  if (/_left[_-]2/.test(f)) return 1;
  if (/_left/.test(f)) return 2;
  if (/_front[_-]1/.test(f)) return 3;
  if (/_front/.test(f)) return 4;
  if (/_full[_-]graphic/.test(f)) return 5;
  if (/-1_1\.png/.test(f)) return 6; // Supabase-style hero
  if (/_right_1/.test(f)) return 7;
  if (/_right/.test(f)) return 8;
  return 20;
}

function pickBestUrl(mediaGallery) {
  if (!mediaGallery?.length) return null;
  const imgs = mediaGallery
    .filter(m => m.url && /\.(png|jpg|jpeg|webp)/i.test(m.url.split('?')[0]))
    .sort((a, b) => imageScore(a.url) - imageScore(b.url));
  return imgs[0]?.url?.split('?')[0] || null; // strip resize query params
}

// ── Crawl orbus.com GraphQL ───────────────────────────────────────────────────
console.log('Step 1: Crawling orbus.com/graphql...');

const found = {}; // sku → { name, imageUrl }
let page = 1, totalPages = 1, totalScanned = 0;

while (page <= totalPages) {
  process.stdout.write(`\r  Page ${page}/${totalPages} — scanned ${totalScanned}, matched ${Object.keys(found).length}...`);

  let data;
  try {
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        query: `{
          products(search: "", pageSize: ${PAGE_SIZE}, currentPage: ${page}) {
            total_count
            page_info { total_pages }
            items { sku name media_gallery { url label } }
          }
        }`
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    data = json?.data?.products;
  } catch (e) {
    console.error(`\n  Fetch error page ${page}: ${e.message}`);
    break;
  }

  if (!data) break;
  totalPages = data.page_info?.total_pages || 1;

  for (const item of (data.items || [])) {
    const sku = (item.sku || '').replace(/\^\^/g, '').trim();
    totalScanned++;
    if (!sku || !targetSkus.has(sku)) continue;
    const imgUrl = pickBestUrl(item.media_gallery);
    if (imgUrl) found[sku] = { name: item.name, imageUrl: imgUrl };
  }

  page++;
  await new Promise(r => setTimeout(r, 150));
}

const notFound = [...targetSkus.keys()].filter(s => !found[s]);
console.log(`\n  Scanned ${totalScanned} products`);
console.log(`  Matched: ${Object.keys(found).length} of ${targetSkus.size} targets`);
if (notFound.length) {
  console.log(`  Not found on GraphQL: ${notFound.length}`);
  console.log(`  (${notFound.slice(0, 6).join(', ')}${notFound.length > 6 ? '…' : ''})`);
}

if (Object.keys(found).length === 0) {
  console.log('\n  No matches — GraphQL may be down or SKUs may not exist on orbus.com.\n');
  process.exit(0);
}

if (DRY_RUN) {
  console.log('\n[DRY RUN] Would process:');
  for (const [sku, { name, imageUrl }] of Object.entries(found).slice(0, 20)) {
    console.log(`  ${sku}: ${imageUrl.split('/').pop()} — ${name}`);
  }
  console.log(`\n  Run without --dry-run to download + sync all ${Object.keys(found).length}.\n`);
  process.exit(0);
}

// ── Download → Supabase → Base44 ─────────────────────────────────────────────
console.log(`\nStep 2: Downloading + uploading ${Object.keys(found).length} images...`);
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

// Load Base44 Product records for the target SKUs so we have their IDs
console.log('  Fetching Base44 Product records...');
const b44Records = {}; // sku → { id, ... }
try {
  const allProducts = await base44.entities.Product.list('sku', 2000) || [];
  for (const p of allProducts) {
    if (p.sku && targetSkus.has(p.sku)) b44Records[p.sku] = p;
  }
  console.log(`  Found ${Object.keys(b44Records).length} existing Base44 records for target SKUs`);
} catch (e) {
  console.warn(`  Warning: could not pre-fetch Base44 records: ${e.message}`);
}

const synced  = {}; // sku → supabase URL
let uploaded  = 0, b44Updated = 0, b44Created = 0, dlFailed = 0;
const workList = Object.entries(found);

for (let i = 0; i < workList.length; i++) {
  const [sku, { name, imageUrl }] = workList[i];
  process.stdout.write(`[${i + 1}/${workList.length}] ${sku}... `);

  // Derive filename from URL
  const rawFilename = decodeURIComponent(basename(imageUrl.split('?')[0])) || `${sku}.png`;
  const filename    = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `products/${sku}/image/${filename}`;
  const publicUrl   = `${SUPABASE_PUB}/storage/v1/object/public/${BUCKET}/${storagePath}`;

  // Download
  let imgBuffer;
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; catalog-sync/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    imgBuffer = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    process.stdout.write(`❌ Download: ${e.message}\n`);
    dlFailed++;
    continue;
  }

  // Upload to Supabase
  const contentType = filename.match(/\.png$/i) ? 'image/png' : 'image/jpeg';
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, imgBuffer, { contentType, upsert: true });

  if (upErr) {
    process.stdout.write(`❌ Upload: ${upErr.message}\n`);
    dlFailed++;
    continue;
  }

  synced[sku] = publicUrl;
  uploaded++;

  // Update / create Base44 record
  const b44 = b44Records[sku];
  let attempts = 0, b44ok = false;
  while (attempts < 3 && !b44ok) {
    try {
      if (b44) {
        await base44.entities.Product.update(b44.id, {
          primary_image_url: publicUrl, image_url: publicUrl,
        });
        b44Updated++;
      } else {
        await base44.entities.Product.create({
          sku, name: name || sku,
          primary_image_url: publicUrl, image_url: publicUrl,
        });
        b44Created++;
      }
      b44ok = true;
    } catch (e) {
      attempts++;
      if (attempts < 3 && e.message?.includes('Rate limit')) {
        await new Promise(r => setTimeout(r, 2000 * attempts));
      } else {
        process.stdout.write(`⚠️  Base44 fail: ${e.message?.slice(0, 50)}\n`);
        break;
      }
    }
  }

  process.stdout.write(`✅ ${filename}\n`);
  await new Promise(r => setTimeout(r, 300));
}

// ── Update skuImageMap.js ─────────────────────────────────────────────────────
console.log('\nStep 3: Updating skuImageMap.js...');
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
  let out = `// Auto-generated — Orbus CDN + GraphQL + Supabase bucket\n`;
  out += `// ${total} product SKUs mapped to their primary product image URL\n`;
  out += `export const SKU_TO_IMAGE = {\n`;
  for (const [k, v] of Object.entries(sorted)) out += `  "${k}": "${v}",\n`;
  out += `};\n`;
  writeFileSync(MAP_FILE, out);
}

// ── Summary ───────────────────────────────────────────────────────────────────
const totalRemaining = notFound.length + (Object.keys(found).length - uploaded);
console.log(`\n${'═'.repeat(62)}`);
console.log(`  DONE`);
console.log(`  GraphQL matches:       ${Object.keys(found).length} / ${targetSkus.size}`);
console.log(`  Uploaded to Supabase:  ${uploaded}`);
console.log(`  Base44 updated:        ${b44Updated}`);
console.log(`  Base44 created:        ${b44Created}`);
console.log(`  Download/upload fails: ${dlFailed}`);
console.log(`  skuImageMap entries:   +${mapAdded} → ${Object.keys(entries).length} total`);
if (totalRemaining > 0) {
  console.log(`\n  ${totalRemaining} SKUs still have no image after all passes`);
  console.log(`  (These are likely unlisted/discontinued products)`);
}
console.log(`${'═'.repeat(62)}\n`);
