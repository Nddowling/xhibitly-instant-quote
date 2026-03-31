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

// ─── Categorize products into booth zones based on name/SKU patterns ───────────
function categorizeProducts(lineItems) {
  const backWall = [];
  const bannerStands = [];
  const counters = [];
  const accessories = [];

  for (const item of lineItems) {
    const name = (item.product_name || item.sku || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();

    // Tension fabric displays, backwalls, large format displays
    if (
      /pegasus|formulate|embrace|panoramic|backwall|waveline|lumiere|vector frame|infinite|hop|cove/.test(name) ||
      /pgsus|fml|emb|pan|wvl|lmr|hop|cove/.test(sku)
    ) {
      backWall.push(item);
    }
    // Retractable banner stands, roll-up stands
    else if (
      /orient|banner stand|retract|roll.?up|blade|spring/.test(name) ||
      /^ont|^bld|^rst|^spr/.test(sku)
    ) {
      bannerStands.push(item);
    }
    // Counter displays, kiosks, pedestals
    else if (
      /counter|kiosk|pedestal|podium|reception/.test(name) ||
      /-ct\b|ksk|ped/.test(sku)
    ) {
      counters.push(item);
    }
    else {
      accessories.push(item);
    }
  }

  return { backWall, bannerStands, counters, accessories };
}

// ─── Build spatial layout description for the DALL-E prompt ──────────────────
function buildSpatialLayout(boothW, boothD, boothType, zones) {
  const { backWall, bannerStands, counters, accessories } = zones;
  const type = (boothType || 'Inline').toLowerCase();
  const lines = [];

  // Booth shell
  if (type === 'island') {
    lines.push(`A ${boothW}x${boothD} foot island booth open on all four sides, visible from every direction. No back wall — products arranged around a central open structure.`);
  } else if (type === 'corner') {
    lines.push(`A ${boothW}x${boothD} foot corner booth with two open aisle-facing sides meeting at a 90-degree corner. Back walls on two sides form an L-shape.`);
  } else {
    lines.push(`A ${boothW}x${boothD} foot inline trade show booth viewed from the aisle. The back wall spans the full ${boothW} feet in width. The booth is ${boothD} feet deep from back wall to aisle edge. Open front.`);
  }

  // Back wall products
  if (backWall.length > 0) {
    const desc = backWall.map(item => {
      const qty = item.quantity > 1 ? ` (${item.quantity} panels/units side by side)` : '';
      return `${item.product_name || item.sku}${qty}`;
    }).join(' + ');
    lines.push(`BACK WALL: ${desc} — mounted flush against the back wall, spanning the full width. The graphic panels display a clean branded design with neutral colors.`);
  }

  // Banner stands — distribute symmetrically left/right of center
  if (bannerStands.length > 0) {
    // Expand by quantity
    const expanded = [];
    for (const item of bannerStands) {
      for (let q = 0; q < (item.quantity || 1); q++) expanded.push(item);
    }
    const total = expanded.length;
    if (total === 1) {
      lines.push(`FLOOR STANDING: 1x ${expanded[0].product_name || expanded[0].sku} — positioned slightly off-center toward the aisle, in front of the back wall.`);
    } else if (total === 2) {
      lines.push(`FLOOR STANDING: ${expanded[0].product_name || expanded[0].sku} on the far left side of the booth + ${expanded[1].product_name || expanded[1].sku} on the far right side of the booth, flanking the back wall.`);
    } else {
      const positions = ['far left', 'center-left', 'center', 'center-right', 'far right'].slice(0, Math.min(total, 5));
      const placed = expanded.slice(0, positions.length).map((item, i) => `${item.product_name || item.sku} at ${positions[i]}`).join(', ');
      lines.push(`FLOOR STANDING (${total} units): ${placed} — evenly spaced across the booth width, in front of the back wall.`);
    }
  }

  // Counters / pedestals — front-center
  if (counters.length > 0) {
    const desc = counters.map(item => `${item.quantity > 1 ? item.quantity + 'x ' : ''}${item.product_name || item.sku}`).join(', ');
    lines.push(`FRONT CENTER: ${desc} — positioned at the front of the booth near the aisle edge, centered.`);
  }

  // Accessories
  if (accessories.length > 0) {
    const desc = accessories.map(item => item.product_name || item.sku).join(', ');
    lines.push(`ADDITIONAL ELEMENTS: ${desc} — placed naturally within the booth.`);
  }

  return lines.join('\n\n');
}

// ─── Step 1: Claude Vision analyzes product STRUCTURE only (ignore graphics) ──
async function analyzeProductStructures(lineItems) {
  const itemsWithImages = lineItems.filter(item => resolveProductImage(item));
  if (itemsWithImages.length === 0) return {};

  const imageUrls = itemsWithImages.map(item => resolveProductImage(item));
  const productList = itemsWithImages.map((item, i) =>
    `Image ${i + 1}: ${item.product_name || item.sku} (SKU: ${item.sku})`
  ).join('\n');

  const response = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a trade show exhibit expert analyzing product photos to extract their PHYSICAL STRUCTURE ONLY.

For each product image, describe ONLY its physical form factor — the hardware, frame, structure, and dimensions. Completely IGNORE any graphics, branding, logos, colors, or printed designs shown on the graphic panels in the photos (those are sample demo graphics, not real).

Products shown (one image per product):
${productList}

For each product, provide a brief physical description in this format:
[Product Name]: [physical structure — frame type, shape, height, width, panel count, how it stands/mounts, any hardware visible]

Focus on: aluminum frame, fabric tension mechanism, retractable cassette, base/feet type, number of panels, approximate dimensions. Ignore all graphic content.`,
    file_urls: imageUrls,
    model: 'claude_sonnet_4_6',
  });

  // Map each item's SKU to its physical description
  const descMap = {};
  const lines = (response || '').split('\n').filter(l => l.trim());
  for (let i = 0; i < itemsWithImages.length; i++) {
    const item = itemsWithImages[i];
    // Try to find matching line
    const match = lines.find(l =>
      l.toLowerCase().includes((item.product_name || item.sku).toLowerCase().slice(0, 10)) ||
      l.toLowerCase().includes(item.sku.toLowerCase().slice(0, 6)) ||
      l.startsWith(`${i + 1}.`) || l.startsWith(`Image ${i + 1}`)
    );
    descMap[item.sku] = match || `${item.product_name || item.sku}: trade show display product`;
  }
  return descMap;
}

// ─── Step 2: Build the DALL-E image generation prompt ────────────────────────
async function buildRenderingPrompt(order, lineItems) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';
  const zones = categorizeProducts(lineItems);
  const spatialLayout = buildSpatialLayout(boothW, boothD, boothType, zones);

  // Aspect ratio instruction
  const ratio = boothW / boothD;
  const aspectDirective = ratio >= 2
    ? `Extreme wide-angle panoramic view, the entire back wall spans the full width of the frame`
    : ratio >= 1.5
    ? `Wide landscape view, the back wall stretches across the full frame width`
    : `Front-facing view, slightly elevated eye level (~6 feet high), centered on booth`;

  // Get physical structure descriptions from product photos
  const structureMap = await analyzeProductStructures(lineItems);

  // Build per-product structure summary
  const productStructures = lineItems.map(item => {
    const struct = structureMap[item.sku] || `${item.product_name || item.sku}`;
    const qty = item.quantity > 1 ? ` ×${item.quantity}` : '';
    return `- ${struct}${qty}`;
  }).join('\n');

  const prompt = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a professional trade show exhibit visualizer. Write a single photorealistic DALL-E image generation prompt for the following booth setup.

BOOTH LAYOUT:
${spatialLayout}

PRODUCT PHYSICAL STRUCTURES (hardware/form only — ignore any sample graphics described):
${productStructures}

GRAPHIC PANEL STYLE: All graphic panels should appear as clean, professionally printed panels with solid color backgrounds and minimal modern typography — no specific branding, logos, or imagery. Light neutral tones preferred (white, light gray, one subtle accent color).

RENDERING REQUIREMENTS:
- ${aspectDirective}
- Photorealistic 3D architectural visualization
- Professional trade show convention center hall: light gray carpet floor, high ceiling with suspended track lighting and warm spotlights aimed at the booth
- White pipe-and-drape curtain walls visible in background behind the booth
- No people in the scene
- Sharp product edges, accurate proportions, realistic shadows and reflections

CRITICAL ACCURACY RULES:
- Show EXACTLY the number of each product as specified (quantities above are precise)
- Place products in the exact spatial positions described in BOOTH LAYOUT
- The back wall products must fill the back of the booth completely
- Do not add, remove, or substitute any products

Return ONLY the DALL-E prompt — no explanation, no preamble, no quotes around it.`,
    model: 'claude_sonnet_4_6',
  });

  return prompt;
}

// ─── Step 3: Generate the image — text-to-image only (no seed images) ─────────
async function generatePhotoRender(order, lineItems) {
  const prompt = await buildRenderingPrompt(order, lineItems);

  const result = await base44.integrations.Core.GenerateImage({ prompt });

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
    setGenStep('Analyzing product structures…');
    try {
      setGenStep('Claude is mapping booth layout…');
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

      {/* ── Photorealistic render ── */}
      {renderUrl && (
        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-white">
          <div className="px-4 py-2.5 bg-[#1a1a1a] flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5 text-[#e2231a]" />
              Photorealistic Booth Concept
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLightboxOpen(true)}
                className="text-white/50 hover:text-white transition-colors"
                title="View full size"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="text-white/50 hover:text-white transition-colors"
                title="Regenerate"
              >
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
              {boothW}' × {boothD}' {boothType} · {lineItems.length} product{lineItems.length !== 1 ? 's' : ''} · AI-generated concept — actual products may vary
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
            AI maps your {lineItems.length} product{lineItems.length !== 1 ? 's' : ''} to a spatial booth layout, then generates a photorealistic 3D concept render
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
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
            >
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
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-white"
          >
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
