#!/usr/bin/env node
/**
 * Generate clickable product hotspots for each catalog page using Claude Vision.
 *
 * For each product page, sends the page JPEG + known product list to Claude
 * and asks it to return bounding boxes for each product area.
 *
 * Output: src/data/catalogHotspots.json
 * Format: { "31": [{ sku, name, x, y, width, height }], "32": [...], ... }
 *   where x, y, width, height are all normalized 0–1 relative to the page image.
 *
 * Usage:
 *   node scripts/generatePageHotspots.js              # all product pages (resume)
 *   node scripts/generatePageHotspots.js --test       # 3 pages only
 *   node scripts/generatePageHotspots.js --page 31    # single page (force re-run)
 *   node scripts/generatePageHotspots.js --rerun-failed  # only pages with 0 hotspots
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

const PDF_PATH = '/Users/nicholasdowling/Downloads/Exhibitors_Handbook_Catalog.pdf';
const MAPPING_PATH = path.join(__dirname, '../orbus_catalog/product_catalog_page_mapping.json');
const OUTPUT_PATH = path.join(__dirname, '../src/data/catalogHotspots.json');
const TEMP_DIR = '/tmp/catalog_hotspot_pages';

const TEST_MODE = process.argv.includes('--test');
const RERUN_FAILED = process.argv.includes('--rerun-failed');
const SINGLE_PAGE = (() => {
  const idx = process.argv.indexOf('--page');
  return idx >= 0 ? parseInt(process.argv[idx + 1]) : null;
})();

// Load existing hotspots (resume support)
let hotspots = {};
if (existsSync(OUTPUT_PATH)) {
  hotspots = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
  console.log(`Resuming — ${Object.keys(hotspots).length} pages already processed`);
}

// Build page → products map from mapping JSON
const mapping = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8'));
const pageProducts = {};
for (const product of mapping.product_page_mapping) {
  for (const page of product.pages) {
    if (!pageProducts[page]) pageProducts[page] = [];
    pageProducts[page].push({
      sku: product.product_sku,
      name: product.product_name,
      category: product.category,
      isPrimary: page === product.primary_page,
    });
  }
}

let pagesToProcess = Object.keys(pageProducts).map(Number).sort((a, b) => a - b);
if (SINGLE_PAGE) {
  pagesToProcess = [SINGLE_PAGE];
} else if (TEST_MODE) {
  pagesToProcess = pagesToProcess.slice(0, 3);
  console.log('TEST MODE: 3 pages');
} else if (RERUN_FAILED) {
  // Re-run pages that have 0 hotspots or fallback (full-height) hotspots
  pagesToProcess = pagesToProcess.filter(p => {
    const existing = hotspots[p];
    if (!existing || existing.length === 0) return true;
    // Fallback hotspots have height = 1/N (evenly divided strips)
    const isFallback = existing.every(h => h.x === 0 && h.width === 1);
    return isFallback;
  });
  console.log(`RERUN-FAILED mode: ${pagesToProcess.length} pages to retry`);
} else {
  // Skip already processed (unless single page or rerun-failed)
  pagesToProcess = pagesToProcess.filter(p => !hotspots[p]);
}

console.log(`${pagesToProcess.length} pages to process\n`);
mkdirSync(TEMP_DIR, { recursive: true });

async function getPageImageBase64(pageNum) {
  const paddedNum = String(pageNum).padStart(3, '0');
  const outputPrefix = `${TEMP_DIR}/p${paddedNum}`;
  const actualOutput = `${outputPrefix}-${paddedNum}.jpg`;

  if (!existsSync(actualOutput)) {
    execSync(
      `pdftoppm -r 120 -f ${pageNum} -l ${pageNum} -jpeg -jpegopt quality=82 "${PDF_PATH}" "${outputPrefix}"`,
      { stdio: 'pipe' }
    );
  }

  if (!existsSync(actualOutput)) throw new Error(`pdftoppm failed for page ${pageNum}`);
  return readFileSync(actualOutput).toString('base64');
}

async function detectHotspots(pageNum, products) {
  const imageBase64 = await getPageImageBase64(pageNum);

  const productList = products
    .map(p => `- ${p.sku}: "${p.name}" (${p.category})${p.isPrimary ? ' [FEATURED]' : ''}`)
    .join('\n');

  const prompt = `This is page ${pageNum} of the Orbus Exhibitor's Handbook trade show display catalog.

The following products appear on this page:
${productList}

Your task: Return a JSON array of bounding boxes for each product's primary visual area (the product photo/render — NOT spec tables or text blocks).

Rules:
- If multiple SKUs are size variants of the SAME product shown in ONE image, return ONE box covering that image and list all variant SKUs in groupedSkus
- If products appear as SEPARATE distinct images, return a separate box for each
- x, y = top-left corner (normalized 0.0–1.0, where 0,0 is top-left of page)
- width, height = box dimensions (normalized 0.0–1.0)
- Aim for tight boxes around the product image itself, not the whole page section
- If a product is only in a spec table with no photo, set its box to cover that table row

Return ONLY a valid JSON array, no explanation, no markdown fences:
[
  {
    "sku": "SKU-CODE",
    "name": "Product Name",
    "x": 0.0,
    "y": 0.0,
    "width": 1.0,
    "height": 1.0,
    "groupedSkus": ["SKU1", "SKU2"]
  }
]

Where groupedSkus lists all SKUs sharing this visual (include the primary sku too).`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const raw = response.content[0].text.trim();

  // Extract JSON array from response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error(`No JSON array found in response: ${raw.slice(0, 200)}`);

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate and clamp all values to 0-1
  return parsed.map(item => ({
    sku: item.sku || products[0]?.sku,
    name: item.name || '',
    x: Math.max(0, Math.min(1, Number(item.x) || 0)),
    y: Math.max(0, Math.min(1, Number(item.y) || 0)),
    width: Math.max(0.05, Math.min(1, Number(item.width) || 0.5)),
    height: Math.max(0.05, Math.min(1, Number(item.height) || 0.5)),
    groupedSkus: Array.isArray(item.groupedSkus) ? item.groupedSkus : [item.sku],
  }));
}

async function main() {
  const total = pagesToProcess.length;
  let done = 0, failed = 0;

  for (const pageNum of pagesToProcess) {
    const products = pageProducts[pageNum] || [];
    process.stdout.write(`[${done + 1}/${total}] Page ${pageNum} (${products.length} products)... `);

    try {
      const spots = await detectHotspots(pageNum, products);
      hotspots[pageNum] = spots;
      writeFileSync(OUTPUT_PATH, JSON.stringify(hotspots, null, 2));
      console.log(`✅ ${spots.length} hotspot${spots.length !== 1 ? 's' : ''} detected`);
      done++;
    } catch (err) {
      console.error(`❌ ${err.message}`);
      hotspots[pageNum] = products.map((p, i) => ({
        sku: p.sku,
        name: p.name,
        x: 0,
        y: i / products.length,
        width: 1,
        height: 1 / products.length,
        groupedSkus: [p.sku],
      }));
      writeFileSync(OUTPUT_PATH, JSON.stringify(hotspots, null, 2));
      failed++;
    }

    // Brief pause to stay within API rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n✅ Done! ${done} pages processed, ${failed} used fallback hotspots`);
  console.log(`📄 Hotspots saved: ${OUTPUT_PATH}`);
  console.log(`Total pages with hotspots: ${Object.keys(hotspots).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
