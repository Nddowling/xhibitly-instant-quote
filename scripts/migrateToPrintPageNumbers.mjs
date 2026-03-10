/**
 * Migrate all catalog page references from PDF page numbers → print page numbers
 *
 * The PDF has 220 pages. The catalog has 218 printed pages.
 * PDF page 1 = front cover (no print number)
 * PDF page 2 = symbol/warranty key (no print number)
 * PDF page 3 = print page 1 (TOC)
 * ...
 * PDF page N = print page N - 2
 *
 * This script subtracts 2 from every page number stored in:
 *   - src/data/catalogHotspots.json        (object keys)
 *   - orbus_catalog/product_catalog_page_mapping.json  (primary_page + pages[])
 *   - orbus_catalog/catalog_scan_log.json  (object keys)
 *
 * Supabase image files keep their PDF-based names (page-009.jpg etc.).
 * The app should use: `page-${String(printPage + 2).padStart(3,'0')}.jpg`
 * to look up the right Supabase image for a given print page number.
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OFFSET = 2; // PDF page = print page + OFFSET

function toprint(pdfPage) {
  return pdfPage - OFFSET;
}

// ── 1. Migrate catalogHotspots.json ──────────────────────────────────────────
const hotspotsPath = path.join(ROOT, 'src/data/catalogHotspots.json');
const hotspots = JSON.parse(readFileSync(hotspotsPath, 'utf-8'));
const newHotspots = {};
let hotspotMoved = 0, hotspotDropped = 0;

for (const [pdfKey, spots] of Object.entries(hotspots)) {
  const printPage = toprint(Number(pdfKey));
  if (printPage <= 0) {
    console.log(`  ⚠️  Hotspot page ${pdfKey} → print ${printPage} (dropped — pre-catalog page)`);
    hotspotDropped++;
    continue;
  }
  newHotspots[String(printPage)] = spots;
  hotspotMoved++;
}
writeFileSync(hotspotsPath, JSON.stringify(newHotspots, null, 2));
console.log(`✅ catalogHotspots.json: ${hotspotMoved} pages migrated, ${hotspotDropped} dropped`);

// ── 2. Migrate product_catalog_page_mapping.json ──────────────────────────────
const mappingPath = path.join(ROOT, 'orbus_catalog/product_catalog_page_mapping.json');
const mappingData = JSON.parse(readFileSync(mappingPath, 'utf-8'));

let mappingUpdated = 0;
for (const product of mappingData.product_page_mapping) {
  const origPrimary = product.primary_page;
  const origPages   = product.pages || [origPrimary];

  product.primary_page = toprint(origPrimary);
  product.pages = origPages.map(p => toprint(p)).filter(p => p > 0);

  if (product.primary_page <= 0) {
    product.primary_page = product.pages[0] || 1;
  }
  mappingUpdated++;
}
writeFileSync(mappingPath, JSON.stringify(mappingData, null, 2));
console.log(`✅ product_catalog_page_mapping.json: ${mappingUpdated} products updated`);

// ── 3. Migrate catalog_scan_log.json ─────────────────────────────────────────
const scanLogPath = path.join(ROOT, 'orbus_catalog/catalog_scan_log.json');
const scanLog = JSON.parse(readFileSync(scanLogPath, 'utf-8'));
const newScanLog = {};
let scanMoved = 0, scanDropped = 0;

for (const [pdfKey, entry] of Object.entries(scanLog)) {
  const printPage = toprint(Number(pdfKey));
  if (printPage <= 0) {
    scanDropped++;
    continue;
  }
  newScanLog[String(printPage)] = entry;
  scanMoved++;
}
writeFileSync(scanLogPath, JSON.stringify(newScanLog, null, 2));
console.log(`✅ catalog_scan_log.json: ${scanMoved} pages migrated, ${scanDropped} dropped`);

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('');
console.log('Migration complete.');
console.log('');
console.log('NOTE: Supabase image files keep their PDF-based names (page-009.jpg etc.).');
console.log('In app code, use: `page-${String(printPage + 2).padStart(3,"0")}.jpg`');
console.log('to look up the Supabase image for a given print page number.');

// ── Quick verification ─────────────────────────────────────────────────────────
const verifyHotspots = JSON.parse(readFileSync(hotspotsPath, 'utf-8'));
const verifyMapping  = JSON.parse(readFileSync(mappingPath, 'utf-8'));
const allPrintPages  = new Set(verifyMapping.product_page_mapping.flatMap(p => p.pages));
const hotspotKeys    = new Set(Object.keys(verifyHotspots).map(Number));
const missing        = [...allPrintPages].filter(p => !hotspotKeys.has(p)).sort((a,b)=>a-b);

console.log('');
console.log('=== POST-MIGRATION VERIFICATION ===');
console.log(`Total SKUs:                ${new Set(verifyMapping.product_page_mapping.map(p => p.product_sku)).size}`);
console.log(`Product pages mapped:      ${allPrintPages.size}`);
console.log(`Pages with hotspots:       ${hotspotKeys.size}`);
console.log(`Mapped pages missing hotspot: ${missing.length}${missing.length ? ' → ' + missing.join(', ') : ''}`);
console.log(`Print page range:          ${Math.min(...allPrintPages)} – ${Math.max(...allPrintPages)}`);
