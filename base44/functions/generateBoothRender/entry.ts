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
    return [
      `${product.name || product.sku} (${product.sku}) x${qty}`,
      product.render_category ? `Category: ${product.render_category}` : null,
      product.placement_zone ? `Placement: ${product.placement_zone}` : null,
      product.physical_description ? `Physical description: ${product.physical_description}` : null,
      product.render_instruction ? `Rendering notes: ${product.render_instruction}` : null,
      product.material ? `Material: ${product.material}` : null,
      (product.footprint_w_ft || product.footprint_d_ft || product.height_ft)
        ? `Approx size: ${product.footprint_w_ft || '?'}ft W x ${product.footprint_d_ft || '?'}ft D x ${product.height_ft || '?'}ft H`
        : null,
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function buildRenderPrompt({ boothInfo, products, productLines }) {
  return `Create a photorealistic concept render of a trade show booth.

Booth requirements:
- Booth size: ${boothInfo.boothSize}
- Booth type: ${boothInfo.boothType}
- Brand name: ${boothInfo.brandName}
- Event: ${boothInfo.showName}
- Environment: professional indoor convention center
- Camera view: wide 3/4 perspective showing the full booth clearly
- People: none

Use only the quoted products below. Do not add any extra products, furniture, counters, monitors, signs, hanging elements, or accessories unless they are listed below.

Quoted products from the Product records:
${productLines}

Branding:
- ${boothInfo.colorNotes ? `Use these colors in the booth graphics: ${boothInfo.colorNotes}` : 'Use a clean professional branded graphic treatment'}
- ${boothInfo.logoUrl ? 'Use the provided logo reference on the booth graphics' : `Show the brand name ${boothInfo.brandName} on the booth graphics`}

Important:
- Build only the booth structure and quoted products
- Keep product scale realistic for the booth footprint
- Match each product's physical look and materials based on its Product record
- Respect the booth type and layout
- Make the final image look like a polished exhibit concept render for a sales proposal`;
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
              .filter((format) => format?.src && (format.format === 'png' || format.format === 'jpeg' || format.format === 'jpg' || format.format === 'webp'))
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

  const existing = await base44.asServiceRole.entities.CompanyBrand.filter({ domain });
  if (existing?.length > 0) {
    return existing[0]?.brand_identity || null;
  }

  if (!BRANDFETCH_API_KEY) {
    return null;
  }

  const response = await fetch(`https://api.brandfetch.io/v2/brands/${domain}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BRANDFETCH_API_KEY}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const parsed = parseBrandfetchResponse(data, domain);
  if (!parsed) return null;

  if (parsed.logo_url && !String(parsed.logo_url).toLowerCase().includes('.svg')) {
    try {
      const cacheRes = await base44.functions.invoke('cacheExternalImage', { url: parsed.logo_url });
      if (cacheRes?.data?.success && cacheRes?.data?.cached_url && !String(cacheRes.data.cached_url).toLowerCase().includes('.svg')) {
        parsed.logo_cached_url = cacheRes.data.cached_url;
      }
    } catch {
    }
  }

  await base44.asServiceRole.entities.CompanyBrand.create({
    domain,
    company_name: parsed.company_name || domain,
    brand_identity: parsed,
  });

  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const { website_url = '', brand_name = '', booth_size = '', booth_type = '', show_name = '', quote_items = [] } = body;

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

    const boothInfo = {
      brandName: brand_name || brandDetails?.company_name || 'Client brand',
      boothSize: booth_size || '10x10',
      boothType: booth_type || 'Inline',
      showName: show_name || 'Convention event',
      colorNotes: [brandDetails?.primary_color, brandDetails?.secondary_color, brandDetails?.accent_color_1, brandDetails?.accent_color_2].filter(Boolean).join(', '),
      logoUrl: brandDetails?.logo_cached_url || brandDetails?.logo_url || ''
    };

    const allProducts = await base44.asServiceRole.entities.Product.filter({ is_active: true }, 'sku', 5000);
    const productBySku = new Map(
      (allProducts || []).map((product) => {
        const normalized = { ...product, ...(product?.data || {}) };
        return [normalized.sku, normalized];
      }).filter(([sku]) => Boolean(sku))
    );

    const selectedProducts = skus
      .map((sku) => productBySku.get(sku))
      .filter(Boolean);

    if (selectedProducts.length === 0) {
      throw new Error('No matching Product records were found for the selected SKUs');
    }

    const productLines = buildProductLines(selectedProducts, quantities);
    const finalPrompt = buildRenderPrompt({ boothInfo, products: selectedProducts, productLines });
    const combinedReferenceUrls = dedupeUrls([
      ...selectedProducts.map((product) => product.image_cached_url || product.image_url || null),
      boothInfo.logoUrl || null,
    ]).slice(0, 6);

    console.log('[generateBoothRender] Using Base44 Product records');
    console.log('[generateBoothRender] Selected SKUs:', JSON.stringify(skus));
    console.log('[generateBoothRender] Prompt:', finalPrompt);
    console.log('[generateBoothRender] Reference URLs:', JSON.stringify(combinedReferenceUrls));

    const imageResult = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: finalPrompt,
      existing_image_urls: combinedReferenceUrls.length > 0 ? combinedReferenceUrls : undefined,
    });

    if (!imageResult?.url) {
      throw new Error('GPT Image did not return an image URL');
    }

    return Response.json({ status: 'completed', url: imageResult.url }, { headers: CORS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generateBoothRender] Error:', msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});