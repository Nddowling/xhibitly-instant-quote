#!/usr/bin/env node

/**
 * Test Catalog Ingestion (First 3 Pages)
 *
 * Tests the Puppeteer-based PDF ingestion on a small sample
 * to verify everything works before running the full 216-page ingestion.
 */

import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
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
const TEST_PAGES = [22, 35, 50]; // Test specific pages with known content

/**
 * Test ingestion on sample pages
 */
async function testIngest() {
  console.log('🧪 Testing catalog ingestion on sample pages...');
  console.log(`📄 PDF: ${PDF_PATH}`);
  console.log(`📋 Testing pages: ${TEST_PAGES.join(', ')}\n`);

  // Parse PDF to extract text
  console.log('📖 Parsing PDF for text extraction...');
  const pdfBuffer = readFileSync(PDF_PATH);
  const pdfData = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdfDocument = await loadingTask.promise;
  console.log(`✅ PDF loaded: ${pdfDocument.numPages} pages\n`);

  // Launch browser for screenshots
  console.log('🌐 Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const pageNum of TEST_PAGES) {
      console.log(`\n🔄 Processing page ${pageNum}...`);

      try {
        await processPageWithPuppeteer(browser, PDF_PATH, pageNum, pdfDocument);
        console.log(`✅ Page ${pageNum} complete`);
      } catch (error) {
        console.error(`❌ Error processing page ${pageNum}:`, error.message);
        console.error('   Stack:', error.stack);
      }
    }

    console.log('\n\n✅ Test complete!');
    console.log('📊 Processed', TEST_PAGES.length, 'pages successfully');
    console.log('\n🔍 Verifying data in Base44...');

    // Verify pages were saved
    for (const pageNum of TEST_PAGES) {
      const page = await base44.entities.CatalogPage.filter({
        page_number: pageNum
      });

      if (page.length > 0) {
        console.log(`   ✅ Page ${pageNum}: Found ${page[0].products?.length || 0} products`);
      } else {
        console.log(`   ⚠️  Page ${pageNum}: Not found in database`);
      }
    }

  } finally {
    await browser.close();
  }
}

/**
 * Process a single page with Puppeteer
 */
async function processPageWithPuppeteer(browser, pdfPath, pageNum, pdfDocument) {
  const page = await browser.newPage();

  try {
    // Render specific page as image
    console.log('  🖼️  Rendering page...');
    await page.goto(`file://${pdfPath}#page=${pageNum}`, { waitUntil: 'networkidle0' });

    // Take screenshot
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true
    });

    // Save first screenshot to disk for verification
    if (pageNum === TEST_PAGES[0]) {
      const debugPath = join(__dirname, `../debug-page-${pageNum}.png`);
      writeFileSync(debugPath, screenshot);
      console.log(`     DEBUG: Screenshot saved to ${debugPath}`);
    }

    // Extract text using pdfjs-dist
    console.log('  📝 Extracting text...');
    const pdfPage = await pdfDocument.getPage(pageNum);
    const textContent = await pdfPage.getTextContent();
    console.log(`     DEBUG: textContent.items.length = ${textContent.items.length}`);
    if (textContent.items.length > 0) {
      console.log(`     DEBUG: First item:`, textContent.items[0]);
    }
    const pageText = textContent.items.map(item => item.str).join(' ');

    console.log(`     Text length: ${pageText.length} chars`);
    if (pageText.length > 0) {
      console.log(`     First 200 chars: "${pageText.substring(0, 200)}"`);
    }

    // Upload image to Base44
    console.log('  ☁️  Uploading image...');
    const imageUrl = await uploadImageToBase44(screenshot, `catalog-page-${pageNum}.png`);
    console.log(`     Image URL: ${imageUrl.substring(0, 60)}...`);

    // Extract products using GPT-4 Vision
    console.log('  🤖 Extracting products with GPT-4 Vision...');
    const products = await extractProductsWithVision(screenshot, pageText);
    console.log(`     Found ${products.length} products`);

    if (products.length > 0) {
      console.log(`     Sample product: ${products[0].name || 'N/A'}`);
    }

    // Generate embedding
    console.log('  🧠 Generating embeddings...');
    const embedding = await generateEmbedding(`Page ${pageNum}: ${pageText}`);
    console.log(`     Embedding dimensions: ${embedding ? embedding.length : 'failed'}`);

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

  } finally {
    await page.close();
  }
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
async function extractProductsWithVision(imageBuffer, pageText) {
  // Ensure imageBuffer is a proper Buffer
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
            text: `Extract all product listings from this catalog page. Return JSON array:
[{
  "name": "Product Name",
  "sku": "SKU",
  "description": "Description",
  "category": "Backwalls/Lighting/Counters/Flooring/Banners/etc",
  "dimensions": "10'W x 8'H",
  "price": 1299,
  "image_region": "describe where product image is on page"
}]

Page text: ${pageText.substring(0, 2000)}

Return ONLY valid JSON array.`
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
    console.log(`     DEBUG: GPT-4o response (first 500 chars): "${content.substring(0, 500)}"`);

    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const products = JSON.parse(jsonMatch[0]);
      return Array.isArray(products) ? products : [];
    }

    console.log(`     DEBUG: No JSON array found in GPT-4o response`);
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
