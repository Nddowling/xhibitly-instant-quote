import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BRANDFETCH_API_KEY = (Deno.env.get('BRANDFETCH_API_KEY') ?? '').trim();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function dedupeUrls(urls) {
  return Array.from(new Set((urls || []).filter(Boolean)));
}

function buildProductLines(products, quantities) {
  return products.map((product) => {
    const qty = quantities[product.sku] || 1;
    const dims = (product.footprint_w_ft || product.footprint_d_ft || product.height_ft)
      ? `${product.footprint_w_ft || '?'}ft W x ${product.footprint_d_ft || '?'}ft D x ${product.height_ft || '?'}ft H`
      : null;
    return [
      `${product.name || product.sku} (${product.sku})${qty > 1 ? ` x${qty}` : ''}`,
      product.render_category ? `Category: ${product.render_category}` : null,
      product.placement_zone ? `Zone: ${product.placement_zone}` : null,
      product.render_instruction ? `Render: ${product.render_instruction}` : null,
      dims ? `Size: ${dims}` : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function buildRenderPrompt({ boothInfo, productLines }) {
  const boothTypeDesc =
    (boothInfo.boothType || '').toLowerCase() === 'island'
      ? 'island — freestanding, open on all four sides'
      : (boothInfo.boothType || '').toLowerCase() === 'peninsula'
      ? 'peninsula — open on three sides, closed on one back wall'
      : 'inline — open at the front only, backed against a back wall';

  return `Create a photorealistic trade show booth concept render for a professional sales proposal.

BOOTH SPECS:
- Size: ${boothInfo.boothSize} feet
- Type: ${boothTypeDesc}
- Brand: ${boothInfo.brandName}
- Event: ${boothInfo.showName}
- Environment: indoor convention center hall
- Camera: 3/4 perspective from slightly above eye level, full booth visible
- No people in the render

BRANDING:
${boothInfo.colorNotes ? `- Apply these exact brand colors to all graphic panels, fabric, and signage: ${boothInfo.colorNotes}` : '- Use a clean professional branded graphic treatment'}
${boothInfo.logoUrl ? '- A logo reference image is provided — reproduce it accurately on all branded surfaces, do not distort or hallucinate it' : `- Display the brand name "${boothInfo.brandName}" prominently on booth graphics`}

QUOTED PRODUCTS — render ONLY these products, exactly as described. Do NOT add any extra furniture, counters, monitors, kiosks, lighting rigs, hanging signs, or accessories not listed here:

${productLines}

SPATIAL RULES:
- Respect each product's placement zone (back_wall = rear of booth, flanking = sides, front = near aisle, accessory = attached to main structure)
- Maintain realistic scale for each product relative to the booth footprint and a 6ft human figure
- Products labeled back_wall should span the rear; flanking products go left/right sides; front products face the aisle
- Each product image provided is a reference photo of that exact item — match its geometry, form factor, and materials

OUTPUT: Polished exhibit concept render, sharp, well-lit with overhead fluorescent + track spotlights on key products, neutral gray convention floor, slightly blurred show floor background for depth.`;
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

    const productLines = buildProductLines(selectedProducts, quantities);
    const finalPrompt  = buildRenderPrompt({ boothInfo, productLines });

    const combinedReferenceUrls = dedupeUrls([
      ...selectedProducts.map((p) => p.image_cached_url || p.image_url || null),
      boothInfo.logoUrl || null,
    ]).slice(0, 6);

    console.log('[generateBoothRender] Prompt:\n', finalPrompt);
    console.log('[generateBoothRender] Reference URLs:', JSON.stringify(combinedReferenceUrls));

    const imageResult = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: finalPrompt,
      existing_image_urls: combinedReferenceUrls.length > 0 ? combinedReferenceUrls : undefined,
    });

    if (!imageResult?.url) throw new Error('Image generation returned no URL');

    return Response.json({ status: 'completed', url: imageResult.url }, { headers: CORS });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generateBoothRender] Error:', msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});