/**
 * Orbus Exhibitor's Handbook — Page to Product Mapping
 *
 * Pre-processed from orbus_catalog/product_catalog_page_mapping.json
 * Maps physical catalog page numbers to the products that appear on them.
 *
 * Usage:
 *   import { PAGE_PRODUCTS, CATALOG_PAGES, MAX_PAGE } from '@/data/catalogPageMapping';
 *   const productsOnPage34 = PAGE_PRODUCTS[34] || [];
 */

import rawMapping from '../../orbus_catalog/product_catalog_page_mapping.json';

// Build pageNum → [{ sku, name, category, isPrimary }]
const PAGE_PRODUCTS = {};

for (const product of rawMapping.product_page_mapping) {
  for (const page of product.pages) {
    if (!PAGE_PRODUCTS[page]) PAGE_PRODUCTS[page] = [];
    PAGE_PRODUCTS[page].push({
      sku: product.product_sku,
      name: product.product_name,
      category: product.category,
      isPrimary: page === product.primary_page,
    });
  }
}

// Sort each page's products: primary products first
for (const page of Object.keys(PAGE_PRODUCTS)) {
  PAGE_PRODUCTS[page].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
}

const CATALOG_PAGES = Object.keys(PAGE_PRODUCTS).map(Number).sort((a, b) => a - b);
// Full catalog is 218 print pages (2026 edition)
const MAX_PAGE = 218;
const MIN_PAGE = 1;

// SKU → primary page lookup (for "where is this product?" feature)
const SKU_TO_PAGE = {};
for (const product of rawMapping.product_page_mapping) {
  SKU_TO_PAGE[product.product_sku] = product.primary_page;
}

export { PAGE_PRODUCTS, CATALOG_PAGES, MAX_PAGE, MIN_PAGE, SKU_TO_PAGE };
