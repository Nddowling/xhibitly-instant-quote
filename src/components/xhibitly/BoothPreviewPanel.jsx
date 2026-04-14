import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Image as ImageIcon, Package, Loader2, X, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function PreviewThumb({ item, onRemove, onQuantityChange }) {
  const src = item?.image_url;

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

export default function BoothPreviewPanel({ order, lineItems, pricingResult, onGeneratePreview, onRemoveItem, isGeneratingPreview = false, previewStatus = '' }) {
  const [showBrandPrompt, setShowBrandPrompt] = useState(false);
  const [websiteInput, setWebsiteInput] = useState(order?.website_url || '');

  const handleQuantityChange = async (item, value) => {
    if (!item?.id) return;
    const parsedQty = parseInt(value, 10);
    const newQty = Number.isNaN(parsedQty) ? 1 : Math.max(1, parsedQty);
    await base44.entities.LineItem.update(item.id, {
      quantity: newQty,
      total_price: parseFloat((newQty * (item.unit_price || 0)).toFixed(2)),
    });
    window.location.reload();
  };

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

      <div className="flex-1 min-h-0 p-4 bg-slate-50/70 flex flex-col gap-4 overflow-hidden">
        <div className="relative min-h-[260px] flex-1 rounded-[24px] border border-dashed border-slate-200 bg-white flex flex-col items-center justify-center text-center px-6 overflow-hidden">
          {order?.booth_rendering_url ? (
            <img src={order.booth_rendering_url} alt="Booth preview" className="w-full h-full object-cover rounded-[20px]" />
          ) : (
            <>
              <Sparkles className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-800">AI booth image will appear here</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs">As products, booth details, and brand info are captured, this panel can show the generated concept.</p>
            </>
          )}
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
              {isGeneratingPreview ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</> : 'Generate AI Booth Image'}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 min-h-0 max-h-[230px] flex flex-col overflow-hidden">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex-shrink-0">Preview Inputs</p>
          <div className="mt-2 min-h-0 overflow-y-auto pr-1">
            <p className="text-xs text-slate-600 leading-relaxed">{previewPrompt}</p>
            {lineItems?.length > 0 && (
              <div className="mt-3 grid gap-2">
                {(lineItems || []).map((item) => (
                  <PreviewThumb
                    key={item.id || item.sku}
                    item={item}
                    onRemove={onRemoveItem}
                    onQuantityChange={handleQuantityChange}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Running Total</p>
            <p className="text-[11px] text-slate-500 mt-1">{lineItems?.length || 0} line items</p>
          </div>
          <span className="text-lg font-black text-[#0D4FB3]">{fmt(pricingResult?.finalTotal ?? lineItems?.reduce((sum, item) => sum + (item.final_total_price ?? item.total_price ?? 0), 0))}</span>
        </div>
        {showBrandPrompt && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/45 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0D4FB3]/10 text-[#0D4FB3]">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">Add branding first?</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">If you have a company website, we can pull saved brand details first and use them in the render.</p>
                </div>
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
                <Button variant="outline" onClick={handleSkipBranding} className="flex-1 rounded-xl">Skip Branding</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}