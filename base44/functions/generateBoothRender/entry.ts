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
  const status = task?.data?.status || task?.status || 'pending';
  const output = task?.data?.output || task?.output || {};
  const imageUrl = output?.image_url || output?.url || output?.rendered_image || output?.result_url || output?.image || output?.images?.[0]?.url || output?.images?.[0] || task?.data?.image_url || task?.image_url;

  console.log('[generateBoothRender] Status response:', JSON.stringify(task));

  return {
    status,
    url: imageUrl || null,
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

  const { prompt, reference_urls = [], task_id } = body;

  try {
    if (task_id) {
      const result = await getGenerationStatus(task_id);
      return Response.json(result, { headers: CORS });
    }

    if (!prompt) {
      return Response.json({ error: 'prompt is required' }, { status: 400, headers: CORS });
    }

    console.log(`[generateBoothRender] Creating Tripo generation | refs: ${reference_urls.length}`);
    const id = await createGeneration(prompt, reference_urls);
    return Response.json({ task_id: id, status: 'pending' }, { headers: CORS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[generateBoothRender] Error:', msg);
    return Response.json({ error: msg }, { status: 500, headers: CORS });
  }
});