#!/usr/bin/env node
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const data = JSON.parse(readFileSync(path.join(__dirname, '../orbus_catalog/products_with_all_files.json'), 'utf-8'));
const products = data.products || [];

const glbSkus = new Set([
  'AKIT-1S','ARCH-01','ARCH-02','ARCH-03','ARCH-06','ARCH-07','BARRICADE-COVER',
  'BLD-LT-1200','BLD-LT-920','BLZ-0306','BLZ-0308','BLZ-0406','BLZ-0408',
  'BLZ-0608','BLZ-0808','BLZ-1008','BLZ-1010','BLZ-2008','BLZ-H-2010',
  'BLZ-W-0603','BLZ-W-0604','BLZ-W-0606','BLZ-W-0803','BLZ-W-0804','BLZ-W-0806',
  'BLZ-W-0808','BLZ-W-1008','BLZ-W-1010','BLZ-W-2008','BLZ-W-2010','BLZ-W-3008',
  'BREAKAWAY-BANNER-LARGE','BREZ-2','C-WALL','CFAB-K-05','CFAB-K-06','CFAB-K-07',
  'CFAB-K-08','CFAB-K-09','CFAB-K-10','CL-TBLTP-LB-01','COL-01','COL-02','COL-03',
  'CONTOUR-01-PB','CYL-01','EMB-1X2-S','EMB-2X2-S','EMB-3X3-S','EMB-4X4-S',
  'EMB-BL-4X3-S','EMB-EXT-SHLF-K-2','FF-CT-CL-BL','FMLT-BL-WS3-01','FMLT-BL-WS5-01',
  'FMLT-BL-WS8-01','FMLT-CHRG-COUNTER-1','FMLT-DS-10-04','FMLT-DS-10-05',
  'FMLT-DS-10-06','FMLT-DS-10-07','FMLT-DS-10-08','FMLT-DS-10-09','FMLT-DS-10-13',
  'FMLT-DS-20-07','FMLT-DS-20-12','FMLT-E-BL-1100','FMLT-E-S-1000-2','FMLT-E-S-1200-2',
  'FMLT-E-S-1500-2','FMLT-E-S-600-2','FMLT-E-S-800-2','FMLT-E-S-850-2','FMLT-E-S-920-2',
  'FMLT-E-S10-02','FMLT-E-SC10-02','FMLT-KIOSK-01','FMLT-KIOSK-02','FMLT-KIOSK-03',
  'FMLT-KIOSK-04','FMLT-LT-01','FMLT-WBWA-05','FMLT-WH0810','FMLT-WH8-01','FMLT-WL04',
  'FMLT-WS0810','FMLT-WS8-01','FMLT-WTT-V03','FMLT-WV10-01','FMLT-WV8-01',
  'FS-WOODCRATE','HOP-2-12X3-S','HOP-DIM-01','HOP-DIM-02','HP-K-01','HP-K-02',
  'HP-K-03','HP-K-04','HP-K-05','HP-K-06','HP-K-07','HP-K-09','HP-K-11','HP-K-13',
  'HP-K-14','HP-K-15','HP-K-19','HP-K-24','HP-K-25','HP-K-27','HP-K-34','HP-K-35',
  'HP-K-36','HP-K-37','HPT-02','HPT-04','LED-COOL-WHT-BLAST','LED-RGB-BLAST',
  'LED-WRM-WHT-BLAST','LUM-LED2-ORL','LUM-LED3-ORL-B','MFY-RSR-02','MOD-30-01',
  'MOD-30-03','MOD-30-04','MOD-DOOR-M','MOD-FRM-01','MOD-FRM-02','MOD-FRM-03',
  'MOD-FRM-04','MOD-FRM-05','MOD-FRM-06','MOD-FRM-07','MOD-FRM-08','MOD-FRM-09',
  'MOD-FRM-12','OCB-2','PBFM902-B-HDR','PGSUS3','PM4S3-MK','QUARTER-WOODCRATE',
  'RU-S1-4','SHD-TOWER-01','SHD-TOWER-02','SHD-TOWER-03','SYNERGY-800','TABLET-STD-05',
  'TWIRL','VF-ESS-LB-R-01','VF-ESS-LB-R-02','VF-ESS-LB-R-03','VF-ESS-LB-R-04',
  'VF-LB-R-01','VF-R-01','VF-R-02','VF-TWR-01','VFF-01-3','VFF-01-F','VFF-02-F',
  'VFF-03-F','VFF-CT-BL','VFF-LB-02-F','W-01-C','W-02-C','W-03-C','W-04-C',
  'W-05-C','W-06-C-02','W-06-C-03','W-06-C-04','W-06-C-05','ZM-FLX-FOLDABLE',
  'ZOOM-FLX-D-LG','ZOOM-FLX-EDGE-M','ZOOM-FLX-TNT','HP-K-19','VF-MK-02',
  'TOWER-02','TOWER-03'
]);

const withGLB = products.filter(p => glbSkus.has(p.sku));
const byCat = {};
withGLB.forEach(p => {
  const cat = p.category || p.subcategory || 'Unknown';
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push({ sku: p.sku, name: p.name });
});

console.log(`Total products with 3D models: ${withGLB.length}\n`);
Object.entries(byCat).sort((a,b) => b[1].length - a[1].length).forEach(([cat, items]) => {
  console.log(`\n${cat.toUpperCase()} (${items.length})`);
  items.forEach(i => console.log(`  ${i.sku} - ${i.name}`));
});
