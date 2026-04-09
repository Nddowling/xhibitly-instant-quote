/**
 * generateBoothRender.ts
 *
 * Generates a photorealistic booth concept render using Luma AI Photon-1.
 * Passes up to 4 product reference photos via image_ref for hardware/graphic accuracy.
 * Polls until the generation completes and returns the image URL.
 *
 * Body:
 *   prompt: string           — detailed booth layout prompt from Claude
 *   reference_urls: string[] — product photo URLs (up to 4 used as image_ref)
 *
 * Returns:
 *   { url: string }          — Luma CDN URL of the completed render
 */

// @ts-ignore — Deno runtime, types not available in VS Code
const LUMAAI_API_KEY = Deno.env.get('LumaAI') ?? Deno.env.get('LUMAAI_API_KEY') ?? '';

const LUMA_BASE = 'https://api.lumalabs.ai/dream-machine/v1';
const MODEL = 'photon-1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─── Create a generation via Luma REST API ────────────────────────────────────
async function createGeneration(prompt: string, referenceUrls: string[]): Promise<string> {
  // image_ref: up to 4 product photos, weighted by position (first = strongest)
  const imageRef = referenceUrls.slice(0, 4).map((url, i) => ({
    url,
    weight: i === 0 ? 0.85 : i === 1 ? 0.75 : 0.65,
  }));

  const body: Record<string, unknown> = {
    prompt,
    model: MODEL,
    aspect_ratio: '16:9', // landscape — best for booth visualization
  };

  if (imageRef.length > 0) {
    body.image_ref = imageRef;
  }

  const res = await fetch(`${LUMA_BASE}/generations/image`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LUMAAI_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Luma create failed (${res.status}): ${err}`);
  }

  const data = await res.json() as { id: string };
  return data.id;
}

// ─── Poll until completed or failed ──────────────────────────────────────────
async function pollGeneration(id: string, timeoutMs = 90_000): Promise<string> {
  const start = Date.now();
  const INTERVAL = 4_000; // 4 second poll interval

  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, INTERVAL));

    const res = await fetch(`${LUMA_BASE}/generations/${id}`, {
      headers: {
        'Authorization': `Bearer ${LUMAAI_API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) continue;

    const gen = await res.json() as {
      state: string;
      assets?: { image?: string };
      failure_reason?: string;
    };

    if (gen.state === 'completed') {
      const url = gen.assets?.image;
      if (!url) throw new Error('Luma returned completed state but no image URL');
      return url;
    }

    if (gen.state === 'failed') {
      throw new Error(`Luma generation failed: ${gen.failure_reason || 'unknown reason'}`);
    }

    // state is 'dreaming' or 'queued' — keep polling
  }

  throw new Error('Luma generation timed out after 90 seconds');
}

// ─── Main handler ─────────────────────────────────────────────────────────────
// @ts-ignore — Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (!LUMAAI_API_KEY) {
    return Response.json(
      { error: 'LUMAAI_API_KEY not configured — add it to Base44 environment variables' },
      { status: 500, headers: CORS }
    );
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

  try {
    console.log(`[generateBoothRender] Creating Luma generation | refs: ${reference_urls.length}`);
    const id = await createGeneration(prompt, reference_urls);

    console.log(`[generateBoothRender] Polling generation ${id}...`);
    const imageUrl = await pollGeneration(id);

    console.log(`[generateBoothRender] Done: ${imageUrl}`);
    return Response.json({ url: imageUrl }, { headers: CORS });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generateBoothRender] Error:', msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});