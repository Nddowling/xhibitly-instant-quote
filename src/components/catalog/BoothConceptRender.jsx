import React, { useState } from 'react';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, RefreshCw, ZoomIn, X, Sparkles, Images, ScanSearch, CheckCircle2 } from 'lucide-react';

// ─── Config ────────────────────────────────────────────────────────────────────
const REGISTRY_ENDPOINT = 'https://xpgvpzbzmkubahyxwipk.supabase.co/functions/v1/get-render-data';

function resolveProductImage(item) {
  if (item.sku && SKU_TO_IMAGE[item.sku]) return SKU_TO_IMAGE[item.sku];
  if (item.image_url && item.image_url.includes('/products/')) return item.image_url;
  return null;
}

function parseBoothSize(boothSize) {
  const parts = (boothSize || '10x10').toLowerCase().split('x');
  return { w: parseInt(parts[0]) || 10, d: parseInt(parts[1]) || 10 };
}

function getGridCols(boothW, itemCount) {
  if (itemCount === 1) return 1;
  if (itemCount === 2) return 2;
  if (boothW >= 20) return Math.min(itemCount, 5);
  return Math.min(itemCount, 3);
}

// ─── OLD FLOW (fallback only) ─────────────────────────────────────────────────

function categorizeProducts(lineItems) {
  const backWall = [];
  const bannerStands = [];
  const counters = [];
  const accessories = [];

  for (const item of lineItems) {
    const name = (item.product_name || item.sku || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    if (/case|cases|carry bag|carrybag|bag|shipping case|transport case|roller bag/.test(name)) continue;

    if (/pegasus|formulate|embrace|panoramic|back wall|backwall|waveline|lumiere|vector frame|infinite|hop|cove/.test(name) ||
        /pgsus|fml|emb|pan|wvl|lmr|hop|cove/.test(sku)) {
      backWall.push(item);
    } else if (/orient|banner stand|retract|roll.?up|blade|spring/.test(name) ||
               /^ont|^bld|^rst|^spr/.test(sku)) {
      bannerStands.push(item);
    } else if (/counter|kiosk|pedestal|podium|reception/.test(name) ||
               /-ct\b|ksk|ped/.test(sku)) {
      counters.push(item);
    } else {
      accessories.push(item);
    }
  }
  return { backWall, bannerStands, counters, accessories };
}

function buildPlacementInstructions(boothW, boothD, boothType, zones, imageIndexMap) {
  const { backWall, bannerStands, counters, accessories } = zones;
  const type = (boothType || 'Inline').toLowerCase();
  const instructions = [];

  if (type === 'island') {
    instructions.push(`BOOTH SHELL: ${boothW}x${boothD} foot island booth — open on all 4 sides.`);
  } else if (type === 'corner') {
    instructions.push(`BOOTH SHELL: ${boothW}x${boothD} foot corner booth — L-shape walls.`);
  } else {
    instructions.push(`BOOTH SHELL: ${boothW}x${boothD} foot inline booth. Back wall spans full ${boothW} feet.`);
  }

  if (backWall.length > 0) {
    for (const item of backWall) {
      const qty = item.quantity || 1;
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      instructions.push(`BACK WALL — ${item.product_name || item.sku}${ref}: show exactly ${qty} unit(s). Do not add extras.`);
    }
  }

  if (bannerStands.length > 0) {
    const expanded = [];
    for (const item of bannerStands) {
      for (let q = 0; q < (item.quantity || 1); q++) expanded.push(item);
    }
    const total = expanded.length;
    const positions = total === 1 ? ['center'] : total === 2 ? ['far left', 'far right'] : ['far left', 'center', 'far right'].slice(0, total);
    expanded.forEach((item, i) => {
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      instructions.push(`FLOOR STANDING (${i + 1}/${total}) — ${item.product_name || item.sku}${ref}: positioned at ${positions[i]}.`);
    });
  }

  if (counters.length > 0) {
    counters.forEach((item, i) => {
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      instructions.push(`FRONT CENTER (${i + 1}) — ${item.product_name || item.sku}${ref}: positioned at front edge, centered.`);
    });
  }

  if (accessories.length > 0) {
    accessories.forEach(item => {
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      instructions.push(`ADDITIONAL — ${item.product_name || item.sku}${ref}: show exactly ${item.quantity || 1} unit(s).`);
    });
  }

  return instructions.join('\n\n');
}

async function buildFallbackPrompt(order, lineItems) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';
  const renderableLineItems = lineItems.filter(item => {
    const name = (item.product_name || item.sku || '').toLowerCase();
    return !/case|cases|carry bag|carrybag|bag|shipping case|transport case|roller bag/.test(name);
  });
  const zones = categorizeProducts(renderableLineItems);

  const seen = new Set();
  const referenceImages = [];
  const imageIndexMap = {};
  for (const item of renderableLineItems) {
    if (seen.has(item.sku)) continue;
    const url = resolveProductImage(item);
    if (url) {
      seen.add(item.sku);
      referenceImages.push({ item, url });
      imageIndexMap[item.sku] = referenceImages.length;
    }
  }

  const refLegend = referenceImages.length > 0
    ? `REFERENCE PHOTOS PROVIDED (${referenceImages.length} images attached):\n` +
      referenceImages.map((r, i) => `  Photo ${i + 1}: ${r.item.product_name || r.item.sku} (SKU: ${r.item.sku})`).join('\n')
    : '';

  const placementInstructions = buildPlacementInstructions(boothW, boothD, boothType, zones, imageIndexMap);

  const prompt = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a professional trade show exhibit render artist creating a precise image generation prompt.

${refLegend}

EXACT PRODUCT PLACEMENT:
${placementInstructions}

QUANTITY CONTROL: Render only the exact products and quantities listed. Do not add any extra elements.

SCENE: Professional trade show convention center, gray carpet, high ceiling, pipe-and-drape, no people.

Write ONLY the final image generation prompt — no explanation, no preamble.`,
    file_urls: referenceImages.length > 0 ? referenceImages.map(r => r.url) : undefined,
    model: 'claude_sonnet_4_6',
  });

  return { prompt, referenceImages };
}

// ─── NEW FLOW: Registry → Sonnet → Image Gen ──────────────────────────────────

async function generatePhotoRender(order, lineItems) {
  const boothType = order?.booth_type || 'Inline';
  const boothSize = order?.booth_size || '10x10';
  const brandName = order?.customer_company || order?.customer_name || 'Client Brand';
  const showName = order?.show_name || 'Trade Show';
  const colorNotes = order?.brand_colors || '';
  const brandDetails = order?.brand_details || null;

  // ── Step 1: Call Supabase product registry ──────────────────────────────────
  const skus = lineItems.map(item => item.sku).filter(Boolean);
  const quantities = {};
  lineItems.forEach(item => {
    if (item.sku) quantities[item.sku] = item.quantity || 1;
  });

  let registryRes = null;
  try {
    const regResponse = await fetch(REGISTRY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skus,
        quantities,
        boothInfo: {
          brandName,
          boothSize,
          boothType,
          showName,
          colorNotes,
          logoUrl: brandDetails?.logo_cached_url || brandDetails?.logo_url || '',
        },
      }),
    });
    registryRes = await regResponse.json();
    console.log('[BoothRender] Registry returned', registryRes?.total, 'products,', registryRes?.missing_skus?.length, 'missing');
  } catch (e) {
    console.warn('[BoothRender] Registry fetch failed, using fallback:', e);
  }

  let prompt;
  let allReferenceUrls = [];

  // ── Step 2: Build prompt via Claude Sonnet ──────────────────────────────────
  if (registryRes?.prompt) {
    // ENRICHED PATH: Registry returned a system prompt with physical descriptions.
    // Send it through Claude Sonnet so Sonnet writes the actual image gen prompt.
    const registryImageUrls = (registryRes.image_urls || []).map(i => i.url).filter(Boolean);

    // Also grab any line item images as extra references
    const lineItemImageUrls = lineItems
      .map(item => resolveProductImage(item))
      .filter(Boolean);

    // Merge and deduplicate: registry images first, then line item images
    const seenUrls = new Set();
    allReferenceUrls = [];
    for (const url of [...registryImageUrls, ...lineItemImageUrls]) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allReferenceUrls.push(url);
      }
    }

    console.log('[BoothRender] Sending enriched prompt to Sonnet with', allReferenceUrls.length, 'reference images');

    // Send the enriched prompt to Claude Sonnet — Sonnet writes the actual image gen prompt
    prompt = await base44.integrations.Core.InvokeLLM({
      prompt: registryRes.prompt,
      file_urls: allReferenceUrls.length > 0 ? allReferenceUrls : undefined,
      model: 'claude_sonnet_4_6',
    });

    console.log('[BoothRender] Sonnet wrote image gen prompt:', typeof prompt === 'string' ? prompt.substring(0, 200) + '...' : prompt);

  } else {
    // FALLBACK PATH: Registry unavailable, use old prompt builder
    console.warn('[BoothRender] No registry prompt available, falling back to old flow');
    const fallback = await buildFallbackPrompt(order, lineItems);
    prompt = fallback.prompt;
    allReferenceUrls = fallback.referenceImages.map(r => r.url);
  }

  // ── Step 3: Generate the image ──────────────────────────────────────────────
  let result;
  try {
    result = await base44.functions.invoke('generateBoothRender', {
      body: {
        prompt,
        reference_urls: allReferenceUrls,
      },
    });
    const renderUrl = result?.data?.url || result?.url;
    if (!renderUrl) throw new Error('No URL returned from generateBoothRender');
    result = { url: renderUrl };
  } catch (fnErr) {
    console.warn('[BoothRender] generateBoothRender failed, falling back to GenerateImage:', fnErr?.message);
    const fallback = await base44.integrations.Core.GenerateImage({
      prompt,
      existing_image_urls: allReferenceUrls.length > 0 ? allReferenceUrls : undefined,
    });
    result = fallback;
  }

  return {
    url: result.url,
    prompt,
    requestPayload: {
      skus,
      quantities,
      boothInfo: { brandName, boothSize, boothType, showName, colorNotes },
    },
    referenceUrls: allReferenceUrls,
    registryResponse: registryRes,
  };
}

// ─── Product thumbnail card ───────────────────────────────────────────────────
function ProductCard({ item }) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = resolveProductImage(item);

  return (
    <div className="flex flex-col items-center bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      <div className="w-full aspect-square bg-slate-50 flex items-center justify-center overflow-hidden border-b border-slate-100">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={item.product_name || item.sku}
            className="w-full h-full object-contain p-1.5"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 p-2 text-center">
            <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center">
              <span className="text-[8px] font-black text-slate-400">IMG</span>
            </div>
            <span className="text-[8px] text-slate-400 font-mono">{item.sku}</span>
          </div>
        )}
      </div>
      <div className="px-1.5 py-1.5 w-full text-center">
        <p className="text-[9px] font-bold text-slate-800 leading-tight line-clamp-2">{item.product_name || item.sku}</p>
        <p className="text-[8px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
        {item.quantity > 1 && (
          <span className="inline-block mt-1 bg-[#e2231a] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            ×{item.quantity}
          </span>
        )}
      </div>
    </div>
  );
}

function RenderProgressMonitor({ currentStepIndex, steps }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-[#ff5a52]">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black tracking-tight">Rendering your booth concept</p>
          <p className="mt-1 text-xs text-white/65">Building the scene from your selected products and booth layout.</p>
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#e2231a] via-orange-400 to-amber-300 transition-all duration-700"
          style={{ width: `${Math.max(8, ((currentStepIndex + 1) / steps.length) * 100)}%` }}
        />
      </div>

      <div className="mt-4 space-y-2">
        {steps.map((step, index) => {
          const isDone = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const Icon = step.icon;

          return (
            <div
              key={step.label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
                isCurrent ? 'bg-white/10 border border-white/10' : 'bg-white/5'
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isDone ? 'bg-emerald-500/20 text-emerald-300' : isCurrent ? 'bg-[#e2231a]/20 text-[#ff8c86]' : 'bg-white/10 text-white/45'}`}>
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className={`w-4 h-4 ${isCurrent ? 'animate-pulse' : ''}`} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold ${isCurrent ? 'text-white' : isDone ? 'text-white/80' : 'text-white/50'}`}>{step.label}</p>
                <p className="text-[11px] text-white/45">{step.fun}</p>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                {isDone ? 'Done' : isCurrent ? 'Live' : 'Queued'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BoothConceptRender({ order, lineItems = [], onRenderingSaved }) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';
  const gridCols = getGridCols(boothW, lineItems.length);

  const renderSteps = [
    { label: 'Loading product registry', fun: 'Fetching physical descriptions and placement rules from Supabase.', icon: Images },
    { label: 'Writing render prompt', fun: 'Claude Sonnet is composing a precise scene description from your products.', icon: ScanSearch },
    { label: 'Generating booth image', fun: 'Creating the photorealistic booth concept from the scene description.', icon: Sparkles },
  ];

  const [renderUrl, setRenderUrl] = useState(order?.booth_rendering_url || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [genStep, setGenStep] = useState('');
  const [genStepIndex, setGenStepIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [renderDebug, setRenderDebug] = useState(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenError(null);
    setGenStep('Loading product registry…');
    setGenStepIndex(0);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setGenStep('Writing render prompt via Claude Sonnet…');
      setGenStepIndex(1);
      await new Promise(resolve => setTimeout(resolve, 500));

      const renderResult = await generatePhotoRender(order, lineItems);

      setGenStep('Generating booth image…');
      setGenStepIndex(2);

      const { url } = renderResult;
      setRenderDebug(renderResult);
      setRenderUrl(url);

      if (order?.id) {
        await base44.entities.Order.update(order.id, { booth_rendering_url: url });
        if (onRenderingSaved) onRenderingSaved(url);
      }

      setGenStep('');
    } catch (err) {
      console.error('Render failed:', err);
      setGenError('Rendering failed: ' + (err?.message || 'Unknown error. Please try again.'));
      setGenStep('');
    }
    setIsGenerating(false);
  };

  return (
    <div className="space-y-4">

      {/* ── Render result ── */}
      {renderUrl && (
        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
          <div className="px-4 py-2.5 bg-[#1a1a1a] flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-[#e2231a]" />
              Photorealistic Booth Concept
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setLightboxOpen(true)} className="text-white/50 hover:text-white transition-colors" title="View full size">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={handleGenerate} disabled={isGenerating} className="text-white/50 hover:text-white transition-colors" title="Regenerate">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <img
            src={renderUrl}
            alt="Booth Concept Rendering"
            className="w-full object-contain cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
          />
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">
              {boothW}' × {boothD}' {boothType} · {lineItems.length} product{lineItems.length !== 1 ? 's' : ''} · Registry-enriched render
            </p>
          </div>
        </div>
      )}

      {/* ── Generate button ── */}
      <div className="flex flex-col gap-3">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || lineItems.length === 0}
          className="flex items-center justify-center gap-2 w-full py-3 bg-[#e2231a] hover:bg-[#b01b13] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
        >
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {genStep || 'Generating…'}</>
          ) : renderUrl ? (
            <><RefreshCw className="w-4 h-4" /> Regenerate Booth Render</>
          ) : (
            <><Wand2 className="w-4 h-4" /> Generate Booth Rendering</>
          )}
        </button>
        {isGenerating ? (
          <RenderProgressMonitor currentStepIndex={genStepIndex} steps={renderSteps} />
        ) : (
          <p className="text-[10px] text-slate-400 text-center">
            Uses product registry + Claude Sonnet to map your {lineItems.length} product{lineItems.length !== 1 ? 's' : ''} into a photorealistic booth concept
          </p>
        )}
        {genError && (
          <p className="text-[10px] text-red-500 text-center">{genError}</p>
        )}
        {renderDebug && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left space-y-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Last Render Debug</p>
            <div>
              <p className="text-[10px] font-semibold text-slate-700">Registry status</p>
              <pre className="mt-1 text-[10px] text-slate-600 whitespace-pre-wrap break-words bg-white rounded-lg border border-slate-200 p-2 overflow-auto max-h-20">
                {renderDebug.registryResponse
                  ? `✅ Registry returned ${renderDebug.registryResponse.total} products, ${renderDebug.registryResponse.missing_skus?.length || 0} missing`
                  : '❌ Registry unavailable — used fallback prompt'}
              </pre>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-700">Sent payload</p>
              <pre className="mt-1 text-[10px] text-slate-600 whitespace-pre-wrap break-words bg-white rounded-lg border border-slate-200 p-2 overflow-auto max-h-40">{JSON.stringify(renderDebug.requestPayload, null, 2)}</pre>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-700">Image gen prompt (written by Sonnet)</p>
              <pre className="mt-1 text-[10px] text-slate-600 whitespace-pre-wrap break-words bg-white rounded-lg border border-slate-200 p-2 overflow-auto max-h-64">{renderDebug.prompt}</pre>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-700">Reference images ({renderDebug.referenceUrls?.length || 0})</p>
              <pre className="mt-1 text-[10px] text-slate-600 whitespace-pre-wrap break-words bg-white rounded-lg border border-slate-200 p-2 overflow-auto max-h-32">{JSON.stringify(renderDebug.referenceUrls, null, 2)}</pre>
            </div>
          </div>
        )}
      </div>

      {/* ── Product reference grid ── */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Products in this quote ({lineItems.length})
        </p>
        <div className="rounded-xl border-2 border-[#1a1a1a] overflow-hidden">
          <div className="bg-[#1a1a1a] px-3 py-1.5 flex items-center justify-between">
            <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">BACK WALL</span>
            <span className="text-[9px] text-white/70 font-bold">{boothW}' × {boothD}' {boothType}</span>
          </div>
          <div className="p-3 bg-gradient-to-b from-slate-100 to-slate-200">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
              {lineItems.map((item, i) => (
                <ProductCard key={item.id || i} item={item} />
              ))}
            </div>
          </div>
          <div className="border-t-2 border-dashed border-slate-400/50 mx-3 mb-2 pt-1 text-center">
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">AISLE</span>
          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && renderUrl && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <button onClick={() => setLightboxOpen(false)} className="absolute top-4 right-4 text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <img
            src={renderUrl}
            alt="Booth Concept"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
