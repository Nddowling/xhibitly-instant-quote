import React, { useState } from 'react';
import { SKU_TO_PAGE } from '@/data/catalogPageMapping';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, RefreshCw, ZoomIn, X } from 'lucide-react';

const SUPABASE_URL = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';

function resolveProductImage(item) {
  if (item.image_url) return item.image_url;
  if (SKU_TO_IMAGE[item.sku]) return SKU_TO_IMAGE[item.sku];
  const page = SKU_TO_PAGE?.[item.sku];
  if (page) return `${SUPABASE_URL}/catalog/pages/page-${String(page + 2).padStart(3, '0')}.jpg`;
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

// ─── Step 1: Claude Vision analyzes product photos → writes the perfect DALL-E prompt
async function buildRenderingPrompt(order, lineItems) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';

  const productImages = lineItems
    .map(item => resolveProductImage(item))
    .filter(Boolean)
    .slice(0, 10);

  const productList = lineItems.map((item, i) =>
    `${i + 1}. ${item.product_name || item.sku} (SKU: ${item.sku}${item.quantity > 1 ? `, Qty: ${item.quantity}` : ''})`
  ).join('\n');

  const response = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a trade show exhibit designer creating a photorealistic 3D rendering brief.

I'm showing you ${productImages.length} product photos from the Orbus trade show display catalog. These are the exact products a client has ordered for their booth:

${productList}

Booth specs: ${boothW}' × ${boothD}' ${boothType} configuration

Study each product photo carefully and write a single, highly detailed image generation prompt that will produce a photorealistic 3D rendering of this complete booth setup. Your prompt must:

- Describe each product with specific visual details you can see in the photos (shape, material, fabric tension system, frame style, counter design, lighting fixtures, etc.)
- Specify realistic arrangement: where each item sits in a ${boothW}x${boothD} ${boothType} booth (back wall displays at rear, counters/stands in front areas, lighting overhead)
- Set the scene: bright trade show hall, clean neutral gray carpet, soft overhead spotlights, white walls, professional exhibit environment
- Style directive: architectural visualization, photorealistic 3D render, no people, clean brand-neutral displays with white/gray graphics
- Image ratio: wide landscape view showing the full booth from a slightly elevated front-facing angle

Return ONLY the image generation prompt — no explanation, no labels, just the prompt text.`,
    file_urls: productImages,
    model: 'claude_sonnet_4_6',
    response_type: 'text',
  });

  return response;
}

// ─── Step 2: Generate the photorealistic image from the prompt
async function generatePhotoRender(order, lineItems) {
  const renderPrompt = await buildRenderingPrompt(order, lineItems);

  const result = await base44.integrations.Core.GenerateImage({
    prompt: renderPrompt,
  });

  return { url: result.url, prompt: renderPrompt };
}

// ─── Product thumbnail card (for the reference grid, always shown below the render)
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
    setGenStep('Claude is analyzing your product photos…');
    try {
      setGenStep('Claude is analyzing your product photos…');
      const { url, prompt } = await generatePhotoRender(order, lineItems);

      setRenderUrl(url);

      // Save to Order entity
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

      {/* ── Photorealistic render (shown after generation or if already saved) ── */}
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
            Claude Vision analyzes your {lineItems.length} product photo{lineItems.length !== 1 ? 's' : ''}, then generates a photorealistic 3D render of the full booth
          </p>
        )}
        {genError && (
          <p className="text-[10px] text-red-500 text-center">{genError}</p>
        )}
      </div>

      {/* ── Product reference grid (always shown — "these are the products in the quote") ── */}
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
