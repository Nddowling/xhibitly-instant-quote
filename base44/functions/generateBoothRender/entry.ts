/**
 * generateBoothRender.ts
 *
 * Generates a branded booth concept image using Tripo's image generation task flow.
 * Uses the selected quote item images as references and returns a single preview image URL.
 */

const TRIPO_API_KEY = (Deno.env.get('TRIPO_API_KEY') ?? '').trim();

const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function createGeneration(prompt, referenceUrls) {
  const imageUrls = referenceUrls.slice(0, 4);

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

async function pollGeneration(id, timeoutMs = 120000) {
  const start = Date.now();
  const INTERVAL = 4_000;

  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, INTERVAL));

    const res = await fetch(`${TRIPO_BASE}/task/${id}`, {
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) continue;

    const task = await res.json();

    const status = task?.data?.status || task?.status;
    const output = task?.data?.output || task?.output;
    const imageUrl = output?.image_url || output?.url || output?.rendered_image;

    if (status === 'success' || status === 'completed' || status === 'finished') {
      if (!imageUrl) throw new Error('Tripo returned a completed task but no image URL');
      return imageUrl;
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(`Tripo generation failed: ${task?.message || 'unknown reason'}`);
    }
  }

  throw new Error('Tripo generation timed out after 120 seconds');
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

  const { prompt, reference_urls = [] } = body;

  if (!prompt) {
    return Response.json({ error: 'prompt is required' }, { status: 400, headers: CORS });
  }

  try {
    console.log(`[generateBoothRender] Creating Tripo generation | refs: ${reference_urls.length}`);
    const id = await createGeneration(prompt, reference_urls);

    console.log(`[generateBoothRender] Polling task ${id}...`);
    const imageUrl = await pollGeneration(id);

    console.log(`[generateBoothRender] Done: ${imageUrl}`);
    return Response.json({ url: imageUrl }, { headers: CORS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generateBoothRender] Error:', msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});