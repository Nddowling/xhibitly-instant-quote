#!/usr/bin/env node

/**
 * Exhibitor's Handbook PDF Ingestion Script (Puppeteer Version)
 *
 * Uses Puppeteer for reliable PDF rendering with product images.
 * Processes the 84MB PDF catalog and uploads to Base44.
 *
 * Usage: node scripts/ingestCatalogPuppeteer.js
 */

import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
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

/**
 * Main ingestion function
 */
async function ingestCatalog() {
  console.log('🚀 Starting catalog ingestion (Puppeteer version)...');
  console.log(`📄 PDF: ${PDF_PATH}`);

  // Parse PDF to extract text
  console.log('\n📖 Parsing PDF for text extraction...');
  const pdfBuffer = readFileSync(PDF_PATH);
  const pdfData = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdfDocument = await loadingTask.promise;
  const totalPages = pdfDocument.numPages;
  console.log(`✅ PDF loaded: ${totalPages} pages\n`);

  // Launch browser for screenshots
  console.log('🌐 Launching headless browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {

    // Process each page
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      console.log(`\n🔄 Processing page ${pageNum}/${totalPages}...`);

      try {
        await processPageWithPuppeteer(browser, PDF_PATH, pageNum, pdfDocument);
        console.log(`✅ Page ${pageNum} complete`);
      } catch (error) {
        console.error(`❌ Error processing page ${pageNum}:`, error.message);
        // Continue with next page
      }
    }

    console.log('\n\n🎉 Catalog ingestion complete!');
    console.log(`📊 Total pages processed: ${totalPages}`);

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

    // Extract text using pdfjs-dist
    console.log('  📝 Extracting text...');
    const pdfPage = await pdfDocument.getPage(pageNum);
    const textContent = await pdfPage.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');

    // Upload image to Base44
    console.log('  ☁️  Uploading image...');
    const imageUrl = await uploadImageToBase44(screenshot, `catalog-page-${pageNum}.png`);

    // Extract products using GPT-4 Vision
    console.log('  🤖 Extracting products with GPT-4 Vision...');
    const products = await extractProductsWithVision(screenshot, pageText);
    console.log(`     Found ${products.length} products`);

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
    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const products = JSON.parse(jsonMatch[0]);
      return Array.isArray(products) ? products : [];
    }

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

// Run the script
ingestCatalog().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
