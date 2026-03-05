#!/usr/bin/env node

/**
 * Test script for catalog search functionality
 *
 * Usage: node scripts/testCatalogSearch.js
 */

import { searchProducts, searchByPageNumber, searchByCategory } from '../src/lib/catalogSearch.js';

async function runTests() {
  console.log('🧪 Testing Catalog Search System\n');

  // Test 1: Search by page number
  console.log('Test 1: Search by page number (page 22)');
  const page22 = await searchByPageNumber(22);
  if (page22) {
    console.log(`✅ Found page 22 with ${page22.products?.length || 0} products`);
    if (page22.products && page22.products.length > 0) {
      console.log(`   First product: ${page22.products[0].name}`);
    }
  } else {
    console.log('❌ Page 22 not found (catalog may not be ingested yet)');
  }

  console.log('');

  // Test 2: Semantic product search
  console.log('Test 2: Semantic search for "LED light boxes"');
  const lightboxes = await searchProducts('LED light boxes', { limit: 3 });
  if (lightboxes.length > 0) {
    console.log(`✅ Found ${lightboxes.length} matching products:`);
    lightboxes.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name} (page ${p.page_number}, score: ${p.relevance_score})`);
    });
  } else {
    console.log('❌ No products found (catalog may not be ingested yet)');
  }

  console.log('');

  // Test 3: Category search
  console.log('Test 3: Search by category "Lighting"');
  const lightingProducts = await searchByCategory('Lighting');
  if (lightingProducts.length > 0) {
    console.log(`✅ Found ${lightingProducts.length} lighting products`);
    console.log(`   Example: ${lightingProducts[0].name} (page ${lightingProducts[0].page_number})`);
  } else {
    console.log('❌ No lighting products found');
  }

  console.log('');

  // Test 4: Hybrid search (page + query)
  console.log('Test 4: Hybrid search - "counter" on page 35');
  const counters = await searchProducts('counter', { pageNumber: 35, limit: 3 });
  if (counters.length > 0) {
    console.log(`✅ Found ${counters.length} counters on page 35:`);
    counters.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.name}`);
    });
  } else {
    console.log('❌ No counters found on page 35');
  }

  console.log('\n✅ All tests complete!');
  console.log('\nNote: If tests fail, run "npm run ingest-catalog" first to process the PDF.');
}

runTests().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
