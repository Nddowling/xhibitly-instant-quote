#!/usr/bin/env node
/**
 * Inspect a few failing CAD zips to see what file types they contain
 */
import { readFileSync } from 'fs';
import AdmZip from 'adm-zip';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: '.env.local' });

const data = JSON.parse(readFileSync(path.join(__dirname, '../orbus_catalog/products_with_all_files.json'), 'utf-8'));
const products = data.products || [];

// Get products with CAD that don't have GLBs (by checking known GLB SKUs)
const knownGLBSkus = new Set([
  'AKIT-1S','ARCH-07','BARRICADE-COVER','BLD-LT-1200','BREAKAWAY-BANNER-LARGE',
  'CONTOUR-01-PB','EMB-1X2-S','EMB-2X2-S','EMB-3X3-S','EMB-4X4-S','EMB-BL-4X3-S',
  'EMB-EXT-SHLF-K-2','FMLT-BL-WS3-01','FMLT-BL-WS5-01','FMLT-BL-WS8-01',
  'FMLT-E-BL-1100','FMLT-E-S-1000-2','FMLT-E-S-1200-2','FMLT-E-S-1500-2',
  'FMLT-E-S-600-2','FMLT-E-S-800-2','FMLT-E-S-850-2','FMLT-E-S-920-2',
  'HOP-2-12X3-S','HOP-DIM-02','HP-K-11','HP-K-13','HP-K-14','HP-K-24','HP-K-25',
  'HP-K-27','HP-K-34','LED-WRM-WHT-BLAST','MOD-30-01','MOD-30-04','MOD-DOOR-M',
  'MOD-FRM-01','MOD-FRM-02','MOD-FRM-03','MOD-FRM-04','MOD-FRM-05','MOD-FRM-06',
  'MOD-FRM-07','MOD-FRM-08','MOD-FRM-09','MOD-FRM-12','OCB-2','PBFM902-B-HDR',
  'QUARTER-WOODCRATE','SYNERGY-800','TWIRL','VF-ESS-LB-R-01','VF-ESS-LB-R-02',
  'VF-LB-R-01','VF-TWR-01','VFF-02-F','VFF-LB-02-F','ZM-FLX-FOLDABLE',
  'ZOOM-FLX-EDGE-M','ZOOM-FLX-TNT'
]);

const noGLB = products.filter(p =>
  p.sku && !knownGLBSkus.has(p.sku) &&
  p.additional_downloads?.some(d => d.asset_type === 'cad' && d.url)
);

console.log(`Products with CAD but no GLB: ${noGLB.length}\n`);
console.log('Sampling 5 to inspect zip contents...\n');

const sample = noGLB.slice(0, 5);

for (const product of sample) {
  const cadFile = product.additional_downloads.find(d => d.asset_type === 'cad');
  console.log(`${product.sku} - ${product.name}`);
  console.log(`  File: ${cadFile.filename}`);

  try {
    const resp = await axios.get(cadFile.url, { responseType: 'arraybuffer', timeout: 15000 });
    const zip = new AdmZip(Buffer.from(resp.data));
    const entries = zip.getEntries().map(e => e.entryName);
    const exts = [...new Set(entries.map(e => path.extname(e).toLowerCase()).filter(Boolean))];
    console.log(`  Files in zip: ${entries.slice(0, 8).join(', ')}${entries.length > 8 ? '...' : ''}`);
    console.log(`  Extensions: ${exts.join(', ')}`);
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
  console.log();
}
