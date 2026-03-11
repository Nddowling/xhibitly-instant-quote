import React from 'react';
import { SKU_TO_PAGE } from '@/data/catalogPageMapping';

const SUPABASE_URL = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';

function catalogThumb(sku) {
  const page = SKU_TO_PAGE?.[sku];
  if (!page) return null;
  const pdfPage = page + 2;
  return `${SUPABASE_URL}/catalog/pages/page-${String(pdfPage).padStart(3, '0')}.jpg`;
}

function resolveThumb(item) {
  return item.image_url || catalogThumb(item.sku);
}

function parseBoothSize(boothSize) {
  const parts = (boothSize || '10x10').toLowerCase().split('x');
  return { w: parseInt(parts[0]) || 10, d: parseInt(parts[1]) || 10 };
}

function ProductCard({ item }) {
  const [imgError, setImgError] = React.useState(false);
  const imgSrc = resolveThumb(item);

  return (
    <div className="flex flex-col items-center bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
      {/* Product image */}
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
            <span className="text-[8px] text-slate-400 font-mono leading-tight break-all">{item.sku}</span>
          </div>
        )}
      </div>

      {/* Product info */}
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

// Determines optimal grid columns based on booth width + item count
function getGridCols(boothW, itemCount) {
  if (itemCount === 1) return 1;
  if (itemCount === 2) return 2;
  if (boothW >= 20) return Math.min(itemCount, 5);
  return Math.min(itemCount, 3);
}

export default function BoothConceptRender({ order, lineItems = [] }) {
  const { w: boothW, d: boothD } = parseBoothSize(order?.booth_size);
  const boothType = order?.booth_type || 'Inline';
  const gridCols = getGridCols(boothW, lineItems.length);

  // Visual scale: each foot = ~28px, capped for display
  const pxPerFoot = 28;
  const visualW = Math.min(boothW * pxPerFoot, 600);
  const visualD = Math.min(boothD * pxPerFoot, 400);

  return (
    <div className="font-sans">
      {/* Booth space — outer frame represents physical walls */}
      <div
        className="relative mx-auto bg-gradient-to-b from-slate-100 to-slate-200 border-2 border-[#1a1a1a] rounded-sm overflow-hidden"
        style={{ width: visualW, height: visualD, maxWidth: '100%' }}
      >
        {/* Back wall (top) */}
        <div className="absolute top-0 left-0 right-0 h-3 bg-[#1a1a1a] flex items-center justify-center">
          <span className="text-[7px] text-white/50 font-bold uppercase tracking-widest">BACK WALL</span>
        </div>

        {/* Side walls */}
        <div className="absolute top-3 left-0 bottom-0 w-2 bg-[#1a1a1a]/20" />
        <div className="absolute top-3 right-0 bottom-0 w-2 bg-[#1a1a1a]/20" />

        {/* Aisle marker (bottom) */}
        <div className="absolute bottom-0 left-0 right-0 h-4 border-t-2 border-dashed border-slate-400/60 bg-white/20 flex items-center justify-center">
          <span className="text-[7px] text-slate-500 font-bold uppercase tracking-widest">AISLE</span>
        </div>

        {/* Booth dimensions chip */}
        <div className="absolute top-5 right-3 bg-white/90 rounded px-1.5 py-0.5 shadow-sm">
          <span className="text-[8px] font-bold text-slate-700">{boothW}' × {boothD}'</span>
        </div>

        {/* Products grid — the core of the concept */}
        <div
          className="absolute left-3 right-3 top-4 bottom-5 flex items-center justify-center"
        >
          <div
            className="grid gap-2 w-full"
            style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
          >
            {lineItems.map((item, i) => (
              <ProductCard key={item.id || i} item={item} />
            ))}
          </div>
        </div>
      </div>

      {/* Caption bar */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
          {boothW}' × {boothD}' {boothType} · {lineItems.length} product{lineItems.length !== 1 ? 's' : ''}
        </span>
        <span className="text-[9px] text-slate-400">Concept only — not to scale</span>
      </div>
    </div>
  );
}
