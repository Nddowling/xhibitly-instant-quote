#!/usr/bin/env node
/**
 * tagGLBMeshes.js
 *
 * Post-processes existing GLB files in Supabase to rename meshes with
 * BRAND_ / STRUCT_ prefixes so the booth renderer knows exactly what
 * to brand and what to leave as structural hardware.
 *
 * Classification logic:
 *   BRAND_panel_N  — large flat surface (graphic area, fabric panel, sign face)
 *   STRUCT_hw_N    — thin/tubular geometry (poles, frames, legs, hardware)
 *   (unchanged)    — everything else (renderer uses heuristics as fallback)
 *
 * Usage:
 *   node scripts/tagGLBMeshes.js             # all products with GLBs
 *   node scripts/tagGLBMeshes.js --sku ARCH-07 # single SKU
 *   node scripts/tagGLBMeshes.js --dry-run   # print what would change, no upload
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { JSDOM } from 'jsdom';
import dotenv from 'dotenv';
import axios from 'axios';

const dom = new JSDOM('<!DOCTYPE html>');
global.document = dom.window.document;
global.window   = dom.window;
global.Blob     = dom.window.Blob;
global.FileReader = dom.window.FileReader;
global.URL      = dom.window.URL;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const BUCKET = 'orbus-assets';
const TEMP   = path.join(__dirname, '../orbus_catalog/temp_cad');
const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_SKU = (() => {
  const i = process.argv.indexOf('--sku');
  return i >= 0 ? process.argv[i + 1] : null;
})();

if (!existsSync(TEMP)) mkdirSync(TEMP, { recursive: true });

// ── Geometry analysis ──────────────────────────────────────────

function classifyMesh(mesh) {
  const box  = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const matName  = (mesh.material?.name || '').toLowerCase();
  const meshName = (mesh.name || '').toLowerCase();

  // Already tagged — skip
  if (meshName.startsWith('brand_') || meshName.startsWith('struct_')) return null;

  // Glass / acrylic — leave as-is
  if (matName.includes('glass') || matName.includes('acrylic') || matName.includes('clear')) return null;

  // Name-based hardware detection
  const nameHw =
    matName.includes('metal') || matName.includes('steel') || matName.includes('chrome') ||
    meshName.includes('pole') || meshName.includes('frame') || meshName.includes('leg') ||
    meshName.includes('foot') || meshName.includes('base')  || meshName.includes('rod') ||
    meshName.includes('bolt') || meshName.includes('tube')  || meshName.includes('pipe') ||
    meshName.includes('bracket') || meshName.includes('rail') || meshName.includes('clamp');

  // Geometry: sort dims; thin in 2 axes = tube/rod
  const dims = [size.x, size.y, size.z].sort((a, b) => a - b);
  const isTube  = dims[0] < 0.08 && dims[2] > 0.35;
  const isFlat  = (size.x > size.z * 4 || size.y > size.z * 4) &&
                  (size.x > 0.3 || size.y > 0.3);

  const surfaceArea = size.x * size.y * 2 + size.y * size.z * 2 + size.x * size.z * 2;

  if (nameHw || isTube) return 'STRUCT';
  if (isFlat && surfaceArea > 0.1) return 'BRAND';

  // Ambiguous — don't tag, let renderer heuristics handle it
  return null;
}

// ── Load GLB from URL ──────────────────────────────────────────

async function loadGLBFromUrl(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  const buffer = Buffer.from(res.data);
  const tmpPath = path.join(TEMP, `_tmp_${Date.now()}.glb`);
  writeFileSync(tmpPath, buffer);

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(`file://${tmpPath}`, gltf => resolve({ scene: gltf.scene, tmpPath }),
      undefined, reject);
  });
}

// ── Tag + re-export GLB ────────────────────────────────────────

async function tagAndExport(gltfScene, sku) {
  let brandCount  = 0;
  let structCount = 0;
  let skipCount   = 0;

  gltfScene.traverse(child => {
    if (!child.isMesh) return;
    const tag = classifyMesh(child);
    if (!tag) { skipCount++; return; }

    const baseName = child.name || `mesh_${Math.random().toString(36).slice(2, 6)}`;
    if (tag === 'BRAND') {
      child.name = `BRAND_${baseName}`;
      brandCount++;
    } else {
      child.name = `STRUCT_${baseName}`;
      structCount++;
    }
  });

  console.log(`  Tags: ${brandCount} BRAND, ${structCount} STRUCT, ${skipCount} unchanged`);

  if (brandCount === 0 && structCount === 0) {
    console.log('  No tags applied — skipping re-upload');
    return null;
  }

  // Export to GLB
  const outPath = path.join(TEMP, `${sku}_tagged.glb`);
  await new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      gltfScene,
      glb => {
        if (glb instanceof ArrayBuffer) {
          writeFileSync(outPath, Buffer.from(glb));
          resolve();
        } else {
          reject(new Error('Expected ArrayBuffer'));
        }
      },
      err => reject(err),
      { binary: true }
    );
  });

  return outPath;
}

// ── Upload tagged GLB ──────────────────────────────────────────

async function uploadTagged(localPath, sku, originalFilename) {
  const buf  = readFileSync(localPath);
  const dest = `products/${sku}/model_3d/${originalFilename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(dest, buf, { contentType: 'model/gltf-binary', upsert: true });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(dest);
  return publicUrl;
}

// ── Process one product ────────────────────────────────────────

async function processProduct(product) {
  const sku = product.sku;
  if (!sku) return;

  // Find GLB path in Supabase
  const { data: files } = await supabase.storage
    .from(BUCKET)
    .list(`products/${sku}/model_3d`, { limit: 20 });

  const glbFile = files?.find(f => f.name.match(/\.(glb|gltf)$/i));
  if (!glbFile) {
    console.log(`  [${sku}] No GLB found — skipping`);
    return;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(`products/${sku}/model_3d/${glbFile.name}`);

  console.log(`\n[${sku}] Loading ${glbFile.name}...`);

  let gltfScene, tmpPath;
  try {
    ({ scene: gltfScene, tmpPath } = await loadGLBFromUrl(publicUrl));
  } catch (e) {
    console.error(`  Failed to load GLB: ${e.message}`);
    return;
  }

  const outPath = await tagAndExport(gltfScene, sku);

  if (!outPath) return;

  if (DRY_RUN) {
    console.log(`  DRY RUN — would upload ${outPath} → ${sku}/model_3d/${glbFile.name}`);
  } else {
    try {
      const url = await uploadTagged(outPath, sku, glbFile.name);
      console.log(`  Uploaded: ${url}`);
    } catch (e) {
      console.error(`  Upload failed: ${e.message}`);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? 'DRY RUN MODE\n' : 'Tagging GLB meshes...\n');

  // Load product list
  const catalogPath = path.join(__dirname, '../orbus_catalog/products_with_all_files.json');
  if (!existsSync(catalogPath)) {
    console.error('products_with_all_files.json not found');
    process.exit(1);
  }
  const { products } = JSON.parse(readFileSync(catalogPath));

  const targets = TARGET_SKU
    ? products.filter(p => p.sku === TARGET_SKU)
    : products.filter(p => p.sku);

  if (TARGET_SKU && targets.length === 0) {
    console.error(`SKU not found: ${TARGET_SKU}`);
    process.exit(1);
  }

  console.log(`Processing ${targets.length} products...\n`);

  for (const product of targets) {
    await processProduct(product);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
