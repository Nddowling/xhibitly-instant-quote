import React, { useState } from 'react';
import { SKU_TO_PAGE } from '@/data/catalogPageMapping';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, RefreshCw } from 'lucide-react';

const SUPABASE_URL = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';

// Priority: 1) stored image_url on line item, 2) static SKU_TO_IMAGE map (real product photos),
// 3) catalog page image (always available)
function resolveProductImage(item) {
  if (item.image_url) return item.image_url;
  const mapped = SKU_TO_IMAGE[item.sku];
  if (mapped) return mapped;
  const page = SKU_TO_PAGE?.[item.sku];
  if (page) {
    return `${SUPABASE_URL}/catalog/pages/page-${String(page + 2).padStart(3, '0')}.jpg`;
  }
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
            <span className="text-[8px] text-slate-400 font-mono leading-tight">{item.sku}</span>
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

// ─── AI Rendering via Claude Vision ──────────────────────────────────────────
async function generateAIRendering(order, lineItems) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';

  // Collect real product image URLs for each line item
  const productImages = lineItems
    .map(item => resolveProductImage(item))
    .filter(Boolean)
    .slice(0, 10); // Claude accepts up to 10 images in a single call

  const productList = lineItems.map((item, i) =>
    `${i + 1}. ${item.product_name || item.sku} (SKU: ${item.sku}, Qty: ${item.quantity || 1})`
  ).join('\n');

  const prompt = `You are a trade show exhibit designer. I am showing you ${productImages.length} product photos from the Orbus trade show display catalog.

These are the products on the quote:
${productList}

Booth specs: ${boothW}' × ${boothD}' ${boothType} booth

Generate a clean, professional SVG (800×500px) showing a front-elevation view of this trade show booth with ONLY these products arranged logically inside it. Rules:
- Back wall across the top, floor at the bottom, open aisle at the front
- Arrange the products as they would realistically appear in a ${boothW}x${boothD} ${boothType} booth
- Each product should be a simple but recognizable rectangle/shape with the product name labeled below it
- Use light colors: booth background #f8fafc, product fills #e2e8f0, accents #e2231a for labels
- Add dimension annotations: "${boothW}'" at the top and "${boothD}'" on the side
- Add a thin dark top border representing the back wall
- Add a dashed line at the bottom representing the aisle
- Keep it clean and architectural — no people, no logos
- Return ONLY the raw SVG markup starting with <svg, nothing else`;

  const response = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: productImages,
    model: 'claude_sonnet_4_6',
    response_type: 'text',
  });

  // Extract SVG from response
  const svgMatch = response.match(/<svg[\s\S]*<\/svg>/i);
  return svgMatch ? svgMatch[0] : null;
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function BoothConceptRender({ order, lineItems = [], onRenderingSaved }) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';
  const gridCols = getGridCols(boothW, lineItems.length);

  const [aiSvg, setAiSvg] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const pxPerFoot = 28;
  const visualW = Math.min(boothW * pxPerFoot, 600);
  const visualD = Math.min(boothD * pxPerFoot, 400);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenError(null);
    try {
      const svg = await generateAIRendering(order, lineItems);
      if (svg) {
        setAiSvg(svg);
        // Save to Order.booth_rendering_url as a data URI if we have an order id
        if (order?.id && onRenderingSaved) {
          const dataUri = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
          await base44.entities.Order.update(order.id, { booth_rendering_url: dataUri });
          onRenderingSaved(dataUri);
        }
      } else {
        setGenError('Could not generate rendering. Try again.');
      }
    } catch (err) {
      console.error('AI rendering failed:', err);
      setGenError('Generation failed. Check your connection and try again.');
    }
    setIsGenerating(false);
  };

  return (
    <div className="space-y-4">
      {/* AI-Generated rendering (shown after generation) */}
      {aiSvg && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Wand2 className="w-3 h-3 text-[#e2231a]" /> AI Concept Rendering
            </span>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Regenerate
            </button>
          </div>
          <div
            className="w-full overflow-hidden"
            dangerouslySetInnerHTML={{ __html: aiSvg }}
          />
        </div>
      )}

      {/* Product photo grid (static, always visible) */}
      <div className="rounded-xl border-2 border-[#1a1a1a] overflow-hidden bg-gradient-to-b from-slate-100 to-slate-200">
        {/* Back wall */}
        <div className="bg-[#1a1a1a] px-3 py-1.5 flex items-center justify-between">
          <span className="text-[8px] text-white/50 font-bold uppercase tracking-widest">BACK WALL</span>
          <span className="text-[9px] text-white/70 font-bold">{boothW}' × {boothD}' {boothType}</span>
        </div>

        {/* Products */}
        <div className="p-3">
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {lineItems.map((item, i) => (
              <ProductCard key={item.id || i} item={item} />
            ))}
          </div>
        </div>

        {/* Aisle */}
        <div className="border-t-2 border-dashed border-slate-400/50 mx-3 mb-2 mt-0 pt-1 text-center">
          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">AISLE</span>
        </div>
      </div>

      {/* Generate AI Concept button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || lineItems.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#e2231a] hover:bg-[#b01b13] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
        >
          {isGenerating
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating AI Layout...</>
            : <><Wand2 className="w-3.5 h-3.5" /> {aiSvg ? 'Regenerate AI Layout' : 'Generate AI Booth Layout'}</>
          }
        </button>
        {!aiSvg && !isGenerating && (
          <span className="text-[10px] text-slate-400">
            Claude Vision analyzes your {lineItems.length} product photo{lineItems.length !== 1 ? 's' : ''} and draws the booth layout
          </span>
        )}
        {genError && <span className="text-[10px] text-red-500">{genError}</span>}
      </div>

      {/* Caption */}
      <p className="text-[9px] text-slate-400 text-center">
        {boothW}' × {boothD}' {boothType} · {lineItems.length} product{lineItems.length !== 1 ? 's' : ''} · Concept only — not to scale
      </p>
    </div>
  );
}
