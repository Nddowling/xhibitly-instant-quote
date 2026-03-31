import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Plus, Minus, ShoppingCart, FileText, Package } from 'lucide-react';
import { SKU_TO_PAGE } from '@/data/catalogPageMapping';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';
import QuotePricingPanel from '@/components/pricing/QuotePricingPanel';

const SUPABASE_URL = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';

function getThumbUrl(item, productCache) {
  // 1. Verified product photo from static map — always wins for known SKUs
  if (item.sku && SKU_TO_IMAGE[item.sku]) return SKU_TO_IMAGE[item.sku];
  // 2. Stored image_url on the line item (skip catalog page scans)
  if (item.image_url && item.image_url.includes('/products/')) return item.image_url;
  // 3. From product cache (populated by CatalogQuote's fetchProduct)
  const cached = productCache?.[item.sku];
  if (cached) {
    const url = cached.primary_image_url || cached.image_cached_url || cached.image_url || cached.thumbnail_url;
    if (url && url.includes('/products/')) return url;
  }
  // 4. Any stored image_url as fallback
  if (item.image_url) return item.image_url;
  // 5. Catalog page as last resort
  const page = SKU_TO_PAGE[item.sku];
  if (page) return `${SUPABASE_URL}/catalog/pages/page-${String(page + 2).padStart(3, '0')}.jpg`;
  return null;
}

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ProductThumb({ src }) {
  const [error, setError] = React.useState(false);
  if (!src || error) return <Package className="w-4 h-4 text-slate-300" />;
  return <img src={src} alt="" className="w-full h-full object-contain p-0.5" onError={() => setError(true)} />;
}

export default function QuoteSidebar({ order, lineItems, onLineItemsChange, onCreateQuote, productCache, onPricingResult }) {
  const [rules, setRules] = useState([]);
  const [dealerSettings, setDealerSettings] = useState(null);
  const [pricingResult, setPricingResult] = useState(null);
  const total = pricingResult?.finalTotal ?? lineItems.reduce((s, i) => s + (i.total_price || 0), 0);
  const itemCount = lineItems.reduce((s, i) => s + (i.quantity || 0), 0);

  useEffect(() => {
    Promise.all([
      base44.entities.PricingRule.filter({ is_active: true }),
      base44.auth.me().then(u => base44.entities.DealerPricingSettings.filter({ user_id: u.id }))
    ]).then(([r, s]) => {
      setRules(r || []);
      setDealerSettings(s?.[0] || null);
    }).catch(() => {});
  }, []);

  const handlePricingResult = (result) => {
    setPricingResult(result);
    onPricingResult?.(result);
  };

  const updateQty = async (item, delta) => {
    const newQty = Math.max(1, (item.quantity || 1) + delta);
    await base44.entities.LineItem.update(item.id, {
      quantity: newQty,
      total_price: parseFloat((newQty * (item.unit_price || 0)).toFixed(2)),
    });
    onLineItemsChange();
  };

  const removeItem = async (item) => {
    await base44.entities.LineItem.delete(item.id);
    onLineItemsChange();
  };

  return (
    <div className="w-full h-full min-h-0 flex-shrink-0 bg-white flex flex-col overflow-hidden">
      <div className="border-b border-slate-200 bg-white px-3 py-3 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e2231a]/10 text-[#e2231a]">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-black tracking-tight text-slate-900">Quote Builder</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                {itemCount} item{itemCount === 1 ? '' : 's'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {order ? 'Client-ready selections for this booth quote.' : 'Start selecting products to build the proposal.'}
            </p>
          </div>
        </div>

        {order && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-900">{order.customer_name || 'Untitled client'}</p>
            <p className="mt-1">{order.customer_company ? `${order.customer_company} · ` : ''}{order.show_name || 'Show not set'}</p>
            <p className="mt-1 text-slate-500">{order.booth_size ? `${order.booth_size} booth` : 'Booth size not set yet'}</p>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2 bg-slate-50/70">
        {lineItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
            <ShoppingCart className="w-8 h-8 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-800">No products added yet</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Click highlighted products in the catalog to start building this client proposal.
            </p>
          </div>
        ) : (
          lineItems.map(item => {
            const finalUnit = item.final_unit_price ?? item.unit_price;
            const finalTotal = item.final_total_price ?? item.total_price;
            const listUnit = item.list_unit_price ?? item.unit_price;
            const markupAmount = Math.max(0, (finalUnit || 0) - (listUnit || 0) + (item.rule_discount_amount || 0));

            return (
              <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                    <ProductThumb src={getThumbUrl(item, productCache)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2">{item.product_name}</p>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
                    {item.category && <p className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">{item.category}</p>}
                  </div>
                  <button onClick={() => removeItem(item)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 p-0.5">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 rounded-lg bg-slate-50 px-2.5 py-2 text-[9px] border border-slate-100">
                  <span className="text-slate-500">List</span>
                  <span className="text-right font-semibold text-slate-700">{listUnit > 0 ? fmt(listUnit) : '—'}</span>
                  <span className="text-slate-500">Markup</span>
                  <span className="text-right font-semibold text-slate-700">{markupAmount > 0 ? fmt(markupAmount) : '—'}</span>
                  <span className="text-slate-500">Final each</span>
                  <span className="text-right font-semibold text-slate-900">{finalUnit > 0 ? fmt(finalUnit) : '—'}</span>
                </div>

                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 rounded-full bg-slate-100 p-1">
                    <button onClick={() => updateQty(item, -1)} className="w-6 h-6 rounded-full bg-white hover:bg-slate-200 flex items-center justify-center transition-colors shadow-sm">
                      <Minus className="w-3 h-3 text-slate-600" />
                    </button>
                    <span className="text-xs font-bold w-6 text-center text-slate-700">{item.quantity}</span>
                    <button onClick={() => updateQty(item, 1)} className="w-6 h-6 rounded-full bg-white hover:bg-slate-200 flex items-center justify-center transition-colors shadow-sm">
                      <Plus className="w-3 h-3 text-slate-600" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Line total</p>
                    <p className="text-sm font-black text-slate-900">{finalTotal > 0 ? fmt(finalTotal) : '—'}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {order && (
        <div className="flex-shrink-0">
          <QuotePricingPanel
            order={order}
            lineItems={lineItems}
            dealerSettings={dealerSettings}
            rules={rules}
            onPricingResult={handlePricingResult}
          />
        </div>
      )}

      <div className="p-3 border-t border-slate-200 bg-white space-y-2.5 flex-shrink-0">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{pricingResult ? 'Quote Total' : 'Current Subtotal'}</p>
            <p className="text-[11px] text-slate-500 mt-1">{itemCount} item{itemCount === 1 ? '' : 's'} selected</p>
          </div>
          <span className="text-lg font-black text-[#e2231a]">{total > 0 ? fmt(total) : '—'}</span>
        </div>
        <Button
          onClick={onCreateQuote}
          disabled={lineItems.length === 0}
          className="w-full bg-[#e2231a] hover:bg-[#b01b13] text-white text-sm h-11 font-bold gap-1.5 rounded-xl disabled:opacity-40"
        >
          <FileText className="w-4 h-4" /> Review & Create Quote
        </Button>
      </div>
    </div>
  );
}