#!/usr/bin/env node

/**
 * Convert CAD Files (DXF/DWG) to GLB for 3D Viewer
 *
 * Pipeline:
 * 1. Download CAD zip from Orbus
 * 2. Extract zip to find DXF files
 * 3. Load DXF with Three.js
 * 4. Export as GLB
 * 5. Upload GLB to Supabase
 * 6. Update products.json with GLB URL
 *
 * Note: DWG files require ODA File Converter (separate install)
 * This script handles DXF files which are more common in CAD zips
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as THREE from 'three';
import { DXFLoader } from 'three-dxf-loader';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { convertDWGtoDXF, checkODAInstalled } from './convertDWGtoDXF.js';
import { JSDOM } from 'jsdom';

// Use jsdom for proper DOM APIs (required by GLTFExporter)
const dom = new JSDOM();
global.FileReader = dom.window.FileReader;
global.Blob = dom.window.Blob;
global.document = dom.window.document;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const PRODUCTS_FILE = path.join(__dirname, '../orbus_catalog/products_with_all_files.json');
const OUTPUT_FILE = path.join(__dirname, '../orbus_catalog/products.json');
const TEMP_DIR = path.join(__dirname, '../orbus_catalog/temp_cad');
const BUCKET_NAME = 'orbus-assets';

// SKUs that already have GLBs in Supabase — skip these to save time
// Updated 2026-03-05: 179 SKUs confirmed in Supabase storage
const ALREADY_CONVERTED = new Set([
  'AKIT-1S','ARCH-01','ARCH-02','ARCH-03','ARCH-06','ARCH-07',
  'BARRICADE-COVER','BLD-LT-1200','BLD-LT-920','BLZ-0306','BLZ-0308','BLZ-0406',
  'BLZ-0408','BLZ-0608','BLZ-0808','BLZ-1008','BLZ-1010','BLZ-2008','BLZ-H-2010',
  'BLZ-W-0603','BLZ-W-0604','BLZ-W-0606','BLZ-W-0803','BLZ-W-0804','BLZ-W-0806',
  'BLZ-W-0808','BLZ-W-1008','BLZ-W-1010','BLZ-W-2008','BLZ-W-2010','BLZ-W-3008',
  'BREAKAWAY-BANNER-LARGE','BREZ-2','C-WALL','CFAB-K-05','CFAB-K-06','CFAB-K-07',
  'CFAB-K-08','CFAB-K-09','CFAB-K-10','CL-TBLTP-LB-01','COL-01','COL-02','COL-03',
  'CONTOUR-01-PB','CYL-01','EMB-1X2-S','EMB-2X2-S','EMB-3X3-S','EMB-4X4-S',
  'EMB-BL-4X3-S','EMB-EXT-SHLF-K-2',
  'FF-CT-CL-BL','FMLT-BL-WS3-01','FMLT-BL-WS5-01','FMLT-BL-WS8-01',
  'FMLT-CHRG-COUNTER-1','FMLT-DS-10-04','FMLT-DS-10-05','FMLT-DS-10-06',
  'FMLT-DS-10-07','FMLT-DS-10-08','FMLT-DS-10-09','FMLT-DS-10-13','FMLT-DS-20-07',
  'FMLT-DS-20-12','FMLT-E-BL-1100','FMLT-E-S-1000-2','FMLT-E-S-1200-2',
  'FMLT-E-S-1500-2','FMLT-E-S-600-2','FMLT-E-S-800-2','FMLT-E-S-850-2',
  'FMLT-E-S-920-2','FMLT-E-S10-02','FMLT-E-SC10-02','FMLT-KIOSK-01','FMLT-KIOSK-02',
  'FMLT-KIOSK-03','FMLT-KIOSK-04','FMLT-LT-01','FMLT-WBWA-05','FMLT-WH0810',
  'FMLT-WH8-01','FMLT-WL04','FMLT-WS0810','FMLT-WS8-01','FMLT-WTT-V03',
  'FMLT-WV10-01','FMLT-WV8-01','FS-WOODCRATE',
  'HOP-2-12X3-S','HOP-DIM-01','HOP-DIM-02',
  'HP-K-01','HP-K-02','HP-K-03','HP-K-04','HP-K-05','HP-K-06','HP-K-07','HP-K-09',
  'HP-K-11','HP-K-13','HP-K-14','HP-K-15','HP-K-19','HP-K-24','HP-K-25','HP-K-27',
  'HP-K-34','HP-K-35','HP-K-36','HP-K-37','HPT-02','HPT-04',
  'LED-COOL-WHT-BLAST','LED-RGB-BLAST','LED-WRM-WHT-BLAST','LUM-LED2-ORL','LUM-LED3-ORL-B',
  'MFY-RSR-02','MOD-30-01','MOD-30-03','MOD-30-04','MOD-DOOR-M',
  'MOD-FRM-01','MOD-FRM-02','MOD-FRM-03','MOD-FRM-04','MOD-FRM-05','MOD-FRM-06',
  'MOD-FRM-07','MOD-FRM-08','MOD-FRM-09','MOD-FRM-12',
  'OCB-2','Out of stockSKUOCA-2',
  'PBFM902-B-HDR','PGSUS3','PM4S3-MK','QUARTER-WOODCRATE','RU-S1-4',
  'SHD-TOWER-01','SHD-TOWER-02','SHD-TOWER-03','SYNERGY-800',
  'TABLET-STD-05','TOWER-02','TOWER-03','TWIRL',
  'VF-ESS-LB-R-01','VF-ESS-LB-R-02','VF-ESS-LB-R-03','VF-ESS-LB-R-04',
  'VF-LB-R-01','VF-MK-02','VF-R-01','VF-R-02','VF-TWR-01',
  'VFF-01-3','VFF-01-F','VFF-02-F','VFF-03-F','VFF-CT-BL','VFF-LB-02-F',
  'W-01-C','W-02-C','W-03-C','W-04-C','W-05-C','W-06-C-02','W-06-C-03','W-06-C-04','W-06-C-05',
  'ZM-FLX-FOLDABLE','ZOOM-FLX-D-LG','ZOOM-FLX-EDGE-M','ZOOM-FLX-TNT',
]);

// Test mode: only process 1 file (set from command line)
const TEST_MODE = process.argv.includes('--test');
const MAX_FILES = TEST_MODE ? 1 : Infinity;

// Create temp directory
if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Download and extract CAD zip file
 */
async function downloadAndExtractCAD(url, filename) {
  console.log(`  📥 Downloading: ${filename}`);

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const zipPath = path.join(TEMP_DIR, filename);
    writeFileSync(zipPath, Buffer.from(response.data));

    // Extract zip
    const zip = new AdmZip(zipPath);
    const extractPath = path.join(TEMP_DIR, filename.replace('.zip', ''));

    if (!existsSync(extractPath)) {
      mkdirSync(extractPath, { recursive: true });
    }

    zip.extractAllTo(extractPath, true);
    console.log(`  ✅ Extracted to: ${extractPath}`);

    return extractPath;
  } catch (error) {
    console.error(`  ❌ Download failed: ${error.message}`);
    return null;
  }
}

/**
 * Recursively find files with given extension in a directory
 */
function findFilesByExt(dir, ext) {
  const results = [];
  try {
    const walk = (currentDir) => {
      for (const file of readdirSync(currentDir)) {
        const filePath = path.join(currentDir, file);
        if (statSync(filePath).isDirectory()) {
          walk(filePath);
        } else if (file.toLowerCase().endsWith(ext)) {
          results.push(filePath);
        }
      }
    };
    walk(dir);
  } catch (error) {
    console.error(`  ❌ Error finding ${ext} files: ${error.message}`);
  }
  return results;
}

function findDXFFiles(dir) { return findFilesByExt(dir, '.dxf'); }
function findDWGFiles(dir) { return findFilesByExt(dir, '.dwg'); }
function findOBJFiles(dir) { return findFilesByExt(dir, '.obj'); }

/**
 * Convert DXF to GLB using Three.js
 */
async function convertDXFtoGLB(dxfPath, outputName) {
  console.log(`  🔄 Converting DXF to GLB...`);

  try {
    const loader = new DXFLoader();
    const dxfData = readFileSync(dxfPath, 'utf-8');

    // Parse DXF - returns { entity: Group, dxf: rawData }
    const result = loader.parse(dxfData);

    if (!result || !result.entity) {
      console.log(`  ⚠️  Empty or invalid DXF file`);
      return null;
    }

    const dxfGroup = result.entity;

    // Check if the group has children (geometry)
    if (!dxfGroup.children || dxfGroup.children.length === 0) {
      console.log(`  ⚠️  DXF file has no geometry`);
      return null;
    }

    console.log(`  ✅ Loaded DXF with ${dxfGroup.children.length} objects`);

    // Create scene and add the DXF group directly
    const scene = new THREE.Scene();
    scene.add(dxfGroup);

    // Center and scale the model
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    scene.position.sub(center);

    // Scale to reasonable size (max dimension = 10 units)
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 10) {
      scene.scale.multiplyScalar(10 / maxDim);
    }

    // Export to GLB
    const exporter = new GLTFExporter();

    return new Promise((resolve, reject) => {
      exporter.parse(
        scene,
        (gltf) => {
          const glbPath = path.join(TEMP_DIR, `${outputName}.glb`);

          // GLB is binary, so we get ArrayBuffer
          if (gltf instanceof ArrayBuffer) {
            writeFileSync(glbPath, Buffer.from(gltf));
            console.log(`  ✅ Converted to GLB: ${glbPath}`);
            resolve(glbPath);
          } else {
            reject(new Error('Expected ArrayBuffer from GLB export'));
          }
        },
        (error) => {
          reject(error);
        },
        { binary: true } // Export as GLB (binary)
      );
    });

  } catch (error) {
    console.error(`  ❌ Conversion failed: ${error.message}`);
    return null;
  }
}

/**
 * Convert OBJ to GLB using Three.js OBJLoader
 */
async function convertOBJtoGLB(objPath, outputName) {
  console.log(`  🔄 Converting OBJ to GLB...`);

  try {
    const objData = readFileSync(objPath, 'utf-8');
    const loader = new OBJLoader();
    const object = loader.parse(objData);

    if (!object || !object.children || object.children.length === 0) {
      console.log(`  ⚠️  OBJ file has no geometry`);
      return null;
    }

    console.log(`  ✅ Loaded OBJ with ${object.children.length} objects`);

    // Merge all geometries into one mesh to dramatically reduce file size
    const geometries = [];
    object.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const geom = child.geometry.clone();
        child.updateWorldMatrix(true, false);
        geom.applyMatrix4(child.matrixWorld);
        geometries.push(geom);
      }
    });

    const scene = new THREE.Scene();
    if (geometries.length > 1) {
      const merged = mergeGeometries(geometries, false);
      if (merged) {
        const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: 0x888888 }));
        scene.add(mesh);
        console.log(`  🔗 Merged ${geometries.length} geometries into 1 mesh`);
      } else {
        scene.add(object);
      }
    } else {
      scene.add(object);
    }

    // Center and scale
    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    scene.children[0].position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 10) scene.children[0].scale.multiplyScalar(10 / maxDim);

    const exporter = new GLTFExporter();
    return new Promise((resolve, reject) => {
      exporter.parse(
        scene,
        (gltf) => {
          const glbPath = path.join(TEMP_DIR, `${outputName}.glb`);
          if (gltf instanceof ArrayBuffer) {
            writeFileSync(glbPath, Buffer.from(gltf));
            console.log(`  ✅ Converted to GLB: ${glbPath}`);
            resolve(glbPath);
          } else {
            reject(new Error('Expected ArrayBuffer from GLB export'));
          }
        },
        (error) => reject(error),
        { binary: true }
      );
    });
  } catch (error) {
    console.error(`  ❌ OBJ conversion failed: ${error.message}`);
    return null;
  }
}

/**
 * Upload GLB to Supabase
 */
async function uploadGLBtoSupabase(glbPath, sku, filename) {
  try {
    const glbBuffer = readFileSync(glbPath);
    const supabasePath = `products/${sku}/model_3d/${filename}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(supabasePath, glbBuffer, {
        contentType: 'model/gltf-binary',
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(supabasePath);

    console.log(`  ✅ Uploaded to Supabase: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error(`  ❌ Upload failed: ${error.message}`);
    return null;
  }
}

/**
 * Process a single CAD file
 */
async function processCADFile(cadFile, product) {
  const { url, filename } = cadFile;
  const productSKU = product.sku;

  console.log(`\n📦 Processing: ${filename} for ${product.name}`);

  // Download and extract
  const extractPath = await downloadAndExtractCAD(url, filename);
  if (!extractPath) return null;

  const glbName = filename.replace('.zip', '');
  let glbPath = null;

  // Priority 1: OBJ files (real 3D meshes, best quality)
  const objFiles = findOBJFiles(extractPath);
  if (objFiles.length > 0) {
    console.log(`  📦 Found OBJ file: ${path.basename(objFiles[0])}`);
    glbPath = await convertOBJtoGLB(objFiles[0], glbName);
  }

  // Priority 2: DXF files
  if (!glbPath) {
    const dxfFiles = findDXFFiles(extractPath);
    if (dxfFiles.length > 0) {
      console.log(`  📄 Using DXF file: ${path.basename(dxfFiles[0])}`);
      glbPath = await convertDXFtoGLB(dxfFiles[0], glbName);
    }
  }

  // Priority 3: DWG → DXF conversion (now recursive search)
  if (!glbPath) {
    const dwgFiles = findDWGFiles(extractPath);
    if (dwgFiles.length > 0) {
      console.log(`  🔧 Found ${dwgFiles.length} DWG file(s), converting to DXF...`);
      try {
        const dwgDir = path.dirname(dwgFiles[0]);
        const dxfOutputPath = path.join(extractPath, 'dxf_output');
        const convertedDxfFiles = await convertDWGtoDXF(dwgDir, dxfOutputPath);
        if (convertedDxfFiles.length > 0) {
          console.log(`  ✅ Successfully converted ${convertedDxfFiles.length} DWG → DXF`);
          glbPath = await convertDXFtoGLB(convertedDxfFiles[0], glbName);
        } else {
          console.log(`  ⚠️  DWG conversion produced no output`);
        }
      } catch (error) {
        console.error(`  ❌ DWG conversion error: ${error.message}`);
      }
    } else {
      console.log(`  ⚠️  No OBJ, DXF, or DWG files found in this archive`);
    }
  }

  if (!glbPath) {
    console.log(`  ❌ No convertible CAD files found`);
    rmSync(extractPath, { recursive: true, force: true });
    return null;
  }

  if (!glbPath) {
    rmSync(extractPath, { recursive: true, force: true });
    return null;
  }

  // Upload to Supabase
  const glbFilename = `${glbName}.glb`;
  const glbUrl = await uploadGLBtoSupabase(glbPath, productSKU, glbFilename);

  // Clean up temp files
  rmSync(extractPath, { recursive: true, force: true });

  return glbUrl;
}

/**
 * Main conversion pipeline
 */
async function convertAllCADFiles() {
  if (TEST_MODE) {
    console.log('🧪 TEST MODE: Processing only 1 CAD file\n');
  } else {
    console.log('🚀 Starting CAD → GLB Conversion Pipeline\n');
  }

  // Check if ODA File Converter is installed
  const odaStatus = checkODAInstalled();
  if (odaStatus.installed) {
    console.log('✅ ODA File Converter found');
    console.log(`   ${odaStatus.path}\n`);
  } else {
    console.log('⚠️  ODA File Converter not found');
    console.log('   Will skip DWG files (only DXF files will be converted)\n');
    console.log('   To convert DWG files, install from:');
    console.log('   https://www.opendesign.com/guestfiles/oda_file_converter\n');
  }

  // Load products
  const catalogData = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));
  const products = catalogData.products || [];

  let stats = {
    total: 0,
    converted: 0,
    failed: 0,
    noCAD: 0,
    noDXF: 0
  };

  let filesProcessed = 0;

  for (const product of products) {
    if (!product.sku) continue;
    if (filesProcessed >= MAX_FILES) break;
    if (ALREADY_CONVERTED.has(product.sku)) continue;

    // Find CAD files for this product - look in additional_downloads
    const cadFiles = product.additional_downloads?.filter(d =>
      d.asset_type === 'cad' && d.url
    ) || [];

    if (cadFiles.length === 0) {
      stats.noCAD++;
      continue;
    }

    stats.total++;

    // Process first CAD file (usually the main one)
    const cadFile = cadFiles[0];
    const glbUrl = await processCADFile(cadFile, product);

    if (glbUrl) {
      // Update product with GLB URL
      if (!product.model_3d_url) {
        product.model_3d_url = glbUrl;
      }
      product.has_3d_model = true;
      stats.converted++;
      filesProcessed++;

      if (TEST_MODE) {
        console.log('\n✅ Test successful! Found a working CAD file.');
        break;
      }
    } else {
      stats.failed++;
      if (TEST_MODE) {
        console.log(`⏩ Trying next product...`);
        continue; // Try next product in test mode
      }
    }

    // Rate limit: wait 1 second between conversions
    if (!TEST_MODE) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Save updated products to products.json (the main file)
  const outputData = {
    ...catalogData,
    metadata: {
      ...catalogData.metadata,
      cad_conversion_completed: new Date().toISOString(),
      glb_models_generated: stats.converted
    }
  };
  writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));

  console.log('\n\n🎉 CAD Conversion Complete!\n');
  console.log('📊 Statistics:');
  console.log(`   Total products with CAD: ${stats.total}`);
  console.log(`   ✅ Successfully converted: ${stats.converted}`);
  console.log(`   ❌ Failed (no DXF): ${stats.failed}`);
  console.log(`   ⏭️  No CAD files: ${stats.noCAD}`);

  if (TEST_MODE && stats.converted > 0) {
    console.log('\n✨ Test passed! Ready to run full conversion:');
    console.log('   npm run cad:convert');
  }
}

// Run conversion
convertAllCADFiles().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
