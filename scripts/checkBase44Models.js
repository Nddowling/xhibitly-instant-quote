#!/usr/bin/env node

/**
 * Check how many products in Base44 have 3D models
 */

import Base44 from '@base44/node-sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const base44 = new Base44({
  apiKey: process.env.VITE_BASE44_API_KEY,
  environment: 'production'
});

console.log('🔍 Checking Base44 for products with 3D models...\n');

async function checkModels() {
  try {
    // Get all products
    const { data: allProducts } = await base44.entities.Product.list({
      page: 1,
      page_size: 1000
    });

    console.log(`📦 Total products in Base44: ${allProducts.length}\n`);

    // Count products with 3D models
    let withModelUrl = 0;
    let withModelGlbUrl = 0;
    let withModelCachedUrl = 0;
    let withAnyModel = 0;

    const productsWithModels = [];

    for (const product of allProducts) {
      const hasModelUrl = product.model_url && product.model_url.length > 0;
      const hasModelGlbUrl = product.model_glb_url && product.model_glb_url.length > 0;
      const hasModelCached = product.model_cached_url && product.model_cached_url.length > 0;

      if (hasModelUrl) withModelUrl++;
      if (hasModelGlbUrl) withModelGlbUrl++;
      if (hasModelCached) withModelCachedUrl++;

      if (hasModelUrl || hasModelGlbUrl || hasModelCached) {
        withAnyModel++;
        productsWithModels.push({
          sku: product.sku,
          name: product.name,
          model_url: hasModelUrl ? 'yes' : 'no',
          model_glb_url: hasModelGlbUrl ? 'yes' : 'no',
          model_cached_url: hasModelCached ? 'yes' : 'no'
        });
      }
    }

    console.log('3D Model Statistics:');
    console.log(`  Products with model_url: ${withModelUrl}`);
    console.log(`  Products with model_glb_url: ${withModelGlbUrl}`);
    console.log(`  Products with model_cached_url: ${withModelCachedUrl}`);
    console.log(`  Products with ANY 3D model: ${withAnyModel}`);
    console.log(`  Products WITHOUT 3D models: ${allProducts.length - withAnyModel}\n`);

    if (productsWithModels.length > 0) {
      console.log('Sample products with 3D models:');
      productsWithModels.slice(0, 5).forEach(p => {
        console.log(`  ${p.sku}: ${p.name}`);
        console.log(`    model_url: ${p.model_url}, model_glb_url: ${p.model_glb_url}, cached: ${p.model_cached_url}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', error.response.data);
    }
  }
}

checkModels();
