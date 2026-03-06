import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PAGE_PRODUCTS, MAX_PAGE, MIN_PAGE, SKU_TO_PAGE } from '@/data/catalogPageMapping';
import {
  ChevronLeft, ChevronRight, Plus, Minus, X, ShoppingCart,
  DollarSign, FileText, Search, Loader2, ImageOff, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Config ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';

function pageImageUrl(pageNum) {
  return `${SUPABASE_URL}/catalog/pages/page-${String(pageNum).padStart(3, '0')}.jpg`;
}

function fmt(n) {
  if (!n && n !== 0) return null;
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Load hotspot data lazily ────────────────────────────────────────────────
let _hotspots = null;
async function getHotspots() {
  if (_hotspots) return _hotspots;
  try {
    const mod = await import('@/data/catalogHotspots.json');
    _hotspots = mod.default;
  } catch {
    _hotspots = {};
  }
  return _hotspots;
}

// ─── Hook: product detail cache ──────────────────────────────────────────────
function useProductCache() {
  const cache = useRef({});
  const [tick, setTick] = useState(0);

  const fetch = useCallback(async (sku) => {
    if (cache.current[sku] !== undefined) return;
    cache.current[sku] = null; // mark loading
    try {
      const res = await base44.entities.Product.filter({ sku });
      cache.current[sku] = res[0] || { sku, name: sku };
    } catch {
      cache.current[sku] = { sku, name: sku };
    }
    setTick(t => t + 1);
  }, []);

  return { cache: cache.current, fetch };
}

// ─── Catalog Page Image with hotspot overlays ────────────────────────────────
function CatalogPageView({ pageNum, hotspots, onHotspotClick, selectedHotspot }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [pageNum]);

  const onLoad = () => {
    setImgLoaded(true);
  };

  const spots = hotspots || [];

  if (!pageNum) return null;

  return (
    <div className="relative inline-block w-full">
      {/* Page image */}
      <img
        ref={imgRef}
        src={pageImageUrl(pageNum)}
        alt={`Catalog page ${pageNum}`}
        className="w-full h-auto rounded-lg shadow-2xl block"
        onLoad={onLoad}
        onError={() => setImgError(true)}
      />

      {/* Loading state */}
      {!imgLoaded && !imgError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 rounded-lg">
          <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      )}

      {/* Error state */}
      {imgError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 rounded-lg gap-3">
          <ImageOff className="w-10 h-10 text-slate-300" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-500">Page {pageNum} not yet uploaded</p>
            <p className="text-xs text-slate-400 mt-1">
              Run: <code className="bg-slate-100 px-1 rounded">npm run catalog:pages</code>
            </p>
          </div>
        </div>
      )}

      {/* Hotspot overlays — only when image is loaded */}
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
              ${isSelected
                ? 'border-[#e2231a] bg-[#e2231a]/20'
                : 'border-transparent hover:border-[#e2231a]/60 hover:bg-[#e2231a]/10'
              }`}
            title={spot.name}
          >
            {/* Add badge — appears on hover */}
            <div className={`absolute top-1 right-1 transition-opacity
              ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <div className="bg-[#e2231a] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                <Plus className="w-2.5 h-2.5" />
                Add
              </div>
            </div>
            {/* Product name tooltip on hover */}
            <div className={`absolute bottom-1 left-1 right-1 transition-opacity
              ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
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

// ─── Variant picker popup (shown when hotspot groups multiple SKUs) ───────────
function VariantPicker({ spot, products, onAdd, onClose }) {
  const skus = spot.groupedSkus || [spot.sku];
  if (skus.length === 1) {
    // Auto-add if only one SKU
    useEffect(() => {
      const p = products[skus[0]];
      onAdd({ sku: skus[0], name: p?.name || spot.name, price: p?.base_price, imageUrl: p?.image_cached_url || p?.image_url });
      onClose();
    }, []);
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 rounded-lg">
      <div className="bg-white rounded-2xl shadow-2xl w-80 max-h-[80%] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">{spot.name}</p>
            <p className="text-xs text-slate-500">Choose a size or variant</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 space-y-1.5">
          {skus.map(sku => {
            const p = products[sku];
            const price = p?.base_price || null;
            return (
              <button
                key={sku}
                onClick={() => {
                  onAdd({ sku, name: p?.name || sku, price, imageUrl: p?.image_cached_url || p?.image_url });
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-[#e2231a]/40 hover:bg-[#e2231a]/5 transition-all text-left group"
              >
                <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-100">
                  {p?.image_cached_url || p?.image_url
                    ? <img src={p.image_cached_url || p.image_url} alt={sku} className="w-full h-full object-contain" />
                    : <Package className="w-5 h-5 text-slate-300" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">{p?.name || sku}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{sku}</p>
                  {price && <p className="text-xs font-bold text-[#e2231a]">{fmt(price)}</p>}
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

// ─── Order Item ──────────────────────────────────────────────────────────────
function OrderItem({ item, onQtyChange, onRemove, onSizeChange }) {
  const total = item.price ? item.price * item.qty : null;
  const sizes = item.sizes?.length > 0 ? item.sizes : null;

  return (
    <div className="flex flex-col gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-start gap-3">
        {/* Thumb */}
        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100">
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain p-1" />
            : <Package className="w-5 h-5 text-slate-300" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">{item.name}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{item.sku}</p>

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
            : <p className="text-[10px] text-slate-400 italic mt-1">Quote</p>
          }
        </div>
      </div>

      {/* Qty controls */}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100">
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Quantity</span>
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

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CatalogQuote() {
  const [currentPage, setCurrentPage] = useState(9); // default to a page with products
  const [pageInput, setPageInput] = useState('9');
  const [direction, setDirection] = useState(1);
  const [hotspotData, setHotspotData] = useState({});
  const [orderItems, setOrderItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [searchSku, setSearchSku] = useState('');
  const [selectedHotspot, setSelectedHotspot] = useState(null);
  const [showVariants, setShowVariants] = useState(false);
  const { cache: productCache, fetch: fetchProduct } = useProductCache();

  // Load hotspot data
  useEffect(() => {
    getHotspots().then(setHotspotData);
  }, []);

  // Pre-fetch product details for all SKUs on current page
  const pageProducts = PAGE_PRODUCTS[currentPage] || [];
  const currentHotspots = hotspotData[currentPage] || [];

  useEffect(() => {
    const skus = new Set([
      ...pageProducts.map(p => p.sku),
      ...currentHotspots.flatMap(h => h.groupedSkus || [h.sku]),
    ]);
    skus.forEach(sku => fetchProduct(sku));
  }, [currentPage, currentHotspots, fetchProduct]);

  // Navigation
  const goToPage = useCallback((n) => {
    let p = Math.max(1, Math.min(n, MAX_PAGE));
    setDirection(p > currentPage ? 1 : -1);
    setCurrentPage(p);
    setPageInput(String(p));
    setSelectedHotspot(null);
    setShowVariants(false);
  }, [currentPage]);

  const handlePageInput = (e) => {
    setPageInput(e.target.value);
    const n = parseInt(e.target.value);
    if (!isNaN(n) && n >= 1) goToPage(n);
  };

  // SKU search → jump to product's page
  const handleSkuSearch = () => {
    const sku = searchSku.trim().toUpperCase();
    const page = SKU_TO_PAGE[sku];
    if (page) { goToPage(page); setSearchSku(''); }
  };

  // Hotspot clicked
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

  // Add to order
  const addToOrder = useCallback((product) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.sku === product.sku);
      if (existing) return prev.map(i => i.sku === product.sku ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...product, id: `${product.sku}-${Date.now()}`, qty: 1 }];
    });
  }, []);

  const handleQtyChange = (id, delta) => {
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
  };
  const handleRemove = (id) => setOrderItems(prev => prev.filter(i => i.id !== id));
  const handleSizeChange = useCallback((id, size) => {
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, selectedSize: size } : i));
  }, []);

  // Totals
  const subtotal = orderItems.reduce((s, i) => s + (i.price ? i.price * i.qty : 0), 0);
  const hasQuoteItems = orderItems.some(i => !i.price);
  const itemCount = orderItems.reduce((s, i) => s + i.qty, 0);
  const hasHotspots = currentHotspots.length > 0;

  // Generate booth concept image
  const handleGenerateImage = async () => {
    setIsGenerating(true);
    try {
      const imageUrls = orderItems.map(i => i.imageUrl).filter(Boolean);
      const productNames = orderItems.map(i => i.name).join(', ');

      const prompt = `A professional, high-quality 3D render of a trade show booth featuring the following products: ${productNames}. The booth should be set in a modern, brightly lit exhibition hall with a clean, neutral carpet. The products should be arranged logically to create an inviting space. Photorealistic, 8k resolution, architectural visualization.`;

      const res = await base44.integrations.Core.GenerateImage({
        prompt,
        existing_image_urls: imageUrls.length > 0 ? imageUrls : undefined
      });

      if (res && res.url) {
        setGeneratedImage(res.url);
      }
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

        {/* Page nav — centered in top bar */}
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
          {hasHotspots && (
            <Badge className="bg-[#e2231a]/10 text-[#e2231a] text-[10px] ml-1">
              {currentHotspots.length} clickable
            </Badge>
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
            {customerName && (
              <p className="text-[11px] text-slate-500 mt-0.5 truncate text-center">{customerName}</p>
            )}
          </div>

          <div className="mt-12 text-center w-full">
            <div className="text-4xl font-black text-slate-900 mb-2">
              {subtotal > 0 ? fmt(subtotal) : hasQuoteItems ? 'TBD' : '$0.00'}
            </div>
            <p className="text-sm text-slate-500 mb-6">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>

            {/* Line item summary */}
            {orderItems.length > 0 && (
              <div className="text-left space-y-1 mb-6 max-h-40 overflow-y-auto">
                {orderItems.map(item => (
                  <div key={item.id} className="flex items-center gap-1.5 py-1 border-b border-slate-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-slate-700 truncate">{item.name}</p>
                      <p className="text-[9px] text-slate-400">{item.sku} x{item.qty}</p>
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
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...</>
              ) : (
                'Generate Booth Concept'
              )}
            </Button>

            {orderItems.length > 0 && (
              <button
                onClick={() => setOrderItems([])}
                className="w-full text-xs text-slate-400 hover:text-red-500 transition-colors mt-4 py-2"
              >
                Clear all items
              </button>
            )}
          </div>
        </div>

        {/* CENTER: Shoppable Catalog Page */}
        <div className="flex-1 overflow-auto p-4 flex justify-center">
          <div className="relative w-full max-w-2xl">
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

            {/* Variant picker popup */}
            {showVariants && selectedHotspot && (
              <VariantPicker
                spot={selectedHotspot}
                products={productCache}
                onAdd={addToOrder}
                onClose={() => { setShowVariants(false); setSelectedHotspot(null); }}
              />
            )}

            {/* No hotspots yet — show product chips below image */}
            {!hasHotspots && pageProducts.length > 0 && (
              <div className="mt-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                  <p className="text-xs text-amber-700 font-medium">
                    Hotspots not yet generated for this page — click below to add products
                  </p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  {pageProducts.map(p => {
                    const pd = productCache[p.sku];
                    return (
                      <button
                        key={p.sku}
                        onClick={() => addToOrder({ sku: p.sku, name: pd?.name || p.name, price: pd?.base_price, imageUrl: pd?.image_cached_url || pd?.image_url })}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-[#e2231a]/40 hover:bg-[#e2231a]/5 text-left transition-all group"
                      >
                        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                          {pd?.image_cached_url || pd?.image_url
                            ? <img src={pd.image_cached_url || pd.image_url} alt={p.name} className="w-full h-full object-contain" />
                            : <Package className="w-4 h-4 text-slate-300" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{p.name}</p>
                          <p className="text-[9px] text-slate-400">{p.sku}</p>
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
                <Badge className="ml-auto bg-[#e2231a] text-white text-[10px] px-1.5 py-0 h-4">
                  {itemCount}
                </Badge>
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
            ) : (
              orderItems.map(item => (
                <OrderItem
                  key={item.id}
                  item={item}
                  onQtyChange={handleQtyChange}
                  onRemove={handleRemove}
                  onSizeChange={handleSizeChange}
                />
              ))
            )}
          </div>

          {orderItems.length > 0 && (
            <div className="p-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
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
