/**
 * Reset CatalogHotspot records in Base44
 *
 * Uses filter({ page_number }) per page so it works without authentication.
 * For each page in catalogHotspots.json:
 *   1. Filter to find any existing records with that page_number
 *   2. Delete all found (clears duplicates + old PDF-numbered records)
 *   3. Create one fresh record with the correct print page number + hotspots
 *
 * Also sweeps page numbers outside the print range (1–218) and deletes any
 * stale records (e.g. old entries stored under PDF page numbers 3–220).
 *
 * Usage: node scripts/resetHotspotsInBase44.mjs
 *        node scripts/resetHotspotsInBase44.mjs --dry-run
 */

import { readFileSync } from 'fs';
import { createClient } from '@base44/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');

const base44 = createClient({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false
});

const hotspots = JSON.parse(readFileSync('src/data/catalogHotspots.json', 'utf-8'));
const printPages = Object.keys(hotspots).map(Number).sort((a, b) => a - b);

// PDF pages run print+2, so old records might be at PDF page numbers (3–220).
// Sweep the full possible range to catch stale entries.
const MAX_PDF_PAGE = 220;

console.log(`\n🔄 Reset CatalogHotspot records — filter-based upsert`);
console.log(`   Print pages with hotspots: ${printPages.length}`);
if (DRY_RUN) console.log(`   *** DRY RUN ***`);
console.log('');

// ── Step 1: Delete stale records outside the print-page range ─────────────────
console.log(`Step 1: Sweep pages ${MAX_PDF_PAGE + 1}–${MAX_PDF_PAGE} ... (checking PDF-page-numbered records)`);

// Check pages that could be PDF page numbers but not valid print pages
const staleCandidates = [];
for (let p = 219; p <= MAX_PDF_PAGE; p++) staleCandidates.push(p);
// Also check PDF offsets of our known print pages (print+2)
for (const pp of printPages) {
  const pdfPage = pp + 2;
  if (!printPages.includes(pdfPage)) staleCandidates.push(pdfPage);
}
const uniqueStaleCandidates = [...new Set(staleCandidates)].sort((a, b) => a - b);

let staleDeleted = 0;
for (const p of uniqueStaleCandidates) {
  try {
    const found = await base44.entities.CatalogHotspot.filter({ page_number: p }) || [];
    if (found.length > 0) {
      process.stdout.write(`  Stale page_number=${p}: ${found.length} record(s) found`);
      if (!DRY_RUN) {
        for (const r of found) {
          await base44.entities.CatalogHotspot.delete(r.id);
          staleDeleted++;
          await new Promise(r => setTimeout(r, 80));
        }
        process.stdout.write(` → deleted\n`);
      } else {
        process.stdout.write(` → [DRY RUN: would delete]\n`);
      }
    }
  } catch { /* ignore filter errors for pages with no records */ }
  await new Promise(r => setTimeout(r, 100));
}
console.log(`   Stale records deleted: ${staleDeleted}\n`);

// ── Step 2: Upsert each print page ────────────────────────────────────────────
console.log(`Step 2: Upsert ${printPages.length} print-page records...`);
let updated = 0, created = 0, failed = 0;

for (const pageNum of printPages) {
  const spots = hotspots[pageNum];
  try {
    const existing = await base44.entities.CatalogHotspot.filter({ page_number: pageNum }) || [];

    if (DRY_RUN) {
      const action = existing.length > 0 ? `update(${existing.length} found)` : 'create';
      process.stdout.write(`  [${action}] Page ${pageNum}: ${spots.length} spots\n`);
      await new Promise(r => setTimeout(r, 50));
      continue;
    }

    if (existing.length > 1) {
      // Delete extra duplicates, keep the first
      for (const dup of existing.slice(1)) {
        await base44.entities.CatalogHotspot.delete(dup.id);
        await new Promise(r => setTimeout(r, 80));
      }
    }

    if (existing.length > 0) {
      await base44.entities.CatalogHotspot.update(existing[0].id, {
        page_number: pageNum,
        hotspots: spots,
      });
      process.stdout.write(`  ✅ [updated] Page ${pageNum}: ${spots.length} spots\n`);
      updated++;
    } else {
      await base44.entities.CatalogHotspot.create({ page_number: pageNum, hotspots: spots });
      process.stdout.write(`  ✅ [created] Page ${pageNum}: ${spots.length} spots\n`);
      created++;
    }
  } catch (e) {
    process.stdout.write(`  ❌ Page ${pageNum}: ${e.message?.slice(0, 80)}\n`);
    failed++;
  }

  await new Promise(r => setTimeout(r, 150));
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`  Stale deleted: ${staleDeleted}`);
console.log(`  Updated:       ${updated}`);
console.log(`  Created:       ${created}`);
console.log(`  Failed:        ${failed}`);
console.log(`${'═'.repeat(50)}\n`);
