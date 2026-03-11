/**
 * scrapeOrbusImages.mjs
 *
 * Queries the orbus.com GraphQL API to enumerate all products and their images.
 * Finds SKUs not currently in skuImageMap.js and adds them.
 * Uses orbus.com CDN URLs directly for new entries (no upload needed).
 *
 * Run: node scripts/scrapeOrbusImages.mjs
 */

import { createReadStream, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MAP_FILE = join(ROOT, 'src/data/skuImageMap.js');

const GQL_URL = 'https://www.orbus.com/graphql';
const PAGE_SIZE = 100;

// ── Image priority scorer ────────────────────────────────────────────────────
function score(url) {
  const f = url.toLowerCase().split('?')[0].split('/').pop();
  if (/_left[_-]1[._]/.test(f) || /_left-1\./.test(f) || /_left_1\./.test(f)) return 0;
  if (/_left[_-]2/.test(f)) return 1;
  if (/_left/.test(f)) return 2;
  if (/_front[_-]1/.test(f) || /_front-1\./.test(f)) return 3;
  if (/_front/.test(f)) return 4;
  if (/_right_1/.test(f)) return 5;
  if (/_right/.test(f)) return 6;
  if (/hqdefault|youtube|warranty|instruction|manual|guide|bag|carry|case/.test(f)) return 99;
  return 20;
}

function bestImage(mediaGallery) {
  if (!mediaGallery?.length) return null;
  const sorted = [...mediaGallery]
    .filter(m => m.url && /\.(png|jpg|jpeg|webp)/i.test(m.url.split('?')[0]))
    .sort((a, b) => score(a.url) - score(b.url));
  if (!sorted.length) return null;
  // Return URL without quality resize params — gets raw PNG
  return sorted[0].url.split('?')[0];
}

// ── GraphQL query ────────────────────────────────────────────────────────────
async function fetchPage(currentPage) {
  // Must use search: "" — orbus.com GraphQL requires a search parameter
  // Removed sort to avoid conflicts with empty search
  const query = `{
    products(search: "", pageSize: ${PAGE_SIZE}, currentPage: ${currentPage}) {
      total_count
      page_info { total_pages }
      items {
        sku
        name
        media_gallery { url label }
      }
    }
  }`;

  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  return json?.data?.products;
}

// ── Load existing map ────────────────────────────────────────────────────────
function loadExistingMap() {
  const content = readFileSync(MAP_FILE, 'utf8');
  const map = {};
  for (const m of content.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

// ── Write updated map ────────────────────────────────────────────────────────
function writeMap(map) {
  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  const total = Object.keys(sorted).length;
  let out = `// Auto-generated — orbus.com GraphQL + Supabase bucket enumeration\n`;
  out += `// ${total} product SKUs mapped to their primary product image URL\n`;
  out += `// Priority: _left_1 hero shot > _left_2 > _front_1 > _front > _right\n`;
  out += `export const SKU_TO_IMAGE = {\n`;
  for (const [sku, url] of Object.entries(sorted)) {
    out += `  "${sku}": "${url}",\n`;
  }
  out += `};\n`;
  writeFileSync(MAP_FILE, out);
  return total;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Loading existing skuImageMap...');
  const existing = loadExistingMap();
  console.log(`  Existing entries: ${Object.keys(existing).length}`);

  console.log('\nQuerying orbus.com GraphQL API...');
  let currentPage = 1;
  let totalPages = 1;
  let totalProducts = 0;
  const allProducts = [];

  while (currentPage <= totalPages) {
    process.stdout.write(`\r  Page ${currentPage}/${totalPages}...`);
    const data = await fetchPage(currentPage);
    if (!data) break;

    totalPages = data.page_info?.total_pages || 1;
    totalProducts = data.total_count || 0;
    allProducts.push(...(data.items || []));
    currentPage++;

    // Small delay to be polite
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n  Total products found: ${allProducts.length} (reported: ${totalProducts})`);

  // Process each product
  let added = 0;
  let skipped = 0;
  let noImage = 0;
  const newMap = { ...existing };

  for (const product of allProducts) {
    // Clean SKU — some have ^^ delimiters
    const sku = (product.sku || '').replace(/\^\^/g, '').trim();
    if (!sku) continue;

    if (existing[sku]) {
      skipped++;
      continue;
    }

    const imgUrl = bestImage(product.media_gallery);
    if (!imgUrl) {
      noImage++;
      console.log(`  No image: ${sku} (${product.name})`);
      continue;
    }

    newMap[sku] = imgUrl;
    added++;
    console.log(`  + ${sku}: ${imgUrl.split('/').slice(-1)[0]}`);
  }

  console.log(`\nResults:`);
  console.log(`  Already mapped: ${skipped}`);
  console.log(`  Newly added: ${added}`);
  console.log(`  No image found: ${noImage}`);

  if (added > 0) {
    const total = writeMap(newMap);
    console.log(`\n✓ Written ${total} entries to src/data/skuImageMap.js`);
  } else {
    console.log('\nNo new entries to add.');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
