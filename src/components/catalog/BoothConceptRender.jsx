import React, { useState } from 'react';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';
import { base44 } from '@/api/base44Client';
import { Wand2, Loader2, RefreshCw, ZoomIn, X, Sparkles, CheckCircle2 } from 'lucide-react';

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

async function generatePhotoRender(order, lineItems) {
  const quoteItems = lineItems
    .map((item) => ({
      sku: item?.sku || '',
      name: item?.product_name || item?.sku || 'Quoted product',
      image_url: resolveProductImage(item) || item?.image_url || '',
      quantity: item?.quantity || 1,
    }))
    .filter((item) => item.sku || item.name);

  const referenceUrls = Array.from(new Set(
    quoteItems
      .map((item) => item.image_url)
      .filter(Boolean)
  )).slice(0, 6);

  const response = await base44.functions.invoke('generateBoothRender', {
    website_url: order?.website_url || '',
    brand_name: order?.customer_company || order?.customer_name || 'Client brand',
    booth_size: order?.booth_size || '10x10',
    booth_type: order?.booth_type || 'Inline',
    show_name: order?.show_name || 'Trade Show',
    quote_items: quoteItems,
    reference_urls: referenceUrls,
  });

  const renderUrl = response?.data?.url;
  if (!renderUrl) {
    throw new Error(response?.data?.error || 'No booth render image was returned');
  }

  return {
    url: renderUrl,
    prompt: response?.data?.prompt || '',
    boothInfo: response?.data?.booth_info || {
      brandName: order?.customer_company || order?.customer_name || 'Client brand',
      boothSize: order?.booth_size || '10x10',
      boothType: order?.booth_type || 'Inline',
      showName: order?.show_name || 'Trade Show',
    },
    requestPayload: {
      quote_items: quoteItems,
      boothInfo: {
        brandName: order?.customer_company || order?.customer_name || 'Client brand',
        boothSize: order?.booth_size || '10x10',
        boothType: order?.booth_type || 'Inline',
        showName: order?.show_name || 'Trade Show',
      },
    },
    referenceUrls,
    registryResponse: {
      source: 'product-records',
      total: quoteItems.length,
      missing_skus: [],
    },
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
    { label: 'Reading quote products', fun: 'Collecting the selected SKUs and product details from this quote.', icon: CheckCircle2 },
    { label: 'Building booth prompt', fun: 'Writing one booth scene prompt from the matching Product records.', icon: Wand2 },
    { label: 'Generating booth image', fun: 'Creating the photorealistic booth concept from that booth prompt.', icon: Sparkles },
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
    setGenStep('Reading quote products…');
    setGenStepIndex(0);
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      setGenStep('Building booth prompt from Product records…');
      setGenStepIndex(1);
      await new Promise(resolve => setTimeout(resolve, 250));

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
              {boothW}' × {boothD}' {boothType} · {lineItems.length} product{lineItems.length !== 1 ? 's' : ''} · Quote-based render
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
            Uses only the products in this quote and their Product record details to build the booth render
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
                  ? `✅ Using ${renderDebug.registryResponse.total} quote product records`
                  : 'No product record summary available'}
              </pre>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-700">Booth setup used</p>
              <pre className="mt-1 text-[10px] text-slate-600 whitespace-pre-wrap break-words bg-white rounded-lg border border-slate-200 p-2 overflow-auto max-h-24">{JSON.stringify(renderDebug.boothInfo, null, 2)}</pre>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-700">Sent payload</p>
              <pre className="mt-1 text-[10px] text-slate-600 whitespace-pre-wrap break-words bg-white rounded-lg border border-slate-200 p-2 overflow-auto max-h-40">{JSON.stringify(renderDebug.requestPayload, null, 2)}</pre>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-slate-700">Final booth render prompt</p>
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