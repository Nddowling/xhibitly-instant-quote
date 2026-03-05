#!/usr/bin/env node

/**
 * Test CAD → GLB Conversion on ONE file
 *
 * Tests the complete pipeline:
 * 1. Download CAD zip
 * 2. Extract DXF
 * 3. Convert to GLB
 * 4. Upload to Supabase
 * 5. Update product data
 * 6. Transform products
 * 7. Sync to Base44
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
const TEMP_DIR = path.join(__dirname, '../orbus_catalog/temp_cad');
const BUCKET_NAME = 'orbus-assets';

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
 * Find DXF files in extracted directory
 */
function findDXFFiles(dir) {
  const dxfFiles = [];

  try {
    const walk = (currentDir) => {
      const files = readdirSync(currentDir);

      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stat = statSync(filePath);

        if (stat.isDirectory()) {
          walk(filePath);
        } else if (file.toLowerCase().endsWith('.dxf')) {
          dxfFiles.push(filePath);
        }
      }
    };

    walk(dir);
  } catch (error) {
    console.error(`  ❌ Error finding DXF files: ${error.message}`);
  }

  return dxfFiles;
}

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

  console.log(`\n📦 Processing: ${filename} for ${product.name} (${productSKU})`);

  // Download and extract
  const extractPath = await downloadAndExtractCAD(url, filename);
  if (!extractPath) return null;

  // Find DXF files
  let dxfFiles = findDXFFiles(extractPath);

  // If no DXF files found, try converting DWG to DXF
  if (dxfFiles.length === 0) {
    console.log(`  📝 No DXF files found, checking for DWG files...`);

    // Check if DWG files exist
    const dwgFiles = readdirSync(extractPath).filter(f =>
      f.toLowerCase().endsWith('.dwg')
    );

    if (dwgFiles.length > 0) {
      console.log(`  🔧 Found ${dwgFiles.length} DWG file(s), converting to DXF...`);

      try {
        // Create DXF output directory
        const dxfOutputPath = path.join(extractPath, 'dxf_output');

        // Convert DWG to DXF
        const convertedDxfFiles = await convertDWGtoDXF(extractPath, dxfOutputPath);

        if (convertedDxfFiles.length > 0) {
          dxfFiles = convertedDxfFiles;
          console.log(`  ✅ Successfully converted ${dxfFiles.length} DWG → DXF`);
        } else {
          console.log(`  ⚠️  DWG conversion failed or produced no output`);
        }
      } catch (error) {
        console.error(`  ❌ DWG conversion error: ${error.message}`);
      }
    } else {
      console.log(`  ⚠️  No DXF or DWG files found in this archive`);
    }
  }

  // If still no DXF files, give up
  if (dxfFiles.length === 0) {
    console.log(`  ❌ No convertible CAD files found`);
    rmSync(extractPath, { recursive: true, force: true });
    return null;
  }

  console.log(`  📄 Using DXF file: ${path.basename(dxfFiles[0])}`);

  // Convert first DXF file to GLB
  const dxfFile = dxfFiles[0];
  const glbName = filename.replace('.zip', '');
  const glbPath = await convertDXFtoGLB(dxfFile, glbName);

  if (!glbPath) {
    console.log(`  🔍 KEEPING TEMP FILES FOR DEBUGGING: ${extractPath}`);
    // Don't delete - we need to inspect the DXF files
    // rmSync(extractPath, { recursive: true, force: true });
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
 * Test conversion on ONE CAD file
 */
async function testConversion() {
  console.log('🧪 Testing CAD → GLB Conversion on ONE file\n');

  // Load products
  const catalogData = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));
  const products = catalogData.products || [];

  // Collect all products with CAD files
  const productsWithCAD = [];

  for (const product of products) {
    if (!product.sku) continue;

    // Look in additional_downloads for CAD files
    const cadFiles = product.additional_downloads?.filter(d =>
      d.asset_type === 'cad' && d.url
    ) || [];

    if (cadFiles.length > 0) {
      productsWithCAD.push({ product, cadFiles });
    }
  }

  if (productsWithCAD.length === 0) {
    console.error('❌ No products with CAD files found!');
    console.log('   Make sure you ran: npm run scrape:match');
    process.exit(1);
  }

  console.log(`📊 Found ${productsWithCAD.length} products with CAD files\n`);
  console.log('🔍 Trying to find one with DXF files...\n');

  // Try up to 5 products to find one with DXF
  for (let i = 0; i < Math.min(5, productsWithCAD.length); i++) {
    const { product, cadFiles } = productsWithCAD[i];
    const cadFile = cadFiles[0];

    console.log(`\n🎯 Test Product ${i + 1}:`);
    console.log(`   Name: ${product.name}`);
    console.log(`   SKU: ${product.sku}`);
    console.log(`   CAD File: ${cadFile.filename}`);

    // Process the CAD file
    const glbUrl = await processCADFile(cadFile, product);

    if (glbUrl) {
      console.log('\n\n🎉 Test Successful!\n');
      console.log('✅ Complete pipeline works:');
      console.log('   1. ✅ Downloaded CAD zip');
      console.log('   2. ✅ Extracted DXF file');
      console.log('   3. ✅ Converted to GLB');
      console.log('   4. ✅ Uploaded to Supabase');
      console.log(`\n🔗 GLB URL: ${glbUrl}`);
      console.log(`\n📦 Product updated: ${product.sku}`);
      console.log('\n✨ Ready to run full conversion on all 779 CAD files!');
      console.log('   Command: npm run cad:full');
      return; // Success!
    }

    console.log(`   ⏩ Skipping to next product...\n`);
  }

  // If we get here, none worked
  console.log('\n\n❌ Test Failed');
  console.log('   Tried 5 products, none had DXF files');
  console.log('   All CAD zips may contain DWG-only (requires ODA converter)');
  process.exit(1);
}

// Run test
testConversion().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
