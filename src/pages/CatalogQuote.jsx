import React, { useState, useEffect, useRef, useCallback } from 'react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PAGE_PRODUCTS, MAX_PAGE, SKU_TO_PAGE } from '@/data/catalogPageMapping';
import {
  ChevronLeft, ChevronRight, Plus, Minus, X, ShoppingCart,
  FileText, Search, Loader2, ImageOff, Package, Edit2, Save,
  Download, Trash2, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Claude Vision hotspot detection (runs via backend integration) ───────────────────────
async function detectHotspotsWithClaude(pageNum, products, supabaseUrl) {
  const imageUrl = `${supabaseUrl}/catalog/pages/page-${String(pageNum).padStart(3, '0')}.jpg`;

  const productList = products && products.length > 0
    ? products.map(p => `- ${p.sku}: "${p.name}" (${p.category})${p.isPrimary ? ' [FEATURED]' : ''}`).join('\n')
    : "Extract all product SKUs and names visible on the page (especially from tables).";

  const prompt = `This is page ${pageNum} of the Orbus Exhibitor's Handbook trade show display catalog.

Products on this page:
${productList}

Return a JSON array of bounding boxes for each product's primary visual/photo area. Rules:
- Size variants sharing ONE image → ONE box, list all SKUs in groupedSkus
- Separate product images → separate boxes
- If products are only listed in a table, draw ONE box around the table (or relevant section) and list all those SKUs in groupedSkus
- x, y = top-left corner, normalized 0–1 (0,0 = top-left)
- width, height = normalized 0–1
- Tight boxes around product photos or tables`;

  const response = await base44.integrations.Core.InvokeLLM({
    prompt: prompt,
    file_urls: [imageUrl],
    model: "claude_sonnet_4_6",
    response_json_schema: {
      type: "object",
      properties: {
        hotspots: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: { type: "string" },
              name: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              groupedSkus: { type: "array", items: { type: "string" } }
            },
            required: ["sku", "name", "x", "y", "width", "height", "groupedSkus"]
          }
        }
      },
      required: ["hotspots"]
    }
  });

  return response.hotspots.map(item => ({
    sku: item.sku || products[0]?.sku,
    name: item.name || '',
    x: Math.max(0, Math.min(1, Number(item.x) || 0)),
    y: Math.max(0, Math.min(1, Number(item.y) || 0)),
    width: Math.max(0.05, Math.min(1, Number(item.width) || 0.5)),
    height: Math.max(0.05, Math.min(1, Number(item.height) || 0.5)),
    groupedSkus: Array.isArray(item.groupedSkus) ? item.groupedSkus : [item.sku],
  }));
}

// ─── Config ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';
const LS_KEY = 'catalog-hotspot-edits';

function pageImageUrl(pageNum) {
  return `${SUPABASE_URL}/catalog/pages/page-${String(pageNum).padStart(3, '0')}.jpg`;
}

function fmt(n) {
  if (!n && n !== 0) return null;
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }

function getImageUrl(p) {
  if (!p) return null;
  let url = p.image_cached_url || p.image_url || p.thumbnail_url;
  if (!url) return null;
  
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${SUPABASE_URL}${url}`;
  return `${SUPABASE_URL}/${url}`;
}

function ProductImage({ src, alt, className = "w-full h-full object-contain", fallbackClassName = "w-5 h-5 text-slate-300" }) {
  const [error, setError] = useState(false);
  if (!src || error) return <Package className={fallbackClassName} />;
  return <img src={src} alt={alt} className={className} onError={() => setError(true)} />;
}

// ─── Load hotspot data lazily ────────────────────────────────────────────────
let _hotspots = null;
async function getHotspots() {
  if (_hotspots) return _hotspots;
  try {
    const mod = await import('@/data/catalogHotspots.json');
    _hotspots = mod.default;
  } catch { _hotspots = {}; }
  return _hotspots;
}

// ─── Hook: product detail cache ──────────────────────────────────────────────
function useProductCache() {
  const cache = useRef({});
  const [, setTick] = useState(0);

  const fetchProduct = useCallback(async (sku) => {
    if (cache.current[sku] !== undefined) return;
    cache.current[sku] = null;
    try {
      let prod = null;
      const res = await base44.entities.Product.filter({ sku });
      if (res && res.length > 0) {
        prod = res[0];
      } else {
        const variantRes = await base44.entities.ProductVariant.filter({ manufacturer_sku: sku });
        if (variantRes && variantRes.length > 0) {
          const v = variantRes[0];
          prod = {
            ...v,
            sku: v.manufacturer_sku,
            name: v.display_name,
            image_url: v.thumbnail_url || v.image_url,
            base_price: v.base_price
          };
        } else {
          prod = { sku, name: sku };
        }
      }

      // If no image URL on the entity, look it up from Supabase storage —
      // same pattern as ProductDetail.jsx which has working thumbnails.
      if (prod && !prod.image_cached_url && !prod.image_url) {
        try {
          const imgRes = await base44.functions.invoke('listSupabaseAssets', { path: `products/${sku}/image` });
          if (imgRes.data?.files?.length > 0) {
            const imgFile = imgRes.data.files.find(f => f.name.match(/\.(png|jpe?g|gif|webp)$/i));
            if (imgFile) prod.image_url = imgFile.publicUrl;
          }
        } catch { /* no image in storage, fallback to icon */ }
      }

      cache.current[sku] = prod;
    } catch {
      cache.current[sku] = { sku, name: sku };
    }
    setTick(t => t + 1);
  }, []);

  return { cache: cache.current, fetchProduct };
}

// ─── Normal catalog page view (read-only hotspot overlays) ───────────────────
function CatalogPageView({ pageNum, hotspots, onHotspotClick, selectedHotspot }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgLoaded(false); setImgError(false); }, [pageNum]);

  const spots = hotspots || [];

  return (
    <div className="relative inline-block w-full">
      <img
        src={pageImageUrl(pageNum)}
        alt={`Catalog page ${pageNum}`}
        className="w-full h-auto rounded-lg shadow-2xl block"
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
      />
      {!imgLoaded && !imgError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
          <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      )}
      {imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 rounded-lg gap-3">
          <ImageOff className="w-10 h-10 text-slate-300" />
          <p className="text-sm text-slate-500">Page {pageNum} image not available</p>
          <p className="text-xs text-slate-400">Run: <code className="bg-slate-100 px-1 rounded">npm run catalog:pages</code></p>
        </div>
      )}
      {imgLoaded && spots.map((spot, i) => {
        const isSelected = selectedHotspot?.sku === spot.sku;
        return (
          <div
            key={`${spot.sku}-${i}`}
            onClick={() => onHotspotClick(spot)}
            style={{
              position: 'absolute',
              left: `${spot.x * 100}%`,
              top: `${spot.y * 100}%`,
              width: `${spot.width * 100}%`,
              height: `${spot.height * 100}%`,
              cursor: 'pointer',
            }}
            className={`group border-2 rounded transition-all duration-150
              ${isSelected ? 'border-[#e2231a] bg-[#e2231a]/20' : 'border-transparent hover:border-[#e2231a]/60 hover:bg-[#e2231a]/10'}`}
            title={spot.name}
          >
            <div className={`absolute top-1 right-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <div className="bg-[#e2231a] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                <Plus className="w-2.5 h-2.5" />Add
              </div>
            </div>
            <div className={`absolute bottom-1 left-1 right-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <div className="bg-black/75 text-white text-[10px] px-1.5 py-1 rounded shadow-lg leading-tight line-clamp-2">
                {spot.name}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Hotspot Editor (drag to move/resize, add, delete) ───────────────────────
function HotspotEditor({ pageNum, spots, onChange, pageProducts, productCache }) {
  const containerRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [drag, setDrag] = useState(null);
  // drag = { type: 'move'|'resize'|'create', idx, startNX, startNY, origSpot, curSpot }
  const [adding, setAdding] = useState(false); // draw-new-box mode
  const [newSkuPrompt, setNewSkuPrompt] = useState(null); // { x, y, width, height }

  useEffect(() => { setImgLoaded(false); }, [pageNum]);

  const toNorm = (clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { nx: 0, ny: 0 };
    return {
      nx: clamp((clientX - rect.left) / rect.width),
      ny: clamp((clientY - rect.top) / rect.height),
    };
  };

  const onMouseDown = (e, type, idx) => {
    e.preventDefault();
    e.stopPropagation();
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    setDrag({ type, idx, startNX: nx, startNY: ny, origSpot: { ...spots[idx] } });
  };

  const onContainerMouseDown = (e) => {
    if (!adding) return;
    e.preventDefault();
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    setDrag({ type: 'create', startNX: nx, startNY: ny, curX: nx, curY: ny, curW: 0, curH: 0 });
  };

  const onMouseMove = (e) => {
    if (!drag) return;
    const { nx, ny } = toNorm(e.clientX, e.clientY);
    const dx = nx - drag.startNX;
    const dy = ny - drag.startNY;

    if (drag.type === 'create') {
      const x = drag.startNX < nx ? drag.startNX : nx;
      const y = drag.startNY < ny ? drag.startNY : ny;
      setDrag(d => ({ ...d, curX: x, curY: y, curW: Math.abs(nx - d.startNX), curH: Math.abs(ny - d.startNY) }));
      return;
    }

    const orig = drag.origSpot;
    let updated;
    if (drag.type === 'move') {
      updated = {
        ...orig,
        x: clamp(orig.x + dx, 0, 1 - orig.width),
        y: clamp(orig.y + dy, 0, 1 - orig.height),
      };
    } else { // resize
      updated = {
        ...orig,
        width: clamp(orig.width + dx, 0.02, 1 - orig.x),
        height: clamp(orig.height + dy, 0.02, 1 - orig.y),
      };
    }
    const newSpots = spots.map((s, i) => i === drag.idx ? updated : s);
    onChange(newSpots);
  };

  const onMouseUp = (e) => {
    if (!drag) return;
    if (drag.type === 'create') {
      const w = drag.curW || 0;
      const h = drag.curH || 0;
      if (w > 0.02 && h > 0.02) {
        setNewSkuPrompt({ x: drag.curX, y: drag.curY, width: w, height: h });
      }
      setAdding(false);
    }
    setDrag(null);
  };

  const deleteSpot = (idx) => onChange(spots.filter((_, i) => i !== idx));

  const commitNewSpot = (sku, name) => {
    if (!newSkuPrompt) return;
    const spot = { sku, name, ...newSkuPrompt, groupedSkus: [sku] };
    onChange([...spots, spot]);
    setNewSkuPrompt(null);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full select-none ${adding ? 'cursor-crosshair' : 'cursor-default'}`}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onMouseDown={onContainerMouseDown}
    >
      <img
        src={pageImageUrl(pageNum)}
        alt={`Page ${pageNum}`}
        className="w-full h-auto rounded-lg shadow-2xl block"
        onLoad={() => setImgLoaded(true)}
        draggable={false}
      />

      {imgLoaded && spots.map((spot, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${spot.x * 100}%`,
            top: `${spot.y * 100}%`,
            width: `${spot.width * 100}%`,
            height: `${spot.height * 100}%`,
          }}
          className="border-2 border-blue-500 bg-blue-500/10 rounded group"
        >
          {/* Move handle — drag the whole box */}
          <div
            className="absolute inset-0 cursor-move"
            onMouseDown={(e) => onMouseDown(e, 'move', i)}
          />

          {/* Label */}
          <div className="absolute top-0 left-0 right-0 bg-blue-600/90 text-white text-[9px] px-1 py-0.5 leading-tight truncate pointer-events-none rounded-t">
            {spot.name || spot.sku}
          </div>

          {/* Delete button */}
          <button
            className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center z-10 shadow"
            onMouseDown={(e) => { e.stopPropagation(); deleteSpot(i); }}
          >
            <X className="w-2.5 h-2.5" />
          </button>

          {/* Resize handle — bottom-right corner */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 bg-blue-600 rounded-tl cursor-se-resize z-10 flex items-center justify-center"
            onMouseDown={(e) => onMouseDown(e, 'resize', i)}
          >
            <div className="w-2 h-2 border-b-2 border-r-2 border-white" />
          </div>
        </div>
      ))}

      {/* Draw preview box while creating */}
      {drag?.type === 'create' && drag.curW > 0 && (
        <div
          style={{
            position: 'absolute',
            left: `${drag.curX * 100}%`,
            top: `${drag.curY * 100}%`,
            width: `${drag.curW * 100}%`,
            height: `${drag.curH * 100}%`,
          }}
          className="border-2 border-dashed border-green-500 bg-green-500/10 rounded pointer-events-none"
        />
      )}

      {/* Add instruction overlay */}
      {adding && !drag && (
        <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
            Click and drag to draw a hotspot box
          </div>
        </div>
      )}

      {/* SKU/Name prompt after drawing */}
      {newSkuPrompt && (
        <NewHotspotForm
          pageProducts={pageProducts}
          productCache={productCache}
          onConfirm={commitNewSpot}
          onCancel={() => setNewSkuPrompt(null)}
        />
      )}
    </div>
  );
}

function NewHotspotForm({ pageProducts, productCache, onConfirm, onCancel }) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');

  const selectProduct = (p) => {
    const pd = productCache[p.sku];
    setSku(p.sku);
    setName(pd?.name || p.name);
  };

  const submit = () => {
    if (!sku.trim()) return;
    onConfirm(sku.trim().toUpperCase(), name.trim() || sku.trim());
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 rounded-lg">
      <div className="bg-white rounded-2xl shadow-2xl w-80 p-4 space-y-3">
        <p className="text-sm font-bold text-slate-900">Assign Product to Hotspot</p>

        {pageProducts.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {pageProducts.map(p => (
              <button
                key={p.sku}
                onClick={() => selectProduct(p)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all
                  ${sku === p.sku ? 'border-[#e2231a] bg-[#e2231a]/10 font-bold' : 'border-slate-200 hover:border-[#e2231a]/40'}`}
              >
                <span className="text-slate-400 mr-2">{p.sku}</span>
                {productCache[p.sku]?.name || p.name}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <input
            placeholder="SKU (e.g. ONT-800/S-84)"
            value={sku}
            onChange={e => setSku(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
          />
          <input
            placeholder="Display name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
          />
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={submit} className="flex-1 bg-[#e2231a] hover:bg-[#b01b13] text-white">
            Add Hotspot
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Variant picker popup ─────────────────────────────────────────────────────
function VariantPicker({ spot, products, onAdd, onClose }) {
  const skus = spot.groupedSkus || [spot.sku];

  useEffect(() => {
    if (skus.length === 1) {
      const p = products[skus[0]];
      onAdd({ sku: skus[0], name: p?.name || spot.name, price: p?.base_price, imageUrl: getImageUrl(p) });
      onClose();
    }
  }, []);

  if (skus.length === 1) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-lg">
      <div className="bg-white rounded-2xl shadow-2xl w-80 max-h-[80%] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">{spot.name}</p>
            <p className="text-xs text-slate-500">Choose a size or variant</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="overflow-y-auto p-3 space-y-1.5">
          {skus.map(sku => {
            const p = products[sku];
            return (
              <button
                key={sku}
                onClick={() => { onAdd({ sku, name: p?.name || sku, price: p?.base_price, imageUrl: getImageUrl(p) }); onClose(); }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-[#e2231a]/40 hover:bg-[#e2231a]/5 transition-all text-left group"
              >
                <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-100">
                  <ProductImage src={getImageUrl(p)} alt={sku} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">{p?.name || sku}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{sku}</p>
                  {p?.base_price && <p className="text-xs font-bold text-[#e2231a]">{fmt(p.base_price)}</p>}
                </div>
                <Plus className="w-4 h-4 text-[#e2231a] opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Order Item ───────────────────────────────────────────────────────────────
function OrderItem({ item, onQtyChange, onRemove, onSizeChange }) {
  const total = item.price ? item.price * item.qty : null;
  const sizes = item.sizes?.length > 0 ? item.sizes : null;

  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100">
          <ProductImage src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-1" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">{item.name}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{item.sku}</p>
          {sizes && (
            <select
              className="mt-2 w-full text-xs border border-slate-200 rounded-md p-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#e2231a]"
              value={item.selectedSize || ''}
              onChange={(e) => onSizeChange(item.id, e.target.value)}
            >
              <option value="" disabled>Select Size...</option>
              {sizes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button onClick={() => onRemove(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 -mr-1 -mt-1">
            <X className="w-3.5 h-3.5" />
          </button>
          {total != null
            ? <p className="text-xs font-bold text-slate-800 mt-1">{fmt(total)}</p>
            : <p className="text-[10px] text-slate-400 italic mt-1">Quote</p>}
        </div>
      </div>
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100">
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Qty</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onQtyChange(item.id, -1)} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs font-bold w-6 text-center text-slate-700">{item.qty}</span>
          <button onClick={() => onQtyChange(item.id, 1)} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CatalogQuote() {
  const [currentPage, setCurrentPage] = useState(9);
  const [pageInput, setPageInput] = useState('9');
  const [direction, setDirection] = useState(1);
  const [hotspotData, setHotspotData] = useState({});
  const [dbHotspots, setDbHotspots] = useState({});
  const [editedHotspots, setEditedHotspots] = useState({}); // localStorage overrides
  const [orderItems, setOrderItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [searchSku, setSearchSku] = useState('');
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [showVariants, setShowVariants] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addingHotspot, setAddingHotspot] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);
  const { cache: productCache, fetchProduct } = useProductCache();

  // Load hotspot data + localStorage overrides
  useEffect(() => {
    getHotspots().then(setHotspotData);
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setEditedHotspots(JSON.parse(saved));
    } catch {}
    
    // Load from DB
    const loadDbHotspots = async () => {
      try {
        const res = await base44.entities.CatalogHotspot.list();
        const map = {};
        res.forEach(item => {
          map[item.page_number] = item.hotspots;
        });
        setDbHotspots(map);
      } catch (e) {
        console.error("Failed to load hotspots from DB", e);
      }
    };
    loadDbHotspots();
  }, []);

  const pageProducts = PAGE_PRODUCTS[currentPage] || [];

  // Effective hotspots: localStorage edits take priority over DB, then AI-generated
  const baseHotspots = hotspotData[currentPage] || [];
  const currentHotspots = editedHotspots[currentPage] ?? dbHotspots[currentPage] ?? baseHotspots;
  const hasHotspots = currentHotspots.length > 0;

  // Pre-fetch product details for all SKUs on current page
  useEffect(() => {
    const skus = new Set([
      ...pageProducts.map(p => p.sku),
      ...currentHotspots.flatMap(h => h.groupedSkus || [h.sku]),
    ]);
    skus.forEach(sku => fetchProduct(sku));
  }, [currentPage, currentHotspots, fetchProduct]);

  // Navigation
  const goToPage = useCallback((n) => {
    const p = Math.max(1, Math.min(n, MAX_PAGE));
    setDirection(p > currentPage ? 1 : -1);
    setCurrentPage(p);
    setPageInput(String(p));
    setSelectedHotspot(null);
    setShowVariants(false);
    setAddingHotspot(false);
  }, [currentPage]);

  const handlePageInput = (e) => {
    setPageInput(e.target.value);
    const n = parseInt(e.target.value);
    if (!isNaN(n) && n >= 1) goToPage(n);
  };

  const handleSkuSearch = () => {
    const sku = searchSku.trim().toUpperCase();
    const page = SKU_TO_PAGE[sku];
    if (page) { goToPage(page); setSearchSku(''); }
  };

  // Hotspot clicked (read mode)
  const handleHotspotClick = (spot) => {
    setSelectedHotspot(spot);
    const skus = spot.groupedSkus || [spot.sku];
    if (skus.length === 1) {
      const p = productCache[skus[0]];
      addToOrder({ sku: skus[0], name: p?.name || spot.name, price: p?.base_price, imageUrl: p?.image_cached_url || p?.image_url });
      setSelectedHotspot(null);
    } else {
      setShowVariants(true);
    }
  };

  // Hotspot edits (edit mode)
  const handleHotspotsChange = (newSpots) => {
    const updated = { ...editedHotspots, [currentPage]: newSpots };
    setEditedHotspots(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  const resetPageHotspots = () => {
    const updated = { ...editedHotspots };
    delete updated[currentPage];
    setEditedHotspots(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  const rerunWithClaude = async () => {
    if (pageProducts.length === 0) {
      alert('No products mapped to this page — nothing to detect.');
      return;
    }
    setIsRerunning(true);
    try {
      const spots = await detectHotspotsWithClaude(currentPage, pageProducts, SUPABASE_URL);
      handleHotspotsChange(spots);
      console.log(`Claude detected ${spots.length} hotspots on page ${currentPage}`);
    } catch (err) {
      console.error('Claude Vision failed:', err);
      alert(`AI detection failed: ${err.message}`);
    } finally {
      setIsRerunning(false);
    }
  };

  const exportHotspots = () => {
    // Merge edits over base data
    const merged = { ...hotspotData, ...editedHotspots };
    const json = JSON.stringify(merged, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'catalogHotspots.json';
    a.click();
  };

  const saveToDb = async () => {
    try {
      const existing = await base44.entities.CatalogHotspot.filter({ page_number: currentPage });
      if (existing.length > 0) {
        await base44.entities.CatalogHotspot.update(existing[0].id, { hotspots: currentHotspots });
      } else {
        await base44.entities.CatalogHotspot.create({ page_number: currentPage, hotspots: currentHotspots });
      }
      
      setDbHotspots(prev => ({ ...prev, [currentPage]: currentHotspots }));
      
      // Clear from editedHotspots since it's now in DB
      const updated = { ...editedHotspots };
      delete updated[currentPage];
      setEditedHotspots(updated);
      localStorage.setItem(LS_KEY, JSON.stringify(updated));
      
      alert('Saved to database successfully!');
    } catch (e) {
      console.error("Failed to save to DB", e);
      alert('Failed to save to database');
    }
  };

  // Order management
  const addToOrder = useCallback((product) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.sku === product.sku);
      if (existing) return prev.map(i => i.sku === product.sku ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, id: `${product.sku}-${Date.now()}`, qty: 1 }];
    });
  }, []);

  const handleQtyChange = (id, delta) =>
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  const handleRemove = (id) => setOrderItems(prev => prev.filter(i => i.id !== id));
  const handleSizeChange = useCallback((id, size) =>
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, selectedSize: size } : i)), []);

  // Totals
  const subtotal = orderItems.reduce((s, i) => s + (i.price ? i.price * i.qty : 0), 0);
  const hasQuoteItems = orderItems.some(i => !i.price);
  const itemCount = orderItems.reduce((s, i) => s + i.qty, 0);
  const isEdited = !!editedHotspots[currentPage];

  // Generate booth concept
  const handleGenerateImage = async () => {
    setIsGenerating(true);
    try {
      const imageUrls = orderItems.map(i => i.imageUrl).filter(Boolean);
      const productNames = orderItems.map(i => i.name).join(', ');
      const prompt = `A professional, high-quality 3D render of a trade show booth featuring the following products: ${productNames}. The booth should be set in a modern, brightly lit exhibition hall with a clean, neutral carpet. The products should be arranged logically to create an inviting space. Photorealistic, 8k resolution, architectural visualization.`;
      const res = await base44.integrations.Core.GenerateImage({
        prompt,
        existing_image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      });
      if (res?.url) setGeneratedImage(res.url);
    } catch (err) {
      console.error('Failed to generate image', err);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-[#e2231a] rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-bold text-slate-900 hidden sm:block">Catalog Quote</h1>
        </div>

        <input
          type="text"
          placeholder="Customer name..."
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-40 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
        />

        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="Find SKU..."
            value={searchSku}
            onChange={e => setSearchSku(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSkuSearch()}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-32 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
          />
          <button onClick={handleSkuSearch} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <Search className="w-4 h-4" />
          </button>
        </div>

        {/* Page nav */}
        <div className="flex-1 flex items-center justify-center gap-2">
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <span className="text-xs text-slate-500">Page</span>
            <input
              type="number" min={1} max={MAX_PAGE} value={pageInput}
              onChange={handlePageInput}
              className="w-14 text-center text-sm font-bold bg-transparent focus:outline-none"
            />
            <span className="text-xs text-slate-400">/ {MAX_PAGE}</span>
          </div>
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= MAX_PAGE}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
            <ChevronRight className="w-5 h-5" />
          </button>
          {hasHotspots && !editMode && (
            <Badge className="bg-[#e2231a]/10 text-[#e2231a] text-[10px] ml-1">
              {currentHotspots.length} clickable
            </Badge>
          )}
          {isEdited && <Badge className="bg-amber-100 text-amber-700 text-[10px] ml-1">edited</Badge>}
        </div>

        {/* Edit mode controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {editMode ? (
            <>
              <button
                onClick={() => setAddingHotspot(a => !a)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                  ${addingHotspot ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <Plus className="w-3.5 h-3.5" />
                {addingHotspot ? 'Drawing...' : 'Add Box'}
              </button>
              {isEdited && (
                <button onClick={resetPageHotspots} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset Page
                </button>
              )}
              <button
                onClick={rerunWithClaude}
                disabled={isRerunning || pageProducts.length === 0}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 disabled:opacity-40 transition-all"
              >
                {isRerunning
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Detecting...</>
                  : <><RefreshCw className="w-3.5 h-3.5" />Re-run AI</>}
              </button>
              <button onClick={exportHotspots} className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 transition-all">
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </button>
              <button
                onClick={saveToDb}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-green-600 bg-green-50 hover:bg-green-100 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                Save to DB
              </button>
              <button
                onClick={() => { setEditMode(false); setAddingHotspot(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
              >
                <X className="w-3.5 h-3.5" />
                Close
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Hotspots
            </button>
          )}
        </div>

        {itemCount > 0 && (
          <div className="flex items-center gap-1.5 bg-[#e2231a] text-white px-3 py-1 rounded-full text-xs font-bold flex-shrink-0">
            <ShoppingCart className="w-3.5 h-3.5" />
            {itemCount}
          </div>
        )}
      </div>

      {/* ── 3-column body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Live Quote Totaler */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col items-center justify-center p-6 relative">
          <div className="absolute top-0 left-0 right-0 p-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide text-center">Order Total</h2>
            {customerName && <p className="text-[11px] text-slate-500 mt-0.5 truncate text-center">{customerName}</p>}
          </div>

          <div className="mt-12 text-center w-full">
            <div className="text-4xl font-black text-slate-900 mb-2">
              {subtotal > 0 ? fmt(subtotal) : hasQuoteItems ? 'TBD' : '$0.00'}
            </div>
            <p className="text-sm text-slate-500 mb-6">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>

            {orderItems.length > 0 && (
              <div className="text-left space-y-1 mb-6 max-h-40 overflow-y-auto">
                {orderItems.map(item => (
                  <div key={item.id} className="flex items-center gap-1.5 py-1 border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-slate-700 truncate">{item.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono">{item.sku} x{item.qty}</p>
                    </div>
                    <p className="text-[10px] font-bold text-slate-800 flex-shrink-0">
                      {item.price ? fmt(item.price * item.qty) : '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Button
              size="lg"
              className="w-full bg-[#e2231a] hover:bg-[#b01b13] text-white py-6 text-base font-bold shadow-lg"
              disabled={orderItems.length === 0 || isGenerating}
              onClick={handleGenerateImage}
            >
              {isGenerating
                ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</>
                : 'Generate Booth Concept'}
            </Button>

            {orderItems.length > 0 && (
              <button onClick={() => setOrderItems([])} className="w-full text-xs text-slate-400 hover:text-red-500 transition-colors mt-4 py-2">
                Clear all items
              </button>
            )}
          </div>
        </div>

        {/* CENTER: Catalog Page */}
        <div className="flex-1 overflow-auto p-4 flex justify-center">
          <div className="relative w-full max-w-2xl">
            {editMode ? (
              // ── Edit mode: draggable hotspot editor ──
              <HotspotEditor
                pageNum={currentPage}
                spots={currentHotspots}
                onChange={handleHotspotsChange}
                pageProducts={pageProducts}
                productCache={productCache}
                adding={addingHotspot}
                onAddingChange={setAddingHotspot}
              />
            ) : (
              // ── Normal mode: clickable hotspot overlays ──
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentPage}
                  custom={direction}
                  initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  <CatalogPageView
                    pageNum={currentPage}
                    hotspots={currentHotspots}
                    onHotspotClick={handleHotspotClick}
                    selectedHotspot={selectedHotspot}
                  />
                </motion.div>
              </AnimatePresence>
            )}

            {/* Variant picker popup */}
            {!editMode && showVariants && selectedHotspot && (
              <VariantPicker
                spot={selectedHotspot}
                products={productCache}
                onAdd={addToOrder}
                onClose={() => { setShowVariants(false); setSelectedHotspot(null); }}
              />
            )}

            {/* Fallback product chips when no hotspots */}
            {!editMode && !hasHotspots && pageProducts.length > 0 && (
              <div className="mt-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                  <p className="text-xs text-amber-700 font-medium">
                    No hotspots for this page — click a product to add it
                  </p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  {pageProducts.map(p => {
                    const pd = productCache[p.sku];
                    return (
                      <button
                        key={p.sku}
                        onClick={() => addToOrder({ sku: p.sku, name: pd?.name || p.name, price: pd?.base_price, imageUrl: getImageUrl(pd) })}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-[#e2231a]/40 hover:bg-[#e2231a]/5 text-left transition-all group"
                      >
                        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                          <ProductImage src={getImageUrl(pd)} alt={p.name} fallbackClassName="w-4 h-4 text-slate-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{pd?.name || p.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono">{p.sku}</p>
                          {pd?.base_price && <p className="text-xs font-bold text-[#e2231a]">{fmt(pd.base_price)}</p>}
                        </div>
                        <Plus className="w-4 h-4 text-[#e2231a] opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Order Items */}
        <div className="w-72 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#e2231a]" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Added to Order</span>
              {itemCount > 0 && (
                <Badge className="ml-auto bg-[#e2231a] text-white text-[10px] px-1.5 py-0 h-4">{itemCount}</Badge>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {orderItems.length === 0 ? (
              <div className="text-center py-10">
                <ShoppingCart className="w-7 h-7 text-slate-200 mx-auto mb-2" />
                <p className="text-[11px] text-slate-400">Order is empty</p>
                <p className="text-[10px] text-slate-300 mt-1">Click products on the catalog pages to add</p>
              </div>
            ) : orderItems.map(item => (
              <OrderItem
                key={item.id}
                item={item}
                onQtyChange={handleQtyChange}
                onRemove={handleRemove}
                onSizeChange={handleSizeChange}
              />
            ))}
          </div>

          {orderItems.length > 0 && (
            <div className="p-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Subtotal</span>
                <span className="text-sm font-black text-slate-900">{subtotal > 0 ? fmt(subtotal) : 'Quote'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Generated Image Modal */}
      {generatedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
          <div className="bg-white rounded-2xl overflow-hidden max-w-5xl w-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800">Generated Booth Concept</h2>
              <button onClick={() => setGeneratedImage(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 bg-slate-100 flex items-center justify-center">
              <img src={generatedImage} alt="Generated Booth" className="max-w-full max-h-[70vh] rounded-lg shadow-md object-contain" />
            </div>
            <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <Button variant="outline" onClick={() => setGeneratedImage(null)}>Close</Button>
              <Button className="bg-[#e2231a] hover:bg-[#b01b13] text-white" onClick={() => {
                const a = document.createElement('a');
                a.href = generatedImage;
                a.download = 'booth-concept.png';
                a.click();
              }}>Download Image</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}