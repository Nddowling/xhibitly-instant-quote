#!/usr/bin/env node

/**
 * Exhibitor's Handbook PDF Ingestion Script
 *
 * Processes the 84MB PDF catalog and uploads to Base44:
 * 1. Extracts text and images per page
 * 2. Uses GPT-4 Vision to parse products
 * 3. Generates embeddings for semantic search
 * 4. Creates CatalogPage entities in Base44
 *
 * Usage: node scripts/ingestCatalog.js
 */

import { readFileSync } from 'fs';
import { createCanvas, loadImage } from 'canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OpenAI } from 'openai';
import { createClient } from '@base44/sdk';
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
  serverUrl: '',
  requiresAuth: false
});

const PDF_PATH = '/Users/nicholasdowling/Downloads/exhibitors-handbook.pdf';
const HANDBOOK_NAME = 'Exhibitors Handbook 2022';

/**
 * Main ingestion function
 */
async function ingestCatalog() {
  console.log('🚀 Starting catalog ingestion...');
  console.log(`📄 PDF: ${PDF_PATH}`);

  // Load PDF
  console.log('\n📖 Loading PDF document...');
  const pdfData = new Uint8Array(readFileSync(PDF_PATH));
  const pdfDoc = await pdfjsLib.getDocument({ data: pdfData }).promise;

  console.log(`✅ Loaded ${pdfDoc.numPages} pages\n`);

  // Process each page
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    console.log(`\n🔄 Processing page ${pageNum}/${pdfDoc.numPages}...`);

    try {
      await processPage(pdfDoc, pageNum);
      console.log(`✅ Page ${pageNum} complete`);
    } catch (error) {
      console.error(`❌ Error processing page ${pageNum}:`, error.message);
      // Continue with next page
    }
  }

  console.log('\n\n🎉 Catalog ingestion complete!');
  console.log(`📊 Total pages processed: ${pdfDoc.numPages}`);
}

/**
 * Process a single page
 */
async function processPage(pdfDoc, pageNum) {
  // 1. Extract page text
  console.log('  📝 Extracting text...');
  const page = await pdfDoc.getPage(pageNum);
  const textContent = await page.getTextContent();
  const pageText = textContent.items.map(item => item.str).join(' ');

  // 2. Skip image rendering (text-only mode for MVP)
  console.log('  ⏭️  Skipping image (text-only mode)');
  const imageUrl = null;

  // 3. Extract products from text only
  console.log('  🤖 Extracting products from text...');
  const products = await extractProductsFromText(pageText);
  console.log(`     Found ${products.length} products`);

  // 5. Generate embedding for semantic search
  console.log('  🧠 Generating embeddings...');
  const embedding = await generateEmbedding(`Page ${pageNum}: ${pageText}`);

  // 6. Save to Base44
  console.log('  💾 Saving to Base44...');
  await base44.entities.CatalogPage.create({
    page_number: pageNum,
    page_text: pageText.substring(0, 10000), // Limit to 10k chars
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
    // Use Base44's file upload API
    const uploadResult = await base44.storage.upload({
      file: imageBuffer,
      filename: filename,
      contentType: 'image/png'
    });

    return uploadResult.url;
  } catch (error) {
    console.warn('     ⚠️  Storage upload failed, using data URL fallback');
    // Fallback to data URL if storage fails
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;
  }
}

/**
 * Extract products from page text using GPT-4
 */
async function extractProductsFromText(pageText) {
  if (!pageText || pageText.trim().length < 50) {
    return []; // Skip nearly empty pages
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [{
        role: "system",
        content: "You are analyzing product catalog pages. Extract product listings and return valid JSON only."
      }, {
        role: "user",
        content: `Extract all products from this catalog page text. Return a JSON array with format:
[{
  "name": "Product Name",
  "sku": "SKU-123",
  "description": "Brief description",
  "category": "Category (Backwalls/Lighting/Counters/Flooring/Banners/etc)",
  "dimensions": "10'W x 8'H",
  "price": 1299
}]

Page text:
${pageText.substring(0, 6000)}

Return ONLY the JSON array, no additional text.`
      }],
      max_tokens: 2000,
      temperature: 0
    });

    const content = response.choices[0].message.content.trim();

    // Try to extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const products = JSON.parse(jsonMatch[0]);
      return Array.isArray(products) ? products : [];
    }

    return [];
  } catch (error) {
    console.warn('     ⚠️  GPT-4 extraction failed:', error.message);
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
      input: text.substring(0, 8000) // Limit to 8k tokens
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
