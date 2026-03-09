#!/usr/bin/env node
/**
 * Convert 2026 Orbus Exhibitor's Handbook pages → JPEG → Supabase
 *
 * Only converts the 87 pages that contain products (from product_catalog_page_mapping.json).
 * Uploads each page as: orbus-assets/catalog/pages/page-XXX.jpg
 *
 * Usage:
 *   node scripts/convertPagesToImages.js
 *   node scripts/convertPagesToImages.js --test        # first 3 pages only
 *   node scripts/convertPagesToImages.js --page 31     # single page
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const PDF_PATH = '/Users/nicholasdowling/Downloads/Exhibitors_Handbook_Catalog.pdf';
const MAPPING_PATH = path.join(__dirname, '../orbus_catalog/product_catalog_page_mapping.json');
const MANIFEST_PATH = path.join(__dirname, '../orbus_catalog/page_images_manifest.json');
const TEMP_DIR = '/tmp/catalog_pages';
const BUCKET = 'orbus-assets';
const DPI = 120; // Good quality, ~500-700KB per page

// Parse args
const TEST_MODE = process.argv.includes('--test');
const SINGLE_PAGE = (() => {
  const idx = process.argv.indexOf('--page');
  return idx >= 0 ? parseInt(process.argv[idx + 1]) : null;
})();

// Load existing manifest (resume support)
let manifest = {};
if (existsSync(MANIFEST_PATH)) {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  console.log(`Resuming — ${Object.keys(manifest).length} pages already uploaded`);
}

// Support --all flag to convert every page in the PDF (not just product pages)
const ALL_PAGES = process.argv.includes('--all');
const TOTAL_PAGES = 214; // full catalog page count

let pagesToProcess;
if (SINGLE_PAGE) {
  pagesToProcess = [SINGLE_PAGE];
} else if (ALL_PAGES) {
  pagesToProcess = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
  console.log(`ALL mode: ${TOTAL_PAGES} pages`);
} else if (TEST_MODE) {
  pagesToProcess = [1, 2, 3];
  console.log('TEST MODE: processing first 3 pages');
} else {
  // Default: only product pages
  const mapping = JSON.parse(readFileSync(MAPPING_PATH, 'utf-8'));
  const allProductPages = new Set();
  for (const product of mapping.product_page_mapping) {
    for (const page of product.pages) {
      allProductPages.add(page);
    }
  }
  pagesToProcess = Array.from(allProductPages).sort((a, b) => a - b);
}

// Skip already-uploaded pages
if (!SINGLE_PAGE) {
  pagesToProcess = pagesToProcess.filter(p => !manifest[p]);
  console.log(`${pagesToProcess.length} pages to convert and upload\n`);
}

// Create temp dir
mkdirSync(TEMP_DIR, { recursive: true });

async function processPage(pageNum) {
  const paddedNum = String(pageNum).padStart(3, '0');
  const localPath = `${TEMP_DIR}/page-${paddedNum}.jpg`;
  const supabasePath = `catalog/pages/page-${paddedNum}.jpg`;

  try {
    // 1. Convert PDF page to JPEG using pdftoppm
    const outputPrefix = `${TEMP_DIR}/p${paddedNum}`;
    execSync(
      `pdftoppm -r ${DPI} -f ${pageNum} -l ${pageNum} -jpeg -jpegopt quality=85 "${PDF_PATH}" "${outputPrefix}"`,
      { stdio: 'pipe' }
    );

    // pdftoppm names output as prefix-NNN.jpg
    const actualOutput = `${outputPrefix}-${paddedNum}.jpg`;
    if (!existsSync(actualOutput)) {
      throw new Error(`pdftoppm output not found: ${actualOutput}`);
    }

    // 2. Upload to Supabase
    const imgBuffer = readFileSync(actualOutput);
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(supabasePath, imgBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) throw error;

    // 3. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(supabasePath);

    // 4. Cleanup temp file
    try { unlinkSync(actualOutput); } catch {}

    // 5. Save to manifest
    manifest[pageNum] = { url: publicUrl, path: supabasePath, size: imgBuffer.length };
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

    console.log(`  ✅ Page ${pageNum} → ${Math.round(imgBuffer.length / 1024)}KB`);
    return publicUrl;
  } catch (err) {
    console.error(`  ❌ Page ${pageNum} failed:`, err.message);
    return null;
  }
}

async function main() {
  const total = pagesToProcess.length;
  let done = 0, failed = 0;

  for (const pageNum of pagesToProcess) {
    process.stdout.write(`[${done + 1}/${total}] Page ${pageNum}... `);
    const url = await processPage(pageNum);
    if (url) done++; else failed++;
    // Small delay to avoid overwhelming Supabase
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n✅ Done! ${done} uploaded, ${failed} failed`);
  console.log(`📄 Manifest saved: ${MANIFEST_PATH}`);
  console.log(`\nTotal pages in manifest: ${Object.keys(manifest).length}`);

  if (done > 0) {
    console.log('\nNext step: generate hotspot data');
    console.log('  node scripts/generatePageHotspots.js');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
