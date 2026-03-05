#!/usr/bin/env node

/**
 * Count all GLB files in Supabase storage
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

console.log('🔍 Counting GLB files in Supabase...\n');

async function countGLBFiles() {
  try {
    // List all product folders
    const { data: folders, error: foldersError } = await supabase.storage
      .from('orbus-assets')
      .list('products', { limit: 1000 });

    if (foldersError) throw foldersError;

    console.log(`📦 Found ${folders.length} product folders\n`);

    let totalGLBs = 0;
    const productsWithGLBs = [];

    // Check each folder for model_3d subfolder
    for (const folder of folders) {
      const { data: files } = await supabase.storage
        .from('orbus-assets')
        .list(`products/${folder.name}/model_3d`, { limit: 100 });

      if (files && files.length > 0) {
        const glbFiles = files.filter(f => f.name.endsWith('.glb'));
        if (glbFiles.length > 0) {
          totalGLBs += glbFiles.length;
          productsWithGLBs.push({
            sku: folder.name,
            glbCount: glbFiles.length,
            files: glbFiles.map(f => f.name)
          });
        }
      }
    }

    console.log('✅ Results:\n');
    console.log(`Total GLB files: ${totalGLBs}`);
    console.log(`Products with GLBs: ${productsWithGLBs.length}\n`);

    if (productsWithGLBs.length > 0) {
      console.log('Products with GLB files:');
      productsWithGLBs.forEach(p => {
        console.log(`  ${p.sku}: ${p.glbCount} file(s)`);
        p.files.forEach(f => console.log(`    - ${f}`));
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

countGLBFiles();
