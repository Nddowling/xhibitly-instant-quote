import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PAGE_PRODUCTS, MAX_PAGE, MIN_PAGE, SKU_TO_PAGE } from '@/data/catalogPageMapping';
import {
  ChevronLeft, ChevronRight, Plus, Minus, Trash2, ShoppingCart,
  DollarSign, FileText, Search, X, ZoomIn, ZoomOut, Loader2
} from 'lucide-react';

// The catalog PDF — upload to Supabase storage at this path:
// orbus-assets bucket → catalog/exhibitors-handbook.pdf
const CATALOG_PDF_URL =
  'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets/catalog/exhibitors-handbook.pdf';

// ─── Helper: format currency ────────────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return 'Quote';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Hook: load + cache product details from Base44 ─────────────────────────
function useProductCache() {
  const cache = useRef({});
  const [, forceUpdate] = useState(0);

  const fetch = useCallback(async (sku) => {
    if (cache.current[sku]) return;
    cache.current[sku] = { loading: true };
    try {
      const res = await base44.entities.Product.filter({ sku });
      if (res.length > 0) {
        cache.current[sku] = res[0];
      } else {
        cache.current[sku] = { sku, name: sku, loading: false };
      }
    } catch {
      cache.current[sku] = { sku, name: sku, loading: false };
    }
    forceUpdate(n => n + 1);
  }, []);

  return { cache: cache.current, fetch };
}

// ─── PDF Page Renderer ───────────────────────────────────────────────────────
function PdfPageView({ pdfDoc, pageNum, scale = 1.0 }) {
  const canvasRef = useRef(null);
  const renderTask = useRef(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    const render = async () => {
      try {
        // Cancel any in-flight render
        if (renderTask.current) {
          renderTask.current.cancel();
          renderTask.current = null;
        }
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        renderTask.current = page.render({ canvasContext: ctx, viewport });
        await renderTask.current.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('[PDF render]', err);
        }
      }
    };

    render();
    return () => {
      cancelled = true;
      if (renderTask.current) renderTask.current.cancel();
    };
  }, [pdfDoc, pageNum, scale]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-auto rounded-lg shadow-lg"
      style={{ display: 'block' }}
    />
  );
}

// ─── Product Card (on the page) ──────────────────────────────────────────────
function PageProductCard({ sku, name, category, isPrimary, productData, onFetch, onAdd }) {
  useEffect(() => { onFetch(sku); }, [sku, onFetch]);

  const price = productData?.base_price || productData?.price_min || null;
  const imgUrl = productData?.image_cached_url || productData?.image_url || null;

  return (
    <button
      onClick={() => onAdd({ sku, name: productData?.name || name, category, price, imageUrl: imgUrl })}
      className={`group flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left w-full
        ${isPrimary
          ? 'border-[#e2231a]/30 bg-[#e2231a]/5 hover:bg-[#e2231a]/10 hover:border-[#e2231a]/50'
          : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'}`}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
        {imgUrl ? (
          <img src={imgUrl} alt={name} className="w-full h-full object-contain" />
        ) : (
          <span className="text-slate-300 text-xl">📦</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{name}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{sku}</p>
        {price ? (
          <p className="text-xs font-bold text-[#e2231a] mt-0.5">{fmt(price)}</p>
        ) : (
          <p className="text-[10px] text-slate-400 italic mt-0.5">Quote required</p>
        )}
      </div>

      {/* Add button */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Plus className="w-4 h-4 text-[#e2231a]" />
      </div>
    </button>
  );
}

// ─── Order Item Row ──────────────────────────────────────────────────────────
function OrderItem({ item, onQtyChange, onRemove }) {
  const total = item.price ? item.price * item.qty : null;
  return (
    <div className="flex items-start gap-2 p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* Thumb */}
      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-100">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
          : <span className="text-slate-300 text-sm">📦</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{item.name}</p>
        <p className="text-[9px] text-slate-400">{item.sku}</p>
        {/* Qty controls */}
        <div className="flex items-center gap-1 mt-1.5">
          <button onClick={() => onQtyChange(item.id, -1)} className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs">
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs font-medium w-5 text-center">{item.qty}</span>
          <button onClick={() => onQtyChange(item.id, 1)} className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 text-xs">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <button onClick={() => onRemove(item.id)} className="text-slate-300 hover:text-red-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
        {total != null
          ? <p className="text-xs font-bold text-slate-800">{fmt(total)}</p>
          : <p className="text-[9px] text-slate-400 italic">Quote</p>
        }
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function CatalogQuote() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfScale, setPdfScale] = useState(1.3);
  const [orderItems, setOrderItems] = useState([]);
  const [searchSku, setSearchSku] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [showPdfSetup, setShowPdfSetup] = useState(false);
  const { cache: productCache, fetch: fetchProduct } = useProductCache();

  // Load PDF on mount
  useEffect(() => {
    setPdfLoading(true);
    setPdfError(false);
    pdfjsLib.getDocument({ url: CATALOG_PDF_URL, withCredentials: false })
      .promise
      .then(doc => { setPdfDoc(doc); setPdfLoading(false); })
      .catch(() => { setPdfLoading(false); setPdfError(true); });
  }, []);

  // Pre-fetch product details for current page products
  const pageProducts = PAGE_PRODUCTS[currentPage] || [];
  useEffect(() => {
    pageProducts.forEach(p => fetchProduct(p.sku));
  }, [currentPage, fetchProduct]);

  // Navigation
  const goToPage = useCallback((n) => {
    const p = Math.max(1, Math.min(n, MAX_PAGE));
    setCurrentPage(p);
    setPageInput(String(p));
  }, []);

  const handlePageInput = (e) => {
    setPageInput(e.target.value);
    const n = parseInt(e.target.value);
    if (!isNaN(n)) goToPage(n);
  };

  // SKU search: jump to that product's primary page
  const handleSkuSearch = () => {
    const sku = searchSku.trim().toUpperCase();
    const page = SKU_TO_PAGE[sku];
    if (page) {
      goToPage(page);
      setSearchSku('');
    }
  };

  // Add product to order
  const handleAdd = useCallback((product) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.sku === product.sku);
      if (existing) {
        return prev.map(i => i.sku === product.sku ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, id: Date.now() + Math.random(), qty: 1 }];
    });
  }, []);

  const handleQtyChange = useCallback((id, delta) => {
    setOrderItems(prev => prev
      .map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );
  }, []);

  const handleRemove = useCallback((id) => {
    setOrderItems(prev => prev.filter(i => i.id !== id));
  }, []);

  // Totals
  const subtotal = orderItems.reduce((sum, i) => sum + (i.price ? i.price * i.qty : 0), 0);
  const hasQuoteItems = orderItems.some(i => !i.price);
  const itemCount = orderItems.reduce((s, i) => s + i.qty, 0);

  // Handle PDF scale
  const zoomIn = () => setPdfScale(s => Math.min(s + 0.2, 2.5));
  const zoomOut = () => setPdfScale(s => Math.max(s - 0.2, 0.5));

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#e2231a] rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-sm font-bold text-slate-900">Catalog Quote</h1>
        </div>

        {/* Customer name */}
        <input
          type="text"
          placeholder="Customer name..."
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
        />

        {/* SKU search */}
        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="Jump to SKU..."
            value={searchSku}
            onChange={e => setSearchSku(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSkuSearch()}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
          />
          <button onClick={handleSkuSearch} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
            <Search className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1" />

        {/* Item count badge */}
        {itemCount > 0 && (
          <div className="flex items-center gap-1.5 bg-[#e2231a]/10 text-[#e2231a] px-3 py-1 rounded-full text-sm font-semibold">
            <ShoppingCart className="w-3.5 h-3.5" />
            {itemCount} item{itemCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* 3-column body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══ LEFT: Live Quote Totaler ══════════════════════════════════════ */}
        <div className="w-52 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#e2231a]" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Live Total</span>
            </div>
            {customerName && (
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">{customerName}</p>
            )}
          </div>

          {/* Running total */}
          <div className="p-4 border-b border-slate-100">
            <div className="text-2xl font-black text-slate-900">
              {subtotal > 0 ? fmt(subtotal) : hasQuoteItems ? 'TBD' : '—'}
            </div>
            {hasQuoteItems && (
              <p className="text-[10px] text-amber-600 mt-0.5">Some items require quotes</p>
            )}
            {subtotal > 0 && (
              <p className="text-[10px] text-slate-400 mt-0.5">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Line items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {orderItems.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                <p className="text-[11px] text-slate-400">No items yet</p>
                <p className="text-[10px] text-slate-300 mt-1">Click products to add</p>
              </div>
            ) : (
              orderItems.map(item => (
                <div key={item.id} className="flex items-center gap-1.5 py-1.5 border-b border-slate-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium text-slate-700 leading-tight truncate">{item.name}</p>
                    <p className="text-[9px] text-slate-400">{item.sku} × {item.qty}</p>
                  </div>
                  <p className="text-[10px] font-bold text-slate-800 flex-shrink-0">
                    {item.price ? fmt(item.price * item.qty) : 'Quote'}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="p-3 border-t border-slate-100 space-y-2">
            <Button
              size="sm"
              className="w-full bg-[#e2231a] hover:bg-[#b01b13] text-white text-xs h-8"
              disabled={orderItems.length === 0}
              onClick={() => alert('Quote generation coming soon!')}
            >
              Generate Quote
            </Button>
            {orderItems.length > 0 && (
              <button
                onClick={() => setOrderItems([])}
                className="w-full text-[10px] text-slate-400 hover:text-red-500 transition-colors py-0.5"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* ══ CENTER: Digital Catalog Viewer ═══════════════════════════════ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Page navigation bar */}
          <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Page</span>
              <input
                type="number"
                min={1}
                max={MAX_PAGE}
                value={pageInput}
                onChange={handlePageInput}
                className="w-16 text-center text-sm font-bold border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
              />
              <span className="text-xs text-slate-400">of {MAX_PAGE}</span>
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= MAX_PAGE}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex-1" />

            {/* Products on this page badge */}
            {pageProducts.length > 0 && (
              <Badge className="bg-slate-100 text-slate-600 text-[10px]">
                {pageProducts.length} product{pageProducts.length !== 1 ? 's' : ''} on this page
              </Badge>
            )}

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <button onClick={zoomOut} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-slate-400 w-8 text-center">{Math.round(pdfScale * 100)}%</span>
              <button onClick={zoomIn} className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* PDF Viewer area */}
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center gap-4 bg-slate-100">
            {pdfLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 className="w-8 h-8 text-[#e2231a] animate-spin" />
                <p className="text-sm text-slate-500">Loading catalog...</p>
              </div>
            )}

            {pdfError && (
              <div className="flex flex-col items-center justify-center h-full max-w-sm text-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">Catalog PDF not yet uploaded</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Upload the Orbus Exhibitor's Handbook to Supabase storage at:<br />
                    <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block break-all">
                      orbus-assets → catalog/exhibitors-handbook.pdf
                    </code>
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Products are still shown below — you can take orders without the PDF.
                </p>
              </div>
            )}

            {pdfDoc && !pdfLoading && (
              <div className="shadow-2xl rounded-lg overflow-hidden max-w-full">
                <PdfPageView pdfDoc={pdfDoc} pageNum={currentPage} scale={pdfScale} />
              </div>
            )}

            {/* Products on this page — always shown, PDF or not */}
            {pageProducts.length > 0 && (
              <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700">
                    Products on page {currentPage}
                  </p>
                  <p className="text-[10px] text-slate-400">Click to add to quote</p>
                </div>
                <div className="p-3 grid grid-cols-2 gap-2">
                  {pageProducts.map(p => (
                    <PageProductCard
                      key={p.sku}
                      sku={p.sku}
                      name={p.name}
                      category={p.category}
                      isPrimary={p.isPrimary}
                      productData={productCache[p.sku]}
                      onFetch={fetchProduct}
                      onAdd={handleAdd}
                    />
                  ))}
                </div>
              </div>
            )}

            {pageProducts.length === 0 && !pdfLoading && (
              <div className="text-center py-4">
                <p className="text-sm text-slate-400">No products mapped to page {currentPage}</p>
                <p className="text-xs text-slate-300 mt-1">Navigate to a page with products (e.g., page 9, 31–35)</p>
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: Order Items ════════════════════════════════════════════ */}
        <div className="w-56 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#e2231a]" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Order</span>
              {itemCount > 0 && (
                <Badge className="ml-auto bg-[#e2231a] text-white text-[10px] px-1.5 py-0 h-4">
                  {itemCount}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {orderItems.length === 0 ? (
              <div className="text-center py-10">
                <ShoppingCart className="w-7 h-7 text-slate-200 mx-auto mb-2" />
                <p className="text-[11px] text-slate-400">Order is empty</p>
                <p className="text-[10px] text-slate-300 mt-1">Navigate catalog pages and click products to add</p>
              </div>
            ) : (
              orderItems.map(item => (
                <OrderItem
                  key={item.id}
                  item={item}
                  onQtyChange={handleQtyChange}
                  onRemove={handleRemove}
                />
              ))
            )}
          </div>

          {orderItems.length > 0 && (
            <div className="p-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 font-medium">Subtotal</span>
                <span className="text-sm font-black text-slate-900">
                  {subtotal > 0 ? fmt(subtotal) : 'Quote'}
                </span>
              </div>
              {hasQuoteItems && (
                <p className="text-[10px] text-amber-600 mb-2">
                  *Some items need pricing from Orbus
                </p>
              )}
              <Button
                size="sm"
                className="w-full bg-[#e2231a] hover:bg-[#b01b13] text-white text-xs h-8"
                onClick={() => alert('Quote generation coming soon!')}
              >
                Generate Quote
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}