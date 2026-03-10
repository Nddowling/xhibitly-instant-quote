/**
 * Sync catalogHotspots.json → Base44 CatalogHotspot entity
 *
 * For each page in catalogHotspots.json, creates or updates a
 * CatalogHotspot record in Base44 with { page_number, hotspots }.
 *
 * Usage: node scripts/syncHotspotsToBase44.mjs
 *        node scripts/syncHotspotsToBase44.mjs --dry-run
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
const pages = Object.keys(hotspots).map(Number).sort((a, b) => a - b);

console.log(`\n📍 Sync Hotspots → Base44`);
console.log(`   Pages to sync: ${pages.length}`);
if (DRY_RUN) console.log(`   *** DRY RUN ***`);
console.log('');

// Fetch existing CatalogHotspot records to find IDs for update vs create
let existing = [];
try {
  existing = await base44.entities.CatalogHotspot.list({ limit: 500 }) || [];
  console.log(`Found ${existing.length} existing CatalogHotspot records in Base44\n`);
} catch (e) {
  console.log(`Could not fetch existing records (will create all): ${e.message}\n`);
}

const existingByPage = new Map((existing || []).map(r => [r.page_number, r]));

let updated = 0, created = 0, failed = 0;

for (const pageNum of pages) {
  const spots = hotspots[pageNum];
  const existing = existingByPage.get(pageNum);

  if (DRY_RUN) {
    const action = existing ? 'update' : 'create';
    process.stdout.write(`  [${action}] Page ${pageNum}: ${spots.length} hotspot${spots.length !== 1 ? 's' : ''}\n`);
    continue;
  }

  try {
    if (existing) {
      await base44.entities.CatalogHotspot.update(existing.id, {
        page_number: pageNum,
        hotspots: spots,
      });
      process.stdout.write(`  ✅ [updated] Page ${pageNum}: ${spots.length} spots\n`);
      updated++;
    } else {
      await base44.entities.CatalogHotspot.create({
        page_number: pageNum,
        hotspots: spots,
      });
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
console.log(`  Updated: ${updated}`);
console.log(`  Created: ${created}`);
console.log(`  Failed:  ${failed}`);
console.log(`${'═'.repeat(50)}\n`);
