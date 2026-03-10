#!/usr/bin/env node
/**
 * Re-run Hotspot Detection — SKU Label Mode
 *
 * Replaces photo-based hotspots with precise text-label hotspots.
 * For each product page, Claude locates:
 *   - Individual SKU code + product name text labels (separate boxes per SKU)
 *   - OR "banks" of SKUs that appear together in a spec table / size grid
 *     (one box covering the whole bank, all variant SKUs in groupedSkus)
 *
 * Usage:
 *   node scripts/rerunHotspotDetection.mjs              # all product pages
 *   node scripts/rerunHotspotDetection.mjs --page 76    # single page
 *   node scripts/rerunHotspotDetection.mjs --from 60 --to 100
 *   node scripts/rerunHotspotDetection.mjs --dry-run    # show page list only
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PDF_PATH      = '/tmp/exhibitors-handbook-2026.pdf';
const MAPPING_PATH  = path.join(__dirname, '../orbus_catalog/product_catalog_page_mapping.json');
const HOTSPOTS_PATH = path.join(__dirname, '../src/data/catalogHotspots.json');
const TEMP_DIR      = '/tmp/catalog_scan_pages';
const PAGE_OFFSET   = 2; // PDF page = print page + PAGE_OFFSET

const DRY_RUN    = process.argv.includes('--dry-run');
const SINGLE_PAGE = (() => { const i = process.argv.indexOf('--page'); return i >= 0 ? parseInt(process.argv[i+1]) : null; })();
const FROM_PAGE   = (() => { const i = process.argv.indexOf('--from'); return i >= 0 ? parseInt(process.argv[i+1]) : 1; })();
const TO_PAGE     = (() => { const i = process.argv.indexOf('--to');   return i >= 0 ? parseInt(process.argv[i+1]) : 218; })();

// ── Load state ────────────────────────────────────────────────────────────────
const mappingData = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8'));
let hotspots = existsSync(HOTSPOTS_PATH) ? JSON.parse(readFileSync(HOTSPOTS_PATH, 'utf-8')) : {};

mkdirSync(TEMP_DIR, { recursive: true });

// Build page → [{sku, name}] lookup
const pageProducts = {};
for (const entry of mappingData.product_page_mapping) {
  for (const page of (entry.pages || [entry.primary_page])) {
    if (!pageProducts[page]) pageProducts[page] = [];
    if (!pageProducts[page].find(p => p.sku === entry.product_sku)) {
      pageProducts[page].push({ sku: entry.product_sku, name: entry.product_name });
    }
  }
}

// Determine pages to process
let pagesToProcess;
if (SINGLE_PAGE) {
  pagesToProcess = [SINGLE_PAGE];
} else {
  pagesToProcess = Object.keys(pageProducts)
    .map(Number)
    .filter(p => p >= FROM_PAGE && p <= TO_PAGE)
    .sort((a, b) => a - b);
}

console.log(`\n🎯 Hotspot Re-Detection — SKU Label Mode`);
console.log(`   Product pages to process: ${pagesToProcess.length}`);
if (DRY_RUN) { console.log(`   *** DRY RUN ***\n`); pagesToProcess.forEach(p => console.log(`   Page ${p}: ${pageProducts[p].map(x => x.sku).join(', ')}`)); process.exit(0); }
console.log('');

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPageImageBase64(printPageNum) {
  const pdfPageNum = printPageNum + PAGE_OFFSET;
  const padded = String(pdfPageNum).padStart(3, '0');
  const prefix = `${TEMP_DIR}/scan-p${padded}`;
  const output = `${prefix}-${padded}.jpg`;
  if (!existsSync(output)) {
    execSync(
      `pdftoppm -r 150 -f ${pdfPageNum} -l ${pdfPageNum} -jpeg -jpegopt quality=85 "${PDF_PATH}" "${prefix}"`,
      { stdio: 'pipe' }
    );
  }
  if (!existsSync(output)) throw new Error(`pdftoppm failed for PDF page ${pdfPageNum}`);
  return readFileSync(output).toString('base64');
}

async function detectSKUHotspots(pageNum, products) {
  const imageBase64 = getPageImageBase64(pageNum);

  const productList = products.map(p => `- ${p.sku}: "${p.name}"`).join('\n');

  const prompt = `This is page ${pageNum} of the Orbus Exhibitors' Handbook 2026 trade show display catalog.

The following SKUs appear on this page:
${productList}

Your task: Find the TEXT LABEL areas where each SKU code and its product name appear on the page.
DO NOT box the product photos. Target the printed SKU codes and name text only.

Two patterns to handle:

1. INDIVIDUAL SKU LABELS — when each SKU has its own distinct label (e.g. "COY-KKG-3X3-C" printed under or beside its photo):
   → Return one box per SKU, tight around its code + name text.

2. SKU BANKS — when multiple SKUs appear together as a group in a spec/size table or stacked label block (e.g. a list of 5 size variants in one text block):
   → Return ONE box covering the entire bank, set sku to the primary/first SKU, and list ALL variant SKUs in groupedSkus.

Coordinate rules:
- x, y = top-left corner of the text label area (normalized 0.0–1.0, top-left of page is 0,0)
- width, height = dimensions of the text label area (normalized 0.0–1.0)
- Boxes should be snug around the text, NOT around the whole product section or photo
- Minimum height: 0.03 (enough to encompass a 2-line label)

Return ONLY a valid JSON array, no markdown, no explanation:
[{ "sku": "SKU-CODE", "name": "Product Name", "x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "groupedSkus": [] }]`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [{
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
      }, {
        type: 'text',
        text: prompt
      }]
    }]
  });

  const text = response.content[0].text.trim();
  try {
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr : [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    console.warn(`    ⚠️  JSON parse failed, raw: ${text.slice(0, 120)}`);
    return [];
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────
let done = 0, errored = 0;

for (let i = 0; i < pagesToProcess.length; i++) {
  const pageNum = pagesToProcess[i];
  const products = pageProducts[pageNum];
  process.stdout.write(`[${i+1}/${pagesToProcess.length}] Page ${pageNum} (${products.length} SKUs)... `);

  try {
    const spots = await detectSKUHotspots(pageNum, products);
    hotspots[pageNum] = spots;
    writeFileSync(HOTSPOTS_PATH, JSON.stringify(hotspots, null, 2));
    process.stdout.write(`✅ ${spots.length} hotspot${spots.length !== 1 ? 's' : ''} saved\n`);
    spots.forEach(s => {
      const extra = s.groupedSkus?.length ? ` [+${s.groupedSkus.length} grouped]` : '';
      console.log(`     • ${s.sku}${extra}  @ (${s.x.toFixed(2)},${s.y.toFixed(2)}) ${s.width.toFixed(2)}×${s.height.toFixed(2)}`);
    });
    done++;
  } catch (err) {
    process.stdout.write(`❌ ${err.message?.slice(0, 80)}\n`);
    errored++;
  }

  // Rate limit buffer
  await new Promise(r => setTimeout(r, 400));
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
console.log('  HOTSPOT RE-DETECTION COMPLETE');
console.log('══════════════════════════════════════════════════');
console.log(`  Pages processed: ${done}`);
console.log(`  Errors:          ${errored}`);
console.log(`  Hotspot pages:   ${Object.keys(hotspots).length}`);
console.log('');
console.log('Next: commit updated hotspots');
console.log('  git add src/data/catalogHotspots.json');
console.log('  git commit -m "Hotspots: switch from photo boxes to SKU label positions"');
console.log('');
