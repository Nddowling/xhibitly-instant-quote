import { readFileSync } from 'fs';
import { createClient } from '@base44/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const base44 = createClient({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false
});

const hotspots = JSON.parse(readFileSync('src/data/catalogHotspots.json', 'utf-8'));
const retryPages = [12,13,14,15,16,17,21,23,25,27,28,29,30,31,32,33,38,39,40,41];

console.log(`\nRetrying ${retryPages.length} rate-limited pages (800ms delay)...\n`);

let updated = 0, created = 0, failed = 0;

for (const pageNum of retryPages) {
  const spots = hotspots[pageNum];
  if (!spots) { console.log(`  skip ${pageNum} (not in JSON)`); continue; }
  try {
    const existing = await base44.entities.CatalogHotspot.filter({ page_number: pageNum }) || [];

    if (existing.length > 1) {
      for (const dup of existing.slice(1)) {
        await base44.entities.CatalogHotspot.delete(dup.id);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (existing.length > 0) {
      await base44.entities.CatalogHotspot.update(existing[0].id, { page_number: pageNum, hotspots: spots });
      console.log(`  ✅ [updated] Page ${pageNum}: ${spots.length} spots`);
      updated++;
    } else {
      await base44.entities.CatalogHotspot.create({ page_number: pageNum, hotspots: spots });
      console.log(`  ✅ [created] Page ${pageNum}: ${spots.length} spots`);
      created++;
    }
  } catch (e) {
    console.log(`  ❌ Page ${pageNum}: ${e.message?.slice(0, 60)}`);
    failed++;
  }

  await new Promise(r => setTimeout(r, 800));
}

console.log(`\nDone — Updated: ${updated}  Created: ${created}  Failed: ${failed}\n`);
