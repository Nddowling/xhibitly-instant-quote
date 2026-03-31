/**
 * applySmartVariantMappings.mjs
 *
 * Applies the smart variant mappings from smart_variant_mappings.json
 * (FG/FGE strip, BG strip, prefix matching) to Base44 Product records
 * and skuImageMap.js.
 *
 * Usage: node scripts/applySmartVariantMappings.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient as createBase44 } from '@base44/sdk';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
dotenv.config({ path: join(ROOT, '.env') });
dotenv.config({ path: join(ROOT, '.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');

const base44 = createBase44({
  appId:      process.env.BASE44_APP_ID   || process.env.VITE_BASE44_APP_ID,
  token:      process.env.BASE44_API_KEY  || process.env.VITE_BASE44_API_KEY,
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl:  process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false,
});

const mappings    = JSON.parse(readFileSync(join(ROOT, 'orbus_catalog/smart_variant_mappings.json'), 'utf8'));
const mapContent  = readFileSync(join(ROOT, 'src/data/skuImageMap.js'), 'utf8');
const report      = JSON.parse(readFileSync(join(ROOT, 'catalog-sync-report.json'), 'utf8'));

// Build current skuImageMap
const skuToUrl = {};
for (const m of mapContent.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) skuToUrl[m[1]] = m[2];

const total = Object.keys(mappings).length;
console.log(`\n${'═'.repeat(55)}`);
console.log(`  Apply Smart Variant Mappings`);
console.log(`  Mode: ${DRY_RUN ? '🟡 DRY RUN' : '🔴 LIVE'}`);
console.log(`${'═'.repeat(55)}`);
console.log(`  Mappings to apply: ${total}`);
console.log('');

if (DRY_RUN) {
  for (const [sku, { parent, method }] of Object.entries(mappings).slice(0, 20)) {
    const imageUrl = skuToUrl[parent];
    const filename = imageUrl?.split('/').pop() || 'no url??';
    console.log(`  ${sku.padEnd(28)} → ${parent.padEnd(20)} [${method}]`);
    console.log(`    ${filename}`);
  }
  if (total > 20) console.log(`  ... and ${total - 20} more`);
  console.log(`\n  Run without --dry-run to apply.\n`);
  process.exit(0);
}

// Pre-fetch Base44 Product records for all variant SKUs
console.log('Fetching Base44 Product records...');
const b44Products = await base44.entities.Product.list('sku', 2000) || [];
const b44BySku = {};
for (const p of b44Products) if (p.sku) b44BySku[p.sku] = p;
console.log(`  Loaded ${b44Products.length} records\n`);

let b44Updated = 0, b44Failed = 0, mapAdded = 0;

for (const [sku, { parent }] of Object.entries(mappings)) {
  const imageUrl = skuToUrl[parent];
  if (!imageUrl) {
    console.log(`  ⚠️  No URL found for parent ${parent} (${sku})`);
    continue;
  }

  // Update skuImageMap
  if (!skuToUrl[sku] || !skuToUrl[sku].includes('supabase.co')) {
    skuToUrl[sku] = imageUrl;
    mapAdded++;
  }

  // Update Base44
  const b44 = b44BySku[sku];
  if (!b44) { process.stdout.write(`  ⚠️  No Base44 record for ${sku}\n`); continue; }

  let attempts = 0, ok = false;
  while (attempts < 3 && !ok) {
    try {
      await base44.entities.Product.update(b44.id, {
        primary_image_url: imageUrl,
        image_url: imageUrl,
      });
      ok = true;
      b44Updated++;
    } catch (e) {
      attempts++;
      if (attempts < 3 && e.message?.includes('Rate limit')) {
        await new Promise(r => setTimeout(r, 2000 * attempts));
      } else {
        process.stdout.write(`  ❌ ${sku}: ${e.message?.slice(0, 50)}\n`);
        b44Failed++;
        break;
      }
    }
  }
  await new Promise(r => setTimeout(r, 350));
}

// Write updated skuImageMap.js
const sorted = Object.fromEntries(Object.entries(skuToUrl).sort(([a], [b]) => a.localeCompare(b)));
const count  = Object.keys(sorted).length;
let out = `// Auto-generated — Orbus CDN + GraphQL + Supabase bucket\n`;
out += `// ${count} product SKUs mapped to their primary product image URL\n`;
out += `export const SKU_TO_IMAGE = {\n`;
for (const [k, v] of Object.entries(sorted)) out += `  "${k}": "${v}",\n`;
out += `};\n`;
writeFileSync(join(ROOT, 'src/data/skuImageMap.js'), out);

console.log(`\n${'═'.repeat(55)}`);
console.log(`  Base44 updated:  ${b44Updated}`);
console.log(`  Base44 failed:   ${b44Failed}`);
console.log(`  skuImageMap:     +${mapAdded} → ${count} total`);
console.log(`${'═'.repeat(55)}\n`);
