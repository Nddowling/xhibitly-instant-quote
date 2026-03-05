import { createClient } from '@base44/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const base44 = createClient({
  appId: process.env.VITE_BASE44_APP_ID,
  token: process.env.VITE_BASE44_API_KEY,
  functionsVersion: 'latest',
  appBaseUrl: 'https://app.base44.com',
  serverUrl: 'https://app.base44.com',
  requiresAuth: false
});

async function checkProducts() {
  try {
    const products = await base44.entities.Product.list();
    console.log(`\n📦 Total products in Base44: ${products.length}\n`);

    // Check how many have dimensions
    const withDimensions = products.filter(p =>
      p.footprint_w_ft && p.footprint_d_ft && p.height_ft
    );
    console.log(`✅ Products WITH dimensions: ${withDimensions.length}`);
    console.log(`❌ Products WITHOUT dimensions: ${products.length - withDimensions.length}`);

    // Check how many have images
    const withImages = products.filter(p => p.primary_image_url);
    console.log(`\n🖼️  Products with images: ${withImages.length}`);

    // Show first product with ALL fields
    if (products.length > 0) {
      console.log('\n📋 First product (all fields):');
      console.log(JSON.stringify(products[0], null, 2));
    }

    // Show first product WITH dimensions
    if (withDimensions.length > 0) {
      console.log('\n\n✨ First product WITH dimensions:');
      const sample = withDimensions[0];
      console.log(`   Name: ${sample.name}`);
      console.log(`   SKU: ${sample.sku}`);
      console.log(`   Width: ${sample.footprint_w_ft} ft`);
      console.log(`   Depth: ${sample.footprint_d_ft} ft`);
      console.log(`   Height: ${sample.height_ft} ft`);
      console.log(`   Image: ${sample.primary_image_url ? 'Yes' : 'No'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProducts();
