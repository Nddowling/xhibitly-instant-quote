import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PAGE_PRODUCTS, MAX_PAGE, MIN_PAGE, SKU_TO_PAGE } from '@/data/catalogPageMapping';
import {
  ChevronLeft, ChevronRight, Plus, Minus, Trash2, ShoppingCart,
  DollarSign, FileText, Search, X, ZoomIn, ZoomOut, Loader2, BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PDF_URLS = [
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/96f439ea9_exhibitors-handbook_p001-005.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/fa2d96f04_exhibitors-handbook_p006-010.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/44e40bba6_exhibitors-handbook_p011-015.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/8f60bf7fc_exhibitors-handbook_p016-020.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/f1f8ef1c8_exhibitors-handbook_p021-025.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/b63e7ed26_exhibitors-handbook_p026-030.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/8c0c5ec5d_exhibitors-handbook_p031-035.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/854305152_exhibitors-handbook_p036-040.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/ed1455046_exhibitors-handbook_p041-045.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/a731186ff_exhibitors-handbook_p046-050.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/a713f27cb_exhibitors-handbook_p051-055.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/8f79a785c_exhibitors-handbook_p061-065.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/4a399cd76_exhibitors-handbook_p066-070.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/f82e19db9_exhibitors-handbook_p071-075.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/7ae81ab2f_exhibitors-handbook_p076-080.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/022a60eca_exhibitors-handbook_p081-085.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/acf440a1f_exhibitors-handbook_p086-090.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/510464716_exhibitors-handbook_p091-095.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/ab3ab9e5a_exhibitors-handbook_p096-100.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/b91a3e4cb_exhibitors-handbook_p101-105.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/4818a9bc5_exhibitors-handbook_p106-110.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/455b00486_exhibitors-handbook_p111-115.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/8477ffd86_exhibitors-handbook_p116-120.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/04f6dca26_exhibitors-handbook_p121-125.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/6096b205b_exhibitors-handbook_p126-130.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/4cbbc4149_exhibitors-handbook_p131-135.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/63bee2b79_exhibitors-handbook_p136-140.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/ede072fe2_exhibitors-handbook_p146-150.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/7bfcbade4_exhibitors-handbook_p151-155.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/76940cac3_exhibitors-handbook_p156-160.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/7404245ec_exhibitors-handbook_p161-165.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/0e395ee7b_exhibitors-handbook_p166-170.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/09ae679a1_exhibitors-handbook_p176-180.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/20026656c_exhibitors-handbook_p181-185.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/e8f158557_exhibitors-handbook_p186-190.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/510d7b8aa_exhibitors-handbook_p191-195.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/75326516f_exhibitors-handbook_p196-200.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/4302dc6c2_exhibitors-handbook_p201-205.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/7484fc06b_exhibitors-handbook_p206-210.pdf",
  "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69834d9e0d7220d671bfd124/5b3814230_exhibitors-handbook_p211-215.pdf"
];

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
function PdfPageView({ pdfDoc, pageNum, scale = 1.0, className = "" }) {
  const canvasRef = useRef(null);
  const renderTask = useRef(null);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !pageNum) return;
    let cancelled = false;

    const render = async () => {
      try {
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

  if (!pageNum) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-auto ${className}`}
      style={{ display: 'block' }}
    />
  );
}

// ─── Product Card (on the page) ──────────────────────────────────────────────
function PageProductCard({ sku, name, category, isPrimary, productData, onFetch, onAdd }) {
  useEffect(() => { onFetch(sku); }, [sku, onFetch]);

  const price = productData?.base_price || productData?.price_min || null;
  const imgUrl = productData?.image_cached_url || productData?.image_url || null;
  const sizes = productData?.sizes?.length > 0 ? productData.sizes : productData?.booth_sizes?.length > 0 ? productData.booth_sizes : [];

  return (
    <div className={`group flex flex-col gap-2 p-3 rounded-xl border transition-all text-left w-full bg-white/95 backdrop-blur-sm hover:shadow-md
        ${isPrimary ? 'border-[#e2231a]/40 shadow-sm' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-white overflow-hidden flex items-center justify-center border border-slate-100 shadow-sm">
          {imgUrl ? (
            <img src={imgUrl} alt={name} className="w-full h-full object-contain p-1" />
          ) : (
            <span className="text-slate-200 text-xl">📦</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 leading-tight line-clamp-2">{name}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{sku}</p>
        </div>
      </div>
      
      <Button 
        size="sm" 
        variant="default" 
        className="w-full h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white mt-1 shadow-sm"
        onClick={() => onAdd({ sku, name: productData?.name || name, category, price, imageUrl: imgUrl, sizes })}
      >
        <Plus className="w-3 h-3 mr-1.5" /> Add to Quote
      </Button>
    </div>
  );
}

// ─── Order Item Row ──────────────────────────────────────────────────────────
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
            : <span className="text-slate-300 text-sm">📦</span>
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [direction, setDirection] = useState(1);
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
        
        // Merge PDFs in the frontend to avoid backend memory limits
        const { PDFDocument } = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm');
        const mergedPdf = await PDFDocument.create();
        
        // Fetch all PDFs in parallel
        const fetchPromises = PDF_URLS.map(url => fetch(url).then(res => res.arrayBuffer()));
        const buffers = await Promise.all(fetchPromises);

        for (const buffer of buffers) {
            const pdf = await PDFDocument.load(buffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const objectUrl = URL.createObjectURL(blob);
        
        const doc = await pdfjsLib.getDocument({ url: objectUrl, withCredentials: false }).promise;
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
  const displayProducts = React.useMemo(() => {
    return currentPage === 1 
      ? (PAGE_PRODUCTS[1] || [])
      : [
          ...(PAGE_PRODUCTS[currentPage] || []),
          ...(currentPage + 1 <= MAX_PAGE ? (PAGE_PRODUCTS[currentPage + 1] || []) : [])
        ];
  }, [currentPage]);

  useEffect(() => {
    displayProducts.forEach(p => fetchProduct(p.sku));
  }, [displayProducts, fetchProduct]);

  // Navigation
  const goToPage = useCallback((n) => {
    let p = Math.max(1, Math.min(n, MAX_PAGE));
    if (p > 1 && p % 2 !== 0) {
      p = p - 1;
    }
    setDirection(p > currentPage ? 1 : -1);
    setCurrentPage(p);
    setPageInput(String(p));
  }, [currentPage]);

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

  const handleSizeChange = useCallback((id, size) => {
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, selectedSize: size } : i));
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
              onClick={() => goToPage(currentPage === 1 ? 1 : currentPage - 2)}
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
              onClick={() => goToPage(currentPage === 1 ? 2 : currentPage + 2)}
              disabled={currentPage >= MAX_PAGE - (currentPage === 1 ? 0 : 1)}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex-1" />

            {/* Products on this page badge */}
            {displayProducts.length > 0 && (
              <Badge className="bg-slate-100 text-slate-600 text-[10px]">
                {displayProducts.length} product{displayProducts.length !== 1 ? 's' : ''} on this page
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
          <div className="flex-1 relative bg-slate-100 flex overflow-hidden">
            <div className="flex-1 overflow-auto p-4 flex flex-col items-center gap-4">
              {pdfLoading && (
                <div className="flex flex-col items-center justify-center h-full gap-3 mt-20">
                  <Loader2 className="w-8 h-8 text-[#e2231a] animate-spin" />
                  <p className="text-sm text-slate-500">Loading catalog...</p>
                </div>
              )}

              {pdfError && (
                <div className="flex flex-col items-center justify-center h-full max-w-sm text-center gap-4 mt-20">
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
                <div className="relative w-full flex-1 flex items-center justify-center overflow-hidden" style={{ perspective: 1200 }}>
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={currentPage}
                      custom={direction}
                      initial={{ opacity: 0, rotateY: direction > 0 ? 30 : -30, scale: 0.95 }}
                      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                      exit={{ opacity: 0, rotateY: direction > 0 ? -30 : 30, scale: 0.95 }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                      className="flex justify-center items-center max-w-full drop-shadow-2xl"
                    >
                      {currentPage === 1 ? (
                        <div className="w-1/2 max-w-2xl bg-white rounded-r-lg overflow-hidden">
                          <PdfPageView pdfDoc={pdfDoc} pageNum={1} scale={pdfScale} />
                        </div>
                      ) : (
                        <div className="flex w-full max-w-5xl bg-white rounded-lg overflow-hidden">
                          <div className="w-1/2 border-r border-slate-300 relative">
                            <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-black/10 to-transparent pointer-events-none z-10" />
                            <PdfPageView pdfDoc={pdfDoc} pageNum={currentPage} scale={pdfScale} />
                          </div>
                          <div className="w-1/2 relative">
                            <div className="absolute top-0 left-0 bottom-0 w-12 bg-gradient-to-r from-black/10 to-transparent pointer-events-none z-10" />
                            {currentPage + 1 <= MAX_PAGE && (
                              <PdfPageView pdfDoc={pdfDoc} pageNum={currentPage + 1} scale={pdfScale} />
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}
              
              {displayProducts.length === 0 && !pdfLoading && (
                <div className="text-center py-4 shrink-0 mt-4">
                  <p className="text-sm text-slate-400">No products mapped to {currentPage === 1 ? 'page 1' : `pages ${currentPage}-${currentPage + 1}`}</p>
                  <p className="text-xs text-slate-300 mt-1">Navigate to a page with products (e.g., page 9, 31–35)</p>
                </div>
              )}
            </div>

            {/* Floating Products Panel Overlay */}
            {displayProducts.length > 0 && !pdfLoading && (
              <div className="absolute right-6 top-6 bottom-6 w-72 bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 shadow-2xl overflow-hidden flex flex-col z-20 pointer-events-auto">
                <div className="px-4 py-3 bg-slate-900/90 backdrop-blur-md text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#e2231a]" />
                    <p className="text-sm font-bold">On This Page</p>
                  </div>
                  <Badge className="bg-white/20 text-white hover:bg-white/30 border-none">{displayProducts.length}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {displayProducts.map(p => (
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