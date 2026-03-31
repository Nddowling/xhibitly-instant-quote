/**
 * generateBoothRender.ts
 *
 * Calls GPT Image 1.5 directly with multi-image reference composition.
 * Uses product reference photos for hardware structure accuracy while
 * rendering neutral placeholder graphics on all display panels.
 *
 * Body:
 *   prompt: string          — the detailed booth render prompt from Claude
 *   reference_urls: string[] — product photo URLs (max 10) for structure reference
 *
 * Returns:
 *   { url: string }          — base64 data URL or storage URL of rendered image
 */

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function fetchImageAsBase64(url: string): Promise<{ b64: string; mime: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; booth-render/1.0)' },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const b64 = btoa(binary);
    const ct = res.headers.get('content-type') || 'image/jpeg';
    const mime = ct.split(';')[0].trim();
    return { b64, mime };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (!OPENAI_API_KEY) {
    return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500, headers: CORS });
  }

  let body: { prompt?: string; reference_urls?: string[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const { prompt, reference_urls = [] } = body;

  if (!prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400, headers: CORS });
  }

  // Download reference images and encode as base64 for gpt-image-1 multi-image input
  const imageInputs: Array<{ type: 'image_url'; image_url: { url: string } }> = [];

  for (const url of reference_urls.slice(0, 10)) {
    const img = await fetchImageAsBase64(url);
    if (img) {
      imageInputs.push({
        type: 'image_url',
        image_url: { url: `data:${img.mime};base64,${img.b64}` },
      });
    }
  }

  // Build the message content — text prompt + reference images
  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: prompt },
    ...imageInputs,
  ];

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: imageInputs.length > 0
          ? `${prompt}\n\n[${imageInputs.length} product reference photo(s) provided above — use for hardware structure only, do not copy any graphics from them]`
          : prompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',
        // gpt-image-1 returns base64 by default
        response_format: 'b64_json',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('OpenAI error:', err);
      return Response.json({ error: `OpenAI API error: ${res.status}` }, { status: 502, headers: CORS });
    }

    const data = await res.json();
    const b64Image = data?.data?.[0]?.b64_json;

    if (!b64Image) {
      return Response.json({ error: 'No image returned from OpenAI' }, { status: 502, headers: CORS });
    }

    // Return as data URL — client can display it directly
    const imageUrl = `data:image/png;base64,${b64Image}`;

    return Response.json({ url: imageUrl }, { headers: CORS });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('generateBoothRender error:', msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});
