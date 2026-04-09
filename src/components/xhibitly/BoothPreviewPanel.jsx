import React, { useMemo } from 'react';
import { Sparkles, Image as ImageIcon } from 'lucide-react';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BoothPreviewPanel({ order, lineItems, pricingResult }) {
  const previewPrompt = useMemo(() => {
    const items = (lineItems || []).map(item => item.product_name || item.sku).filter(Boolean).slice(0, 6);
    const brand = order?.customer_company || order?.customer_name || 'Client brand';
    const booth = order?.booth_size || 'Booth size not set';
    const show = order?.show_name || 'Event not set';
    if (items.length === 0) return 'Start adding products to generate a branded booth preview.';
    return `${brand} • ${booth} • ${show} • ${items.join(', ')}`;
  }, [order, lineItems]);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)] overflow-hidden h-full flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf6ff] text-[#18C3F8]">
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

      <div className="flex-1 min-h-0 p-4 bg-slate-50/70 flex flex-col gap-4">
        <div className="flex-1 rounded-[24px] border border-dashed border-slate-200 bg-white flex flex-col items-center justify-center text-center px-6">
          {order?.booth_rendering_url ? (
            <img src={order.booth_rendering_url} alt="Booth preview" className="w-full h-full object-cover rounded-[20px]" />
          ) : (
            <>
              <Sparkles className="w-8 h-8 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-800">AI booth image will appear here</p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-xs">As products, booth details, and brand info are captured, this panel can show the generated concept.</p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Preview Inputs</p>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{previewPrompt}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Running Total</p>
            <p className="text-[11px] text-slate-500 mt-1">{lineItems?.length || 0} line items</p>
          </div>
          <span className="text-lg font-black text-[#18C3F8]">{fmt(pricingResult?.finalTotal ?? lineItems?.reduce((sum, item) => sum + (item.final_total_price ?? item.total_price ?? 0), 0))}</span>
        </div>
      </div>
    </div>
  );
}