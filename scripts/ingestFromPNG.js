#!/usr/bin/env node

/**
 * Catalog Ingestion from PNG Images
 *
 * Processes pre-converted PNG images of the Exhibitor's Handbook
 * and uploads product data to Base44 with GPT-4o Vision extraction.
 *
 * Usage: node scripts/ingestFromPNG.js [--test]
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { OpenAI } from 'openai';
import { createClient } from '@base44/sdk';
import sharp from 'sharp';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Base44 client
const base44 = createClient({
  appId: process.env.BASE44_APP_ID || process.env.VITE_BASE44_APP_ID,
  token: process.env.BASE44_API_KEY || process.env.VITE_BASE44_API_KEY,
  functionsVersion: process.env.VITE_BASE44_FUNCTIONS_VERSION || 'latest',
  appBaseUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  serverUrl: process.env.VITE_BASE44_APP_BASE_URL || 'https://app.base44.com',
  requiresAuth: false
});

const CATALOG_DIR = '/Users/nicholasdowling/Downloads/catalog-pages';
const OUTPUT_DIR = '/Users/nicholasdowling/Downloads/catalog-data';
const HANDBOOK_NAME = 'Exhibitors Handbook 2022';

// Test mode processes specific pages
const TEST_PAGES = [1, 22, 35, 50];
const isTestMode = process.argv.includes('--test');

// Create output directory if it doesn't exist
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Main ingestion function
 */
async function ingestFromPNG() {
  console.log('🚀 Starting PNG catalog ingestion...');
  console.log(`📁 Source directory: ${CATALOG_DIR}`);
  console.log(`🧪 Test mode: ${isTestMode ? 'YES' : 'NO'}\n`);

  // Get all PNG files
  const allFiles = readdirSync(CATALOG_DIR)
    .filter(file => file.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

  console.log(`📄 Found ${allFiles.length} PNG files`);

  // Filter to test pages if in test mode
  const filesToProcess = isTestMode
    ? allFiles.filter(file => {
        const pageNum = parseInt(file.match(/\d+/)[0]);
        return TEST_PAGES.includes(pageNum);
      })
    : allFiles;

  console.log(`📋 Processing ${filesToProcess.length} pages\n`);

  let successCount = 0;
  let errorCount = 0;
  const catalogIndex = [];

  for (const filename of filesToProcess) {
    const pageNum = parseInt(filename.match(/\d+/)[0]);
    console.log(`\n🔄 Processing page ${pageNum}...`);

    try {
      const pageData = await processPage(filename, pageNum);
      catalogIndex.push(pageData);
      successCount++;
      console.log(`✅ Page ${pageNum} complete`);
    } catch (error) {
      errorCount++;
      console.error(`❌ Error processing page ${pageNum}:`, error.message);
    }
  }

  // Save master catalog index
  console.log('\n💾 Saving master catalog index...');
  const indexPath = join(OUTPUT_DIR, 'catalog-index.json');
  writeFileSync(indexPath, JSON.stringify(catalogIndex, null, 2));
  console.log(`   Saved to: ${indexPath}`);

  console.log('\n\n🎉 Ingestion complete!');
  console.log(`📊 Success: ${successCount}, Errors: ${errorCount}`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log('\n📋 Files created:');
  console.log(`   - catalog-index.json (master index with all ${successCount} pages)`);
  console.log(`   - page-[N].json (individual page data, ${successCount} files)`);
  console.log(`   - page-[N]-compressed.jpg (compressed images, ${successCount} files)`);
}

/**
 * Compress image to reduce file size
 */
async function compressImage(imageBuffer, maxWidth = 1200) {
  try {
    const compressed = await sharp(imageBuffer)
      .resize(maxWidth, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    const originalMB = (imageBuffer.length / 1024 / 1024).toFixed(2);
    const compressedMB = (compressed.length / 1024 / 1024).toFixed(2);
    console.log(`     Compressed: ${originalMB}MB → ${compressedMB}MB`);

    return compressed;
  } catch (error) {
    console.warn(`     ⚠️  Compression failed, using original: ${error.message}`);
    return imageBuffer;
  }
}

/**
 * Process a single PNG file
 */
async function processPage(filename, pageNum) {
  const filePath = join(CATALOG_DIR, filename);

  // Read PNG file
  console.log('  📖 Reading PNG file...');
  const originalBuffer = readFileSync(filePath);
  const fileSizeMB = (originalBuffer.length / 1024 / 1024).toFixed(2);
  console.log(`     Original size: ${fileSizeMB} MB`);

  // Compress image for Vision API
  console.log('  🗜️  Compressing image...');
  const imageBuffer = await compressImage(originalBuffer);

  // Save compressed image locally
  const compressedPath = join(OUTPUT_DIR, `page-${pageNum}-compressed.jpg`);
  writeFileSync(compressedPath, imageBuffer);
  console.log(`     Saved compressed image: page-${pageNum}-compressed.jpg`);

  // Extract products using GPT-4o Vision
  console.log('  🤖 Extracting products with GPT-4o Vision...');
  const products = await extractProductsWithVision(imageBuffer);
  console.log(`     Found ${products.length} products`);

  if (products.length > 0) {
    console.log(`     Sample: ${products[0].name || 'N/A'}`);
  }

  // Generate text from products for embeddings
  const pageText = products.map(p =>
    `${p.name || ''} ${p.description || ''} ${p.category || ''} ${p.sku || ''}`
  ).join(' ');

  // Generate embedding for semantic search
  console.log('  🧠 Generating embeddings...');
  const embedding = await generateEmbedding(`Page ${pageNum}: ${pageText}`);
  console.log(`     Embedding dimensions: ${embedding ? embedding.length : 'failed'}`);

  // Create page data object
  const pageData = {
    page_number: pageNum,
    page_text: pageText.substring(0, 10000),
    original_image_path: filePath,
    compressed_image_path: compressedPath,
    embedding_vector: embedding,
    products: products,
    handbook_name: HANDBOOK_NAME,
    processed_at: new Date().toISOString()
  };

  // Save to local JSON file
  console.log('  💾 Saving to local JSON...');
  const jsonPath = join(OUTPUT_DIR, `page-${pageNum}.json`);
  writeFileSync(jsonPath, JSON.stringify(pageData, null, 2));
  console.log(`     Saved: page-${pageNum}.json`);

  return pageData;
}

/**
 * Upload image to Base44 storage
 */
async function uploadImageToBase44(imageBuffer, filename) {
  try {
    // Try uploading to Base44 storage
    const uploadResult = await base44.storage.upload({
      file: imageBuffer,
      filename: filename,
      contentType: 'image/jpeg'
    });

    console.log(`     ✅ Storage URL: ${uploadResult.url.substring(0, 60)}...`);
    return uploadResult.url;
  } catch (error) {
    console.warn(`     ⚠️  Storage upload failed: ${error.message}`);

    // For large images, we can't use data URLs due to MongoDB 16MB limit
    // Instead, save a reference to the local file
    const fileSizeMB = (imageBuffer.length / 1024 / 1024).toFixed(2);

    if (imageBuffer.length > 10000000) { // > 10 MB
      console.warn(`     ⚠️  Image too large (${fileSizeMB}MB) for data URL. Skipping image storage.`);
      return null; // Return null instead of huge data URL
    }

    // For smaller images, use data URL as fallback
    const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
    const dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    console.warn(`     Using data URL fallback (${fileSizeMB}MB)`);
    return dataUrl;
  }
}

/**
 * Extract products from page using GPT-4o Vision
 */
async function extractProductsWithVision(imageBuffer) {
  const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
  const base64Image = buffer.toString('base64');

  try {
    console.log(`     Sending ${Math.round(base64Image.length / 1024)}KB to GPT-4o Vision...`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: `Extract all product listings from this trade show exhibitor catalog page.

Look for:
- Product names
- SKU/model numbers
- Descriptions
- Categories (Backwalls, Lighting, Counters, Flooring, Banners, Displays, etc.)
- Dimensions (e.g., "10'W x 8'H")
- Prices (if visible)

For each product, also identify the location/region of its image on the page so we can later extract it for branding projection.

Return ONLY a valid JSON array with this exact format:
[{
  "name": "Product Name",
  "sku": "SKU-123",
  "description": "Product description",
  "category": "Category",
  "dimensions": "10'W x 8'H",
  "price": 1299,
  "image_region": "describe approximate location on page (e.g., 'top left', 'center right', 'bottom third')"
}]

If no products are found, return an empty array: []`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
              detail: "high"
            }
          }
        ]
      }],
      max_tokens: 3000,
      temperature: 0
    });

    const content = response.choices[0].message.content.trim();

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const products = JSON.parse(jsonMatch[0]);
      return Array.isArray(products) ? products : [];
    }

    console.log(`     ⚠️  No JSON array found in GPT-4o response`);
    return [];
  } catch (error) {
    console.warn(`     ⚠️  GPT-4o Vision failed: ${error.message}`);
    return [];
  }
}

/**
 * Generate embedding for semantic search
 */
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.substring(0, 8000)
    });

    return response.data[0].embedding;
  } catch (error) {
    console.warn(`     ⚠️  Embedding generation failed: ${error.message}`);
    return null;
  }
}

// Run the script
ingestFromPNG().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
