const orderMaterialFields = [
  'customer_name', 'customer_email', 'customer_phone', 'customer_company',
  'website_url', 'show_name', 'show_date', 'booth_size', 'booth_type',
  'selected_services', 'dealer_markup_pct', 'customer_discount_pct',
  'promo_code_applied', 'discount_amount', 'discount_reason'
];

const designMaterialFields = [
  'brand_name', 'brand_url', 'brand_identity', 'booth_size', 'booth_type',
  'open_sides', 'layout_instructions', 'spatial_layout', 'scene_json'
];

function pick(source, fields) {
  return fields.reduce((result, field) => {
    result[field] = source?.[field] ?? null;
    return result;
  }, {});
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function materialVisualQuoteData({ order, lineItems = [], boothDesign = null }) {
  return {
    project: pick(order, orderMaterialFields),
    products: [...lineItems]
      .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')))
      .map((item) => ({
        line_item_id: item.id,
        product_id: item.product_id || null,
        sku: item.sku || '',
        quantity: Number(item.quantity || 1),
        product_snapshot: item.product_snapshot || {
          name: item.product_name || '',
          description: item.description || '',
          image_url: item.image_url || '',
          unit_price: item.unit_price ?? null,
        },
        unit_price: item.unit_price ?? null,
        list_unit_price: item.list_unit_price ?? null,
        markup_pct: item.markup_pct ?? null,
        discount_pct: item.discount_pct ?? null,
        placement_intent: item.placement_intent || null,
        verification_status: item.verification_status || null,
        pricing_status: item.pricing_status || null,
        render_ready: item.render_ready ?? null,
      })),
    booth_design: boothDesign ? pick(boothDesign, designMaterialFields) : null,
  };
}

export function configurationFingerprint(input) {
  const text = stableStringify(materialVisualQuoteData(input));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildVisualQuoteConfiguration({ order, lineItems = [], boothDesign = null, configurationVersion = 0 }) {
  const material = materialVisualQuoteData({ order, lineItems, boothDesign });
  return {
    project_id: order?.id || null,
    reference_number: order?.reference_number || null,
    configuration_version: configurationVersion,
    assembled_at: new Date().toISOString(),
    customer: {
      name: order?.customer_name || '',
      email: order?.customer_email || '',
      phone: order?.customer_phone || '',
      company: order?.customer_company || '',
    },
    website: order?.website_url || '',
    show: { name: order?.show_name || '', date: order?.show_date || null },
    booth: {
      size: order?.booth_size || boothDesign?.booth_size || '',
      type: order?.booth_type || boothDesign?.booth_type || '',
      open_sides: boothDesign?.open_sides || [],
      placement_instructions: boothDesign?.layout_instructions || '',
    },
    brand_identity: boothDesign?.brand_identity || null,
    products: material.products,
    pricing: {
      list_total: order?.list_price_total ?? null,
      quoted_price: order?.quoted_price ?? null,
      final_price: order?.final_price ?? null,
      dealer_markup_pct: order?.dealer_markup_pct ?? 0,
      customer_discount_pct: order?.customer_discount_pct ?? 0,
      discounts: {
        rule: order?.rule_discount_amount ?? 0,
        customer: order?.customer_discount_amount ?? 0,
        promo: order?.promo_discount_amount ?? 0,
      },
    },
    services: order?.selected_services || [],
    validation_results: boothDesign?.validation_results || null,
    render_contract: boothDesign?.render_contract || null,
    render_status: boothDesign?.render_status || null,
    approved_render_url: boothDesign?.approved_render_url || null,
  };
}