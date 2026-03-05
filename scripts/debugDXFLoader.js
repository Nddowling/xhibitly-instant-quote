#!/usr/bin/env node

/**
 * Debug DXF Loading Issues
 *
 * Tests different approaches to load and parse DXF files
 */

import { readFileSync } from 'fs';
import { DXFLoader } from 'three-dxf-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DXF_FILE = "/Users/nicholasdowling/Projects/circle/xhibitly-instant-quote/orbus_catalog/temp_cad/cad_vf-ess-lb-r-01/dxf_output/VF-ESS-LB-R-01 (with Graphics).dxf";

console.log('🔍 Debugging DXF Loader\n');

// Test 1: Check file size and version
console.log('📊 File Info:');
const stats = readFileSync(DXF_FILE);
console.log(`   Size: ${(stats.length / 1024 / 1024).toFixed(2)} MB`);

const firstLines = readFileSync(DXF_FILE, 'utf-8').split('\n').slice(0, 20);
const versionLine = firstLines.find(line => line.trim().startsWith('AC'));
console.log(`   DXF Version: ${versionLine ? versionLine.trim() : 'Unknown'}`);
console.log('');

// Test 2: Try loading with three-dxf-loader
console.log('🧪 Test 1: three-dxf-loader (current approach)');
try {
  const loader = new DXFLoader();
  const dxfData = readFileSync(DXF_FILE, 'utf-8');

  console.log('   Parsing...');
  const result = loader.parse(dxfData);

  console.log('   Result type:', typeof result);
  console.log('   Result keys:', Object.keys(result || {}));

  if (result) {
    console.log('   Has entities:', !!result.entities);
    console.log('   Entities length:', result.entities?.length || 0);
    console.log('   Has layers:', !!result.layers);
    console.log('   Has tables:', !!result.tables);
  }

  if (!result || !result.entities || result.entities.length === 0) {
    console.log('   ❌ FAILED: Empty or no entities');
  } else {
    console.log('   ✅ SUCCESS: Found', result.entities.length, 'entities');
  }
} catch (error) {
  console.log('   ❌ ERROR:', error.message);
}
console.log('');

// Test 3: Try different encoding
console.log('🧪 Test 2: Try binary/latin1 encoding');
try {
  const loader = new DXFLoader();
  const dxfData = readFileSync(DXF_FILE, 'latin1');

  console.log('   Parsing with latin1 encoding...');
  const result = loader.parse(dxfData);

  if (!result || !result.entities || result.entities.length === 0) {
    console.log('   ❌ FAILED: Empty or no entities');
  } else {
    console.log('   ✅ SUCCESS: Found', result.entities.length, 'entities');
  }
} catch (error) {
  console.log('   ❌ ERROR:', error.message);
}
console.log('');

// Test 4: Check what three-dxf-loader actually returns
console.log('🧪 Test 3: Detailed inspection');
try {
  const loader = new DXFLoader();
  const dxfData = readFileSync(DXF_FILE, 'utf-8');

  const result = loader.parse(dxfData);
  console.log('   Full result:', JSON.stringify(result, null, 2).substring(0, 500) + '...');
} catch (error) {
  console.log('   ❌ ERROR:', error.message);
}
console.log('');

console.log('💡 Recommendations:');
console.log('   1. Convert to older DXF version (AC1015/AC1018)');
console.log('   2. Try alternative parser (dxf-parser npm package)');
console.log('   3. Use Blender for conversion (DWG → GLB directly)');
