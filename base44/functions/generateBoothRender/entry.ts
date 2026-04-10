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

  console.log('[generateBoothRender] Create body:', JSON.stringify(body));

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
              .filter((format) => format?.src && (format.format === 'png' || format.format === 'svg' || format.format === 'jpeg'))
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

  return {
    company_name: brandfetchData.name || domain || null,
    domain: domain || null,
    primary_color: colors[0] || null,
    secondary_color: colors[1] || null,
    accent_color_1: colors[2] || null,
    accent_color_2: colors[3] || null,
    logo_url: logoOptions[0]?.url || null,
    logo_options: logoOptions,
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

  if (parsed.logo_url) {
    try {
      const cacheRes = await base44.functions.invoke('cacheExternalImage', { url: parsed.logo_url });
      if (cacheRes?.data?.success && cacheRes?.data?.cached_url) {
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

function buildPrompt({ prompt, boothSize, boothType, showName, brandName, brandDetails, quoteItems }) {
  if (prompt) return prompt;

  const itemSummary = (quoteItems || []).map((item) => `${item?.sku ? `${item.sku} ` : ''}${item?.name || 'Product'}`.trim()).join(', ');
  const colorNotes = [brandDetails?.primary_color, brandDetails?.secondary_color, brandDetails?.accent_color_1, brandDetails?.accent_color_2].filter(Boolean).join(', ');

  return `Create a realistic, production-ready branded exhibitors booth rendering for a convention center. Brand: ${brandName || brandDetails?.company_name || 'Client brand'}. Booth size: ${boothSize || '10x10'}. Booth type: ${boothType || 'Inline'}. Event: ${showName || 'Convention event'}. This must be spatially correct for the stated booth footprint and booth type. Use the provided quoted product images as the actual products in the booth. Do not invent extra structures, counters, furniture, lighting, flooring, hanging signs, or accessories that are not represented by the quoted items. Selected quote items: ${itemSummary || 'Quoted products'}.${colorNotes ? ` Use these brand colors: ${colorNotes}.` : ''}${brandDetails?.logo_cached_url || brandDetails?.logo_url ? ' Apply the provided brand logo and graphic style naturally across the booth.' : ''} If any item is unclear, stay conservative and preserve the referenced shapes and proportions.`;
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
    const logoUrl = brandDetails?.logo_cached_url || brandDetails?.logo_url || '';
    const combinedReferenceUrls = [logoUrl, ...reference_urls, ...quoteItemUrls].filter(Boolean).filter((url, index, arr) => arr.indexOf(url) === index).slice(0, 6);
    const finalPrompt = buildPrompt({
      prompt,
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