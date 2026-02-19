/**
 * XHIBITLY Booth Design Business Rules Engine v1.1
 * 
 * CORE PRINCIPLE: If it appears in the booth, it appears in the quote.
 *                 If it appears in the quote, it appears in the booth.
 * 
 * This runs AFTER the AI proposes a design and BEFORE image generation.
 * It enforces, corrects, upgrades, and auto-adds to guarantee
 * every design is commercially valid and visually honest.
 */

// ─── GEOMETRY TYPE CONSTANTS ───
const GEO = {
  BACKWALL: 'backwall',
  COUNTER: 'counter',
  TABLE: 'table',
  TENT: 'tent',
  BANNER: 'banner_stand',
  BILLBOARD: 'billboard',
  MONITOR: 'monitor_stand',
  LIGHTING: 'lighting',
  FLOORING: 'flooring',
  ACCESSORY: 'accessory',
  POPUP_BAR: 'popup_bar',
  KIOSK: 'kiosk',
};

// ─── FORBIDDEN SKUS (never auto-select these) ───
const FORBIDDEN_SKUS = [
  // Plain/unbranded flooring — always upgrade
];

// ─── FLOORING RULES ───
// POLICY: Always use branded carpet. Interlocking floors are never offered.
const FLOORING_FORBIDDEN_KEYWORDS = ['plain', 'gray', 'grey', 'unbranded', 'bare', 'interlocking', 'interlock', 'tile', 'foam', 'rubber'];

function isFlooringForbidden(product) {
  const name = (product.display_name || product.name || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const sku = (product.manufacturer_sku || product.sku || '').toLowerCase();
  // Reject anything with forbidden keywords
  if (FLOORING_FORBIDDEN_KEYWORDS.some(kw => name.includes(kw) || desc.includes(kw) || sku.includes(kw))) return true;
  // Also reject any flooring that is NOT branded carpet
  return !isFlooringBrandedCarpet(product);
}

function isFlooringBrandedCarpet(product) {
  const name = (product.display_name || product.name || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  return (
    name.includes('carpet') || name.includes('branded carpet') ||
    desc.includes('carpet') || desc.includes('dye-sub carpet') ||
    desc.includes('custom print carpet')
  );
}

function isFlooringBranded(product) {
  return isFlooringBrandedCarpet(product);
}

// ─── REQUIRED BASE COMPONENTS ───
const REQUIRED_GEOMETRY_TYPES = [
  GEO.FLOORING,
  GEO.BACKWALL,   // structural system
  GEO.LIGHTING,
  // counter OR kiosk — handled separately
];

// ─── SERVICE AUTO-INJECTION RULES ───
const HANGING_TRIGGER_CATEGORIES = ['hanging structure', 'hanging sign', 'truss'];

function hasHangingElements(products) {
  return products.some(p => {
    const cat = (p.category_name || p.category || '').toLowerCase();
    const name = (p.display_name || p.name || '').toLowerCase();
    return HANGING_TRIGGER_CATEGORIES.some(kw => cat.includes(kw) || name.includes(kw)) ||
           name.includes('suspended') || name.includes('ceiling');
  });
}

function hasLargeGraphics(products) {
  return products.some(p => {
    const dims = p.dimensions || {};
    return (dims.width && dims.width >= 8) && 
           (p.customizable === true) &&
           ((p.branding_surfaces || []).length > 0);
  });
}

function hasTechnology(products) {
  return products.some(p => {
    const cat = (p.category_name || p.category || '').toLowerCase();
    const name = (p.display_name || p.name || '').toLowerCase();
    return cat.includes('monitor') || cat.includes('screen') || cat.includes('led') ||
           name.includes('monitor') || name.includes('screen') || name.includes('led wall');
  });
}

// ─── TIER DEFAULTS (for auto-adding missing components) ───
function getDefaultFlooringSkuForTier(tier, boothSize, catalog) {
  // ONLY branded carpet — never interlocking
  const carpetProducts = catalog
    .filter(p => p.geometry_type === GEO.FLOORING)
    .filter(p => isFlooringBrandedCarpet(p))
    .filter(p => !p.booth_sizes || p.booth_sizes.includes(boothSize));

  // Sort by price for tier
  carpetProducts.sort((a, b) => {
    if (tier === 'Custom') return b.base_price - a.base_price;
    return a.base_price - b.base_price;
  });

  // Fallback: if no carpet products exist, pick any non-interlocking flooring
  if (carpetProducts.length === 0) {
    const anyFlooring = catalog
      .filter(p => p.geometry_type === GEO.FLOORING)
      .filter(p => !p.booth_sizes || p.booth_sizes.includes(boothSize))
      .filter(p => {
        const name = (p.display_name || p.name || '').toLowerCase();
        return !name.includes('interlocking') && !name.includes('interlock') && !name.includes('tile');
      });
    return anyFlooring[0] || null;
  }

  return carpetProducts[0] || null;
}

function getDefaultForGeometry(geoType, tier, boothSize, catalog) {
  const candidates = catalog
    .filter(p => p.geometry_type === geoType)
    .filter(p => !p.booth_sizes || p.booth_sizes.includes(boothSize));

  // For tier matching, prefer products in the same tier, then any
  const tierMatched = candidates.filter(p => p.price_tier === tier);
  const pool = tierMatched.length > 0 ? tierMatched : candidates;

  // Sort by price: Modular → cheapest, Custom → most expensive, Hybrid → mid
  if (tier === 'Modular') {
    pool.sort((a, b) => a.base_price - b.base_price);
  } else if (tier === 'Custom') {
    pool.sort((a, b) => b.base_price - a.base_price);
  } else {
    // Hybrid — pick middle
    pool.sort((a, b) => a.base_price - b.base_price);
    if (pool.length > 2) return pool[Math.floor(pool.length / 2)];
  }

  return pool[0] || null;
}

// ═══════════════════════════════════════════════════════
//  MAIN RULES ENGINE
// ═══════════════════════════════════════════════════════

export function enforceBoothRules(design, catalog, services, boothSize, customerProfile) {
  const corrections = []; // log of what the engine changed
  let selectedProducts = [...(design.product_skus || [])];

  // Build lookup: sku → product
  const skuMap = {};
  catalog.forEach(p => {
    const sku = p.manufacturer_sku || p.sku;
    if (sku) skuMap[sku] = p;
  });

  // Get the actual product objects for selected SKUs
  const getSelectedProducts = () => selectedProducts.map(sku => skuMap[sku]).filter(Boolean);

  // ── RULE 1: Strip forbidden SKUs ──
  selectedProducts = selectedProducts.filter(sku => {
    if (FORBIDDEN_SKUS.includes(sku)) {
      corrections.push(`Removed forbidden SKU: ${sku}`);
      return false;
    }
    return true;
  });

  // ── RULE 2: Flooring — upgrade or replace forbidden flooring ──
  const flooringSkus = selectedProducts.filter(sku => skuMap[sku]?.geometry_type === GEO.FLOORING);
  flooringSkus.forEach(sku => {
    const product = skuMap[sku];
    if (product && isFlooringForbidden(product)) {
      // Remove the forbidden flooring
      selectedProducts = selectedProducts.filter(s => s !== sku);
      const replacement = getDefaultFlooringSkuForTier(design.tier, boothSize, catalog);
      if (replacement) {
        const repSku = replacement.manufacturer_sku || replacement.sku;
        selectedProducts.push(repSku);
        corrections.push(`Upgraded plain flooring "${product.display_name}" → "${replacement.display_name}"`);
      }
    }
  });

  // ── RULE 3: Required base components ──
  // Check backwall/structural
  const hasBackwall = getSelectedProducts().some(p => 
    p.geometry_type === GEO.BACKWALL || p.geometry_type === GEO.TENT
  );
  if (!hasBackwall) {
    const fallback = getDefaultForGeometry(GEO.BACKWALL, design.tier, boothSize, catalog);
    if (fallback) {
      selectedProducts.push(fallback.manufacturer_sku || fallback.sku);
      corrections.push(`Auto-added required backwall: "${fallback.display_name}"`);
    }
  }

  // Check counter or kiosk
  const hasCounter = getSelectedProducts().some(p =>
    p.geometry_type === GEO.COUNTER || p.geometry_type === GEO.KIOSK || p.geometry_type === GEO.POPUP_BAR
  );
  if (!hasCounter) {
    const fallback = getDefaultForGeometry(GEO.COUNTER, design.tier, boothSize, catalog) ||
                     getDefaultForGeometry(GEO.KIOSK, design.tier, boothSize, catalog);
    if (fallback) {
      selectedProducts.push(fallback.manufacturer_sku || fallback.sku);
      corrections.push(`Auto-added required counter: "${fallback.display_name}"`);
    }
  }

  // Check lighting
  const hasLighting = getSelectedProducts().some(p => p.geometry_type === GEO.LIGHTING);
  if (!hasLighting) {
    const fallback = getDefaultForGeometry(GEO.LIGHTING, design.tier, boothSize, catalog);
    if (fallback) {
      selectedProducts.push(fallback.manufacturer_sku || fallback.sku);
      corrections.push(`Auto-added required lighting: "${fallback.display_name}"`);
    }
  }

  // Check flooring
  const hasFlooring = getSelectedProducts().some(p => p.geometry_type === GEO.FLOORING);
  if (!hasFlooring) {
    const fallback = getDefaultFlooringSkuForTier(design.tier, boothSize, catalog);
    if (fallback) {
      selectedProducts.push(fallback.manufacturer_sku || fallback.sku);
      corrections.push(`Auto-added required flooring: "${fallback.display_name}"`);
    }
  }

  // ── RULE 4: Hanging elements → auto-inject services ──
  const autoServices = [];
  const currentProducts = getSelectedProducts();

  if (hasHangingElements(currentProducts)) {
    autoServices.push(
      { name: 'Engineering Review', cost: 750, reason: 'Hanging elements require structural engineering review' },
      { name: 'Rigging Labor', cost: 1200, reason: 'Hanging elements require certified rigging crew' },
      { name: 'Venue Approval Handling', cost: 350, reason: 'Hanging elements require venue approval coordination' }
    );
    corrections.push('Auto-added engineering, rigging, and venue approval services for hanging elements');
  }

  // ── RULE 5: Large graphics → auto-add file prep / print management ──
  if (hasLargeGraphics(currentProducts)) {
    autoServices.push(
      { name: 'File Prep & Print Management', cost: 450, reason: 'Large branded graphics require file prep and print management' }
    );
    corrections.push('Auto-added file prep & print management for large graphics');
  }

  // ── RULE 6: Technology → auto-add electrical/AV ──
  if (hasTechnology(currentProducts)) {
    autoServices.push(
      { name: 'Electrical & AV Setup', cost: 400, reason: 'Technology components require electrical and AV setup' }
    );
    corrections.push('Auto-added electrical & AV setup for technology components');
  }

  // ── RULE 7: Tier-specific mandatory services ──
  if (design.tier === 'Hybrid' || design.tier === 'Custom') {
    autoServices.push(
      { name: 'Project Management', cost: 500, reason: `${design.tier} tier includes project management` }
    );
    corrections.push(`Auto-added project management for ${design.tier} tier`);
  }

  if (design.tier === 'Custom') {
    autoServices.push(
      { name: 'On-Site Supervision', cost: 500, reason: 'Custom tier requires on-site supervision' },
      { name: 'Engineering Review', cost: 750, reason: 'Custom tier requires engineering review' }
    );
    // Deduplicate
    corrections.push('Auto-added supervision and engineering for Custom tier');
  }

  // ── RULE 8: Customer logistics request → auto-add shipping ──
  if (customerProfile?.needs_logistics) {
    const shippingService = services.find(s => s.category === 'shipping');
    if (shippingService) {
      autoServices.push({
        name: shippingService.name,
        cost: shippingService.base_cost,
        reason: 'Customer requested logistics support'
      });
      corrections.push('Auto-added shipping & logistics per customer request');
    }
  }

  // ── RULE 9: Customer graphic design request → auto-add graphic design ──
  if (customerProfile?.needs_graphic_design) {
    const gdService = services.find(s => s.category === 'graphic_design');
    if (gdService) {
      autoServices.push({
        name: gdService.name,
        cost: gdService.base_cost,
        reason: 'Customer requested graphic design assistance'
      });
      corrections.push('Auto-added graphic design services per customer request');
    }
  }

  // ── Deduplicate auto-services ──
  const uniqueServices = [];
  const seenServiceNames = new Set();
  autoServices.forEach(s => {
    if (!seenServiceNames.has(s.name)) {
      seenServiceNames.add(s.name);
      uniqueServices.push(s);
    }
  });

  // ── RULE 10: Rebuild line items from validated product list ──
  const finalProducts = getSelectedProducts();
  const lineItems = finalProducts.map(p => ({
    sku: p.manufacturer_sku || p.sku,
    name: p.display_name || p.name,
    category: p.category_name || p.category || '',
    quantity: 1,
    unit_price: p.is_rental ? (p.rental_price || p.base_price) : p.base_price,
    line_total: p.is_rental ? (p.rental_price || p.base_price) : p.base_price,
  }));

  // Add services as line items
  uniqueServices.forEach(s => {
    lineItems.push({
      sku: 'SVC-' + s.name.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20),
      name: s.name,
      category: 'Services',
      quantity: 1,
      unit_price: s.cost,
      line_total: s.cost,
    });
  });

  // ── RULE 11: Recalculate total from locked line items ──
  const totalPrice = lineItems.reduce((sum, li) => sum + li.line_total, 0);

  // ── Build the corrected design ──
  return {
    ...design,
    product_skus: selectedProducts,
    line_items: lineItems,
    total_price: totalPrice,
    auto_services: uniqueServices,
    rules_corrections: corrections,
    rules_validated: true,
  };
}

/**
 * Convenience: run the rules engine on all 3 tier designs
 */
export function enforceAllDesigns(designs, catalog, services, boothSize, customerProfile) {
  return designs.map(design => 
    enforceBoothRules(design, catalog, services, boothSize, customerProfile)
  );
}