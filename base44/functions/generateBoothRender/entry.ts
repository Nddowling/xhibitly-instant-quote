/**
 * generateBoothRender.ts
 *
 * Generates a branded booth concept image using Tripo's image generation task flow.
 * Uses the selected quote item images as references and returns a single preview image URL.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TRIPO_API_KEY = (Deno.env.get('TRIPO_API_KEY') ?? '').trim();
const BRANDFETCH_API_KEY = (Deno.env.get('BRANDFETCH_API_KEY') ?? '').trim();

const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function createGeneration(prompt, referenceUrls) {
  const imageUrls = referenceUrls.slice(0, 6);

  const body = {
    type: 'generate_image',
    prompt,
    image_urls: imageUrls,
  };

  const res = await fetch(`${TRIPO_BASE}/task`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TRIPO_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tripo create failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const taskId = data?.data?.task_id || data?.task_id;
  if (!taskId) throw new Error('Tripo did not return a task id');
  return taskId;
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

function buildPrompt({ boothSize, boothType, showName, brandName, brandDetails, quoteItems }) {
  const selectedItems = (quoteItems || []).map((item, index) => `${index + 1}. ${item?.sku ? `${item.sku} — ` : ''}${item?.name || 'Product'}`.trim()).join('\n');
  const colorNotes = [brandDetails?.primary_color, brandDetails?.secondary_color, brandDetails?.accent_color_1, brandDetails?.accent_color_2].filter(Boolean).join(', ');
  const resolvedBoothType = String(boothType || 'Inline').toLowerCase();
  const resolvedBrandName = brandName || brandDetails?.company_name || 'Client brand';

  return `Create one realistic trade show booth rendering for ${resolvedBrandName}.
Booth size: ${boothSize || '10x10'}.
Booth type: ${resolvedBoothType}.
Event: ${showName || 'Convention event'}.

STRICT GOAL:
- Show only the products from the current quote.
- Do not add any extra exhibit pieces, structures, counters, tables, seating, lighting, flooring, hanging signs, accessories, or architectural elements that are not in the quoted product references.
- Match the referenced product shapes, sizes, proportions, and placement style as closely as possible.
- Keep the booth physically realistic for the stated footprint.
- Prominently brand the booth for ${resolvedBrandName}; do not use any other brand name or invented company name.

CURRENT QUOTED PRODUCTS:
${selectedItems || 'Quoted products'}

BRAND DIRECTION:
${colorNotes ? `Use these brand colors: ${colorNotes}.` : 'Use a clean branded graphic treatment.'}
${brandDetails?.logo_cached_url || brandDetails?.logo_url ? `Use the provided ${resolvedBrandName} logo as the branding source.` : `Use the provided brand name ${resolvedBrandName} in the booth graphics.`}

OUTPUT:
A polished sales-preview rendering that reflects the exact current quote, not an upsell concept.`;
}

function extractImageUrl(task) {
  const data = task?.data || {};
  const output = data?.output || task?.output || {};
  const result = data?.result || task?.result || {};

  return output?.generated_image
    || output?.image_url
    || output?.url
    || output?.rendered_image
    || output?.result_url
    || output?.image
    || output?.images?.[0]?.url
    || output?.images?.[0]
    || result?.generated_image
    || result?.image_url
    || result?.url
    || result?.rendered_image
    || result?.result_url
    || result?.image
    || result?.images?.[0]?.url
    || result?.images?.[0]
    || data?.image_url
    || data?.rendered_image
    || data?.url
    || task?.image_url
    || task?.url
    || null;
}

async function getGenerationStatus(id) {
  const res = await fetch(`${TRIPO_BASE}/task/${id}`, {
    headers: {
      'Authorization': `Bearer ${TRIPO_API_KEY}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Tripo status failed (${res.status}): ${err}`);
  }

  const task = await res.json();
  const rawStatus = task?.data?.status || task?.status || 'pending';
  const imageUrl = extractImageUrl(task);
  const createTime = Number(task?.data?.create_time || task?.create_time || 0);
  const ageSeconds = createTime ? Math.max(0, Math.floor(Date.now() / 1000) - createTime) : 0;
  const status = imageUrl && ['running', 'processing', 'queued', 'pending'].includes(rawStatus) ? 'completed' : rawStatus;

  console.log('[generateBoothRender] Status response:', JSON.stringify(task));

  if (!imageUrl && ['running', 'processing'].includes(rawStatus) && ageSeconds > 180) {
    throw new Error('Render timed out before an image was returned');
  }

  return {
    status,
    url: imageUrl,
    raw: task,
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (!TRIPO_API_KEY) {
    return Response.json(
      { error: 'TRIPO_API_KEY not configured — add it to Base44 environment variables' },
      { status: 500, headers: CORS }
    );
  }

  if ([...TRIPO_API_KEY].some((char) => char.charCodeAt(0) > 255)) {
    return Response.json(
      { error: 'TRIPO_API_KEY contains unsupported characters. Please re-save the secret as plain text.' },
      { status: 500, headers: CORS }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const { prompt, reference_urls = [], task_id, website_url = '', brand_name = '', booth_size = '', booth_type = '', show_name = '', quote_items = [] } = body;

  try {
    if (task_id) {
      const result = await getGenerationStatus(task_id);
      return Response.json(result, { headers: CORS });
    }

    const base44 = createClientFromRequest(req);
    const brandDetails = website_url ? await fetchBrandDetails(base44, website_url) : null;
    const quoteItemUrls = Array.isArray(quote_items)
      ? quote_items.map((item) => item?.image_url).filter(Boolean)
      : [];
    const logoUrl = [brandDetails?.logo_cached_url, brandDetails?.logo_url]
      .filter((url) => url && !String(url).toLowerCase().includes('.svg'))[0] || '';
    const combinedReferenceUrls = [logoUrl, ...quoteItemUrls, ...reference_urls]
      .filter(Boolean)
      .filter((url, index, arr) => arr.indexOf(url) === index)
      .slice(0, 6);
    const finalPrompt = buildPrompt({
      boothSize: booth_size,
      boothType: booth_type,
      showName: show_name,
      brandName: brand_name,
      brandDetails,
      quoteItems: quote_items,
    });

    console.log(`[generateBoothRender] Creating Tripo generation | refs: ${combinedReferenceUrls.length}`);
    const id = await createGeneration(finalPrompt, combinedReferenceUrls);
    return Response.json({ task_id: id, status: 'pending' }, { headers: CORS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generateBoothRender] Error:', msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});