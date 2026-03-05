#!/usr/bin/env node
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(path.join(__dirname, '../orbus_catalog/products_with_all_files.json'), 'utf-8'));
const products = data.products || [];

const withCAD = products.filter(p => p.additional_downloads?.some(d => d.asset_type === 'cad' && d.url));
const withGLB = products.filter(p => p.model_3d_url || p.has_3d_model);
const withCADnoGLB = withCAD.filter(p => !p.model_3d_url && !p.has_3d_model);

console.log('Total products:', products.length);
console.log('Products with CAD files:', withCAD.length);
console.log('Products already have GLB:', withGLB.length);
console.log('Products with CAD but no GLB:', withCADnoGLB.length);
console.log('No CAD at all:', products.length - withCAD.length);

// Show a sample of products with CAD but no GLB
console.log('\nSample products with CAD but no GLB (first 10):');
withCADnoGLB.slice(0, 10).forEach(p => {
  const cadFile = p.additional_downloads.find(d => d.asset_type === 'cad');
  console.log(`  ${p.sku} - ${p.name}`);
  console.log(`    CAD: ${cadFile.filename}`);
});
