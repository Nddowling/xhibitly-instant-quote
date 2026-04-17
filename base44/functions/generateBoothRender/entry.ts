import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BRANDFETCH_API_KEY = (Deno.env.get('BRANDFETCH_API_KEY') ?? '').trim();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function dedupeUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)));
}

function normalizeReferenceUrl(url) {
  if (!url) return null;
  if (String(url).startsWith('http')) return url;
  if (String(url).startsWith('/images/')) {
    return `https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets${url}`;
  }
  return url;
}

function extractDomain(url) {
  try {
    const cleanUrl = String(url || '').trim().replace(/^https?:\/\/(www\.)?/, '');
    return cleanUrl.split('/')[0].split('?')[0];
  } catch {
    return String(url || '').trim();
  }
}

function parseBrandfetchResponse(brandfetchData, domain) {
  if (!brandfetchData) return null;

  const colors = Array.isArray(brandfetchData.colors)
    ? brandfetchData.colors.filter((c) => c?.hex && c.hex.startsWith('#')).map((c) => c.hex.toLowerCase()).slice(0, 4)
    : [];

  const logoOptions = Array.isArray(brandfetchData.logos)
    ? brandfetchData.logos.flatMap((logo) =>
        Array.isArray(logo?.formats)
          ? logo.formats
              .filter((format) => format?.src && ['png', 'jpeg', 'jpg', 'webp'].includes(format.format))
              .map((format) => ({
                url: format.src,
                format: format.format,
                width: format.width,
                height: format.height,
                type: logo?.type || 'logo',
              }))
          : []
      )
    : [];

  const sortedLogoOptions = [...logoOptions].sort((a, b) => {
    const score = (item) => {
      const typeScore = item?.type === 'icon' ? 0 : 10;
      const formatScore = item?.format === 'png' ? 5 : item?.format === 'webp' ? 4 : 3;
      const sizeScore = Number(item?.width || 0);
      return typeScore + formatScore + sizeScore;
    };
    return score(b) - score(a);
  });

  return {
    company_name: brandfetchData.name || domain || null,
    domain: domain || null,
    primary_color: colors[0] || null,
    secondary_color: colors[1] || null,
    accent_color_1: colors[2] || null,
    accent_color_2: colors[3] || null,
    logo_url: sortedLogoOptions[0]?.url || null,
    logo_options: sortedLogoOptions,
    industry: Array.isArray(brandfetchData.industries) ? brandfetchData.industries[0] || null : null,
  };
}

async function fetchBrandDetails(base44, websiteUrl) {
  if (!websiteUrl) return null;
  const domain = extractDomain(websiteUrl);
  if (!domain) return null;

  try {
    const existing = await base44.asServiceRole.entities.CompanyBrand.filter({ domain });
    if (existing?.length > 0) return existing[0]?.brand_identity || null;
  } catch {}

  if (!BRANDFETCH_API_KEY) return null;

  const response = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
    headers: { Authorization: `Bearer ${BRANDFETCH_API_KEY}` },
  });
  if (!response.ok) return null;

  const data = await response.json();
  const parsed = parseBrandfetchResponse(data, domain);
  if (!parsed) return null;

  if (parsed.logo_url && !String(parsed.logo_url).toLowerCase().includes('.svg')) {
    try {
      const cacheRes = await base44.functions.invoke('cacheExternalImage', { url: parsed.logo_url });
      if (cacheRes?.data?.success && cacheRes?.data?.cached_url) {
        parsed.logo_cached_url = cacheRes.data.cached_url;
      }
    } catch {}
  }

  await base44.asServiceRole.entities.CompanyBrand.create({
    domain,
    company_name: parsed.company_name || domain,
    brand_identity: parsed,
  });

  return parsed;
}

function parseBoothSize(boothSize) {
  const match = String(boothSize || '').match(/(\d+)x(\d+)/i);
  if (!match) return { width_ft: 10, depth_ft: 10 };
  return {
    width_ft: Number(match[1]),
    depth_ft: Number(match[2]),
  };
}

function getSkuFamily(sku) {
  return String(sku || '').split('-')[0] || String(sku || '');
}

function inferObjectClass(product) {
  const category = String(product.render_category || '').toLowerCase();
  const zone = String(product.placement_zone || '').toLowerCase();
  if (category.includes('accessory') || category.includes('monitor_mount') || category.includes('shelf')) return 'accessory';
  if (category.includes('backwall')) return 'backwall';
  if (category.includes('banner_stand')) return 'banner_stand';
  if (category.includes('counter')) return 'counter';
  if (category.includes('tower')) return 'tower';
  if (category.includes('lighting')) return 'lighting';
  if (zone === 'back_wall') return 'backwall';
  return category || 'unknown';
}

function sanitizeProduct(product) {
  const category = String(product.render_category || '').toLowerCase();
  let instruction = product.render_instruction || '';

  const objectClassKeywords = {
    banner_stand: ['table', 'counter', 'kiosk', 'cabinet', 'shelving unit'],
    accessory: ['standalone display', 'freestanding booth', 'floor unit'],
    case: ['display showcase', 'exhibit', 'retail fixture'],
    lighting: ['tower', 'column', 'architectural feature', 'wall'],
    monitor_mount: ['table', 'counter', 'floor stand'],
    shelf: ['freestanding', 'floor unit', 'standalone'],
  };

  for (const [classKey, bannedWords] of Object.entries(objectClassKeywords)) {
    if (category.includes(classKey)) {
      const instructionLower = instruction.toLowerCase();
      if (bannedWords.some((word) => instructionLower.includes(word))) {
        instruction = `Render as a ${category.replace(/_/g, ' ')}. Preserve original object form factor.`;
      }
      break;
    }
  }

  const physicalDescription = product.physical_description || (
    product.footprint_w_ft
      ? `${category.replace(/_/g, ' ')}, approx ${product.footprint_w_ft}ft W x ${product.footprint_d_ft || '?'}ft D x ${product.height_ft || '?'}ft H`
      : product.physical_description
  );

  return {
    ...product,
    render_instruction: instruction,
    physical_description: physicalDescription,
    _sanitized: true,
  };
}

function isFrameOnlySku(product) {
  const sku = String(product?.sku || '').toUpperCase();
  const name = String(product?.name || '').toLowerCase();
  const category = String(product?.category || '').toLowerCase();
  const renderCategory = String(product?.render_category || '').toLowerCase();

  const frameSignals = [
    sku.includes('-EXT-'),
    name.includes('frame only'),
    name.includes('hardware only'),
    name.includes('replacement frame'),
    name.includes('extrusion'),
    category.includes('hardware only'),
    renderCategory.includes('frame_only'),
  ];

  return frameSignals.some(Boolean);
}

function hasFabricOrKitCompanion(product, products) {
  const sku = String(product?.sku || '').toUpperCase();
  const family = getSkuFamily(sku);

  return (products || []).some((candidate) => {
    if (!candidate?.sku || candidate.sku === product.sku) return false;
    const candidateSku = String(candidate.sku).toUpperCase();
    const candidateName = String(candidate.name || '').toLowerCase();
    const sameFamily = getSkuFamily(candidateSku) === family || candidateSku.startsWith(family);
    const isCompanion = candidateName.includes('kit') || candidateName.includes('fabric') || !isFrameOnlySku(candidate);
    return sameFamily && isCompanion;
  });
}

function resolveAccessoryParent(item, hosts) {
  const zoneMatch = hosts.find((host) => host.placement_zone === item.placement_zone);
  if (zoneMatch) return zoneMatch.sku;

  const family = getSkuFamily(item.sku);
  const familyMatch = hosts.find((host) => getSkuFamily(host.sku) === family);
  if (familyMatch) return familyMatch.sku;

  const proximityMap = {
    front: ['front', 'center'],
    flanking: ['flanking', 'side'],
    back_wall: ['back_wall'],
    attached: ['back_wall', 'flanking', 'front', 'center'],
  };
  const preferredZones = proximityMap[item.placement_zone] || [];
  const proximityMatch = hosts.find((host) => preferredZones.includes(host.placement_zone));
  if (proximityMatch) return proximityMatch.sku;

  const largestHost = [...hosts].sort((a, b) => (b.width_ft * b.height_ft) - (a.width_ft * a.height_ft))[0];
  return largestHost?.sku || null;
}

function buildRenderContract({ quoteItems, products, boothInfo }) {
  const boothDims = parseBoothSize(boothInfo.boothSize);
  const boothWidth = Number(boothDims.width_ft || 10);
  const unresolvedSkus = quoteItems.map((item) => item?.sku).filter(Boolean).filter((sku) => !products.find((product) => product.sku === sku));
  const errors = [];
  const warnings = [];

  if (unresolvedSkus.length > 0) {
    errors.push({
      type: 'UNRESOLVED_SKU',
      message: 'Product not found in catalog. Verify SKU is correct.',
      skus: unresolvedSkus,
    });
  }

  const eligibleProducts = products.filter((product) => {
    if (!isFrameOnlySku(product)) return true;
    const keep = hasFabricOrKitCompanion(product, products);
    if (!keep) {
      warnings.push({
        type: 'FRAME_ONLY_EXCLUDED',
        severity: 'info',
        message: 'Frame-only hardware was excluded from the render because no fabric or kit companion was quoted.',
        skus: [product.sku],
      });
    }
    return keep;
  });

  const items = eligibleProducts.map((product) => {
    const quoteItem = quoteItems.find((item) => item?.sku === product.sku);
    const objectClass = inferObjectClass(product);
    const renderCategory = String(product.render_category || '').toLowerCase();
    const widthFt = Number(product.footprint_w_ft || 0);
    const isAccessory = objectClass === 'accessory' || renderCategory.includes('accessory');
    const isWideBackwall = objectClass === 'backwall' && widthFt >= Math.max(boothWidth - 2, 16);
    const normalizedZone = isWideBackwall
      ? 'back_wall'
      : (product.placement_zone || 'center');

    return {
      sku: product.sku,
      quantity: quoteItem?.quantity || 1,
      object_class: objectClass,
      placement_zone: normalizedZone,
      width_ft: widthFt,
      depth_ft: Number(product.footprint_d_ft || 0),
      height_ft: Number(product.height_ft || 0),
      material: product.material || null,
      is_accessory: isAccessory,
      parent_sku: null,
      sku_family: getSkuFamily(product.sku),
      reference_image_url: normalizeReferenceUrl(product.image_cached_url || product.image_url || null),
      render_category: product.render_category || '',
      render_instruction: product.render_instruction || '',
      is_wide_backwall: isWideBackwall,
      _sanitized: !!product._sanitized,
    };
  });

  const hosts = items.filter((item) => !item.is_accessory);
  items.forEach((item) => {
    if (!item.is_accessory) return;
    item.parent_sku = resolveAccessoryParent(item, hosts);
    if (!item.parent_sku) {
      warnings.push({
        type: 'ORPHANED_ACCESSORY',
        severity: 'warning',
        message: 'Accessory has no parent structure in this quote. It will be rendered on the floor as a fallback.',
        skus: [item.sku],
      });
    }
  });

  const backWallGroups = new Map();
  items.filter((item) => item.placement_zone === 'back_wall').forEach((item) => {
    const key = item.is_wide_backwall ? `full_span:${item.sku}` : `${item.sku_family}:${item.placement_zone}`;
    const current = backWallGroups.get(key) || [];
    current.push(item);
    backWallGroups.set(key, current);
  });

  const totalBackwallWidth = Array.from(backWallGroups.values()).reduce((sum, group) => {
    const maxWidth = Math.max(...group.map((item) => Number(item.width_ft || 0)), 0);
    return sum + maxWidth;
  }, 0);

  if (totalBackwallWidth > boothDims.width_ft && backWallGroups.size > 1) {
    errors.push({
      type: 'SPATIAL_CONFLICT',
      message: `Back wall products from different families total ${totalBackwallWidth}ft but booth is only ${boothDims.width_ft}ft wide. Reduce products or select a larger booth.`,
      skus: items.filter((item) => item.placement_zone === 'back_wall').map((item) => item.sku),
    });
  }

  const structures = Array.from(backWallGroups.entries()).map(([key, group], index) => ({
    structure_id: `struct_${index + 1}`,
    family: group[0]?.sku_family || key,
    type: group[0]?.object_class || 'backwall',
    component_skus: group.map((item) => item.sku),
    combined_width_ft: Math.max(...group.map((item) => Number(item.width_ft || 0)), 0),
    note: group.length > 1 ? 'multi-section backwall treated as single structure' : 'single structure',
  }));

  return {
    booth: {
      width_ft: boothDims.width_ft,
      depth_ft: boothDims.depth_ft,
      type: String(boothInfo.boothType || 'Inline').toLowerCase(),
    },
    items,
    structures,
    brand: {
      name: boothInfo.brandName,
      primary_color: boothInfo.primaryColor || null,
      secondary_color: boothInfo.secondaryColor || null,
      logo_url: boothInfo.logoUrl || null,
    },
    validation: {
      total_items: items.length,
      total_footprint_width_ft: totalBackwallWidth,
      fits_booth: errors.filter((error) => error.type === 'SPATIAL_CONFLICT').length === 0,
      all_accessories_have_parents: items.filter((item) => item.is_accessory).every((item) => !!item.parent_sku),
      all_skus_resolved: unresolvedSkus.length === 0,
    },
    errors,
    warnings,
  };
}

function buildDenseProductLine(item, index) {
  const parts = [
    `ITEM ${index + 1}`,
    `SKU: ${item.sku}`,
    `QTY: ${item.quantity} — render exactly ${item.quantity}, no more, no less`,
    `CLASS: ${(item.object_class || item.render_category || 'unknown').replace(/_/g, ' ')}`,
  ];

  if (item.width_ft || item.depth_ft || item.height_ft) {
    parts.push(`DIMS: ${item.width_ft || '?'}ft W x ${item.depth_ft || '?'}ft D x ${item.height_ft || '?'}ft H`);
  }
  if (item.material) {
    parts.push(`MATERIAL: ${item.material}`);
  }
  if (item.placement_zone) {
    parts.push(`ZONE: ${item.placement_zone}`);
  }
  if (item.is_accessory && item.parent_sku) {
    parts.push(`ATTACHED TO: ${item.parent_sku} — physically mount on parent structure frame, do not place on floor independently`);
  }
  if (item.render_instruction && item._sanitized) {
    parts.push(`NOTE: ${item.render_instruction}`);
  }

  return parts.join(' | ');
}

function buildStrictRenderPrompt({ boothInfo, denseProductLines, referenceImageCount, hasFullSpanBackwall, itemCount, structureCount, bannerStandCount, counterCount, towerCount }) {
  const boothTypeLower = (boothInfo.boothType || '').toLowerCase();

  const boothTypeDesc =
    boothTypeLower === 'island' ? 'island — freestanding, open on all four sides, no walls unless quoted'
    : boothTypeLower === 'peninsula' ? 'peninsula — open on three sides, one closed back wall'
    : boothTypeLower === 'corner' ? 'corner — open on two sides, graphics concentrated on back wall and one side wall'
    : 'inline — open ONLY at the front, solid back wall, neighboring booths tight on left and right sides';

  const brandBlock = [
    boothInfo.colorNotes
      ? `Apply these brand colors to graphic surfaces of quoted products only: ${boothInfo.colorNotes}`
      : 'Use clean professional branded graphics on quoted product surfaces only',
    boothInfo.logoUrl
      ? 'A logo reference image is provided. Reproduce it accurately on the primary branded graphic surfaces of quoted products only. Do not place logos on the floor, ceiling, neighboring booths, or any unquoted surface.'
      : `Display the brand name "${boothInfo.brandName}" on the primary quoted graphic surface only.`,
  ].join('\n');

  const referenceBlock = referenceImageCount > 0
    ? `REFERENCE IMAGES:\n${referenceImageCount} reference images are provided. Each corresponds to a quoted product or the brand logo.\nThese images are the DEFINITIVE visual reference for each item's geometry, form factor, materials, and finish.\nIf a reference image conflicts with any text description, the reference image wins.\nMatch the reference image faithfully — do not reinterpret, stylize, or substitute a different object.`
    : '';

  const countBlock = `QUANTITY LOCK:\n- Total quoted line items to show: ${itemCount}\n- Backwall structures quoted: ${structureCount}\n- Banner stands quoted: ${bannerStandCount}\n- Counters quoted: ${counterCount}\n- Towers quoted: ${towerCount}\nDo not invent any additional walls, towers, counters, kiosks, banner stands, iPad pedestals, or signs beyond these counts.`;

  return `ROLE: You are a purchase-order-accurate booth render engine for trade show exhibit sales proposals. Your output is a visual contract — it must show exactly what the customer is purchasing, nothing more, nothing less.

BOOTH SPECIFICATIONS:
- Exact footprint: ${boothInfo.boothSize}
- Booth configuration: ${boothTypeDesc}
- Brand: ${boothInfo.brandName}
- Event: ${boothInfo.showName}
- Setting: indoor convention center hall, neutral gray industrial carpet, standard overhead fluorescent lighting with track spotlights on key products
- Camera angle: 3/4 perspective from slightly above eye level, full booth visible in frame
- No people in the render

CORE CONSTRAINT:
Render ONLY the items listed below in their exact stated quantities.
Any object not in this list must not appear in the image — no furniture, monitors, plants, extra signage, flooring upgrades, hanging structures, lighting rigs, or decorative elements.
If the quote contains only two items, the booth contains only two items.
Empty floor space is correct and expected when the quote is sparse. Do not fill empty space.
Do not duplicate items for visual symmetry unless the stated quantity requires it.
Do not substitute a "nicer looking" version of a quoted item.

BRANDING:
${brandBlock}

${referenceBlock}

${countBlock}

QUOTED ITEMS — RENDER ALL OF THESE, RENDER NOTHING ELSE:
${denseProductLines}

OBJECT FIDELITY:
Every item must remain its stated CLASS throughout the render.
- A banner stand must look like a banner stand, not a kiosk or table
- A backwall must read as a full-height back wall structure, not a small popup
- An accessory with a parent SKU must be physically attached to or mounted on that parent structure
- A retractable banner stand is a tall narrow vertical sign on a spring-loaded base
- A counter is a waist-height horizontal surface
- A case or crate must not appear unless explicitly listed as a visible display element
Preserve each product's real-world object identity regardless of any descriptive text

SPATIAL RULES:
- All items must physically fit inside the exact ${boothInfo.boothSize} footprint
- Back wall items anchor to the rear plane of the booth
- Front zone items face the aisle at the front of the booth space
- Flanking items position along the left and right sides
- Banner stands and narrow signs must never be dropped alone in the aisle unless their ZONE is explicitly front
- Accessories with a parent SKU mount directly to their parent structure's frame — do not place on the floor
- Inline booths have a solid back wall and closed sides — do not show open sides or wraparound architecture
- Maintain realistic human scale — a 6ft tall person should be able to stand next to any product and the proportions look correct
- Multi-section backwalls that share a SKU family prefix connect together as one continuous structure
- If a quoted backwall is approximately booth-width, render it as one continuous full rear-span master backwall, not a smaller centered panel with empty wall space beside it
- If no towers are quoted, do not create side towers, endcaps, columns, or vertical lightboxes flanking the backwall
- If no banner stands are quoted, do not create freestanding aisle signs anywhere in the booth
- If only one backwall is quoted, show one backwall only — do not split it into multiple wall objects
- Do not mount counters, beds, shelves, or horizontal surfaces on banner stands or iPad towers

OUTPUT:
Generate one clean, photorealistic, well-lit convention booth render that shows the exact quoted products assembled together in the booth space with no unquoted objects. Sharp focus, professional trade show lighting, slight depth-of-field blur on the background show floor for realism.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const {
    website_url = '',
    brand_name = '',
    booth_size = '',
    booth_type = '',
    show_name = '',
    quote_items = [],
    reference_urls = [],
  } = body;

  try {
    const base44 = createClientFromRequest(req);

    const brandDetails = website_url ? await fetchBrandDetails(base44, website_url) : null;

    const skus = Array.isArray(quote_items)
      ? quote_items.map((item) => item?.sku).filter(Boolean)
      : [];

    const productBySku = new Map();
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.Product.list('-updated_date', 500, skip);
      if (!batch?.length) break;
      for (const p of batch) {
        if (p?.sku) productBySku.set(p.sku, p);
      }
      if (batch.length < 500) break;
      skip += 500;
    }

    console.log(`[generateBoothRender] Catalog loaded: ${productBySku.size} SKUs`);

    const unresolvedSkus = skus.filter((sku) => !productBySku.get(sku));
    const matchedProducts = skus.map((sku) => productBySku.get(sku)).filter(Boolean).map((product) => sanitizeProduct(product));

    console.log(`[generateBoothRender] Matched ${matchedProducts.length}/${skus.length} SKUs`);

    const boothInfo = {
      brandName: brand_name || brandDetails?.company_name || 'Client brand',
      boothSize: booth_size || '10x10',
      boothType: booth_type || 'Inline',
      showName: show_name || 'Convention event',
      colorNotes: [brandDetails?.primary_color, brandDetails?.secondary_color, brandDetails?.accent_color_1, brandDetails?.accent_color_2].filter(Boolean).join(', '),
      primaryColor: brandDetails?.primary_color || null,
      secondaryColor: brandDetails?.secondary_color || null,
      logoUrl: brandDetails?.logo_cached_url || brandDetails?.logo_url || '',
    };

    const renderContract = buildRenderContract({
      quoteItems: quote_items,
      products: matchedProducts,
      boothInfo,
    });

    if (unresolvedSkus.length > 0 && renderContract.errors.every((error) => error.type !== 'UNRESOLVED_SKU')) {
      renderContract.errors.push({
        type: 'UNRESOLVED_SKU',
        message: 'Product not found in catalog. Verify SKU is correct.',
        skus: unresolvedSkus,
      });
    }

    const blockingErrors = renderContract.errors.filter((error) => ['SPATIAL_CONFLICT', 'UNRESOLVED_SKU'].includes(error.type));
    if (blockingErrors.length > 0) {
      return Response.json({
        status: 'validation_error',
        errors: [...blockingErrors, ...renderContract.warnings],
        render_contract: renderContract,
      }, { status: 400, headers: CORS });
    }

    const denseProductLines = renderContract.items.map((item, index) => buildDenseProductLine(item, index)).join('\n');
  const hasFullSpanBackwall = renderContract.items.some((item) => item.is_wide_backwall);

    const combinedReferenceUrls = dedupeUrls([
      ...(reference_urls || []).map(normalizeReferenceUrl),
      ...renderContract.items.map((item) => item.reference_image_url).filter(Boolean),
      boothInfo.logoUrl || null,
    ]);

    const finalPrompt = buildStrictRenderPrompt({
      boothInfo,
      denseProductLines,
      referenceImageCount: combinedReferenceUrls.length,
      hasFullSpanBackwall,
      itemCount: renderContract.items.length,
      structureCount: renderContract.structures.length,
      bannerStandCount: renderContract.items.filter((item) => item.object_class === 'banner_stand').reduce((sum, item) => sum + Number(item.quantity || 1), 0),
      counterCount: renderContract.items.filter((item) => item.object_class === 'counter').reduce((sum, item) => sum + Number(item.quantity || 1), 0),
      towerCount: renderContract.items.filter((item) => item.object_class === 'tower').reduce((sum, item) => sum + Number(item.quantity || 1), 0),
    });

    console.log('[generateBoothRender] Prompt length:', finalPrompt.length);
    console.log('[generateBoothRender] Prompt:\n', finalPrompt);
    console.log('[generateBoothRender] Reference URLs:', JSON.stringify(combinedReferenceUrls));

    const imageResult = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: finalPrompt,
      existing_image_urls: combinedReferenceUrls.length > 0 ? combinedReferenceUrls : undefined,
    });

    if (!imageResult?.url) throw new Error('Image generation returned no URL');

    return Response.json({
      status: 'completed',
      url: imageResult.url,
      prompt: finalPrompt,
      booth_info: boothInfo,
      render_contract: renderContract,
      warnings: renderContract.warnings,
    }, { headers: CORS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generateBoothRender] Error:', msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});