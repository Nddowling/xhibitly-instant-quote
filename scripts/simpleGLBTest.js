#!/usr/bin/env node

/**
 * Simple test: Load DXF and export to GLB
 * Uses alternative approach without browser APIs
 */

import { readFileSync, writeFileSync } from 'fs';
import * as THREE from 'three';
import { DXFLoader } from 'three-dxf-loader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { JSDOM } from 'jsdom';

// Use jsdom for proper FileReader
const dom = new JSDOM();
globalThis.FileReader = dom.window.FileReader;
globalThis.Blob = dom.window.Blob;
globalThis.document = dom.window.document;

const DXF_FILE = "/Users/nicholasdowling/Projects/circle/xhibitly-instant-quote/orbus_catalog/temp_cad/cad_vf-ess-lb-r-01/dxf_output/VF-ESS-LB-R-01 (with Graphics).dxf";
const GLB_OUTPUT = "/Users/nicholasdowling/Projects/circle/xhibitly-instant-quote/orbus_catalog/temp_cad/test-output.glb";

console.log('🧪 Simple GLB Export Test\n');

// Load DXF
console.log('📥 Loading DXF...');
const loader = new DXFLoader();
const dxfData = readFileSync(DXF_FILE, 'utf-8');
const result = loader.parse(dxfData);

if (!result || !result.entity) {
  console.error('❌ Failed to load DXF');
  process.exit(1);
}

console.log(`✅ Loaded DXF with ${result.entity.children.length} objects`);

// Create scene
const scene = new THREE.Scene();
scene.add(result.entity);

// Center and scale
const box = new THREE.Box3().setFromObject(scene);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());

scene.position.sub(center);

const maxDim = Math.max(size.x, size.y, size.z);
if (maxDim > 10) {
  scene.scale.multiplyScalar(10 / maxDim);
}

console.log('📐 Model dimensions:', {
  width: size.x.toFixed(2),
  height: size.y.toFixed(2),
  depth: size.z.toFixed(2)
});

// Export to GLB
console.log('🔄 Exporting to GLB...');

const exporter = new GLTFExporter();

exporter.parse(
  scene,
  (gltf) => {
    console.log('✅ Export callback triggered');
    console.log('   gltf type:', typeof gltf);
    console.log('   gltf instanceof ArrayBuffer:', gltf instanceof ArrayBuffer);
    console.log('   gltf constructor:', gltf?.constructor?.name);

    if (gltf) {
      console.log('   gltf keys:', Object.keys(gltf || {}));
      console.log('   gltf.byteLength:', gltf.byteLength);
    }

    // gltf is ArrayBuffer when binary: true
    if (gltf instanceof ArrayBuffer) {
      const buffer = Buffer.from(gltf);
      console.log('   Buffer size:', buffer.length);
      writeFileSync(GLB_OUTPUT, buffer);
      console.log(`💾 Saved GLB: ${GLB_OUTPUT}`);
      console.log(`📊 Size: ${(gltf.byteLength / 1024).toFixed(2)} KB`);
      process.exit(0);
    } else {
      console.error('❌ Expected ArrayBuffer from GLB export, got:', typeof gltf);
      console.error('   Value:', gltf);
      process.exit(1);
    }
  },
  (error) => {
    console.error('❌ Export failed:', error);
    process.exit(1);
  },
  {
    binary: true,
    onlyVisible: true
  }
);
