import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PAGE_PRODUCTS, MAX_PAGE, SKU_TO_PAGE } from '@/data/catalogPageMapping';
import { FIRST_VISIBLE_CATALOG_PAGE, normalizeCatalogPage } from '@/components/catalog/catalogPageUtils';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';
import {
  ChevronLeft, ChevronRight, Plus, Minus, X, ShoppingCart,
  FileText, Search, Loader2, ImageOff, Package, Edit2, Save,
  Download, Trash2, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SessionStartModal from '@/components/catalog/SessionStartModal';
import QuoteSidebar from '@/components/catalog/QuoteSidebar';

import QuoteConfirmModal from '@/components/catalog/QuoteConfirmModal';
import { runPricingEngine, generatePromoCode } from '@/components/pricing/pricingEngine';

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

// ─── Claude Vision hotspot detection (SKU/table-first for edit mode) ───────────────────────
async function detectHotspotsWithClaude(pageNum, products, supabaseUrl) {
  const imageUrl = `${supabaseUrl}/catalog/pages/page-${String(pageNum + 2).padStart(3, '0')}.jpg`;

  const knownProducts = products && products.length > 0
    ? products.map(p => `- ${p.sku}: "${p.name}" (${p.category})${p.isPrimary ? ' [FEATURED]' : ''}`).join('\n')
    : 'No known product list provided for this page.';

  const prompt = `You are analyzing page ${pageNum} of the Orbus Exhibitor's Handbook trade show display catalog.

IMPORTANT: In edit mode, do NOT look for product photos or product images first.
Your main job is to find printed SKU groups, SKU tables, and table sections that list products.

Known products for this page:
${knownProducts}

Return hotspot boxes using these rules exactly:
- Find SKU tables, SKU lists, and grouped SKU sections first.
- Create ONE hotspot box per table or per clearly separated SKU section.
- Do NOT create one hotspot per individual row when those rows belong to the same visible table block.
- If a single table contains multiple related SKUs, return ONE hotspot with all of them in groupedSkus.
- Only create separate boxes when there are clearly separate tables or separate SKU groups on the page.
- Prefer matching groupedSkus to the known products list above when possible.
- sku should be the first SKU in groupedSkus.
- name should describe the table/group, using the printed heading or a short useful label.
- x, y, width, height must be normalized 0 to 1.
- Boxes should tightly cover the table or SKU section, not the whole page.
- If the page has both image areas and SKU tables, prioritize the SKU tables.
- Ignore decorative graphics and lifestyle imagery.

The goal is that each hotspot opens a selectable list of SKUs exactly like the current grouped SKU picker UI.`;

  const response = await base44.integrations.Core.InvokeLLM({
    prompt,
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

  const hotspots = response?.hotspots ?? response?.response?.hotspots ?? [];
  if (!Array.isArray(hotspots)) {
    console.warn('[Re-run AI] Unexpected response shape:', response);
    return [];
  }

  const knownSkuSet = new Set((products || []).map(p => p.sku));

  return hotspots
    .map(item => {
      const rawGrouped = Array.isArray(item.groupedSkus) ? item.groupedSkus : [];
      const normalizedGrouped = rawGrouped
        .map(sku => String(sku || '').trim().toUpperCase())
        .filter(Boolean)
        .filter((sku, index, arr) => arr.indexOf(sku) === index);

      const matchedGrouped = normalizedGrouped.filter(sku => knownSkuSet.size === 0 || knownSkuSet.has(sku));
      const groupedSkus = matchedGrouped.length > 0 ? matchedGrouped : normalizedGrouped;
      const primarySku = groupedSkus[0] || String(item.sku || '').trim().toUpperCase() || products[0]?.sku || '';

      if (!primarySku || groupedSkus.length === 0) return null;

      return {
        sku: primarySku,
        name: item.name || primarySku,
        x: Math.max(0, Math.min(1, Number(item.x) || 0)),
        y: Math.max(0, Math.min(1, Number(item.y) || 0)),
        width: Math.max(0.05, Math.min(1, Number(item.width) || 0.5)),
        height: Math.max(0.05, Math.min(1, Number(item.height) || 0.5)),
        groupedSkus,
      };
    })
    .filter(Boolean);
}

// ─── Config ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';
const LS_KEY = 'catalog-hotspot-edits';
// Catalog print pages (1–218) are stored in Supabase as PDF page numbers (print + 2).
// page-007.jpg in the catalog = page-009.jpg in Supabase.
const CATALOG_PAGE_OFFSET = 2;

function pageImageUrl(printPageNum) {
  // Page 0 = cover (PDF page 1)
  if (printPageNum === 0) return `${SUPABASE_URL}/catalog/pages/page-001.jpg`;
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
  // Static map first — 344 verified working Supabase product photo URLs
  if (p.sku && SKU_TO_IMAGE[p.sku]) return SKU_TO_IMAGE[p.sku];
  let url = p.primary_image_url || p.image_cached_url || p.image_url || p.thumbnail_url;
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  if (url.startsWith('/')) return `${SUPABASE_URL}${url}`;
  return `${SUPABASE_URL}/${url}`;
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getProductTagging(product) {
  const text = normalizeSearchText([
    product?.sku,
    product?.name,
    product?.description,
    product?.category,
    product?.subcategory,
    product?.product_line,
    Array.isArray(product?.features) ? product.features.join(' ') : ''
  ].join(' '));

  const tags = [];

  if (/back wall|backwall|backdrop|wall display|fabric wall|display wall/.test(text)) tags.push('back wall');
  if (/banner stand|retractable|retractor|roll up|popup banner|blade lite/.test(text)) tags.push('banner stand');
  if (/counter|podium|kiosk|reception/.test(text)) tags.push('counter');
  if (/case|cases|carry bag|carrybag|bag|shipping case|transport case|roller bag/.test(text)) tags.push('case');

  return {
    text,
    tags,
    isAccessoryOnly: tags.includes('case'),
    excludeFromRenderPrompt: tags.includes('case'),
  };
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
    // Always store an array — null/undefined means "explicitly saved as empty"
    res.forEach(item => { map[item.page_number] = Array.isArray(item.hotspots) ? item.hotspots : []; });
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

      // Ensure image URL — use real product photo from static map first
      if (prod && !prod.primary_image_url && !prod.image_cached_url && !prod.image_url) {
        // 1. Real product photo (from products.json / Supabase products/ folder)
        if (SKU_TO_IMAGE[sku]) {
          prod.image_url = SKU_TO_IMAGE[sku];
        } else {
          // 2. Last resort: catalog page image
          const printPage = SKU_TO_PAGE[sku];
          if (printPage) {
            prod.image_url = pageImageUrl(printPage);
          }
        }
      } else if (prod && !prod.image_url && SKU_TO_IMAGE[sku]) {
        // primary_image_url or image_cached_url exists but image_url empty — fill it
        prod.image_url = prod.primary_image_url || prod.image_cached_url || SKU_TO_IMAGE[sku];
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
function CatalogPageView({ pageNum, hotspots, onHotspotClick, selectedHotspot, onPageClick }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImgLoaded(true);
    }
  }, [pageNum]);

  const spots = hotspots || [];

  return (
    <div className="relative inline-block cursor-pointer" onClick={onPageClick}>
      <img
        key={pageNum}
        ref={imgRef}
        src={pageImageUrl(pageNum)}
        alt={`Catalog page ${pageNum}`}
        className="block rounded-lg shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 96px)', width: 'auto', maxWidth: '100%' }}
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
            onClick={(e) => { e.stopPropagation(); onHotspotClick(spot); }}
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
  const imgRef = useRef(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [drag, setDrag] = useState(null);
  // drag = { type: 'move'|'resize'|'create', idx, startNX, startNY, origSpot, curSpot }
  const setAdding = (val) => onAddingChange?.(typeof val === 'function' ? val(adding) : val);
  const [newSkuPrompt, setNewSkuPrompt] = useState(null); // { x, y, width, height }
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetected, setAutoDetected] = useState(null); // { sku, name, groupedSkus }
  const [editingSpot, setEditingSpot] = useState(null); // { idx, spot }

  useEffect(() => {
    setImgLoaded(false);
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImgLoaded(true);
    }
  }, [pageNum]);

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
        key={pageNum}
        ref={imgRef}
        src={pageImageUrl(pageNum)}
        alt={`Page ${pageNum}`}
        className="block rounded-lg shadow-2xl"
        style={{ maxHeight: 'calc(100vh - 96px)', width: 'auto', maxWidth: '100%' }}
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
  const skus = Array.from(new Set((spot.groupedSkus?.length > 0 ? spot.groupedSkus : [spot.sku]).filter(Boolean)));

  // Ensure all variant SKUs are fetched
  useEffect(() => {
    skus.forEach(sku => fetchProduct(sku));
  }, [spot]);

  useEffect(() => {
    if (skus.length === 1 && hasSession) {
      const p = products[skus[0]];
      if (p !== null && p !== undefined) {
        onAdd({ sku: skus[0], name: p?.name || spot.name, price: p?.base_price, imageUrl: getImageUrl(p) });
        onClose();
      }
    }
    // if no session, fall through to render the picker UI below
  }, [products[skus[0]]]);

  if (skus.length === 1 && hasSession) {
    const p = products[skus[0]];
    if (!p) return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-lg">
        <div className="bg-white rounded-2xl p-6 flex items-center gap-3 shadow-xl">
          <Loader2 className="w-5 h-5 animate-spin text-[#e2231a]" />
          <span className="text-sm text-slate-600">Loading product...</span>
        </div>
      </div>
    );
    return null; // useEffect auto-adds it
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
  const [currentPage, setCurrentPage] = useState(FIRST_VISIBLE_CATALOG_PAGE);
  const [pageInput, setPageInput] = useState(String(FIRST_VISIBLE_CATALOG_PAGE));
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
  const [showMobileQuote, setShowMobileQuote] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [latestPricingResult, setLatestPricingResult] = useState(null);
  const [generatedPromos, setGeneratedPromos] = useState([]);
  const rulesResCacheRef = useRef([]);

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
    setShowConfirmModal(false);

    // Load pricing rules + dealer settings
    const [rulesRes, dealerSettingsRes] = await Promise.all([
      base44.entities.PricingRule.filter({ is_active: true }),
      base44.auth.me().then(u => base44.entities.DealerPricingSettings.filter({ user_id: u.id })),
    ]);
    const rules = rulesRes || [];
    rulesResCacheRef.current = rules;
    const dealerSettings = dealerSettingsRes?.[0] || null;

    // Use latest pricing result from sidebar if available, otherwise re-run
    let pricingResult = latestPricingResult;
    if (!pricingResult) {
      pricingResult = runPricingEngine({ order: activeOrder, lineItems, rules, dealerSettings });
    }

    const { itemResults, appliedRuleIds, generatedPromos: newPromos, listTotal, markupAmount, ruleDiscountAmount, customerDiscountAmount, promoDiscountAmount, finalTotal, markupPct, discountPct } = pricingResult;

    // Update each line item with final prices
    await Promise.all(itemResults.map(item =>
      base44.entities.LineItem.update(item.id, {
        list_unit_price: item.list_unit_price || item.unit_price,
        final_unit_price: item.final_unit_price,
        final_total_price: item.final_total_price,
        rule_discount_amount: item.rule_discount_amount || 0,
      })
    ));

    // Save generated promos to database
    const savedPromos = [];
    for (const p of (newPromos || [])) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (p.expires_days || 90));
      const promo = await base44.entities.PromoCode.create({
        code: p.code || generatePromoCode(),
        generated_from_rule_id: appliedRuleIds?.[0] || '',
        generated_from_order_id: activeOrder.id,
        discount_pct: p.discount_pct,
        applies_to: p.applies_to || 'quote',
        applies_to_value: p.applies_to_value || '',
        expires_at: expiresAt.toLocaleDateString('en-CA'),
        message: p.message || '',
        is_used: false,
      });
      savedPromos.push({ ...p, ...promo });
    }

    setGeneratedPromos(savedPromos);

    const quoted_price = parseFloat(finalTotal.toFixed(2));
    const share_token = crypto.randomUUID();

    await base44.entities.Order.update(activeOrder.id, {
      status: 'Quoted',
      quoted_price,
      final_price: quoted_price,
      share_token,
      list_price_total: listTotal,
      markup_amount: markupAmount,
      rule_discount_amount: ruleDiscountAmount,
      customer_discount_amount: customerDiscountAmount,
      promo_discount_amount: promoDiscountAmount,
      applied_rule_ids: appliedRuleIds,
      dealer_markup_pct: markupPct ?? activeOrder.dealer_markup_pct ?? 0,
      customer_discount_pct: discountPct ?? activeOrder.customer_discount_pct ?? 0,
    });

    setActiveOrder(prev => ({ ...prev, share_token, quoted_price, list_price_total: listTotal, markup_amount: markupAmount, rule_discount_amount: ruleDiscountAmount, applied_rule_ids: appliedRuleIds }));
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
      // Save any pending local edits to DB before reloading so they aren't lost
      const editedPages = Object.keys(editedHotspots);
      for (const pageStr of editedPages) {
        const page = parseInt(pageStr);
        const spots = Array.isArray(editedHotspots[page]) ? editedHotspots[page] : [];
        const existing = await base44.entities.CatalogHotspot.filter({ page_number: page });
        if (existing.length > 0) {
          await base44.entities.CatalogHotspot.update(existing[0].id, { hotspots: spots });
        } else {
          await base44.entities.CatalogHotspot.create({ page_number: page, hotspots: spots });
        }
      }
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
  const currentHotspots = (editedHotspots[currentPage] ?? dbHotspots[currentPage] ?? baseHotspots).map((spot) => {
    const groupedSkus = Array.from(new Set((spot.groupedSkus?.length > 0 ? spot.groupedSkus : [spot.sku]).filter(Boolean)));
    return {
      ...spot,
      sku: groupedSkus[0] || spot.sku,
      groupedSkus,
    };
  });
  const hasHotspots = currentHotspots.length > 0;

  // Pre-fetch product details only for visible hotspots on the current page
  useEffect(() => {
    const skus = new Set(currentHotspots.flatMap(h => h.groupedSkus || [h.sku]));
    skus.forEach(sku => fetchProduct(sku));
  }, [currentHotspots, fetchProduct]);

  // Navigation
  const goToPage = useCallback((n) => {
    const p = normalizeCatalogPage(n, currentPage, MAX_PAGE);
    setDirection(p > currentPage ? 1 : -1);
    setCurrentPage(p);
    setPageInput(String(p));
    setSelectedHotspot(null);
    setShowVariants(false);
    setAddingHotspot(false);
  }, [currentPage]);

  const handlePageInput = (e) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = () => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n) && n >= 0) goToPage(n);
    else setPageInput(String(currentPage));
  };

  const handleSkuSearch = () => {
    const query = searchSku.trim();
    if (!query) return;

    const page = /^\d+$/.test(query) ? Number(query) : SKU_TO_PAGE[query.toUpperCase()];
    if (Number.isFinite(page)) {
      goToPage(page);
      setSearchSku('');
      setShowSearchDropdown(false);
    }
  };

  const searchDebounceRef = useRef(null);

  useEffect(() => () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
  }, []);

  const handleProductSearch = (query) => {
    setSearchSku(query);
    const trimmed = query.trim();

    if (!trimmed || trimmed.length < 2 || /^\d+$/.test(trimmed)) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      const regex = { $regex: trimmed, $options: 'i' };
      try {
        const [byName, bySku, byCategory, bySubcategory, byDescription] = await Promise.all([
          base44.entities.Product.filter({ name: regex }),
          base44.entities.Product.filter({ sku: regex }),
          base44.entities.Product.filter({ category: regex }),
          base44.entities.Product.filter({ subcategory: regex }),
          base44.entities.Product.filter({ description: regex }),
        ]);
        const normalizedQuery = normalizeSearchText(trimmed);
        const combined = [...(byName || []), ...(bySku || []), ...(byCategory || []), ...(bySubcategory || []), ...(byDescription || [])];
        const unique = combined.filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
        const ranked = unique
          .map(product => {
            const tagging = getProductTagging(product);
            const text = tagging.text;
            const score = [
              text.includes(normalizedQuery) ? 100 : 0,
              tagging.tags.some(tag => tag.includes(normalizedQuery) || normalizedQuery.includes(tag)) ? 60 : 0,
              normalizeSearchText(product?.name).includes(normalizedQuery) ? 40 : 0,
              normalizeSearchText(product?.category).includes(normalizedQuery) ? 20 : 0,
              normalizeSearchText(product?.subcategory).includes(normalizedQuery) ? 20 : 0,
            ].reduce((sum, n) => sum + n, 0);
            return { product, score };
          })
          .filter(item => item.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 15)
          .map(item => item.product);
        setSearchResults(ranked);
        setShowSearchDropdown(ranked.length > 0);
      } catch {
        setShowSearchDropdown(false);
      }
    }, 250);
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
    const skus = Array.from(new Set((spot.groupedSkus?.length > 0 ? spot.groupedSkus : [spot.sku]).filter(Boolean)));
    const normalizedSpot = { ...spot, sku: skus[0] || spot.sku, groupedSkus: skus };
    setSelectedHotspot(normalizedSpot);
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
        alert('AI found no SKU tables or grouped SKU sections on this page.');
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
      // Ensure we always save a real array (even empty) so DB never stores null
      const spotsToSave = Array.isArray(currentHotspots) ? currentHotspots : [];
      const existing = await base44.entities.CatalogHotspot.filter({ page_number: currentPage });
      if (existing.length > 0) {
        await base44.entities.CatalogHotspot.update(existing[0].id, { hotspots: spotsToSave });
      } else {
        await base44.entities.CatalogHotspot.create({ page_number: currentPage, hotspots: spotsToSave });
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

  const handleExitEditMode = async () => {
    const editedPages = Object.keys(editedHotspots);
    if (editedPages.length > 0) {
      setIsSyncing(true);
      try {
        for (const pageStr of editedPages) {
          const page = parseInt(pageStr);
          const spots = Array.isArray(editedHotspots[page]) ? editedHotspots[page] : [];
          const existing = await base44.entities.CatalogHotspot.filter({ page_number: page });
          if (existing.length > 0) {
            await base44.entities.CatalogHotspot.update(existing[0].id, { hotspots: spots });
          } else {
            await base44.entities.CatalogHotspot.create({ page_number: page, hotspots: spots });
          }
        }
        const dbData = await loadAllDbHotspots();
        setDbHotspots(dbData);
        setEditedHotspots({});
        localStorage.removeItem(LS_KEY);
        setSyncMsg(`Auto-saved ${editedPages.length} page${editedPages.length > 1 ? 's' : ''} to database`);
        setTimeout(() => setSyncMsg(null), 3000);
      } catch (e) {
        setSyncMsg('Auto-save failed — your edits are still in local storage');
        setTimeout(() => setSyncMsg(null), 5000);
      } finally {
        setIsSyncing(false);
      }
    }
    setEditMode(false);
    setAddingHotspot(false);
  };



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
          isPreview={!activeOrder.share_token}
          generatedPromos={generatedPromos}
          appliedRules={rulesResCacheRef.current}
        />
      )}

      {/* ── Top bar ── */}
      <div className="bg-white/95 backdrop-blur border-b border-slate-200 px-3 sm:px-4 py-2.5 flex-shrink-0 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
          <div className="flex items-center gap-3 min-w-0 lg:flex-[1.2]">
            <div className="w-10 h-10 bg-[#e2231a] rounded-2xl flex items-center justify-center shadow-lg shadow-[#e2231a]/20 flex-shrink-0">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">Catalog Quote</h1>
              <p className="text-xs text-slate-500 mt-1 truncate">Search the catalog, confirm booth products, and build a cleaner client quote.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative lg:flex-1 lg:max-w-sm" ref={searchRef}>
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search by product name, SKU, or category"
                value={searchSku}
                onChange={e => handleProductSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSkuSearch()}
                onFocus={() => searchResults.length > 0 && setShowSearchDropdown(true)}
                onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                className="text-sm border border-slate-200 rounded-xl px-3.5 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#e2231a]/20"
              />
              <button onClick={handleSkuSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <Search className="w-4 h-4" />
              </button>
            </div>
            {showSearchDropdown && (
              <div className="absolute top-full left-0 mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onMouseDown={() => handleSearchResultClick(p)}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{p.sku} · {p.category}</p>
                      {getProductTagging(p).tags.length > 0 && (
                        <p className="text-[10px] text-slate-500 mt-0.5">{getProductTagging(p).tags.join(' · ')}</p>
                      )}
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

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 lg:justify-end">
            {activeOrder ? (
              <div className="hidden 2xl:flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 max-w-[20rem]">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0"></span>
                <span className="truncate">{activeOrder.customer_name || activeOrder.customer_email} · {activeOrder.show_name || 'Show not set'}{activeOrder.booth_size ? ` · ${activeOrder.booth_size}` : ''}</span>
              </div>
            ) : (
              <button
                onClick={() => setShowSessionModal(true)}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-[#e2231a]/30 hover:text-[#e2231a] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Start Quote Session
              </button>
            )}

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 shadow-sm">
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= FIRST_VISIBLE_CATALOG_PAGE}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500">Page</span>
              <input
                type="number" min={FIRST_VISIBLE_CATALOG_PAGE} max={MAX_PAGE} value={pageInput}
                onChange={handlePageInput}
                onBlur={handlePageInputSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handlePageInputSubmit();
                  }
                }}
                className="w-14 text-center text-sm font-bold bg-transparent focus:outline-none"
              />
              <span className="text-xs text-slate-400">/ {MAX_PAGE}</span>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= MAX_PAGE}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 text-slate-600">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {hasHotspots && !editMode && (
              <Badge className="hidden 2xl:inline-flex bg-[#e2231a]/10 text-[#e2231a] text-[10px] rounded-full px-3 py-1">{currentHotspots.length} hotspots</Badge>
            )}
            {isEdited && <Badge className="hidden 2xl:inline-flex bg-amber-100 text-amber-700 text-[10px] rounded-full px-3 py-1">unsaved edits</Badge>}

            <button
              onClick={() => setShowMobileQuote(true)}
              className="lg:hidden flex items-center gap-1.5 bg-[#e2231a] text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-[#b01b13] transition-colors shadow-sm"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Quote ({lineItems.reduce((s, i) => s + (i.quantity || 0), 0)})
            </button>

            {lineItems.length > 0 && (
              <button
                onClick={handleCreateQuote}
                className="hidden 2xl:flex items-center gap-1.5 bg-[#e2231a] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#b01b13] transition-colors shadow-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                Review Quote ({lineItems.reduce((s, i) => s + (i.quantity || 0), 0)})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sync toast */}
      {syncMsg && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-sm font-semibold shadow-xl text-white transition-all
          ${syncMsg.includes('failed') ? 'bg-red-600' : 'bg-green-600'}`}>
          {syncMsg}
        </div>
      )}

      {/* Mobile quote drawer */}
      {showMobileQuote && (
        <div className="lg:hidden fixed inset-x-0 top-14 bottom-14 z-40 bg-black/40" onClick={() => setShowMobileQuote(false)}>
          <div className="absolute inset-x-0 bottom-0 h-[70vh] bg-white rounded-t-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
              <div className="w-10" />
              <div className="w-10 h-1 rounded-full bg-slate-300" />
              <button onClick={() => setShowMobileQuote(false)} className="w-10 h-10 flex items-center justify-center text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[calc(70vh-57px)] overflow-hidden">
              <QuoteSidebar
                order={activeOrder}
                lineItems={lineItems}
                onLineItemsChange={refreshLineItems}
                onCreateQuote={handleCreateQuote}
                productCache={productCache}
                onPricingResult={setLatestPricingResult}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 3-column body ── */}
      <div className="flex-1 flex overflow-hidden">



        {/* LEFT: Floating Edit Toolbar */}
        <div className="relative flex-shrink-0 p-2">
          {!editMode ? (
            <div className="sticky top-3 flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm">
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
            <div className="sticky top-3 flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm w-16">
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
                title="Re-analyze SKU tables"
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
                onClick={handleExitEditMode}
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
        <div className="flex-1 min-w-0 overflow-auto p-2 sm:p-2.5 flex justify-center items-start">
          <div className="relative w-full max-w-4xl flex flex-col items-center">
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
                    onPageClick={() => currentPage < MAX_PAGE && goToPage(currentPage + 1)}
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
        <div className="hidden lg:block lg:w-[18rem] xl:w-[20rem] 2xl:w-[22rem] lg:flex-shrink-0 border-l border-slate-200 bg-white">
          <QuoteSidebar
            order={activeOrder}
            lineItems={lineItems}
            onLineItemsChange={refreshLineItems}
            onCreateQuote={handleCreateQuote}
            productCache={productCache}
            onPricingResult={setLatestPricingResult}
          />
        </div>
      </div>


    </div>
  );
}