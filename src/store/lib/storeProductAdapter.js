export function normalizeStoreProduct(product) {
  const price = Number(product.retail_price || product.base_price || product.market_value || 0);
  return {
    id: product.id,
    sku: product.sku,
    slug: product.sku || product.id,
    name: product.name,
    price,
    compare_at_price: product.retail_price && product.base_price && Number(product.retail_price) > Number(product.base_price)
      ? Number(product.retail_price)
      : null,
    short_description: product.description || product.category || '',
    description: product.description || '',
    category: product.category || 'Orbus Products',
    image_url: product.image_cached_url || product.image_url || '',
    images: [product.image_cached_url || product.image_url].filter(Boolean),
    in_stock: product.is_active !== false,
    tags: [product.product_line, product.category].filter(Boolean),
  };
}

export function getStoreCategories(products) {
  return Array.from(new Set(products.map(product => product.category).filter(Boolean))).sort();
}