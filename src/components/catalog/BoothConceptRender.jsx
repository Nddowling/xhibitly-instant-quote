import React, { useState } from 'react';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, RefreshCw, ZoomIn, X } from 'lucide-react';

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

    if (
      /pegasus|formulate|embrace|panoramic|backwall|waveline|lumiere|vector frame|infinite|hop|cove/.test(name) ||
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
        ? `${qty} identical panels arranged side-by-side to span the full back wall width`
        : `filling the full ${boothW}-foot back wall width`;
      instructions.push(`BACK WALL — ${item.product_name || item.sku}${ref}: ${panelDesc}. ` +
        `The fabric tension graphic panels display a clean, professional, solid-color gradient design in deep navy blue and white — NO text, logos, or imagery copied from the reference photo. The hardware frame (aluminum extrusions, feet) must match the reference photo exactly.`);
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
        `positioned at ${positions[i]}, standing upright on floor, in front of the back wall. ` +
        `The retractable graphic panel displays a clean professional solid-color design — do NOT copy the graphics from the reference photo, show neutral branded panels. Hardware/frame must match the reference photo exactly.`);
    });
  }

  // Counters — front center
  if (counters.length > 0) {
    counters.forEach((item, i) => {
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      instructions.push(`FRONT CENTER (${i + 1}) — ${item.product_name || item.sku}${ref}: ` +
        `positioned at the front edge of the booth, centered, near the aisle. ` +
        `The display panels show a clean neutral branded design — do NOT copy reference photo graphics. Hardware must match the reference.`);
    });
  }

  // Accessories
  if (accessories.length > 0) {
    accessories.forEach(item => {
      const ref = imageIndexMap[item.sku] ? ` [Reference photo ${imageIndexMap[item.sku]}]` : '';
      instructions.push(`ADDITIONAL — ${item.product_name || item.sku}${ref}: placed naturally within the booth space.`);
    });
  }

  return instructions.join('\n\n');
}

// ─── Core render prompt builder ───────────────────────────────────────────────
async function buildRenderingPrompt(order, lineItems) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';
  const zones = categorizeProducts(lineItems);

  // Collect reference images — one per unique SKU, max 8
  const seen = new Set();
  const referenceImages = [];
  const imageIndexMap = {}; // sku → 1-based index

  for (const item of lineItems) {
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
        `  Photo ${i + 1}: ${r.item.product_name || r.item.sku} (SKU: ${r.item.sku}) — use this photo to accurately reproduce the physical hardware structure, frame shape, base/feet, and proportions ONLY. DO NOT copy any printed graphics, text, logos, colors, or imagery visible on the graphic panels in this photo.`
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
All printed graphic panels throughout the booth — on the back wall display, banner stands, and any other displays — must show a clean, professional, modern design using only neutral colors: deep navy blue or charcoal as the base with white accents, or a clean white/light gray gradient. Use subtle geometric shapes or soft gradients. Do NOT render any text, logos, brand names, imagery, people, or specific graphic designs. The panels should look like they have been printed with a sophisticated placeholder design ready for customization.

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

// ─── Generate the image — pass reference photos so model knows hardware shapes ─
async function generatePhotoRender(order, lineItems) {
  const { prompt, referenceImages } = await buildRenderingPrompt(order, lineItems);

  // Pass reference images so the model can use them for hardware structure accuracy.
  // The prompt explicitly instructs the model to use structure/shape only, not copy graphics.
  const result = await base44.integrations.Core.GenerateImage({
    prompt,
    existing_image_urls: referenceImages.length > 0 ? referenceImages.map(r => r.url) : undefined,
  });

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

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BoothConceptRender({ order, lineItems = [], onRenderingSaved }) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';
  const gridCols = getGridCols(boothW, lineItems.length);

  const [renderUrl, setRenderUrl] = useState(order?.booth_rendering_url || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [genStep, setGenStep] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenError(null);
    setGenStep('Mapping booth layout…');
    try {
      setGenStep('Building photorealistic render…');
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
              {boothW}' × {boothD}' {boothType} · {lineItems.length} product{lineItems.length !== 1 ? 's' : ''} · AI-generated concept — graphic panels shown with placeholder design
            </p>
          </div>
        </div>
      )}

      {/* ── Generate button ── */}
      <div className="flex flex-col gap-2">
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
        {!renderUrl && !isGenerating && (
          <p className="text-[10px] text-slate-400 text-center">
            AI maps your {lineItems.length} selected product{lineItems.length !== 1 ? 's' : ''} to a spatial booth layout and renders a photorealistic concept
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
