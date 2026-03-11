import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
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
import SessionStartModal from '@/components/catalog/SessionStartModal';
import QuoteSidebar from '@/components/catalog/QuoteSidebar';
import QuoteConfirmModal from '@/components/catalog/QuoteConfirmModal';

// ─── Claude Vision: detect product within a specific bounding box ─────────────
async function detectProductInBox(pageNum, box, supabaseUrl) {
  const imageUrl = `${supabaseUrl}/catalog/pages/page-${String(pageNum + 2).padStart(3, '0')}.jpg`;

  const prompt = `This is page ${pageNum} of the Orbus Exhibitor's Handbook trade show display catalog.

I've selected a region of the page at approximately:
- Left: ${(box.x * 100).toFixed(0)}% from left
- Top: ${(box.y * 100).toFixed(0)}% from top
- Width: ${(box.width * 100).toFixed(0)}% of page width
- Height: ${(box.height * 100).toFixed(0)}% of page height

Look at that specific region of the catalog page and identify the product(s) shown there.
Return the primary SKU code(s) exactly as printed (e.g. "FX-2700", "HPN-3020/S"), and the product name.
If multiple size variants share one image, list all SKUs in groupedSkus.
If you cannot identify a SKU, return an empty string for sku.`;

  const response = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [imageUrl],
    model: "claude_sonnet_4_6",
    response_json_schema: {
      type: "object",
      properties: {
        sku: { type: "string" },
        name: { type: "string" },
        groupedSkus: { type: "array", items: { type: "string" } }
      },
      required: ["sku", "name", "groupedSkus"]
    }
  });

  return {
    sku: response.sku || '',
    name: response.name || '',
    groupedSkus: Array.isArray(response.groupedSkus) && response.groupedSkus.length > 0
      ? response.groupedSkus
      : response.sku ? [response.sku] : [],
  };
}

// ─── Claude Vision hotspot detection (runs via backend integration) ───────────────────────
async function detectHotspotsWithClaude(pageNum, products, supabaseUrl) {
  const imageUrl = `${supabaseUrl}/catalog/pages/page-${String(pageNum + 2).padStart(3, '0')}.jpg`;

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

  // Handle LLM sometimes wrapping result in an extra "response" key
  const hotspots = response?.hotspots ?? response?.response?.hotspots ?? [];
  if (!Array.isArray(hotspots)) {
    console.warn('[Re-run AI] Unexpected response shape:', response);
    return [];
  }
  return hotspots.map(item => ({
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
// Catalog print pages (1–218) are stored in Supabase as PDF page numbers (print + 2).
// page-007.jpg in the catalog = page-009.jpg in Supabase.
const CATALOG_PAGE_OFFSET = 2;

function pageImageUrl(printPageNum) {
  const pdfPage = printPageNum + CATALOG_PAGE_OFFSET;
  return `${SUPABASE_URL}/catalog/pages/page-${String(pdfPage).padStart(3, '0')}.jpg`;
}

function fmt(n) {
  if (!n && n !== 0) return null;
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clamp(v, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, v)); }

function getImageUrl(p) {
  if (!p) return null;
  let url = p.primary_image_url || p.image_cached_url || p.image_url || p.thumbnail_url;
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

// ─── Load hotspot data lazily (JSON fallback only) ───────────────────────────
let _hotspots = null;
async function getHotspots() {
  if (_hotspots) return _hotspots;
  try {
    const mod = await import('@/data/catalogHotspots.json');
    _hotspots = mod.default;
  } catch { _hotspots = {}; }
  return _hotspots;
}

// ─── Load ALL DB hotspots in one shot ────────────────────────────────────────
async function loadAllDbHotspots() {
  try {
    const res = await base44.entities.CatalogHotspot.list('page_number', 500);
    const map = {};
    res.forEach(item => { map[item.page_number] = item.hotspots; });
    return map;
  } catch { return {}; }
}

// ─── Hook: product detail cache ──────────────────────────────────────────────
function useProductCache() {
  const cache = useRef({});
  const [tick, setTick] = useState(0);

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

      // Try Supabase storage for image — check product folder directly first, then /image subfolder
      if (prod && !prod.image_cached_url && !prod.image_url) {
        try {
          const imgRes = await base44.functions.invoke('listSupabaseAssets', { path: `products/${sku}` });
          if (imgRes.data?.files?.length > 0) {
            const imgFile = imgRes.data.files.find(f => f.name.match(/\.(png|jpe?g|gif|webp)$/i));
            if (imgFile) prod.image_url = imgFile.publicUrl;
          }
          if (!prod.image_url) {
            const imgRes2 = await base44.functions.invoke('listSupabaseAssets', { path: `products/${sku}/image` });
            if (imgRes2.data?.files?.length > 0) {
              const imgFile = imgRes2.data.files.find(f => f.name.match(/\.(png|jpe?g|gif|webp)$/i));
              if (imgFile) prod.image_url = imgFile.publicUrl;
            }
          }
        } catch { /* no image in storage, fallback to icon */ }
      }

      cache.current[sku] = prod;
    } catch {
      cache.current[sku] = { sku, name: sku };
    }
    setTick(t => t + 1);
  }, []);

  return { cache: cache.current, fetchProduct, tick };
}

// ─── Normal catalog page view (read-only hotspot overlays) ───────────────────
function CatalogPageView({ pageNum, hotspots, onHotspotClick, selectedHotspot }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => { setImgLoaded(false); setImgError(false); }, [pageNum]);

  const spots = hotspots || [];

  return (
    <div className="relative inline-block">
      <img
        src={pageImageUrl(pageNum)}
        alt={`Catalog page ${pageNum}`}
        className="block rounded-lg shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 130px)', width: 'auto', maxWidth: '100%' }}
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

// ─── Edit Hotspot Dialog (double-click to fix SKU/name) ──────────────────────
function EditHotspotDialog({ spot, pageProducts, productCache, onSave, onCancel }) {
  const [displayName, setDisplayName] = useState(spot.name || '');
  const [groupedSkus, setGroupedSkus] = useState(spot.groupedSkus?.length > 0 ? [...spot.groupedSkus] : [spot.sku]);
  const [skuInput, setSkuInput] = useState('');

  const togglePageProduct = (p) => {
    const s = p.sku;
    if (groupedSkus.includes(s)) {
      setGroupedSkus(prev => prev.filter(x => x !== s));
    } else {
      setGroupedSkus(prev => [...prev, s]);
      if (!displayName) setDisplayName(productCache[s]?.name || p.name);
    }
  };

  const addManualSku = () => {
    const s = skuInput.trim().toUpperCase();
    if (!s || groupedSkus.includes(s)) { setSkuInput(''); return; }
    setGroupedSkus(prev => [...prev, s]);
    if (!displayName) setDisplayName(s);
    setSkuInput('');
  };

  const removeSku = (s) => setGroupedSkus(prev => prev.filter(x => x !== s));

  const submit = () => {
    if (groupedSkus.length === 0) return;
    onSave({ ...spot, sku: groupedSkus[0], name: displayName.trim() || groupedSkus[0], groupedSkus });
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 rounded-lg">
      <div className="bg-white rounded-2xl shadow-2xl w-96 p-4 space-y-3 max-h-[90%] overflow-y-auto">
        <p className="text-sm font-bold text-slate-900">Edit Hotspot</p>

        {pageProducts.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Page Products</p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {pageProducts.map(p => {
                const checked = groupedSkus.includes(p.sku);
                return (
                  <button key={p.sku} onClick={() => togglePageProduct(p)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all flex items-center gap-2
                      ${checked ? 'border-[#e2231a] bg-[#e2231a]/10 font-bold' : 'border-slate-200 hover:border-[#e2231a]/40'}`}>
                    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${checked ? 'bg-[#e2231a] border-[#e2231a]' : 'border-slate-300'}`}>
                      {checked && <span className="text-white text-[8px] font-bold">✓</span>}
                    </div>
                    <span className="text-slate-400 font-mono mr-1">{p.sku}</span>
                    <span className="truncate">{productCache[p.sku]?.name || p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Add / Fix SKU</p>
          <div className="flex gap-1.5">
            <input placeholder="e.g. FX-2700" value={skuInput}
              onChange={e => setSkuInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addManualSku()}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30" />
            <Button size="sm" onClick={addManualSku} className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {groupedSkus.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">SKUs ({groupedSkus.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {groupedSkus.map(s => (
                <div key={s} className="flex items-center gap-1 bg-[#e2231a]/10 border border-[#e2231a]/30 text-[#e2231a] rounded-full px-2.5 py-1 text-[10px] font-bold">
                  {s}
                  <button onClick={() => removeSku(s)} className="hover:text-red-700 ml-0.5"><X className="w-2.5 h-2.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        <input placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30" />

        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={groupedSkus.length === 0}
            className="flex-1 bg-[#e2231a] hover:bg-[#b01b13] text-white disabled:opacity-50">
            Save Changes
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Hotspot Editor (drag to move/resize, add, delete, double-click to edit) ──
function HotspotEditor({ pageNum, spots, onChange, pageProducts, productCache, adding = false, onAddingChange }) {
  const containerRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [drag, setDrag] = useState(null);
  // drag = { type: 'move'|'resize'|'create', idx, startNX, startNY, origSpot, curSpot }
  const setAdding = (val) => onAddingChange?.(typeof val === 'function' ? val(adding) : val);
  const [newSkuPrompt, setNewSkuPrompt] = useState(null); // { x, y, width, height }
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetected, setAutoDetected] = useState(null); // { sku, name, groupedSkus }
  const [editingSpot, setEditingSpot] = useState(null); // { idx, spot }

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

  const onMouseUp = async (e) => {
    if (!drag) return;
    if (drag.type === 'create') {
      const w = drag.curW || 0;
      const h = drag.curH || 0;
      if (w > 0.02 && h > 0.02) {
        const box = { x: drag.curX, y: drag.curY, width: w, height: h };
        setNewSkuPrompt(box);
        setAutoDetected(null);
        // Auto-detect product in this box region
        setAutoDetecting(true);
        try {
          const result = await detectProductInBox(pageNum, box, SUPABASE_URL);
          setAutoDetected(result);
        } catch { /* fallback to manual entry */ }
        finally { setAutoDetecting(false); }
      }
      setAdding(false);
    }
    setDrag(null);
  };

  const deleteSpot = (idx) => onChange(spots.filter((_, i) => i !== idx));

  const handleDoubleClick = (e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSpot({ idx, spot: { ...spots[idx] } });
  };

  const commitEditedSpot = (updatedSpot) => {
    if (!editingSpot) return;
    onChange(spots.map((s, i) => i === editingSpot.idx ? updatedSpot : s));
    setEditingSpot(null);
  };

  const commitNewSpot = (sku, name, groupedSkus) => {
    if (!newSkuPrompt) return;
    const spot = { sku, name, ...newSkuPrompt, groupedSkus: groupedSkus?.length > 0 ? groupedSkus : [sku] };
    onChange([...spots, spot]);
    setNewSkuPrompt(null);
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block select-none ${adding ? 'cursor-crosshair' : 'cursor-default'}`}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onMouseDown={onContainerMouseDown}
    >
      <img
        src={pageImageUrl(pageNum)}
        alt={`Page ${pageNum}`}
        className="block rounded-lg shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 130px)', width: 'auto', maxWidth: '100%' }}
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
          {/* Move handle — drag the whole box, double-click to edit */}
          <div
            className="absolute inset-0 cursor-move"
            onMouseDown={(e) => onMouseDown(e, 'move', i)}
            onDoubleClick={(e) => handleDoubleClick(e, i)}
          />

          {/* Label */}
          <div className="absolute top-0 left-0 right-0 bg-blue-600/90 text-white text-[9px] px-1 py-0.5 leading-tight truncate pointer-events-none rounded-t flex items-center gap-1">
            <span className="truncate">{spot.name || spot.sku}</span>
            <span className="opacity-50 ml-auto flex-shrink-0">✎</span>
          </div>

          {/* Delete button */}
          <button
            className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center z-10 shadow"
            onMouseDown={(e) => { e.stopPropagation(); deleteSpot(i); }}
          >
            <X className="w-2.5 h-2.5" />
          </button>

          {/* Edit button (double click hint) */}
          <div className="absolute bottom-0 left-0 right-0 bg-blue-800/70 text-white text-[8px] px-1 py-0.5 text-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            double-click to edit
          </div>

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
          autoDetecting={autoDetecting}
          autoDetected={autoDetected}
          onConfirm={(sku, name, groupedSkus) => { commitNewSpot(sku, name, groupedSkus); setAutoDetected(null); }}
          onCancel={() => { setNewSkuPrompt(null); setAutoDetected(null); }}
        />
      )}

      {/* Double-click edit dialog */}
      {editingSpot && (
        <EditHotspotDialog
          spot={editingSpot.spot}
          pageProducts={pageProducts}
          productCache={productCache}
          onSave={commitEditedSpot}
          onCancel={() => setEditingSpot(null)}
        />
      )}
    </div>
  );
}

function NewHotspotForm({ pageProducts, productCache, autoDetecting, autoDetected, onConfirm, onCancel }) {
  const [displayName, setDisplayName] = useState('');
  const [groupedSkus, setGroupedSkus] = useState([]);
  const [skuInput, setSkuInput] = useState('');

  // When auto-detection completes, pre-fill
  useEffect(() => {
    if (autoDetected && autoDetected.sku) {
      setDisplayName(autoDetected.name || autoDetected.sku);
      setGroupedSkus(autoDetected.groupedSkus?.length > 0 ? autoDetected.groupedSkus : [autoDetected.sku]);
    }
  }, [autoDetected]);

  const togglePageProduct = (p) => {
    const s = p.sku;
    if (groupedSkus.includes(s)) {
      setGroupedSkus(prev => prev.filter(x => x !== s));
    } else {
      setGroupedSkus(prev => [...prev, s]);
      if (!displayName) setDisplayName(productCache[s]?.name || p.name);
    }
  };

  const addManualSku = () => {
    const s = skuInput.trim().toUpperCase();
    if (!s || groupedSkus.includes(s)) { setSkuInput(''); return; }
    setGroupedSkus(prev => [...prev, s]);
    setSkuInput('');
  };

  const removeSku = (s) => setGroupedSkus(prev => prev.filter(x => x !== s));

  const submit = () => {
    if (groupedSkus.length === 0) return;
    onConfirm(groupedSkus[0], displayName.trim() || groupedSkus[0], groupedSkus);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 rounded-lg">
      <div className="bg-white rounded-2xl shadow-2xl w-96 p-4 space-y-3 max-h-[90%] overflow-y-auto">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-900 flex-1">Assign SKUs to Hotspot</p>
          {autoDetecting && (
            <div className="flex items-center gap-1.5 text-purple-600 text-[10px] font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />AI detecting...
            </div>
          )}
          {!autoDetecting && autoDetected?.sku && (
            <span className="text-green-600 text-[10px] font-medium">✓ AI detected</span>
          )}
        </div>

        {autoDetecting && (
          <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5 text-xs text-purple-700">
            Reading SKUs from the selected area…
          </div>
        )}

        {/* Page product checkboxes */}
        {!autoDetecting && pageProducts.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Page Products — click to toggle</p>
            <div className="space-y-1 max-h-36 overflow-y-auto">
              {pageProducts.map(p => {
                const checked = groupedSkus.includes(p.sku);
                return (
                  <button
                    key={p.sku}
                    onClick={() => togglePageProduct(p)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all flex items-center gap-2
                      ${checked ? 'border-[#e2231a] bg-[#e2231a]/10 font-bold' : 'border-slate-200 hover:border-[#e2231a]/40'}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${checked ? 'bg-[#e2231a] border-[#e2231a]' : 'border-slate-300'}`}>
                      {checked && <span className="text-white text-[8px] font-bold">✓</span>}
                    </div>
                    <span className="text-slate-400 font-mono mr-1">{p.sku}</span>
                    <span className="truncate">{productCache[p.sku]?.name || p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Manual SKU entry */}
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Add SKU Manually</p>
          <div className="flex gap-1.5">
            <input
              placeholder="e.g. FX-2700"
              value={skuInput}
              onChange={e => setSkuInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addManualSku()}
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
            />
            <Button size="sm" onClick={addManualSku} className="bg-slate-100 text-slate-700 hover:bg-slate-200 px-3">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Selected SKUs */}
        {groupedSkus.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Selected SKUs ({groupedSkus.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {groupedSkus.map(s => (
                <div key={s} className="flex items-center gap-1 bg-[#e2231a]/10 border border-[#e2231a]/30 text-[#e2231a] rounded-full px-2.5 py-1 text-[10px] font-bold">
                  {s}
                  <button onClick={() => removeSku(s)} className="hover:text-red-700 ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Display name */}
        <input
          placeholder="Hotspot display name"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
        />

        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={autoDetecting || groupedSkus.length === 0} className="flex-1 bg-[#e2231a] hover:bg-[#b01b13] text-white disabled:opacity-50">
            Add Hotspot ({groupedSkus.length} SKU{groupedSkus.length !== 1 ? 's' : ''})
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Variant picker popup ─────────────────────────────────────────────────────
function VariantPicker({ spot, products, fetchProduct, onAdd, onClose, hasSession, onStartSession }) {
  const skus = spot.groupedSkus?.length > 0 ? spot.groupedSkus : [spot.sku];

  // Ensure all variant SKUs are fetched
  useEffect(() => {
    skus.forEach(sku => fetchProduct(sku));
  }, [spot]);

  useEffect(() => {
    if (skus.length === 1 && hasSession) {
      const p = products[skus[0]];
      // Wait until product is loaded (not null placeholder)
      if (p !== null && p !== undefined) {
        onAdd({ sku: skus[0], name: p?.name || spot.name, price: p?.base_price, imageUrl: getImageUrl(p) });
        onClose();
      }
    }
  }, [products[skus[0]]]);

  if (skus.length === 1) {
    const p = products[skus[0]];
    if (!p) return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-lg">
        <div className="bg-white rounded-2xl p-6 flex items-center gap-3 shadow-xl">
          <Loader2 className="w-5 h-5 animate-spin text-[#e2231a]" />
          <span className="text-sm text-slate-600">Loading product...</span>
        </div>
      </div>
    );
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-lg">
      <div className="bg-white rounded-2xl shadow-2xl w-80 max-h-[80%] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">{spot.name}</p>
            <p className="text-xs text-slate-500">{skus.length > 1 ? 'Choose a size or variant' : 'Product details'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        {!hasSession && (
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-700">Start a quote session to add items.</p>
            <button onClick={onStartSession} className="text-xs font-bold text-[#e2231a] hover:underline whitespace-nowrap">Start Session →</button>
          </div>
        )}
        <div className="overflow-y-auto p-3 space-y-1.5">
          {skus.map(sku => {
            const p = products[sku];
            const imgSrc = getImageUrl(p);
            return (
              <button
                key={sku}
                onClick={() => { if (hasSession) { onAdd({ sku, name: p?.name || sku, price: p?.base_price, imageUrl: imgSrc }); onClose(); } else { onStartSession(); } }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-[#e2231a]/40 hover:bg-[#e2231a]/5 transition-all text-left group"
              >
                <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-100">
                  {p === null ? (
                    <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                  ) : (
                    <ProductImage src={imgSrc} alt={sku} className="w-full h-full object-contain p-1" fallbackClassName="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">{p?.name || sku}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{sku}</p>
                  {p?.base_price && <p className="text-xs font-bold text-[#e2231a] mt-0.5">{fmt(p.base_price)}</p>}
                </div>
                {hasSession && <Plus className="w-4 h-4 text-[#e2231a] opacity-0 group-hover:opacity-100 flex-shrink-0" />}
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
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(9);
  const [pageInput, setPageInput] = useState('9');
  const [direction, setDirection] = useState(1);
  const [hotspotData, setHotspotData] = useState({});
  const [dbHotspots, setDbHotspots] = useState({});
  const [editedHotspots, setEditedHotspots] = useState({});
  const [searchSku, setSearchSku] = useState('');
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [showVariants, setShowVariants] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addingHotspot, setAddingHotspot] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);
  const { cache: productCache, fetchProduct, tick } = useProductCache();

  // ── Session / Quote state ─────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setShowSessionModal(true); }).catch(() => setShowSessionModal(true));
  }, []);

  // ── Line items loader ────────────────────────────────────────────────────
  const refreshLineItems = useCallback(async () => {
    if (!activeOrder) return;
    const items = await base44.entities.LineItem.filter({ order_id: activeOrder.id });
    setLineItems(items || []);
  }, [activeOrder]);

  useEffect(() => { refreshLineItems(); }, [refreshLineItems]);

  const handleSessionComplete = async (order) => {
    setActiveOrder(order);
    setShowSessionModal(false);
  };

  const handleAddToQuote = useCallback(async (product) => {
    if (!activeOrder) return;
    const { sku, name, price, imageUrl } = product;
    const existing = lineItems.find(i => i.sku === sku);
    if (existing) {
      const newQty = (existing.quantity || 1) + 1;
      await base44.entities.LineItem.update(existing.id, {
        quantity: newQty,
        total_price: parseFloat((newQty * (existing.unit_price || 0)).toFixed(2)),
      });
    } else {
      let unitPrice = price;
      let resolvedImageUrl = imageUrl;
      if (!unitPrice || !resolvedImageUrl) {
        const prods = await base44.entities.Product.filter({ sku });
        if (prods?.length > 0) {
          unitPrice = unitPrice || prods[0].base_price || 0;
          resolvedImageUrl = resolvedImageUrl || getImageUrl(prods[0]);
        }
      }
      await base44.entities.LineItem.create({
        order_id: activeOrder.id,
        sku: sku || '',
        product_name: name || sku || '',
        category: '',
        quantity: 1,
        unit_price: parseFloat((unitPrice || 0).toFixed(2)),
        total_price: parseFloat((unitPrice || 0).toFixed(2)),
        image_url: resolvedImageUrl || '',
      });
    }
    refreshLineItems();
  }, [activeOrder, lineItems, refreshLineItems]);

  const handleCreateQuote = async () => {
    if (!activeOrder || lineItems.length === 0) return;
    const quoted_price = parseFloat(lineItems.reduce((s, i) => s + (i.total_price || 0), 0).toFixed(2));
    const share_token = crypto.randomUUID();
    const updated = await base44.entities.Order.update(activeOrder.id, {
      status: 'Quoted',
      quoted_price,
      final_price: quoted_price,
      share_token,
    });
    setActiveOrder({ ...activeOrder, ...updated, share_token, quoted_price });
    setShowConfirmModal(true);
  };

  // Load hotspot data + localStorage overrides + DB (DB takes priority)
  useEffect(() => {
    // Load JSON fallback and DB hotspots in parallel
    Promise.all([getHotspots(), loadAllDbHotspots()]).then(([jsonData, dbData]) => {
      setHotspotData(jsonData);
      setDbHotspots(dbData);
    });
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) setEditedHotspots(JSON.parse(saved));
    } catch {}
  }, []);

  const refreshFromDb = async () => {
    setIsSyncing(true);
    setSyncMsg(null);
    try {
      const dbData = await loadAllDbHotspots();
      const pageCount = Object.keys(dbData).length;
      setDbHotspots(dbData);
      setEditedHotspots({});
      localStorage.removeItem(LS_KEY);
      setSyncMsg(`Synced ${pageCount} pages from database`);
      setTimeout(() => setSyncMsg(null), 3000);
    } catch (e) {
      setSyncMsg('Sync failed — check connection');
      setTimeout(() => setSyncMsg(null), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Shift ALL DB hotspot page numbers by offset (runs in browser, no timeout)
  const shiftAllPageNumbers = async (offset) => {
    if (!window.confirm(`This will shift ALL hotspot page numbers by ${offset > 0 ? '+' : ''}${offset}. This cannot be undone. Continue?`)) return;
    const all = await base44.entities.CatalogHotspot.list('page_number', 500);
    let done = 0;
    for (const record of all) {
      const newPage = record.page_number + offset;
      if (newPage < 1) continue;
      await base44.entities.CatalogHotspot.update(record.id, { page_number: newPage });
      done++;
    }
    alert(`Done! Shifted ${done} records by ${offset}.`);
    await refreshFromDb();
  };

  const pageProducts = PAGE_PRODUCTS[currentPage] || [];

  // Effective hotspots: localStorage edits > DB > JSON fallback
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
    if (page) { goToPage(page); setSearchSku(''); setShowSearchDropdown(false); }
  };

  const handleProductSearch = async (query) => {
    setSearchSku(query);
    if (!query || query.length < 2) { setSearchResults([]); setShowSearchDropdown(false); return; }
    try {
      const [byName, bySku, byCategory] = await Promise.all([
        base44.entities.Product.filter({ name: query }),
        base44.entities.Product.filter({ sku: query.toUpperCase() }),
        base44.entities.Product.filter({ category: query }),
      ]);
      const combined = [...(byName || []), ...(bySku || []), ...(byCategory || [])];
      const unique = combined.filter((v, i, a) => a.findIndex(x => x.id === v.id) === i).slice(0, 12);
      setSearchResults(unique);
      setShowSearchDropdown(unique.length > 0);
    } catch { setShowSearchDropdown(false); }
  };

  const handleSearchResultClick = (product) => {
    if (product.catalog_pages?.length > 0) {
      goToPage(product.catalog_pages[0]);
    } else if (SKU_TO_PAGE[product.sku]) {
      goToPage(SKU_TO_PAGE[product.sku]);
    }
    setSearchSku('');
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  // Hotspot clicked (read mode)
  const handleHotspotClick = async (spot) => {
    setSelectedHotspot(spot);
    const skus = spot.groupedSkus?.length > 0 ? spot.groupedSkus : [spot.sku];
    // Always show variant picker so the user can see the product and add to quote
    // (for single-SKU spots the picker auto-adds; for multi-SKU it shows options)
    if (skus.length === 1 && activeOrder) {
      // Single SKU + active session: add immediately
      const sku = skus[0];
      await fetchProduct(sku);
      const p = productCache[sku];
      await handleAddToQuote({ sku, name: p?.name || spot.name, price: p?.base_price, imageUrl: getImageUrl(p) });
      setSelectedHotspot(null);
    } else {
      // Multi-SKU OR no active session: show picker
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
    console.log('[Re-run AI] Starting for page', currentPage, 'products:', pageProducts.length);
    setIsRerunning(true);
    try {
      const spots = await detectHotspotsWithClaude(currentPage, pageProducts, SUPABASE_URL);
      console.log('[Re-run AI] Got', spots.length, 'hotspots');
      if (spots.length === 0) {
        alert('AI returned 0 hotspots for this page. Check console for details.');
      }
      handleHotspotsChange(spots);
    } catch (err) {
      console.error('[Re-run AI] Failed:', err);
      alert(`AI detection failed: ${err?.message || String(err)}`);
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

  const isEdited = !!editedHotspots[currentPage];



  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Session Start Modal */}
      {showSessionModal && (
        <SessionStartModal user={user} onComplete={handleSessionComplete} onDismiss={() => setShowSessionModal(false)} />
      )}

      {/* Quote Confirm Modal */}
      {showConfirmModal && activeOrder && (
        <QuoteConfirmModal
          order={activeOrder}
          lineItems={lineItems}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-[#e2231a] rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-bold text-slate-900 hidden sm:block">Catalog Quote</h1>
        </div>

        {activeOrder && (
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 rounded-lg px-2.5 py-1 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
            {activeOrder.customer_name || activeOrder.customer_email} · {activeOrder.show_name}
          </div>
        )}

        <div className="flex items-center gap-1 relative" ref={searchRef}>
          <div className="relative">
            <input
              type="text"
              placeholder="Search name, SKU, category..."
              value={searchSku}
              onChange={e => handleProductSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSkuSearch()}
              onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-52 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
            />
            <button onClick={handleSkuSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
          {showSearchDropdown && (
            <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
              {searchResults.map(p => (
                <button
                  key={p.id}
                  onMouseDown={() => handleSearchResultClick(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{p.sku} · {p.category}</p>
                  </div>
                  {(p.catalog_pages?.[0] || SKU_TO_PAGE[p.sku]) && (
                    <span className="text-[10px] text-[#e2231a] font-bold flex-shrink-0">
                      p.{p.catalog_pages?.[0] || SKU_TO_PAGE[p.sku]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
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



        {lineItems.length > 0 && (
          <div className="flex items-center gap-1.5 bg-[#e2231a]/15 text-[#e2231a] px-3 py-1 rounded-full text-xs font-bold border border-[#e2231a]/30 flex-shrink-0">
            <ShoppingCart className="w-3.5 h-3.5" />
            {lineItems.reduce((s, i) => s + (i.quantity || 0), 0)}
          </div>
        )}
      </div>

      {/* Sync toast */}
      {syncMsg && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl text-white transition-all
          ${syncMsg.includes('failed') ? 'bg-red-600' : 'bg-green-600'}`}>
          {syncMsg}
        </div>
      )}

      {/* ── 3-column body ── */}
      <div className="flex-1 flex overflow-hidden">



        {/* LEFT: Floating Edit Toolbar */}
        <div className="relative flex-shrink-0">
          {!editMode ? (
            <div className="flex flex-col items-center gap-1 p-1.5 h-full bg-white border-r border-slate-200">
              <button
                onClick={() => setEditMode(true)}
                title="Edit Hotspots"
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all group"
              >
                <Edit2 className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Edit</span>
              </button>
              <button
                onClick={refreshFromDb}
                disabled={isSyncing}
                title="Sync hotspots from database"
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 disabled:opacity-40 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-blue-500' : ''}`} />
                <span className="text-[9px] font-medium leading-none">{isSyncing ? '...' : 'Sync'}</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 p-1.5 h-full bg-white border-r border-slate-200 w-14">
              <div className="w-full h-px bg-slate-100 my-1" />

              <button
                onClick={() => setAddingHotspot(a => !a)}
                title={addingHotspot ? 'Drawing mode active' : 'Draw hotspot box'}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg w-full transition-all
                  ${addingHotspot ? 'bg-green-500 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                <Plus className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">{addingHotspot ? 'Draw' : 'Add'}</span>
              </button>

              {isEdited && (
                <button
                  onClick={resetPageHotspots}
                  title="Reset page hotspots"
                  className="flex flex-col items-center gap-1 p-2.5 rounded-lg w-full text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-[9px] font-medium leading-none">Reset</span>
                </button>
              )}

              <button
                onClick={rerunWithClaude}
                disabled={isRerunning}
                title="Re-run AI detection"
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg w-full text-purple-500 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-40 transition-all"
              >
                {isRerunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span className="text-[9px] font-medium leading-none">AI</span>
              </button>

              <button
                onClick={refreshFromDb}
                disabled={isSyncing}
                title="Sync hotspots from database"
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg w-full text-blue-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="text-[9px] font-medium leading-none">{isSyncing ? '...' : 'Sync'}</span>
              </button>

              <button
                onClick={exportHotspots}
                title="Export JSON"
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg w-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-all"
              >
                <Download className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Export</span>
              </button>

              <button
                onClick={saveToDb}
                title="Save to database"
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg w-full text-green-600 hover:bg-green-50 transition-all"
              >
                <Save className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Save</span>
              </button>

              <button
                onClick={() => shiftAllPageNumbers(-2)}
                title="Fix -2 page offset"
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg w-full text-orange-500 hover:bg-orange-50 hover:text-orange-700 transition-all"
              >
                <span className="text-[11px] font-black leading-none">-2</span>
                <span className="text-[9px] font-medium leading-none">Offset</span>
              </button>

              <div className="flex-1" />

              <button
                onClick={() => { setEditMode(false); setAddingHotspot(false); }}
                title="Close edit mode"
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg w-full bg-blue-600 text-white hover:bg-blue-700 transition-all mb-1"
              >
                <X className="w-4 h-4" />
                <span className="text-[9px] font-medium leading-none">Done</span>
              </button>
            </div>
          )}
        </div>

        {/* CENTER: Catalog Page */}
        <div className="flex-1 overflow-hidden p-3 flex justify-center items-start">
          <div className="relative w-full max-w-2xl flex flex-col items-center">
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
                    fetchProduct={fetchProduct}
                    hasSession={!!activeOrder}
                    onStartSession={() => { setShowVariants(false); setSelectedHotspot(null); setShowSessionModal(true); }}
                    onAdd={(product) => { handleAddToQuote(product); setShowVariants(false); setSelectedHotspot(null); }}
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
                        onClick={() => handleAddToQuote({ sku: p.sku, name: pd?.name || p.name, price: pd?.base_price, imageUrl: getImageUrl(pd) })}
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

        {/* RIGHT: Quote Sidebar */}
        <QuoteSidebar
          order={activeOrder}
          lineItems={lineItems}
          onLineItemsChange={refreshLineItems}
          onCreateQuote={handleCreateQuote}
        />
      </div>


    </div>
  );
}