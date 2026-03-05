#!/usr/bin/env node
/**
 * Retry GLB uploads that failed with network errors in the last run
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DXFLoader } from 'three-dxf-loader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { convertDWGtoDXF } from './convertDWGtoDXF.js';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
global.FileReader = dom.window.FileReader;
global.Blob = dom.window.Blob;
global.document = dom.window.document;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const PRODUCTS_FILE = path.join(__dirname, '../orbus_catalog/products_with_all_files.json');
const TEMP_DIR = path.join(__dirname, '../orbus_catalog/temp_cad');
const BUCKET_NAME = 'orbus-assets';

// SKUs that failed upload in last run (network errors)
const RETRY_SKUS = new Set([
  'VF-ESS-LB-2008', 'VF-ESS-LB-0808',  // blz-h-2008-s, blz-h-0808-s
]);

// Filename → SKU mapping from the failed run
const FAILED_ZIPS = [
  'blz-h-2008-s.zip',
  'blz-h-0808-s.zip',
  'cad_emb-2-bridge-connector.zip',
  'CAD_VB-MK-01.zip',
  'CAD_LN-CU-03.zip',
  'CAD_TOWER-02.zip',
  'CAD_SHD-TOWER-01.zip',
  'CAD_TOWER-03.zip',
  'CAD_HP-K-06.zip',
  'CAD_HPC-01.zip',
  'CAD_HP-K-09.zip',
];

if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });


function findByExt(dir, ext) {
  const results = [];
  const walk = (d) => {
    try {
      for (const f of readdirSync(d)) {
        const fp = path.join(d, f);
        if (statSync(fp).isDirectory()) walk(fp);
        else if (f.toLowerCase().endsWith(ext)) results.push(fp);
      }
    } catch {}
  };
  walk(dir);
  return results;
}

async function convertAndUpload(product, cadFile) {
  const { url, filename } = cadFile;
  const sku = product.sku;
  console.log(`\n🔄 Retrying: ${filename} for ${product.name} (${sku})`);

  // Download & extract
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  const extractPath = path.join(TEMP_DIR, filename.replace('.zip', ''));
  if (!existsSync(extractPath)) mkdirSync(extractPath, { recursive: true });
  new AdmZip(Buffer.from(resp.data)).extractAllTo(extractPath, true);

  const glbName = filename.replace('.zip', '');
  let glbPath = null;

  // Try OBJ first
  const objFiles = findByExt(extractPath, '.obj');
  if (objFiles.length > 0) {
    console.log(`  📦 Found OBJ: ${path.basename(objFiles[0])}`);
    try {
      const objData = readFileSync(objFiles[0], 'utf-8');
      const object = new OBJLoader().parse(objData);
      const scene = new THREE.Scene();
      const geometries = [];
      object.traverse((child) => {
        if (child.isMesh && child.geometry) {
          const geom = child.geometry.clone();
          child.updateWorldMatrix(true, false);
          geom.applyMatrix4(child.matrixWorld);
          geometries.push(geom);
        }
      });
      if (geometries.length > 1) {
        const merged = mergeGeometries(geometries, false);
        if (merged) {
          scene.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x888888 })));
        } else {
          scene.add(object);
        }
      } else {
        scene.add(object);
      }
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      scene.children[0].position.sub(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 10) scene.children[0].scale.multiplyScalar(10 / maxDim);

      glbPath = await new Promise((resolve, reject) => {
        new GLTFExporter().parse(scene, (gltf) => {
          if (gltf instanceof ArrayBuffer) {
            const p = path.join(TEMP_DIR, `${glbName}.glb`);
            writeFileSync(p, Buffer.from(gltf));
            resolve(p);
          } else reject(new Error('Not ArrayBuffer'));
        }, reject, { binary: true });
      });
      console.log(`  ✅ Converted OBJ → GLB`);
    } catch (e) { console.error(`  ❌ OBJ conversion: ${e.message}`); }
  }

  // Try DWG if no OBJ
  if (!glbPath) {
    const dwgFiles = findByExt(extractPath, '.dwg');
    if (dwgFiles.length > 0) {
      console.log(`  🔧 Trying DWG conversion...`);
      try {
        const dxfOut = path.join(extractPath, 'dxf_output');
        const dxfFiles = await convertDWGtoDXF(path.dirname(dwgFiles[0]), dxfOut);
        if (dxfFiles.length > 0) {
          const dxfData = readFileSync(dxfFiles[0], 'utf-8');
          const result = new DXFLoader().parse(dxfData);
          if (result?.entity?.children?.length > 0) {
            const scene = new THREE.Scene();
            scene.add(result.entity);
            glbPath = await new Promise((resolve, reject) => {
              new GLTFExporter().parse(scene, (gltf) => {
                if (gltf instanceof ArrayBuffer) {
                  const p = path.join(TEMP_DIR, `${glbName}.glb`);
                  writeFileSync(p, Buffer.from(gltf));
                  resolve(p);
                } else reject(new Error('Not ArrayBuffer'));
              }, reject, { binary: true });
            });
          }
        }
      } catch (e) { console.error(`  ❌ DWG conversion: ${e.message}`); }
    }
  }

  if (!glbPath) {
    console.log(`  ❌ Could not convert`);
    rmSync(extractPath, { recursive: true, force: true });
    return false;
  }

  // Upload with retry
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const glbBuffer = readFileSync(glbPath);
      const storagePath = `products/${sku}/model_3d/${glbName}.glb`;
      const { error } = await supabase.storage.from(BUCKET_NAME).upload(storagePath, glbBuffer, {
        contentType: 'model/gltf-binary', upsert: true
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
      console.log(`  ✅ Uploaded: ${publicUrl}`);
      rmSync(extractPath, { recursive: true, force: true });
      return true;
    } catch (e) {
      console.error(`  ❌ Upload attempt ${attempt}/3: ${e.message}`);
      if (attempt < 3) await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }

  rmSync(extractPath, { recursive: true, force: true });
  return false;
}

async function main() {
  console.log('🔄 Retrying failed uploads...\n');

  const data = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));
  const products = data.products || [];

  // Find products whose CAD zip filename matches our failed list
  const toRetry = products.filter(p => {
    const cad = p.additional_downloads?.find(d => d.asset_type === 'cad' && d.url);
    return cad && FAILED_ZIPS.includes(cad.filename);
  });

  console.log(`Found ${toRetry.length} products to retry\n`);

  let success = 0, failed = 0;
  for (const product of toRetry) {
    const cad = product.additional_downloads.find(d => d.asset_type === 'cad' && d.url);
    const ok = await convertAndUpload(product, cad);
    if (ok) success++; else failed++;
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ Done: ${success} succeeded, ${failed} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
