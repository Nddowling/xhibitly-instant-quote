#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { DXFLoader } from 'three-dxf-loader';

const DXF_FILE = "/Users/nicholasdowling/Projects/circle/xhibitly-instant-quote/orbus_catalog/temp_cad/cad_vf-ess-lb-r-01/dxf_output/VF-ESS-LB-R-01 (with Graphics).dxf";

console.log('🔍 Inspecting DXF Structure\n');

const loader = new DXFLoader();
const dxfData = readFileSync(DXF_FILE, 'utf-8');

const result = loader.parse(dxfData);

console.log('📦 Top-level keys:', Object.keys(result));
console.log('');

console.log('📐 result.entity:');
console.log('   Type:', result.entity?.type);
console.log('   UUID:', result.entity?.uuid);
console.log('   Keys:', Object.keys(result.entity || {}));
console.log('');

console.log('📊 result.entity.children:');
console.log('   Is array:', Array.isArray(result.entity?.children));
console.log('   Length:', result.entity?.children?.length || 0);
console.log('');

if (result.entity?.children?.length > 0) {
  console.log('👁️  First child:');
  const firstChild = result.entity.children[0];
  console.log('   Type:', firstChild.type);
  console.log('   UUID:', firstChild.uuid);
  console.log('   Keys:', Object.keys(firstChild));
  if (firstChild.geometry) {
    console.log('   Geometry UUID:', firstChild.geometry);
  }
  console.log('');
}

console.log('📋 result.entity.metadata:');
console.log(JSON.stringify(result.entity?.metadata, null, 2));
console.log('');

console.log('🎨 result.entity.geometries:');
console.log('   Count:', result.entity?.geometries?.length || 0);
if (result.entity?.geometries?.length > 0) {
  console.log('   First geometry type:', result.entity.geometries[0].type);
  console.log('   First geometry UUID:', result.entity.geometries[0].uuid);
}
console.log('');

console.log('📄 result.dxf:');
console.log('   Type:', typeof result.dxf);
console.log('   Keys:', Object.keys(result.dxf || {}));
if (result.dxf) {
  console.log('   Header:', Object.keys(result.dxf.header || {}).slice(0, 5));
  console.log('   Tables:', Object.keys(result.dxf.tables || {}));
  console.log('   Blocks:', result.dxf.blocks ? 'Present' : 'Missing');
  console.log('   Entities:', result.dxf.entities ? 'Present' : 'Missing');
}
console.log('');

// Save full structure to file for inspection
writeFileSync(
  '/Users/nicholasdowling/Projects/circle/xhibitly-instant-quote/orbus_catalog/temp_cad/dxf_structure.json',
  JSON.stringify(result, null, 2)
);
console.log('✅ Saved full structure to: orbus_catalog/temp_cad/dxf_structure.json');
console.log('   (First 50KB only to avoid huge files)');
