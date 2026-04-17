import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Image as ImageIcon, Package, Loader2, X, Palette, CheckCircle2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';

const SUPABASE_URL = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPreviewThumbUrl(item) {
  if (item?.sku && SKU_TO_IMAGE[item.sku]) return SKU_TO_IMAGE[item.sku];

  const productLikeUrl = item?.image_url;
  if (productLikeUrl) {
    if (productLikeUrl.includes('/products/')) return productLikeUrl;
    if (productLikeUrl.startsWith('/products/')) return `${SUPABASE_URL}${productLikeUrl}`;
  }

  return null;
}

function PreviewThumb({ item, onRemove, onQuantityChange }) {
  const src = getPreviewThumbUrl(item);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-white border border-slate-200 flex items-center justify-center">
          {src ? (
            <img src={src} alt={item?.product_name || item?.sku || 'Product'} className="h-full w-full object-contain p-1" />
          ) : (
            <Package className="w-4 h-4 text-slate-300" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-700 leading-tight line-clamp-2">{item?.product_name || item?.sku || 'Product'}</p>
          {item?.sku && <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">{item.sku}</p>}
        </div>
        <button
          type="button"
          onClick={() => onRemove?.(item)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:text-red-500"
          title="Remove from quote"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Qty</span>
        <input
          type="number"
          min="1"
          value={item?.quantity || 1}
          onChange={(e) => onQuantityChange?.(item, e.target.value)}
          className="h-8 w-16 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700 text-center focus:outline-none focus:ring-1 focus:ring-[#0D4FB3]"
          aria-label={`Quantity for ${item?.product_name || item?.sku || 'product'}`}
        />
      </div>
    </div>
  );
}

function RenderProgressCard({ isGeneratingPreview }) {
  const steps = [
    {
      title: 'Reading quote products',
      description: 'Collecting your selected SKUs and booth details.',
      icon: CheckCircle2,
    },
    {
      title: 'Building booth prompt',
      description: 'Preparing the branded render instructions.',
      icon: Wand2,
    },
    {
      title: 'Generating booth image',
      description: 'Creating the booth concept preview image.',
      icon: Sparkles,
    },
  ];

  const exhibitFacts = [
    'Strong booth design helps brands stop more attendees in crowded 2026 exhibit halls.',
    'Clear branding and bold visuals make booths easier to remember after the show ends.',
    'Interactive exhibits are a major 2026 trend because they keep visitors engaged longer.',
    'A polished booth helps sales teams start better conversations and qualify leads faster.',
    'Modular exhibit systems are growing in 2026 because they scale across multiple show sizes.',
    'Premium graphics can make the same footprint feel more established and more valuable.',
    'Attendees judge credibility fast, so booth presentation matters before anyone says hello.',
    'Open, well-planned layouts help staff greet more visitors without making the booth feel cramped.',
    'Brands investing in stronger exhibit presence often get more photo-sharing and social visibility.',
    'A better booth experience can improve traffic quality, not just traffic volume.'
  ];

  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(12);
  const [factIndex, setFactIndex] = useState(0);

  useEffect(() => {
    if (!isGeneratingPreview) {
      setActiveStep(0);
      setProgress(12);
      setFactIndex(0);
      return;
    }

    setActiveStep(0);
    setProgress(12);
    setFactIndex(0);

    const startedAt = Date.now();
    const totalDuration = 12000;
    const stepDuration = totalDuration / steps.length;

    const progressTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const boundedElapsed = Math.min(elapsed, totalDuration);
      const nextStep = Math.min(Math.floor(boundedElapsed / stepDuration), steps.length - 1);
      const nextProgress = Math.min(12 + (boundedElapsed / totalDuration) * 78, 90);

      setActiveStep(nextStep);
      setProgress(nextProgress);
    }, 180);

    const factTimer = window.setInterval(() => {
      setFactIndex((prev) => (prev + 1) % exhibitFacts.length);
    }, 4000);

    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(factTimer);
    };
  }, [isGeneratingPreview]);

  return (
    <div className="h-full rounded-[24px] border border-[#1f3f86] bg-[linear-gradient(180deg,#0d1730_0%,#16233d_100%)] p-4 text-white shadow-[0_18px_40px_rgba(13,79,179,0.22)] flex flex-col overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-[#6EA8FF]">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black tracking-tight">Rendering your booth concept</p>
          <p className="mt-1 text-xs text-white/65">Building the scene from your selected products and booth layout.</p>
        </div>
      </div>

      <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#0D4FB3_0%,#4A8DFF_100%)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {steps.map((step, index) => (
          <div
            key={step.title}
            className={`h-1.5 rounded-full transition-all duration-300 ${index === activeStep ? 'w-8 bg-[#4A8DFF]' : index < activeStep ? 'w-4 bg-white/70' : 'w-4 bg-white/15'}`}
          />
        ))}
      </div>

      <div className="relative mt-4 min-h-[210px] flex-1 overflow-hidden rounded-[22px] border border-white/8 bg-white/6 px-5 py-6">
        <div className="flex h-full flex-col justify-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#2B6EF3]/20 text-[#7FB0FF]">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-black text-white">2026 Exhibit Insight</p>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">LIVE</span>
              </div>
            </div>
          </div>

          <div className="relative mt-6 min-h-[96px] overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.p
                key={factIndex}
                initial={{ opacity: 0, x: 120 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -120 }}
                transition={{ duration: 0.45, ease: 'easeInOut' }}
                className="absolute inset-0 text-[22px] font-bold leading-tight text-white/95 sm:text-[26px]"
              >
                {exhibitFacts[factIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BoothPreviewPanel({ order, lineItems, pricingResult, onGeneratePreview, onRemoveItem, onQuantityChange, onGenerateQuote, isGeneratingPreview = false, previewStatus = '', brandWebsite = '' }) {
  const [showBrandPrompt, setShowBrandPrompt] = useState(false);
  const [websiteInput, setWebsiteInput] = useState(order?.website_url || '');
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const previewPrompt = useMemo(() => {
    const items = (lineItems || []).map(item => item.product_name || item.sku).filter(Boolean);
    const brand = order?.customer_company || order?.customer_name || 'Client brand';
    const booth = order?.booth_size || 'Booth size not set';
    const show = order?.show_name || 'Event not set';
    if (items.length === 0) return 'Start adding products to generate a branded booth preview.';
    return `${brand} • ${booth} • ${show} • ${items.join(', ')}`;
  }, [order, lineItems]);

  const handleGenerateClick = () => {
    setWebsiteInput(order?.website_url || '');
    setShowBrandPrompt(true);
  };

  const handleBrandConfirm = async () => {
    setShowBrandPrompt(false);
    await onGeneratePreview?.({ website_url: websiteInput.trim() });
  };

  const handleSkipBranding = async () => {
    setShowBrandPrompt(false);
    await onGeneratePreview?.({ website_url: '' });
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] overflow-hidden h-full flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0D4FB3]/10 text-[#0D4FB3]">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-black tracking-tight text-slate-900">Booth Preview</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">AI image</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Preview area for the customer’s branded booth concept.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-4 bg-slate-50/70 flex flex-col gap-4 overflow-visible">
        <div className="relative min-h-[260px] flex-1 rounded-[24px] border border-dashed border-slate-200 bg-white overflow-hidden">
          {order?.booth_rendering_url ? (
            <img
              src={order.booth_rendering_url}
              alt="Booth preview"
              className="w-full h-full object-cover rounded-[20px] cursor-zoom-in"
              onClick={() => setImageModalOpen(true)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <Sparkles className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-800">AI booth image will appear here</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs">As products, booth details, and brand info are captured, this panel can show the generated concept.</p>
            </div>
          )}

          {!isGeneratingPreview && (
            <div className="absolute bottom-4 left-4 right-4 flex flex-col items-center gap-2">
              {previewStatus ? (
                <div className="rounded-full bg-slate-900/85 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm">
                  {previewStatus}
                </div>
              ) : null}
              <Button
                onClick={handleGenerateClick}
                disabled={!lineItems?.length || isGeneratingPreview}
                className="rounded-xl bg-[#0D4FB3] hover:bg-[#0b428f] text-white shadow-sm"
              >
                Generate AI Booth Image
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 min-h-0 max-h-[280px] flex flex-col overflow-hidden">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex-shrink-0">Current Render Inputs</p>
          <div className="mt-2 min-h-0 overflow-y-auto pr-1 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Brand</p>
              <p className="mt-1 text-xs font-semibold text-slate-800">{order?.customer_company || order?.customer_name || 'Client brand'}</p>
              <p className="mt-1 text-[11px] text-slate-500 break-all">{brandWebsite || order?.website_url || 'No website added'}</p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{previewPrompt}</p>
            {lineItems?.length > 0 && (
              <div className="grid gap-2">
                {(lineItems || []).map((item) => (
                  <PreviewThumb
                    key={item.id || item.sku}
                    item={item}
                    onRemove={onRemoveItem}
                    onQuantityChange={onQuantityChange}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Running Total</p>
              <p className="text-[11px] text-slate-500 mt-1">{lineItems?.length || 0} line items</p>
            </div>
            <span className="text-lg font-black text-[#0D4FB3]">{fmt(pricingResult?.finalTotal ?? lineItems?.reduce((sum, item) => sum + (item.final_total_price ?? item.total_price ?? 0), 0))}</span>
          </div>
          <Button
            onClick={onGenerateQuote}
            disabled={!order?.id || !lineItems?.length || isGeneratingPreview}
            className="w-full rounded-xl bg-[#0D4FB3] hover:bg-[#0b428f] text-white"
          >
            {isGeneratingPreview ? 'Generating Preview…' : 'Generate Quote'}
          </Button>
        </div>
        {showBrandPrompt && createPortal(
          <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xl max-h-[calc(100%-1.5rem)] overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0D4FB3]/10 text-[#0D4FB3] flex-shrink-0">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">Add branding first?</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">If you have a company website, we can pull saved brand details first and use them in the render.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBrandPrompt(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700 flex-shrink-0"
                  aria-label="Close branding modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4">
                <Input
                  value={websiteInput}
                  onChange={(e) => setWebsiteInput(e.target.value)}
                  placeholder="Company website (optional)"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleBrandConfirm} className="flex-1 rounded-xl bg-[#0D4FB3] hover:bg-[#0b428f] text-white">Use Website</Button>
                <Button variant="outline" onClick={handleSkipBranding} className="flex-1 rounded-xl hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300">Skip Branding</Button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {isGeneratingPreview && createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md">
              <RenderProgressCard isGeneratingPreview={isGeneratingPreview} />
            </div>
          </div>,
          document.body
        )}

        {imageModalOpen && order?.booth_rendering_url && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/90 p-4" onClick={() => setImageModalOpen(false)}>
            <button
              type="button"
              onClick={() => setImageModalOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={order.booth_rendering_url}
              alt="Booth preview full size"
              className="max-h-full max-w-full rounded-[20px] object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}