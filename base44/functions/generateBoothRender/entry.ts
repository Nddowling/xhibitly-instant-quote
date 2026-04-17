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

function summarizeText(text, maxLength = 120) {
  if (!text) return '';
  return String(text).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function buildProductLines(products, quantities, compact = false) {
  return products.map((product) => {
    const qty = quantities[product.sku] || 1;
    const width = Number(product.footprint_w_ft || 0);
    const depth = Number(product.footprint_d_ft || 0);
    const height = Number(product.height_ft || 0);
    const dims = (width || depth || height)
      ? `${width || '?'}ft W x ${depth || '?'}ft D x ${height || '?'}ft H`
      : null;
    const isWideBackwall = (product.placement_zone === 'back_wall' || product.render_category?.includes('backwall')) && width >= 18;
    const spanRule = isWideBackwall ? `MANDATORY SPAN: treat as a full-width backwall spanning about ${width}ft across the rear of the booth, not a small banner stand or 10ft backdrop` : null;

    if (compact) {
      return [
        `${product.name || product.sku} (${product.sku})${qty > 1 ? ` x${qty}` : ''}`,
        product.placement_zone ? `Zone: ${product.placement_zone}` : null,
        dims ? `Size: ${dims}` : null,
        spanRule,
        product.render_instruction ? `Render: ${summarizeText(product.render_instruction, 70)}` : null,
      ].filter(Boolean).join(' | ');
    }

    return [
      `${product.name || product.sku} (${product.sku})${qty > 1 ? ` x${qty}` : ''}`,
      product.render_category ? `Category: ${product.render_category}` : null,
      product.placement_zone ? `Zone: ${product.placement_zone}` : null,
      dims ? `Size: ${dims}` : null,
      spanRule,
      product.render_instruction ? `Render: ${summarizeText(product.render_instruction, 140)}` : null,
    ].filter(Boolean).join('\n');
  }).join(compact ? '\n' : '\n\n');
}

function buildRenderPrompt({ boothInfo, productLines, compact = false, hasInlineFullSpanBackwall = false }) {
  const boothTypeLower = (boothInfo.boothType || '').toLowerCase();
  const boothTypeDesc =
    boothTypeLower === 'island'
      ? 'island, open on all four sides'
      : boothTypeLower === 'peninsula'
      ? 'peninsula, open on three sides'
      : boothTypeLower === 'corner'
      ? 'corner, open on two sides with graphics concentrated on the back and one side wall'
      : 'inline, open only at the front with a hard back wall and neighboring booths tight on both left and right sides';

  return `Create a photorealistic trade show booth render that looks like a literal visual mockup of the exact quoted items.

BOOTH:
- Exact footprint: ${boothInfo.boothSize}
- Booth type: ${boothInfo.boothType}
- Spatial rule: ${boothTypeDesc}
- Brand: ${boothInfo.brandName}
- Event: ${boothInfo.showName}
- Indoor convention hall, 3/4 view, full booth visible, no people

CRITICAL GOAL:
This image must look like the actual products in the quote, arranged into a believable booth layout.
Do NOT invent a custom booth design. Do NOT swap products for nicer-looking retail fixtures. Do NOT add hanging signs, shelving walls, shoe displays, monitors, counters, benches, tables, or architecture unless they are explicitly in the quoted items.
If the quote mostly contains banner stands and a backwall, show exactly that.
If the quote contains repeated banner stands, show the repeated banner stands.

BRANDING:
${boothInfo.colorNotes ? `- Use these brand colors: ${boothInfo.colorNotes}` : '- Use clean professional branded graphics'}
${boothInfo.logoUrl ? '- A logo reference image is provided; reproduce it accurately' : `- Show the brand name "${boothInfo.brandName}" on graphics only where it makes sense on the quoted products`}

QUOTED ITEMS ONLY:
${productLines}

LAYOUT RULES:
- Respect placement zones
- Everything must physically fit inside the exact ${boothInfo.boothSize} footprint
- Treat booth type as mandatory: for inline booths, do not show open sides, wraparound architecture, or island layouts
- Use the back wall as the main anchor for inline booths and keep all products facing the aisle/front opening
- Any quoted backwall wider than 15ft must read visually as a wide full-span structural backwall across the rear wall, never as a centered 8ft or 10ft popup
- If a quoted backwall is approximately 20ft wide in a 10x20 booth, it should dominate most of the rear width of the booth
${hasInlineFullSpanBackwall ? '- In this quote, the main 20ft master backwall is the rear structural wall itself. Do not reinterpret it as an overhead sign, hanging cube, ceiling frame, wraparound portal, or top canopy.' : ''}
${hasInlineFullSpanBackwall ? '- Show the 20ft backwall running horizontally across the entire rear of the 10x20 inline booth at floor level, with vertical structure rising from the floor at the back edge.' : ''}
${hasInlineFullSpanBackwall ? '- Do not create a second large backwall, do not float the structure above the booth, and do not turn the rear wall into a box truss environment.' : ''}
- Keep realistic scale within the booth footprint
- Match the provided reference images for geometry, silhouette, and materials
- Banner stands must remain banner stands, not built-in shelving or permanent retail fixtures
- Lighting accessories should stay small and supportive
${compact ? '- For crowded quotes, keep the layout simple and prioritize the primary structural items first' : ''}

OUTPUT:
A clean, believable sales render showing the exact quoted products assembled together, with realistic trade show styling and no extra unquoted elements.`;
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
      const typeScore   = item?.type === 'icon' ? 0 : 10;
      const formatScore = item?.format === 'png' ? 5 : item?.format === 'webp' ? 4 : 3;
      const sizeScore   = Number(item?.width || 0);
      return typeScore + formatScore + sizeScore;
    };
    return score(b) - score(a);
  });

  return {
    company_name:    brandfetchData.name || domain || null,
    domain:          domain || null,
    primary_color:   colors[0] || null,
    secondary_color: colors[1] || null,
    accent_color_1:  colors[2] || null,
    accent_color_2:  colors[3] || null,
    logo_url:        sortedLogoOptions[0]?.url || null,
    logo_options:    sortedLogoOptions,
    industry:        Array.isArray(brandfetchData.industries) ? brandfetchData.industries[0] || null : null,
  };
}

async function fetchBrandDetails(base44, websiteUrl) {
  if (!websiteUrl) return null;
  const domain = extractDomain(websiteUrl);
  if (!domain) return null;

  try {
    const existing = await base44.asServiceRole.entities.CompanyBrand.filter({ domain });
    if (existing?.length > 0) return existing[0]?.brand_identity || null;
  } catch { /* fall through */ }

  if (!BRANDFETCH_API_KEY) return null;

  const response = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
    headers: { 'Authorization': `Bearer ${BRANDFETCH_API_KEY}` },
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
    } catch { /* non-fatal */ }
  }

  await base44.asServiceRole.entities.CompanyBrand.create({
    domain,
    company_name: parsed.company_name || domain,
    brand_identity: parsed,
  });

  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS }); }

  const {
  website_url = '',
  brand_name  = '',
  booth_size  = '',
  booth_type  = '',
  show_name   = '',
  quote_items = [],
  reference_urls = [],
  } = body;

  try {
    const base44 = createClientFromRequest(req);

    const brandDetails = website_url ? await fetchBrandDetails(base44, website_url) : null;

    const skus = Array.isArray(quote_items)
      ? quote_items.map((item) => item?.sku).filter(Boolean)
      : [];

    const quantities = {};
    (quote_items || []).forEach((item) => {
      if (item?.sku) quantities[item.sku] = item.quantity || 1;
    });

    // Load catalog products with stable pagination
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

    const selectedProducts = skus.map((sku) => productBySku.get(sku)).filter(Boolean);

    console.log(`[generateBoothRender] Matched ${selectedProducts.length}/${skus.length} SKUs`);
    console.log(`[generateBoothRender] Detail check:`, JSON.stringify(
      selectedProducts.map(p => ({
        sku: p.sku,
        has_desc: !!p.physical_description,
        has_inst: !!p.render_instruction,
        zone: p.placement_zone,
      }))
    ));

    if (selectedProducts.length === 0) {
      throw new Error(`No matching Product records found for SKUs: ${skus.join(', ')}`);
    }

    const boothInfo = {
      brandName:  brand_name || brandDetails?.company_name || 'Client brand',
      boothSize:  booth_size || '10x10',
      boothType:  booth_type || 'Inline',
      showName:   show_name || 'Convention event',
      colorNotes: [brandDetails?.primary_color, brandDetails?.secondary_color, brandDetails?.accent_color_1, brandDetails?.accent_color_2].filter(Boolean).join(', '),
      logoUrl:    brandDetails?.logo_cached_url || brandDetails?.logo_url || '',
    };

    const hasInlineFullSpanBackwall = boothInfo.boothSize === '10x20' && (boothInfo.boothType || '').toLowerCase() === 'inline' && selectedProducts.some((product) => {
      const width = Number(product.footprint_w_ft || 0);
      const skuText = `${product.sku || ''} ${product.name || ''} ${product.render_category || ''}`.toLowerCase();
      return width >= 18 || skuText.includes('20ft') || skuText.includes('20 ft') || skuText.includes('master backwall');
    });

    let productLines = buildProductLines(selectedProducts, quantities, false);
    let finalPrompt = buildRenderPrompt({ boothInfo, productLines, compact: false, hasInlineFullSpanBackwall });

    if (finalPrompt.length > 3600) {
      productLines = buildProductLines(selectedProducts, quantities, true);
      finalPrompt = buildRenderPrompt({ boothInfo, productLines, compact: true, hasInlineFullSpanBackwall });
    }

    if (finalPrompt.length > 3900) {
      const cappedProducts = selectedProducts.slice(0, 12);
      productLines = buildProductLines(cappedProducts, quantities, true);
      finalPrompt = buildRenderPrompt({ boothInfo, productLines, compact: true, hasInlineFullSpanBackwall });
    }

    const combinedReferenceUrls = dedupeUrls([
      ...(reference_urls || []).map(normalizeReferenceUrl),
      ...selectedProducts.map((p) => normalizeReferenceUrl(p.image_cached_url || p.image_url || null)),
      boothInfo.logoUrl || null,
    ]).slice(0, 10);

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
    }, { headers: CORS });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generateBoothRender] Error:', msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});