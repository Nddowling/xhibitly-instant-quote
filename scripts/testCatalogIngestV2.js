#!/usr/bin/env node

/**
 * Test Catalog Ingestion V2 (PDF Canvas Rendering)
 *
 * Uses pdfjs-dist + node-canvas to properly render PDF pages as images
 * for GPT-4o Vision extraction.
 */

import { readFileSync, writeFileSync } from 'fs';
import { createCanvas, Image } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OpenAI } from 'openai';
import { createClient } from '@base44/sdk';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set worker path for Node.js
pdfjsLib.GlobalWorkerOptions.workerSrc = join(__dirname, '../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');

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

const PDF_PATH = '/Users/nicholasdowling/Downloads/exhibitors-handbook.pdf';
const HANDBOOK_NAME = 'Exhibitors Handbook 2022';
const TEST_PAGES = [22, 35, 50];

/**
 * Node Canvas Factory for pdfjs-dist
 */
class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return {
      canvas,
      context
    };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/**
 * Test ingestion on sample pages
 */
async function testIngest() {
  console.log('🧪 Testing catalog ingestion V2 (Canvas rendering)...');
  console.log(`📄 PDF: ${PDF_PATH}`);
  console.log(`📋 Testing pages: ${TEST_PAGES.join(', ')}\n`);

  // Parse PDF
  console.log('📖 Loading PDF...');
  const pdfBuffer = readFileSync(PDF_PATH);
  const pdfData = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdfDocument = await loadingTask.promise;
  console.log(`✅ PDF loaded: ${pdfDocument.numPages} pages\n`);

  for (const pageNum of TEST_PAGES) {
    console.log(`\n🔄 Processing page ${pageNum}...`);

    try {
      await processPage(pdfDocument, pageNum);
      console.log(`✅ Page ${pageNum} complete`);
    } catch (error) {
      console.error(`❌ Error processing page ${pageNum}:`, error.message);
      console.error('   Stack:', error.stack);
    }
  }

  console.log('\n\n✅ Test complete!');
  console.log(`📊 Processed ${TEST_PAGES.length} pages`);

  // Verify
  console.log('\n🔍 Verifying data in Base44...');
  for (const pageNum of TEST_PAGES) {
    const results = await base44.entities.CatalogPage.filter({
      page_number: pageNum
    });

    if (results.length > 0) {
      console.log(`   ✅ Page ${pageNum}: Found ${results[0].products?.length || 0} products`);
    } else {
      console.log(`   ⚠️  Page ${pageNum}: Not found in database`);
    }
  }
}

/**
 * Process a single page
 */
async function processPage(pdfDocument, pageNum) {
  // Get page
  console.log('  📄 Loading PDF page...');
  const pdfPage = await pdfDocument.getPage(pageNum);

  // Render to canvas
  console.log('  🎨 Rendering to canvas...');
  const viewport = pdfPage.getViewport({ scale: 2.0 }); // 2x scale for better quality
  const canvasFactory = new NodeCanvasFactory();
  const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
  const { canvas, context } = canvasAndContext;

  const renderContext = {
    canvasContext: context,
    viewport: viewport,
    canvasFactory: canvasFactory,
    background: 'white'
  };

  await pdfPage.render(renderContext).promise;
  console.log(`     Canvas size: ${viewport.width}x${viewport.height}`);

  // Convert canvas to PNG buffer
  const imageBuffer = canvas.toBuffer('image/png');
  console.log(`     Image size: ${Math.round(imageBuffer.length / 1024)}KB`);

  // Save first image for verification
  if (pageNum === TEST_PAGES[0]) {
    const debugPath = join(__dirname, `../debug-canvas-page-${pageNum}.png`);
    writeFileSync(debugPath, imageBuffer);
    console.log(`     DEBUG: Image saved to ${debugPath}`);
  }

  // Upload image to Base44
  console.log('  ☁️  Uploading image...');
  const imageUrl = await uploadImageToBase44(imageBuffer, `catalog-page-${pageNum}.png`);

  // Extract products using GPT-4 Vision
  console.log('  🤖 Extracting products with GPT-4 Vision...');
  const products = await extractProductsWithVision(imageBuffer);
  console.log(`     Found ${products.length} products`);

  if (products.length > 0) {
    console.log(`     Sample: ${products[0].name || 'N/A'}`);
  }

  // Generate text from products for embeddings
  const pageText = products.map(p =>
    `${p.name} ${p.description || ''} ${p.category || ''} ${p.sku || ''}`
  ).join(' ');

  // Generate embedding
  console.log('  🧠 Generating embeddings...');
  const embedding = await generateEmbedding(`Page ${pageNum}: ${pageText}`);

  // Save to Base44
  console.log('  💾 Saving to Base44...');
  await base44.entities.CatalogPage.create({
    page_number: pageNum,
    page_text: pageText.substring(0, 10000),
    page_image_url: imageUrl,
    embedding_vector: embedding,
    products: products,
    handbook_name: HANDBOOK_NAME
  });
}

/**
 * Upload image to Base44 storage
 */
async function uploadImageToBase44(imageBuffer, filename) {
  try {
    const uploadResult = await base44.storage.upload({
      file: imageBuffer,
      filename: filename,
      contentType: 'image/png'
    });

    return uploadResult.url;
  } catch (error) {
    console.warn('     ⚠️  Storage upload failed, using data URL fallback');
    const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }
}

/**
 * Extract products from page using GPT-4 Vision
 */
async function extractProductsWithVision(imageBuffer) {
  const buffer = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
  const base64Image = buffer.toString('base64');

  try {
    console.log(`     DEBUG: Sending ${Math.round(base64Image.length / 1024)}KB image to GPT-4o`);

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

Return ONLY a valid JSON array with this exact format:
[{
  "name": "Product Name",
  "sku": "SKU-123",
  "description": "Product description",
  "category": "Category",
  "dimensions": "10'W x 8'H",
  "price": 1299
}]

If no products are found, return an empty array: []`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: "high"
            }
          }
        ]
      }],
      max_tokens: 2000,
      temperature: 0
    });

    const content = response.choices[0].message.content.trim();
    console.log(`     DEBUG: GPT-4o response (first 300 chars): "${content.substring(0, 300)}"`);

    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const products = JSON.parse(jsonMatch[0]);
      return Array.isArray(products) ? products : [];
    }

    console.log(`     DEBUG: No JSON array found in response`);
    return [];
  } catch (error) {
    console.warn('     ⚠️  GPT-4 Vision failed:', error.message);
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
    console.warn('     ⚠️  Embedding generation failed:', error.message);
    return null;
  }
}

// Run the test
testIngest().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
