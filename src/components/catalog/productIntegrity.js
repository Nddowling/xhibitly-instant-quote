export function chooseCanonicalProduct(products = []) {
  const score = (product) => {
    const fields = [
      'name', 'base_price', 'retail_price', 'dimensions', 'footprint_w_ft',
      'footprint_d_ft', 'height_ft', 'image_cached_url', 'image_url',
      'render_category', 'physical_description', 'placement_zone',
      'render_instruction', 'material'
    ];
    return fields.reduce((total, field) => {
      const value = product?.[field];
      return total + (value !== undefined && value !== null && value !== '' ? 1 : 0);
    }, 0);
  };

  return [...products]
    .filter((product) => product?.sku && product?.is_active !== false)
    .sort((a, b) => {
      const scoreDifference = score(b) - score(a);
      if (scoreDifference !== 0) return scoreDifference;
      return new Date(b.updated_date || 0) - new Date(a.updated_date || 0);
    })[0] || null;
}