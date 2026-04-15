import React, { useState } from 'react';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, RefreshCw, ZoomIn, X, Sparkles, Images, ScanSearch, CheckCircle2 } from 'lucide-react';

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

// ─── Categorize products into booth zones ─────────────────────────────────────
function categorizeProducts(lineItems) {
  const backWall = [];
  const bannerStands = [];
  const counters = [];
  const accessories = [];

  for (const item of lineItems) {
    const name = (item.product_name || item.sku || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    const accessoryOnly = /case|cases|carry bag|carrybag|bag|shipping case|transport case|roller bag/.test(name);

    if (accessoryOnly) {
      continue;
    }

    if (
      /pegasus|formulate|embrace|panoramic|back wall|backwall|waveline|lumiere|vector frame|infinite|hop|cove/.test(name) ||
      /pgsus|fml|emb|pan|wvl|lmr|hop|cove/.test(sku)
    ) {
      backWall.push(item);
    } else if (
      /orient|banner stand|retract|roll.?up|blade|spring/.test(name) ||
      /^ont|^bld|^rst|^spr/.test(sku)
    ) {
      bannerStands.push(item);
    } else if (
      /counter|kiosk|pedestal|podium|reception/.test(name) ||
      /-ct\b|ksk|ped/.test(sku)
    ) {
      counters.push(item);
    } else {
      accessories.push(item);
    }
  }

  return { backWall, bannerStands, counters, accessories };
}

// ─── Derive exact pixel-accurate placement instructions from zones ─────────────
function buildPlacementInstructions(boothW, boothD, boothType, zones, imageIndexMap) {
  const { backWall, bannerStands, counters, accessories } = zones;
  const type = (boothType || 'Inline').toLowerCase();
  const instructions = [];

  // Booth shell
  if (type === 'island') {
    instructions.push(`BOOTH SHELL: ${boothW}x${boothD} foot island booth — open on all 4 sides, no back wall, visible from every direction.`);
  } else if (type === 'corner') {
    instructions.push(`BOOTH SHELL: ${boothW}x${boothD} foot corner booth — back wall along the left and rear sides (L-shape), two aisle-facing open sides.`);
  } else {
    instructions.push(`BOOTH SHELL: ${boothW}x${boothD} foot inline booth viewed from the aisle. Single unbroken back wall spanning the full ${boothW} feet wide. ${boothD} feet deep. Open front facing viewer.`);
  }

  // Back wall — spans full width
  if (backWall.length > 0) {
    for (const item of backWall) {
      const qty = item.quantity || 1;
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      const panelDesc = qty > 1
        ? `show exactly ${qty} units arranged side-by-side across the back wall`
        : `show exactly 1 unit on the back wall`;
      instructions.push(`BACK WALL — ${item.product_name || item.sku}${ref}: ${panelDesc}. ` +
        `Do not add duplicate panels, extra wings, side pieces, matching accessories, or additional display structures beyond the exact quoted quantity. ` +
        `Reproduce the graphic panel design exactly as it appears in the reference photo — same colors, layout, imagery style, and visual treatment. The hardware frame (aluminum extrusions, feet, base) must also match the reference photo exactly.`);
    }
  }

  // Banner stands — explicit left/right/center positioning
  if (bannerStands.length > 0) {
    const expanded = [];
    for (const item of bannerStands) {
      for (let q = 0; q < (item.quantity || 1); q++) expanded.push(item);
    }
    const total = expanded.length;
    const positions = total === 1
      ? ['centered slightly in front of the back wall']
      : total === 2
      ? ['far left side of booth', 'far right side of booth']
      : total === 3
      ? ['far left', 'center', 'far right']
      : total === 4
      ? ['far left', 'left of center', 'right of center', 'far right']
      : ['leftmost', 'left', 'center', 'right', 'rightmost'].slice(0, total);

    expanded.forEach((item, i) => {
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      instructions.push(`FLOOR STANDING (${i + 1}/${total}) — ${item.product_name || item.sku}${ref}: ` +
        `positioned at ${positions[i]}, standing upright on floor, in front of the back wall. Show exactly 1 unit here and do not add any extra matching banner stands or duplicate displays. ` +
        `Reproduce the graphic panel design exactly as shown in the reference photo — same colors, imagery, and visual style. Hardware (cassette base, retractable mechanism, feet) must match the reference photo exactly.`);
    });
  }

  // Counters — front center
  if (counters.length > 0) {
    counters.forEach((item, i) => {
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      instructions.push(`FRONT CENTER (${i + 1}) — ${item.product_name || item.sku}${ref}: ` +
        `positioned at the front edge of the booth, centered, near the aisle. Show exactly 1 counter here and do not add any extra counters, tables, kiosks, or reception pieces. ` +
        `Reproduce the graphic panel design exactly as shown in the reference photo — same colors, imagery, and visual style. Hardware must match the reference photo exactly.`);
    });
  }

  // Accessories
  if (accessories.length > 0) {
    accessories.forEach(item => {
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      const qty = item.quantity || 1;
      instructions.push(`ADDITIONAL — ${item.product_name || item.sku}${ref}: show exactly ${qty} unit${qty === 1 ? '' : 's'} placed naturally within the booth space, with no extra matching accessories or duplicate items.`);
    });
  }

  return instructions.join('\n\n');
}

// ─── Core render prompt builder ───────────────────────────────────────────────
async function buildRenderingPrompt(order, lineItems) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';
  const renderableLineItems = lineItems.filter(item => {
    const name = (item.product_name || item.sku || '').toLowerCase();
    return !/case|cases|carry bag|carrybag|bag|shipping case|transport case|roller bag/.test(name);
  });
  const zones = categorizeProducts(renderableLineItems);

  // Collect reference images — one per unique SKU, max 8
  const seen = new Set();
  const referenceImages = [];
  const imageIndexMap = {}; // sku → 1-based index

  for (const item of renderableLineItems) {
    if (seen.has(item.sku)) continue;
    const url = resolveProductImage(item);
    if (url) {
      seen.add(item.sku);
      referenceImages.push({ item, url });
      imageIndexMap[item.sku] = referenceImages.length;
    }
  }

  // Build reference legend for the prompt
  const refLegend = referenceImages.length > 0
    ? `REFERENCE PHOTOS PROVIDED (${referenceImages.length} images attached):\n` +
      referenceImages.map((r, i) =>
        `  Photo ${i + 1}: ${r.item.product_name || r.item.sku} (SKU: ${r.item.sku}) — reproduce this product faithfully: match the hardware structure (frame, base, feet, mechanism) AND the graphic panel design (colors, imagery, visual style) exactly as shown.`
      ).join('\n')
    : '';

  // Aspect ratio
  const ratio = boothW / boothD;
  const cameraDirective = ratio >= 2
    ? `Ultra-wide camera, low horizontal angle, back wall spans full image width`
    : `Wide-angle lens, slightly elevated eye level (~5.5 feet from floor), centered on booth, booth fills the full frame`;

  const placementInstructions = buildPlacementInstructions(boothW, boothD, boothType, zones, imageIndexMap);

  const prompt = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a professional trade show exhibit render artist creating a precise DALL-E / gpt-image-1 image generation prompt. Your job is to write a single detailed, technically accurate prompt that will produce a photorealistic visualization of a specific trade show booth build.

${refLegend}

EXACT PRODUCT PLACEMENT — follow these instructions precisely, one product at a time:
${placementInstructions}

GRAPHIC PANEL APPEARANCE (critical):
Each product's graphic panels must display the design shown in its reference photo — reproduce the colors, imagery, visual style, and overall graphic treatment faithfully. Each product has its own distinct graphic: do not apply one product's graphic to another product. The goal is for the render to look like a real booth with professionally printed, fully-designed graphics already on the displays.

QUANTITY CONTROL (critical):
Render only the exact products and quantities listed in the placement instructions. Do not invent, infer, auto-complete, mirror, duplicate, or add any extra exhibit elements, side panels, shelving, kiosks, counters, monitors, tables, chairs, hanging signs, architectural features, or branded accessories unless they are explicitly listed in the quote. If the quote contains 3 items, the final booth must visibly contain only those 3 quoted items.

SCENE & ENVIRONMENT:
- Professional trade show convention center interior
- Medium-gray commercial carpet floor
- High ceiling (15+ feet) with exposed industrial structure
- Overhead track lighting with warm halogen spotlights aimed at the booth
- White pipe-and-drape curtain walls forming the backdrop behind and to the sides
- Clean, open aisle space in front of the booth
- No people in the scene

CAMERA & RENDER QUALITY:
- ${cameraDirective}
- Photorealistic architectural visualization quality
- Accurate shadows and soft directional lighting from overhead spots
- Sharp product edges with realistic material textures (aluminum, fabric, carpet)
- Professional product photography composition

Write ONLY the final image generation prompt — no explanation, no preamble, no quotes around it. The prompt must be specific enough that a generative model produces the exact booth configuration described above.`,
    file_urls: referenceImages.length > 0 ? referenceImages.map(r => r.url) : undefined,
    model: 'claude_sonnet_4_6',
  });

  return { prompt, referenceImages };
}

// ─── Generate via GPT Image 1.5 (direct OpenAI — spatial accuracy) ────────────
async function generatePhotoRender(order, lineItems) {
  const boothType = order?.booth_type || 'Inline';
  const boothSize = order?.booth_size || '10x10';
  const brandName = order?.customer_company || order?.customer_name || 'Client Brand';
  const showName = order?.show_name || 'Trade Show';
  const colorNotes = order?.brand_colors || '';
  const brandDetails = order?.brand_details || null;

  // --- START: Registry Integration ---
  const skus = lineItems.map(item => item.sku).filter(Boolean);
  const quantities = {};
  lineItems.forEach(item => {
    if (item.sku) quantities[item.sku] = item.quantity || 1;
  });

  const registryRes = await fetch(
    'https://xpgvpzbzmkubahyxwipk.supabase.co/functions/v1/get-render-data',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skus,
        quantities,
        boothInfo: {
          brandName: brandName || order?.customer_company || '',
          boothSize: boothSize || order?.booth_size || '10x10',
          boothType: boothType || order?.booth_type || 'Inline',
          showName: showName || order?.show_name || '',
          colorNotes: colorNotes || '',
          logoUrl: brandDetails?.logo_cached_url || brandDetails?.logo_url || ''
        }
      })
    }
  ).then(r => r.json()).catch(() => null);

  let prompt;
  let allReferenceUrls = [];

  if (registryRes?.prompt) {
    prompt = registryRes.prompt;
    allReferenceUrls = (registryRes.image_urls || []).map(i => i.url).filter(Boolean);
    console.log('[BoothRender] Using registry prompt. Products:', registryRes.products?.length, 'Images:', allReferenceUrls.length, 'Missing:', registryRes.missing_skus || []);
  } else {
    console.warn('[BoothRender] Registry unavailable, falling back to basic render flow.');
    const result = await buildRenderingPrompt(order, lineItems);
    prompt = result.prompt;
    allReferenceUrls = result.referenceImages.map(r => r.url);
  }
  // --- END: Registry Integration ---

  // ── Send to image generation ───────────────────────────────────────────────
  let result;
  try {
    result = await base44.functions.invoke('generateBoothRender', {
      body: {
        prompt,
        reference_urls: allReferenceUrls,
      },
    });
    const renderUrl = result?.data?.url || result?.url;
    if (!renderUrl) throw new Error('No URL returned');
    result = { url: renderUrl };
  } catch (fnErr) {
    console.warn('Luma render function failed, falling back to built-in GenerateImage:', fnErr?.message);
    const fallback = await base44.integrations.Core.GenerateImage({
      prompt,
      existing_image_urls: allReferenceUrls.length > 0 ? allReferenceUrls : undefined,
    });
    result = fallback;
  }

  return { url: result.url, prompt };
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
          <p className="mt-1 text-xs text-white/65">Luma Photon-1 is building the scene from your selected products and booth layout.</p>
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
    { label: 'Reading product references', fun: 'Pulling the best product images into the scene plan.', icon: Images },
    { label: 'Mapping booth layout', fun: 'Placing walls, counters, and stand positions inside the footprint.', icon: ScanSearch },
    { label: 'Building final render', fun: 'Luma Photon-1 is now painting the finished booth concept.', icon: Sparkles },
  ];

  const [renderUrl, setRenderUrl] = useState(order?.booth_rendering_url || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [genStep, setGenStep] = useState('');
  const [genStepIndex, setGenStepIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenError(null);
    setGenStep('Reading product references…');
    setGenStepIndex(0);
    try {
      await new Promise(resolve => setTimeout(resolve, 700));
      setGenStep('Mapping booth layout…');
      setGenStepIndex(1);
      await new Promise(resolve => setTimeout(resolve, 1100));
      setGenStep('Building final render with Luma Photon-1…');
      setGenStepIndex(2);
      const { url } = await generatePhotoRender(order, lineItems);

      setRenderUrl(url);

      if (order?.id) {
        await base44.entities.Order.update(order.id, { booth_rendering_url: url });
        if (onRenderingSaved) onRenderingSaved(url);
      }

      setGenStep('');
    } catch (err) {
      console.error('Render failed:', err);
      setGenError('Rendering failed. Please try again.');
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
              {boothW}' × {boothD}' {boothType} · {lineItems.length} product{lineItems.length !== 1 ? 's' : ''} · Rendered with Luma Photon-1
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
            <><RefreshCw className="w-4 h-4" /> Regenerate Photorealistic Render</>
          ) : (
            <><Wand2 className="w-4 h-4" /> Generate Photorealistic Booth Rendering</>
          )}
        </button>
        {isGenerating ? (
          <RenderProgressMonitor currentStepIndex={genStepIndex} steps={renderSteps} />
        ) : (
          <p className="text-[10px] text-slate-400 text-center">
            Uses Luma Photon-1 to map your {lineItems.length} selected product{lineItems.length !== 1 ? 's' : ''} into a photorealistic booth concept
          </p>
        )}
        {genError && (
          <p className="text-[10px] text-red-500 text-center">{genError}</p>
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