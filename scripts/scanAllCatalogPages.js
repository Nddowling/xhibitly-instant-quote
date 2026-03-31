#!/usr/bin/env node
/**
 * Full Catalog Page Scanner
 *
 * Scans EVERY page of the 2026 catalog with Claude Vision to find product SKUs
 * on pages not currently in product_catalog_page_mapping.json.
 *
 * For each unmapped page it finds products on, it:
 *   1. Adds those SKUs + page to product_catalog_page_mapping.json
 *   2. Runs hotspot detection on that page
 *   3. Saves results incrementally
 *
 * Usage:
 *   node scripts/scanAllCatalogPages.js              # scan all unmapped pages
 *   node scripts/scanAllCatalogPages.js --all        # re-scan every page (incl. mapped)
 *   node scripts/scanAllCatalogPages.js --page 76    # scan a single page
 *   node scripts/scanAllCatalogPages.js --dry-run    # detect only, don't update mapping
 *   node scripts/scanAllCatalogPages.js --from 60 --to 100  # scan a page range
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

const PDF_PATH = '/tmp/exhibitors-handbook-2026.pdf';
const MAPPING_PATH  = path.join(__dirname, '../orbus_catalog/product_catalog_page_mapping.json');
const HOTSPOTS_PATH = path.join(__dirname, '../src/data/catalogHotspots.json');
const SCAN_LOG_PATH = path.join(__dirname, '../orbus_catalog/catalog_scan_log.json');
const TEMP_DIR      = '/tmp/catalog_scan_pages';

// The PDF has 2 unnumbered pages before print page 1 (cover + symbol key).
// All data is stored using PRINT page numbers (1–218).
// To render a print page from the PDF: PDF_PAGE = PRINT_PAGE + PAGE_OFFSET
const PAGE_OFFSET  = 2;
const TOTAL_PRINT_PAGES = 218;

// ── Flags ─────────────────────────────────────────────────────────────────────
const SCAN_ALL  = process.argv.includes('--all');
const DRY_RUN   = process.argv.includes('--dry-run');
const SINGLE_PAGE = (() => { const i = process.argv.indexOf('--page'); return i >= 0 ? parseInt(process.argv[i+1]) : null; })();
const FROM_PAGE   = (() => { const i = process.argv.indexOf('--from'); return i >= 0 ? parseInt(process.argv[i+1]) : 1; })();
const TO_PAGE     = (() => { const i = process.argv.indexOf('--to');   return i >= 0 ? parseInt(process.argv[i+1]) : TOTAL_PRINT_PAGES; })();

// ── Load current state ────────────────────────────────────────────────────────
const mappingData = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8'));
let hotspots      = existsSync(HOTSPOTS_PATH) ? JSON.parse(readFileSync(HOTSPOTS_PATH, 'utf-8')) : {};
let scanLog       = existsSync(SCAN_LOG_PATH) ? JSON.parse(readFileSync(SCAN_LOG_PATH, 'utf-8')) : {};

const alreadyMappedPages = new Set(
  mappingData.product_page_mapping.flatMap(p => p.pages || [p.primary_page])
);
const alreadyScannedPages = new Set(Object.keys(scanLog).map(Number));

mkdirSync(TEMP_DIR, { recursive: true });

// ── Determine pages to scan ───────────────────────────────────────────────────
// All page numbers below are PRINT page numbers (1–218)
let pagesToScan;
if (SINGLE_PAGE) {
  pagesToScan = [SINGLE_PAGE];
} else {
  pagesToScan = Array.from({ length: TO_PAGE - FROM_PAGE + 1 }, (_, i) => i + FROM_PAGE);
  if (!SCAN_ALL) {
    pagesToScan = pagesToScan.filter(p => !alreadyMappedPages.has(p) && !alreadyScannedPages.has(p));
  }
}

console.log(`\n🔍 Full Catalog Scanner — 2026 Edition`);
console.log(`   PDF: ${PDF_PATH}`);
console.log(`   Total print pages: ${TOTAL_PRINT_PAGES} (PDF has ${TOTAL_PRINT_PAGES + PAGE_OFFSET}, offset=${PAGE_OFFSET})`);
console.log(`   Already mapped pages: ${alreadyMappedPages.size}`);
console.log(`   Already scanned (no product): ${alreadyScannedPages.size}`);
console.log(`   Pages to scan now: ${pagesToScan.length}`);
if (DRY_RUN) console.log(`   *** DRY RUN — mapping will NOT be updated ***`);
console.log('');

if (pagesToScan.length === 0) {
  console.log('✅ Nothing to scan — all pages already processed.');
  process.exit(0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPageImageBase64(printPageNum) {
  const pdfPageNum = printPageNum + PAGE_OFFSET;
  const padded = String(pdfPageNum).padStart(3, '0');
  const prefix = `${TEMP_DIR}/scan-p${padded}`;
  const output = `${prefix}-${padded}.jpg`;
  if (!existsSync(output)) {
    execSync(
      `pdftoppm -r 120 -f ${pdfPageNum} -l ${pdfPageNum} -jpeg -jpegopt quality=82 "${PDF_PATH}" "${prefix}"`,
      { stdio: 'pipe' }
    );
  }
  if (!existsSync(output)) throw new Error(`pdftoppm failed for PDF page ${pdfPageNum} (print page ${printPageNum})`);
  return readFileSync(output).toString('base64');
}

async function detectProductsOnPage(pageNum) {
  const imageBase64 = getPageImageBase64(pageNum);

  const prompt = `This is page ${pageNum} of the Orbus Exhibitors' Handbook 2026 trade show and retail display catalog.

Your task: Identify ALL product SKU codes visible on this page.

Look for:
- SKU codes (e.g. COY-KKG-3X3-C, XCLM-6QP-K1, OCX, OCH, MOD-*, BLD-*, etc.)
- Product names and their associated codes
- Spec tables listing sizes/codes
- Any alphanumeric product identifier codes

Return a JSON object:
{
  "hasProducts": true/false,
  "pageType": "product" | "section-intro" | "info" | "cad-diagram" | "back-cover",
  "productLine": "e.g. Coyote Popup, XClaim Fabric Popup, MODify, Cases, etc.",
  "skus": [
    { "sku": "COY-KKG-3X3-C", "name": "10' wide full height standard display system" },
    ...
  ]
}

If this is a section divider, intro page, CAD diagram page, or back cover with no specific SKU codes, set hasProducts: false and skus: [].

Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
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
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
  }
}

async function runHotspotDetection(pageNum, products) {
  const imageBase64 = getPageImageBase64(pageNum);

  const productList = products.map(p => `- ${p.sku}: "${p.name}"`).join('\n');

  const prompt = `This is page ${pageNum} of the Orbus Exhibitors' Handbook 2026 trade show display catalog.

The following products appear on this page:
${productList}

Return a JSON array of bounding boxes for each product's primary visual area (the product photo/render — NOT spec tables or text blocks).

Rules:
- If multiple SKUs are size variants of the SAME product shown in ONE image, return ONE box and list all variant SKUs in groupedSkus
- If products appear as SEPARATE distinct images, return a separate box for each
- x, y = top-left corner (normalized 0.0–1.0, where 0,0 is top-left of page)
- width, height = box dimensions (normalized 0.0–1.0)
- Tight boxes around product images, not the whole page section

Return ONLY a valid JSON array, no markdown:
[{ "sku": "SKU", "name": "Name", "x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0, "groupedSkus": [] }]`;

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
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

function addToMapping(pageNum, skus, productLine) {
  for (const { sku, name } of skus) {
    const existing = mappingData.product_page_mapping.find(p => p.product_sku === sku);
    if (existing) {
      if (!existing.pages.includes(pageNum)) existing.pages.push(pageNum);
    } else {
      mappingData.product_page_mapping.push({
        product_sku: sku,
        product_name: name,
        primary_page: pageNum,
        pages: [pageNum],
        category: productLine || 'Unknown',
        source: 'scan-2026'
      });
    }
  }
  writeFileSync(MAPPING_PATH, JSON.stringify(mappingData, null, 2));
}

// ── Main loop ─────────────────────────────────────────────────────────────────
let newPagesFound = 0;
let newSkusFound  = 0;
let skipped       = 0;

for (let i = 0; i < pagesToScan.length; i++) {
  const pageNum = pagesToScan[i];
  process.stdout.write(`[${i+1}/${pagesToScan.length}] Page ${pageNum}... `);

  try {
    const result = await detectProductsOnPage(pageNum);

    if (!result.hasProducts || result.skus.length === 0) {
      process.stdout.write(`⬜ ${result.pageType} (no products)\n`);
      // Log as scanned so we don't re-scan next time
      scanLog[pageNum] = { scanned: true, pageType: result.pageType, skus: [] };
      writeFileSync(SCAN_LOG_PATH, JSON.stringify(scanLog, null, 2));
      skipped++;
      continue;
    }

    process.stdout.write(`✅ ${result.skus.length} SKUs found (${result.productLine})\n`);
    result.skus.forEach(s => console.log(`   • ${s.sku} — ${s.name}`));

    if (!DRY_RUN) {
      // Add to mapping
      addToMapping(pageNum, result.skus, result.productLine);
      newSkusFound += result.skus.length;
      newPagesFound++;

      // Run hotspot detection
      process.stdout.write(`   Running hotspot detection... `);
      const spots = await runHotspotDetection(pageNum, result.skus);
      hotspots[pageNum] = spots;
      writeFileSync(HOTSPOTS_PATH, JSON.stringify(hotspots, null, 2));
      process.stdout.write(`${spots.length} hotspots saved\n`);

      // Log as scanned
      scanLog[pageNum] = { scanned: true, pageType: 'product', skus: result.skus.map(s => s.sku) };
      writeFileSync(SCAN_LOG_PATH, JSON.stringify(scanLog, null, 2));
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));

  } catch (err) {
    process.stdout.write(`❌ ERROR: ${err.message}\n`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
console.log('  SCAN COMPLETE');
console.log('══════════════════════════════════════════════════');
console.log(`  Pages scanned:        ${pagesToScan.length}`);
console.log(`  New product pages:    ${newPagesFound}`);
console.log(`  New SKUs discovered:  ${newSkusFound}`);
console.log(`  Non-product pages:    ${skipped}`);
console.log(`  Total mapped pages:   ${new Set(mappingData.product_page_mapping.flatMap(p => p.pages)).size}`);
console.log(`  Total pages w/ spots: ${Object.keys(hotspots).length}`);

if (newPagesFound > 0 && !DRY_RUN) {
  console.log('\n📋 Next: commit the updated mapping + hotspots:');
  console.log('  git add orbus_catalog/product_catalog_page_mapping.json src/data/catalogHotspots.json orbus_catalog/catalog_scan_log.json');
  console.log('  git commit -m "Add missing product pages from full 2026 catalog scan"');
}
console.log('');
