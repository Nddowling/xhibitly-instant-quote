#!/usr/bin/env node

/**
 * Download ALL Orbus Assets Pipeline
 *
 * Downloads every file from theexhibitorshandbook.com and uploads to Supabase:
 * - Product images (PNG, JPG)
 * - Graphic templates (PDF, AI, EPS)
 * - CAD files (DWG, DXF, SKP)
 * - Setup instructions (PDF)
 * - 3D models (GLB, OBJ if available)
 * - Product brochures
 *
 * Stores in Supabase Storage with organized structure:
 * /products/{sku}/images/
 * /products/{sku}/templates/
 * /products/{sku}/cad/
 * /products/{sku}/docs/
 *
 * Usage: node scripts/downloadAllOrbusAssets.js
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({ path: '.env.local' });

// Initialize Supabase
// Use service role key for admin operations (bucket creation)
// Fall back to anon key for uploads (if bucket already exists)
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  supabaseKey
);

// Constants
const PRODUCTS_FILE = path.join(__dirname, '../orbus_catalog/products.json');
const DOWNLOAD_DIR = path.join(__dirname, '../orbus_catalog/downloads');
const BUCKET_NAME = 'orbus-assets';

// File type categories
const FILE_CATEGORIES = {
  image: ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  template: ['.pdf', '.ai', '.eps', '.indd', '.psd'],
  cad: ['.dwg', '.dxf', '.skp', '.rvt', '.3dm'],
  model_3d: ['.glb', '.gltf', '.obj', '.fbx', '.dae', '.stl'],
  document: ['.pdf', '.doc', '.docx'],
  video: ['.mp4', '.mov', '.avi', '.webm']
};

/**
 * Determine file category from extension
 */
function categorizeFile(filename) {
  const ext = path.extname(filename).toLowerCase();

  for (const [category, extensions] of Object.entries(FILE_CATEGORIES)) {
    if (extensions.includes(ext)) {
      return category;
    }
  }

  return 'other';
}

/**
 * Download file from URL
 */
async function downloadFile(url, localPath) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    // Ensure directory exists
    const dir = path.dirname(localPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(localPath, response.data);
    return true;
  } catch (error) {
    console.error(`   ❌ Download failed: ${error.message}`);
    return false;
  }
}

/**
 * Upload file to Supabase Storage
 */
async function uploadToSupabase(localPath, storagePath, contentType) {
  try {
    const fileBuffer = readFileSync(localPath);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath);

    return urlData.publicUrl;
  } catch (error) {
    console.error(`   ❌ Supabase upload failed: ${error.message}`);
    return null;
  }
}

/**
 * Get content type from extension
 */
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.ai': 'application/illustrator',
    '.eps': 'application/postscript',
    '.dwg': 'application/acad',
    '.dxf': 'application/dxf',
    '.skp': 'application/vnd.sketchup.skp',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.obj': 'model/obj',
    '.fbx': 'application/octet-stream'
  };

  return types[ext] || 'application/octet-stream';
}

/**
 * Ensure Supabase bucket exists
 */
async function ensureBucket() {
  try {
    // Try to get bucket
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.log(`⚠️  Could not list buckets (${listError.message})`);
      console.log(`   Assuming bucket exists. Will attempt uploads...\n`);
      return;
    }

    const exists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!exists) {
      console.log(`📦 Creating bucket: ${BUCKET_NAME}...`);
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 52428800 // 50MB
      });

      if (error) {
        if (error.message.includes('already exists')) {
          console.log(`   Bucket already exists\n`);
        } else if (error.message.includes('row-level security')) {
          console.log(`   ⚠️  Cannot create bucket (needs service role key)`);
          console.log(`   Please create bucket "${BUCKET_NAME}" manually in Supabase dashboard`);
          console.log(`   Or add VITE_SUPABASE_SERVICE_ROLE_KEY to .env.local\n`);
          console.log(`   Attempting to continue (bucket may already exist)...\n`);
        } else {
          throw error;
        }
      } else {
        console.log(`✅ Bucket created\n`);
      }
    } else {
      console.log(`✅ Bucket ready: ${BUCKET_NAME}\n`);
    }
  } catch (error) {
    console.error(`⚠️  Bucket setup warning: ${error.message}`);
    console.log(`   Will attempt to continue anyway...\n`);
  }
}

/**
 * Process all product assets
 */
async function processAllAssets() {
  console.log('🚀 Starting comprehensive asset download pipeline\n');

  // Ensure bucket exists
  await ensureBucket();

  // Load products
  console.log('📖 Loading products...');
  const catalogData = JSON.parse(readFileSync(PRODUCTS_FILE, 'utf-8'));
  const products = catalogData.products || [];
  console.log(`   Found ${products.length} products\n`);

  // Statistics
  const stats = {
    totalFiles: 0,
    downloaded: 0,
    uploaded: 0,
    failed: 0,
    skipped: 0,
    byCategory: {}
  };

  // Process each product
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const progress = `[${i + 1}/${products.length}]`;

    if (!product.sku) {
      console.log(`${progress} ⏭️  Skipped: No SKU`);
      stats.skipped++;
      continue;
    }

    console.log(`\n${progress} 📦 ${product.name} (${product.sku})`);

    // Process images
    const images = product.images || [];
    for (const img of images) {
      stats.totalFiles++;

      const category = categorizeFile(img.filename);
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Skip if already has local path and was downloaded
      if (img.downloaded && img.local_path) {
        const fullPath = path.join(__dirname, '../orbus_catalog', img.local_path);

        if (existsSync(fullPath)) {
          console.log(`   📸 Image: ${img.filename} (cached)`);

          // Upload to Supabase
          const storagePath = `products/${product.sku}/${category}/${img.filename}`;
          const contentType = getContentType(img.filename);
          const publicUrl = await uploadToSupabase(fullPath, storagePath, contentType);

          if (publicUrl) {
            img.supabase_url = publicUrl;
            img.storage_path = storagePath;
            stats.uploaded++;
          } else {
            stats.failed++;
          }

          continue;
        }
      }

      // Download new file
      console.log(`   ⬇️  Downloading: ${img.filename}`);
      const localPath = path.join(DOWNLOAD_DIR, product.sku, category, img.filename);

      const downloaded = await downloadFile(img.url, localPath);

      if (downloaded) {
        stats.downloaded++;

        // Upload to Supabase
        const storagePath = `products/${product.sku}/${category}/${img.filename}`;
        const contentType = getContentType(img.filename);
        const publicUrl = await uploadToSupabase(localPath, storagePath, contentType);

        if (publicUrl) {
          img.supabase_url = publicUrl;
          img.storage_path = storagePath;
          img.local_path = path.relative(path.join(__dirname, '..'), localPath);
          img.downloaded = true;
          stats.uploaded++;
          console.log(`   ✅ Uploaded to Supabase`);
        } else {
          stats.failed++;
        }
      } else {
        stats.failed++;
      }
    }

    // Process downloads (templates, CAD, docs)
    const downloads = product.downloads || [];
    for (const dl of downloads) {
      stats.totalFiles++;

      const category = dl.asset_type || categorizeFile(dl.filename);
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

      // Skip if already processed
      if (dl.downloaded && dl.local_path) {
        const fullPath = path.join(__dirname, '../orbus_catalog', dl.local_path);

        if (existsSync(fullPath)) {
          console.log(`   📄 ${category}: ${dl.filename} (cached)`);

          // Upload to Supabase
          const storagePath = `products/${product.sku}/${category}/${dl.filename}`;
          const contentType = getContentType(dl.filename);
          const publicUrl = await uploadToSupabase(fullPath, storagePath, contentType);

          if (publicUrl) {
            dl.supabase_url = publicUrl;
            dl.storage_path = storagePath;
            stats.uploaded++;
          } else {
            stats.failed++;
          }

          continue;
        }
      }

      // Download new file
      console.log(`   ⬇️  Downloading ${category}: ${dl.filename}`);
      const localPath = path.join(DOWNLOAD_DIR, product.sku, category, dl.filename);

      const downloaded = await downloadFile(dl.url, localPath);

      if (downloaded) {
        stats.downloaded++;

        // Upload to Supabase
        const storagePath = `products/${product.sku}/${category}/${dl.filename}`;
        const contentType = getContentType(dl.filename);
        const publicUrl = await uploadToSupabase(localPath, storagePath, contentType);

        if (publicUrl) {
          dl.supabase_url = publicUrl;
          dl.storage_path = storagePath;
          dl.local_path = path.relative(path.join(__dirname, '..'), localPath);
          dl.downloaded = true;
          stats.uploaded++;
          console.log(`   ✅ Uploaded to Supabase`);
        } else {
          stats.failed++;
        }
      } else {
        stats.failed++;
      }
    }

    // Save progress every 10 products
    if ((i + 1) % 10 === 0) {
      console.log(`\n💾 Saving progress...`);
      catalogData.products = products;
      writeFileSync(PRODUCTS_FILE, JSON.stringify(catalogData, null, 2));
    }
  }

  // Final save
  console.log(`\n\n💾 Saving final results...`);
  catalogData.metadata.last_asset_sync = new Date().toISOString();
  catalogData.metadata.asset_stats = stats;
  writeFileSync(PRODUCTS_FILE, JSON.stringify(catalogData, null, 2));

  // Summary
  console.log('\n\n🎉 Asset download pipeline complete!\n');
  console.log('📊 Statistics:');
  console.log(`   Total files:     ${stats.totalFiles}`);
  console.log(`   Downloaded:      ${stats.downloaded}`);
  console.log(`   Uploaded:        ${stats.uploaded}`);
  console.log(`   Failed:          ${stats.failed}`);
  console.log(`   Skipped:         ${stats.skipped}\n`);

  console.log('📂 By Category:');
  Object.entries(stats.byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   ${category.padEnd(20)} ${count}`);
    });

  console.log(`\n✨ All assets available at:`);
  console.log(`   ${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/`);
}

// Run
processAllAssets().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
