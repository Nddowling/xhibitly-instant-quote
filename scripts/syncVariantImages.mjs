/**
 * Sync variant images to Base44
 *
 * For catalog SKUs with no Supabase folder of their own, finds the closest
 * same-family SKU that does have images and assigns that parent's primary
 * image URL to the variant's Base44 Product record.
 *
 * Usage: node scripts/syncVariantImages.mjs [--dry-run]
 */

import { createClient as createBase44 } from '@base44/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');

const base44 = createBase44({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false,
});

const CATALOG_COVER = ['exhb-catalog-cover-spread'];
const FEATURE_ICONS = ['carry_bag', 'recycled', 'rental_product', 'lifetime_warranty', 'graphics_1_year', '1_year_warranty'];

function isBadImage(url) {
  if (!url) return true;
  const lower = url.toLowerCase();
  return CATALOG_COVER.some(p => lower.includes(p)) || FEATURE_ICONS.some(p => lower.includes(p));
}

// Load the last audit report as source of truth for Supabase images
const report = JSON.parse(readFileSync(path.join(__dirname, '../catalog-sync-report.json'), 'utf8'));

// Build set of SKUs with good Supabase images
const goodSupabaseSkus = Object.entries(report.skus)
  .filter(([, s]) => s.has_supabase_folder && s.supabase_primary_image && !isBadImage(s.supabase_primary_image))
  .map(([sku]) => sku);

// Variant SKUs = in catalog, have Base44 record, but no Supabase image
const variantSkus = report.groups.needs_update.filter(sku =>
  !report.skus[sku].supabase_primary_image && report.skus[sku].base44_id
);

// Build variant → parent mappings (require 2+ part prefix match)
const variantMappings = {};
for (const sku of variantSkus) {
  const parts = sku.split('-');
  if (parts.length < 2) continue;
  for (let len = parts.length - 1; len >= 2; len--) {
    const prefix = parts.slice(0, len).join('-');
    const matches = goodSupabaseSkus.filter(s => s.startsWith(prefix + '-') || s === prefix);
    if (matches.length > 0) {
      variantMappings[sku] = matches.sort((a, b) => a.length - b.length)[0];
      break;
    }
  }
}

const total = Object.keys(variantMappings).length;
console.log(`\n${'═'.repeat(55)}`);
console.log(`  VARIANT IMAGE SYNC`);
console.log(`  Mode: ${DRY_RUN ? '🟡 DRY RUN' : '🔴 LIVE'}`);
console.log(`${'═'.repeat(55)}`);
console.log(`  Variant SKUs to process: ${total}`);
console.log('');

let updated = 0, failed = 0;

for (const [sku, parentSku] of Object.entries(variantMappings)) {
  const imageUrl = report.skus[parentSku].supabase_primary_image;
  const base44Id = report.skus[sku].base44_id;

  if (DRY_RUN) {
    console.log(`  [DRY] ${sku} → ${parentSku} (${imageUrl.split('/').pop()})`);
    continue;
  }

  let attempts = 0;
  let success = false;
  while (attempts < 3 && !success) {
    try {
      await base44.entities.Product.update(base44Id, {
        primary_image_url: imageUrl,
        image_url: imageUrl,
      });
      process.stdout.write(`  ✅ ${sku} → ${parentSku}\n`);
      updated++;
      success = true;
    } catch (e) {
      attempts++;
      if (attempts < 3 && e.message?.includes('Rate limit')) {
        process.stdout.write(`  ⏳ Rate limited, retrying ${sku}...\n`);
        await new Promise(r => setTimeout(r, 2000 * attempts));
      } else {
        process.stdout.write(`  ❌ ${sku}: ${e.message?.slice(0, 60)}\n`);
        failed++;
        break;
      }
    }
  }
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\n${'═'.repeat(55)}`);
if (!DRY_RUN) console.log(`  Updated: ${updated} | Failed: ${failed}`);
console.log(`  ${total - updated - failed} skipped (no suitable parent found)`);
console.log(`${'═'.repeat(55)}\n`);
