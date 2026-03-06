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

// The catalog PDF is generated dynamically by merging the uploaded chunks
const CATALOG_PDF_URL = '/api/functions/catalogPdf';

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const { cache: productCache, fetch: fetchProduct } = useProductCache();

  // Load PDF on mount
  useEffect(() => {
    const loadPdf = async () => {
      setPdfLoading(true);
      setPdfError(false);
      try {
        const moduleUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
        const pdfjsLib = await import(/* @vite-ignore */ moduleUrl);
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
        
        const doc = await pdfjsLib.getDocument({ url: CATALOG_PDF_URL, withCredentials: false }).promise;
        setPdfDoc(doc);
        setPdfLoading(false);
      } catch (err) {
        console.error('Failed to load PDF:', err);
        setPdfLoading(false);
        setPdfError(true);
      }
    };
    loadPdf();
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
      console.error("Failed to generate image", err);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

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
            <p className="text-sm text-slate-500 mb-12">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>
            
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

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {orderItems.length === 0 ? (
              <div className="text-center py-10">
                <ShoppingCart className="w-7 h-7 text-slate-200 mx-auto mb-2" />
                <p className="text-[11px] text-slate-400">Order is empty</p>
                <p className="text-[10px] text-slate-300 mt-1">Click products below the catalog to add</p>
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