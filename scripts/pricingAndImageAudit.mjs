/**
 * Pricing & Image Audit
 *
 * 1. Assigns industry ballpark prices to every SKU based on product type/size
 * 2. Ensures every product has the best available image URL
 * 3. Updates Base44 Product records with base_price, retail_price, primary_image_url
 *
 * Pricing is formatted as currency to 2 decimal places (e.g. 234.55)
 *
 * Usage: node scripts/pricingAndImageAudit.mjs
 *        node scripts/pricingAndImageAudit.mjs --dry-run   (show plan, no updates)
 */

import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@base44/sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const DRY_RUN = process.argv.includes('--dry-run');
const CATALOG_PAGE_OFFSET = 2;
const SUPABASE_BASE = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';

const base44 = createClient({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false
});

// ── Pricing Table ──────────────────────────────────────────────────────────────
// Returns { base_price, retail_price } based on SKU pattern + product name
function getPricing(sku, name, category) {
  const s = sku.toUpperCase();
  const n = (name || '').toLowerCase();

  // ── Banner Stands ──────────────────────────────────────────────────────────
  if (s.startsWith('BLD-LT'))  return p(119.00, 179.00);   // Blade Lite
  if (s.startsWith('BLD-'))    return p(189.00, 279.00);   // Blade standard
  if (s.startsWith('IMG-'))    return p(209.00, 299.00);   // Imagine
  if (s.startsWith('RPB-'))    return p(149.00, 219.00);   // Retractable Pro Budget
  if (s.startsWith('SB-'))     return p(169.00, 249.00);   // Spring Back
  if (s.startsWith('TWIST-'))  return p(349.00, 499.00);   // Twist

  // ── Fabric Banners ─────────────────────────────────────────────────────────
  if (s.startsWith('FMM-') || n.includes('modulate'))  return p(289.00, 419.00);
  if (s.startsWith('FME-'))    return p(249.00, 359.00);   // Formulate Essential banner
  if (s.startsWith('FMLT-')) {
    if (n.includes('tabletop') || n.includes('tt'))     return p(499.00, 729.00);
    if (n.includes('8\'') || n.includes('08'))          return p(1249.00, 1799.00);
    if (n.includes('10\'') || n.includes('s10'))        return p(1549.00, 2199.00);
    if (n.includes('20\'') || n.includes('s20'))        return p(2799.00, 3999.00);
    if (n.includes('whiteboard') || s.includes('WB'))   return p(699.00, 999.00);
    return p(1299.00, 1899.00);
  }

  // ── Fabric Light Boxes ─────────────────────────────────────────────────────
  if (s.startsWith('BLZ-SQ-')) {
    const dim = s.match(/(\d{2})(\d{2})$/);
    if (dim) {
      const w = parseInt(dim[1]);
      if (w <= 8)  return p(489.00, 699.00);
      if (w <= 10) return p(649.00, 929.00);
      if (w <= 12) return p(849.00, 1199.00);
      return p(1249.00, 1799.00);
    }
    return p(649.00, 929.00);
  }
  if (s.startsWith('VF-LB-R-') || s.startsWith('VF-LB-S-') || n.includes('light box')) {
    if (n.includes('round'))  return p(549.00, 789.00);
    if (n.includes('square')) return p(499.00, 719.00);
    return p(519.00, 749.00);
  }

  // ── Hanging Banners ────────────────────────────────────────────────────────
  if (n.includes('hanging banner') || s.startsWith('HB-') || s.startsWith('VFF-')) {
    return p(249.00, 359.00);
  }

  // ── Outdoor Displays ──────────────────────────────────────────────────────
  if (s.startsWith('VY-') && s.includes('-BG'))   return p(39.00, 59.00);   // Viper bag
  if (s.startsWith('VY-')) {
    const num = parseInt(s.replace('VY-',''));
    const prices = [129.00, 149.00, 179.00, 199.00, 229.00];
    const base = prices[num - 1] || 149.00;
    return p(base, Math.round(base * 1.45 * 100) / 100);
  }
  if (s.startsWith('VFE-')) {
    return p(159.00, 229.00);  // Vector Frame Easy
  }
  if (n.includes('zoom') && n.includes('tent'))    return p(899.00, 1299.00);
  if (n.includes('tent') || n.includes('canopy'))  return p(749.00, 1099.00);
  if (n.includes('monsoon') || n.includes('a-frame')) return p(299.00, 429.00);
  if (n.includes('flag') || n.includes('feather')) return p(149.00, 219.00);
  if (n.includes('advocate'))                      return p(299.00, 429.00);

  // ── Table Throws & Runners ─────────────────────────────────────────────────
  if (n.includes('table throw') || n.includes('table runner')) {
    if (n.includes('stretch') || n.includes('fitted')) return p(189.00, 269.00);
    return p(159.00, 229.00);
  }

  // ── Folding Panel Tabletop ─────────────────────────────────────────────────
  if (s.startsWith('FPT-') || n.includes('folding panel')) return p(379.00, 549.00);

  // ── Hopup ─────────────────────────────────────────────────────────────────
  if (s.startsWith('HOP-DIM') || s.startsWith('HOP-2-BL')) {
    if (n.includes('5\'') || n.includes('2x2') || n.includes('tabletop')) return p(1199.00, 1749.00);
    if (n.includes('7') || n.includes('3x3'))  return p(1799.00, 2599.00);
    if (n.includes('10\'') || n.includes('4x3')) return p(2299.00, 3299.00);
    return p(1799.00, 2599.00);
  }
  if (s.startsWith('HOP-LITE')) {
    if (n.includes('7') || n.includes('3x3'))  return p(1299.00, 1899.00);
    if (n.includes('10\'') || n.includes('4x3')) return p(1649.00, 2399.00);
    return p(1299.00, 1899.00);
  }
  if (s.startsWith('HOP-CT'))  return p(699.00, 999.00);   // Hopup counter
  if (s.startsWith('OC-HOP'))  return p(349.00, 499.00);   // Hopup case

  // ── Embrace ───────────────────────────────────────────────────────────────
  if (s.startsWith('EMB-') && !s.startsWith('EMB-CT')) {
    if (n.includes('1x1') || n.includes('2x1')) return p(799.00, 1149.00);
    if (n.includes('2x2') || n.includes('1x3')) return p(1199.00, 1749.00);
    if (n.includes('3x2') || n.includes('2x3')) return p(1799.00, 2599.00);
    if (n.includes('3x3') || n.includes('4x3')) return p(2399.00, 3499.00);
    if (n.includes('5x3') || n.includes('6x3')) return p(3199.00, 4599.00);
    if (n.includes('8x3') || n.includes('12x3'))return p(4499.00, 6499.00);
    if (n.includes('bridge'))                   return p(899.00, 1299.00);
    return p(1599.00, 2299.00);
  }
  if (s.startsWith('EMB-CT') || s.startsWith('EMB-TBL')) return p(649.00, 929.00);
  if (s.startsWith('EMB-LITE')) {
    if (n.includes('4x3')) return p(1499.00, 2199.00);
    return p(1199.00, 1749.00);
  }
  if (s.startsWith('EMB-MM') || s.startsWith('EMB-EXT') || s.startsWith('EMB-BRIDGE')) {
    return p(349.00, 499.00);
  }

  // ── XClaim Pyramid Kits ───────────────────────────────────────────────────
  if (s.startsWith('XCLM-3QP'))  return p(1499.00, 2199.00);
  if (s.startsWith('XCLM-6QP'))  return p(2499.00, 3599.00);
  if (s.startsWith('XCLM-10QP')) return p(3999.00, 5799.00);

  // ── Coyote Popup ──────────────────────────────────────────────────────────
  if (s.startsWith('COY-KKG-1X1')) return p(849.00, 1249.00);
  if (s.startsWith('COY-KKG-2X1')) return p(1249.00, 1799.00);
  if (s.startsWith('COY-KKG-2X2')) return p(1799.00, 2599.00);
  if (s.startsWith('COY-KKG-3X2')) return p(2499.00, 3599.00);
  if (s.startsWith('COY-KKG-2X3')) return p(2299.00, 3299.00);
  if (s.startsWith('COY-KKG-3X3')) return p(3199.00, 4599.00);
  if (s.startsWith('COY-KKG-4X3')) return p(4199.00, 5999.00);
  if (s === 'COY-IS-CK')           return p(249.00, 359.00);
  if (s === 'COY-MM')              return p(149.00, 219.00);

  // ── Trapezoid / Snap frames ───────────────────────────────────────────────
  if (s.startsWith('TRP2-'))  return p(299.00, 429.00);
  if (s.startsWith('LED-SNAP')) return p(199.00, 289.00);
  if (s.startsWith('CUBE-'))   return p(1499.00, 2199.00);
  if (s.startsWith('FUN-'))    return p(899.00, 1299.00);

  // ── Wall Signs ────────────────────────────────────────────────────────────
  if (n.includes('dimensional letter'))  return p(299.00, 429.00);
  if (n.includes('wall mount'))          return p(399.00, 569.00);
  if (n.includes('wayfinding'))          return p(249.00, 359.00);
  if (s.startsWith('ZD-'))              return p(329.00, 469.00);
  if (s === 'QNTM-SS')                  return p(449.00, 649.00);
  if (s === 'ZD-LITE')                  return p(229.00, 329.00);
  if (s === 'OASIS')                    return p(1299.00, 1899.00);
  if (s.startsWith('SMDR-') || s.startsWith('SNP-')) return p(249.00, 359.00);
  if (s === 'STEP-STOOL-BLUE')          return p(79.00, 119.00);

  // ── Modulate Magnetic ─────────────────────────────────────────────────────
  if (s.startsWith('MM-') || n.includes('modulate magnetic')) {
    if (n.includes('10\'') || n.includes('10 ft'))   return p(2799.00, 3999.00);
    if (n.includes('20\'') || n.includes('20 ft'))   return p(4999.00, 7199.00);
    if (n.includes('30\'') || n.includes('30 ft'))   return p(7499.00, 10799.00);
    return p(1799.00, 2599.00);
  }

  // ── Formulate Essential ───────────────────────────────────────────────────
  if (s.startsWith('ESS-') || n.includes('formulate essential')) {
    if (n.includes('tabletop'))          return p(799.00, 1149.00);
    if (n.includes('8') || n.includes('08'))  return p(1599.00, 2299.00);
    if (n.includes('10'))                return p(1999.00, 2899.00);
    return p(1599.00, 2299.00);
  }

  // ── Formulate Master ──────────────────────────────────────────────────────
  if (s.startsWith('FMLT-E-') || n.includes('formulate master')) {
    if (n.includes('tabletop'))          return p(1099.00, 1599.00);
    if (n.includes('8'))                 return p(2299.00, 3299.00);
    if (n.includes('10'))                return p(2799.00, 3999.00);
    if (n.includes('20'))                return p(4999.00, 7199.00);
    return p(2499.00, 3599.00);
  }

  // ── Formulate Master Kits ─────────────────────────────────────────────────
  if (s.startsWith('RNG-') || n.includes('round')) return p(1999.00, 2899.00);

  // ── Formulate Designer ────────────────────────────────────────────────────
  if (s.startsWith('HP-K-') || n.includes('designer')) {
    const num = parseInt(s.replace('HP-K-',''));
    if (num <= 10)                       return p(3499.00, 4999.00);
    if (num <= 20)                       return p(5999.00, 8599.00);
    return p(4999.00, 7199.00);
  }

  // ── Formulate Fusion (20x20 island) ──────────────────────────────────────
  if (n.includes('fusion') || n.includes('island')) {
    if (s.startsWith('KIT')) {
      const num = parseInt(s.replace('KIT', '').trim());
      if (num <= 4)  return p(8999.00, 12999.00);
      if (num <= 11) return p(12999.00, 18999.00);
      return p(16999.00, 24999.00);
    }
  }

  // ── Formulate Hanging / Architectural ─────────────────────────────────────
  if (n.includes('hanging sign') || n.includes('hanging display')) return p(1499.00, 2199.00);
  if (n.includes('tower'))            return p(2999.00, 4299.00);
  if (n.includes('arch'))             return p(4499.00, 6499.00);
  if (n.includes('conference wall'))  return p(5999.00, 8599.00);

  // ── Hybrid Pro Modular ────────────────────────────────────────────────────
  if (n.includes('hybrid') || s.startsWith('HPT-') || s.startsWith('HPC-')) {
    if (n.includes('10\'') || s.includes('05') || s.includes('06') || s.includes('07') || s.includes('08')) return p(4999.00, 7199.00);
    if (n.includes('20\'') || n.includes('island'))  return p(9999.00, 14399.00);
    if (n.includes('closet') || n.includes('storage')) return p(1999.00, 2899.00);
    if (n.includes('counter'))                        return p(899.00, 1299.00);
    return p(3999.00, 5799.00);
  }

  // ── Vector Frame Modular ──────────────────────────────────────────────────
  if (s.startsWith('VF-K-') || s.startsWith('VF-R-') || s.startsWith('VF-S-') || s.startsWith('VFC-')) {
    if (n.includes('banner'))          return p(349.00, 499.00);
    if (n.includes('10\'') || n.includes('kit 02') || n.includes('kit 03') || n.includes('kit 04')) return p(2999.00, 4299.00);
    if (n.includes('20\'') || n.includes('kit 09') || n.includes('kit 10') || n.includes('kit 11')) return p(5499.00, 7899.00);
    if (n.includes('tower'))           return p(2499.00, 3599.00);
    if (n.includes('accent') || n.includes('counter')) return p(799.00, 1149.00);
    return p(2499.00, 3599.00);
  }
  if (s.startsWith('OR-K-') || s.startsWith('OR-SM-') || s.startsWith('OR-M-') || s.startsWith('OR-LG-') || s.startsWith('OR-STG') || s.startsWith('OR-TC') || s.startsWith('OR-24') || s.startsWith('OR-36') || s.startsWith('OR-46')) {
    if (n.includes('10\'') || s.startsWith('OR-K-CE1') || s.startsWith('OR-K-AT1')) return p(4999.00, 7199.00);
    if (n.includes('20\'') || s.startsWith('OR-K-PX1') || s.startsWith('OR-K-PR1')) return p(8999.00, 12999.00);
    if (n.includes('island'))          return p(12999.00, 18999.00);
    if (n.includes('monitor') || n.includes('accessory')) return p(499.00, 719.00);
    return p(2999.00, 4299.00);
  }

  // ── Collapsible Counters ──────────────────────────────────────────────────
  if (n.includes('counter') || s.startsWith('COUNTER')) {
    if (n.includes('large') || n.includes('xl'))  return p(799.00, 1149.00);
    if (n.includes('curved'))                     return p(699.00, 999.00);
    return p(499.00, 719.00);
  }

  // ── Info Centers / Kiosks ─────────────────────────────────────────────────
  if (n.includes('tablet stand') || n.includes('ipad')) return p(249.00, 359.00);
  if (n.includes('kiosk'))                              return p(999.00, 1449.00);
  if (n.includes('sign stand') || n.includes('signage stand')) return p(149.00, 219.00);
  if (n.includes('literature') || n.includes('brochure'))      return p(199.00, 289.00);

  // ── Lighting ──────────────────────────────────────────────────────────────
  if (n.includes('light') || s.startsWith('LED-') || n.includes('spot'))  return p(119.00, 179.00);

  // ── Cases ─────────────────────────────────────────────────────────────────
  if (s === 'OCX')                      return p(699.00, 999.00);
  if (s === 'OCE-2' || s === 'OCH')     return p(499.00, 719.00);
  if (s === 'OCH2')                     return p(599.00, 869.00);
  if (s === 'OCT')                      return p(899.00, 1299.00);
  if (s === 'OCFM' || s === 'OCF')      return p(799.00, 1149.00);
  if (s === 'OCF2')                     return p(999.00, 1449.00);
  if (s === 'OC-HOP')                   return p(349.00, 499.00);
  if (s === 'TROLLEY')                  return p(149.00, 219.00);
  if (n.includes('case') || n.includes('carrying')) return p(349.00, 499.00);

  // ── MODify Retail Merchandising System ────────────────────────────────────
  if (s.startsWith('MFY-SS-K')) {
    const num = parseInt(s.match(/K-0*(\d+)/)?.[1] || '1');
    const base = 799 + (num - 1) * 200;
    return p(base + 0.00, Math.round(base * 1.45 * 100) / 100);
  }
  if (s.startsWith('MFY-DS-K')) {
    const num = parseInt(s.match(/K-0*(\d+)/)?.[1] || '1');
    const base = 1199 + (num - 1) * 300;
    return p(base + 0.00, Math.round(base * 1.45 * 100) / 100);
  }
  if (s.startsWith('MFY-GN-K')) return p(1599.00, 2319.00);
  if (s.startsWith('MFY-4S-K')) {
    const num = parseInt(s.match(/K-0*(\d+)/)?.[1] || '1');
    const base = 1999 + (num - 1) * 400;
    return p(base + 0.00, Math.round(base * 1.45 * 100) / 100);
  }
  if (s.startsWith('MFY-PED')) return p(299.00, 429.00);

  // ── Accessories / Misc ────────────────────────────────────────────────────
  if (n.includes('bag') || n.includes('carry bag'))   return p(49.00, 69.00);
  if (n.includes('monitor mount') || n.includes('monitor stand')) return p(299.00, 429.00);

  // ── Fallback by category ──────────────────────────────────────────────────
  const cat = (category || '').toLowerCase();
  if (cat.includes('banner stand'))      return p(239.00, 349.00);
  if (cat.includes('fabric banner'))     return p(299.00, 429.00);
  if (cat.includes('light box'))         return p(599.00, 869.00);
  if (cat.includes('outdoor'))           return p(399.00, 569.00);
  if (cat.includes('table throw'))       return p(179.00, 259.00);
  if (cat.includes('tabletop'))          return p(449.00, 649.00);
  if (cat.includes('hopup') || cat.includes('embrace') || cat.includes('popup')) return p(1799.00, 2599.00);
  if (cat.includes('xclaim') || cat.includes('pyramid')) return p(2499.00, 3599.00);
  if (cat.includes('coyote'))            return p(2999.00, 4299.00);
  if (cat.includes('modulate') || cat.includes('formulate')) return p(2499.00, 3599.00);
  if (cat.includes('hybrid'))            return p(5999.00, 8599.00);
  if (cat.includes('truss') || cat.includes('orbital')) return p(5999.00, 8599.00);
  if (cat.includes('counter'))           return p(599.00, 869.00);
  if (cat.includes('lighting'))          return p(119.00, 179.00);
  if (cat.includes('case'))              return p(399.00, 569.00);
  if (cat.includes('modify') || cat.includes('retail')) return p(999.00, 1449.00);

  // Ultimate fallback
  return p(499.00, 719.00);
}

// Helper: format currency to 2 decimal places
function p(base, retail) {
  return {
    base_price:   parseFloat(base.toFixed(2)),
    retail_price: parseFloat(retail.toFixed(2))
  };
}

// ── Image resolution ──────────────────────────────────────────────────────────
function getBestImageUrl(sku, printPage, productsMap) {
  // 1. Use scraped Supabase product image if available
  const product = productsMap.get(sku);
  if (product) {
    const scraped = product.images?.find(img => img.supabase_url)?.supabase_url;
    if (scraped) return scraped;
    if (product.images?.[0]?.url) return product.images[0].url;
  }

  // 2. Fall back to catalog page image
  if (printPage) {
    const pdfPage = printPage + CATALOG_PAGE_OFFSET;
    return `${SUPABASE_BASE}/catalog/pages/page-${String(pdfPage).padStart(3, '0')}.jpg`;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const mapping   = JSON.parse(readFileSync('orbus_catalog/product_catalog_page_mapping.json', 'utf-8'));
const scanLog   = JSON.parse(readFileSync('orbus_catalog/catalog_scan_log.json', 'utf-8'));
const productsRaw = JSON.parse(readFileSync('orbus_catalog/products.json', 'utf-8'));
const products = productsRaw.products || (Array.isArray(productsRaw) ? productsRaw : []);
const productsMap = new Map(products.map(p => [p.sku, p]));

// Build name lookup from scan log
const scanNames = {};
for (const entry of Object.values(scanLog)) {
  for (const { sku, name } of (entry.skus || [])) {
    if (sku && !scanNames[sku]) scanNames[sku] = name;
  }
}

// Deduplicate mapping by SKU
const skuMap = new Map();
for (const entry of mapping.product_page_mapping) {
  if (entry.product_sku && !skuMap.has(entry.product_sku)) {
    skuMap.set(entry.product_sku, entry);
  }
}

console.log(`\n💰 Pricing & Image Audit`);
console.log(`   Total unique SKUs: ${skuMap.size}`);
console.log(`   Products with scraped images: ${products.filter(p => p.images?.length > 0).length}`);
if (DRY_RUN) console.log(`   *** DRY RUN ***`);
console.log('');

let updated = 0, created = 0, skipped = 0, failed = 0;
const pricingReport = [];

// Upsert: filter by SKU to find existing record, then update or create
async function upsertProduct(sku, payload) {
  // Try to find existing record
  let existing = null;
  try {
    const results = await base44.entities.Product.filter({ sku }) || [];
    existing = results[0] || null;
  } catch (_) { /* filter not supported — fall through to create */ }

  if (existing) {
    await base44.entities.Product.update(existing.id, {
      base_price: payload.base_price,
      retail_price: payload.retail_price,
      primary_image_url: payload.primary_image_url || existing.primary_image_url,
      catalog_page: payload.catalog_page,
    });
    return 'updated';
  } else {
    await base44.entities.Product.create(payload);
    return 'created';
  }
}

for (const [sku, entry] of skuMap) {
  const name     = entry.product_name || scanNames[sku] || sku;
  const category = entry.category || 'Trade Show Displays';
  const printPage = entry.primary_page;
  const { base_price, retail_price } = getPricing(sku, name, category);
  const imageUrl = getBestImageUrl(sku, printPage, productsMap);

  pricingReport.push({ sku, name: name.slice(0, 60), category, base_price, retail_price, has_image: !!imageUrl, source: productsMap.has(sku) ? 'scraped' : 'catalog-page' });

  if (DRY_RUN) {
    process.stdout.write(`  🔍 ${sku}: $${base_price.toFixed(2)} / $${retail_price.toFixed(2)} | ${imageUrl ? '📷' : '❌'}\n`);
    continue;
  }

  const payload = {
    sku,
    name,
    category,
    base_price,
    retail_price,
    catalog_page: printPage,
    primary_image_url: imageUrl || null,
    images: imageUrl ? [imageUrl] : [],
    is_active: true,
    source: 'catalog-2026',
  };

  try {
    const result = await upsertProduct(sku, payload);
    process.stdout.write(`  ✅ [${result}] ${sku}: $${base_price.toFixed(2)} | ${imageUrl ? '📷' : '❌ no img'}\n`);
    if (result === 'updated') updated++; else created++;
  } catch (e) {
    process.stdout.write(`  ❌ ${sku}: ${e.message?.slice(0, 80)}\n`);
    failed++;
  }
  await new Promise(r => setTimeout(r, 200));
}

// Save pricing report locally
writeFileSync('orbus_catalog/pricing_report.json', JSON.stringify(pricingReport, null, 2));

console.log(`\n${'═'.repeat(56)}`);
console.log(`  Updated:  ${updated}`);
console.log(`  Created:  ${created}`);
console.log(`  Failed:   ${failed}`);
console.log(`  Report:   orbus_catalog/pricing_report.json`);
console.log(`${'═'.repeat(56)}\n`);
