import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Plus, Minus, ShoppingCart, FileText, Package } from 'lucide-react';
import { SKU_TO_PAGE } from '@/data/catalogPageMapping';
import { SKU_TO_IMAGE } from '@/data/skuImageMap';

const SUPABASE_URL = 'https://xpgvpzbzmkubahyxwipk.supabase.co/storage/v1/object/public/orbus-assets';

function getThumbUrl(item, productCache) {
  // 1. Stored image_url on the line item
  if (item.image_url) return item.image_url;
  // 2. From product cache (populated by CatalogQuote's fetchProduct)
  const cached = productCache?.[item.sku];
  if (cached) {
    const url = cached.primary_image_url || cached.image_cached_url || cached.image_url || cached.thumbnail_url;
    if (url) return url;
  }
  // 3. Real product photo — 344 products mapped from products.json
  if (SKU_TO_IMAGE[item.sku]) return SKU_TO_IMAGE[item.sku];
  // 4. Catalog page as last resort
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

export default function QuoteSidebar({ order, lineItems, onLineItemsChange, onCreateQuote, productCache }) {
  const total = lineItems.reduce((s, i) => s + (i.total_price || 0), 0);
  const itemCount = lineItems.reduce((s, i) => s + (i.quantity || 0), 0);

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
    <div className="w-72 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2 mb-1.5">
          <ShoppingCart className="w-4 h-4 text-[#e2231a]" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Quote Items</span>
          {itemCount > 0 && (
            <span className="ml-auto bg-[#e2231a] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {itemCount}
            </span>
          )}
        </div>
        {order && (
          <div className="text-[10px] text-slate-500 space-y-0.5">
            <p><span className="font-semibold text-slate-700">{order.customer_name}</span>{order.customer_company ? ` · ${order.customer_company}` : ''}</p>
            <p className="text-slate-400">{order.show_name}{order.booth_size ? ` · ${order.booth_size}` : ''}</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {lineItems.length === 0 ? (
          <div className="text-center py-10">
            <ShoppingCart className="w-7 h-7 text-slate-200 mx-auto mb-2" />
            <p className="text-[11px] text-slate-400">No items yet</p>
            <p className="text-[10px] text-slate-300 mt-1">Click products on catalog pages to add</p>
          </div>
        ) : lineItems.map(item => (
          <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm">
            <div className="flex items-start gap-2">
              <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                <ProductThumb src={getThumbUrl(item, productCache)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-slate-800 leading-tight line-clamp-2">{item.product_name}</p>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
                {item.category && <p className="text-[9px] text-slate-400">{item.category}</p>}
              </div>
              <button onClick={() => removeItem(item)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item, -1)} className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <Minus className="w-2.5 h-2.5 text-slate-600" />
                </button>
                <span className="text-xs font-bold w-5 text-center text-slate-700">{item.quantity}</span>
                <button onClick={() => updateQty(item, 1)} className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <Plus className="w-2.5 h-2.5 text-slate-600" />
                </button>
              </div>
              <div className="text-right">
                {item.unit_price > 0 && <p className="text-[9px] text-slate-400">{fmt(item.unit_price)} ea</p>}
                <p className="text-xs font-bold text-slate-800">{item.unit_price > 0 ? fmt(item.total_price) : '—'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Subtotal</span>
          <span className="text-sm font-black text-slate-900">{total > 0 ? fmt(total) : '—'}</span>
        </div>
        <Button
          onClick={onCreateQuote}
          disabled={lineItems.length === 0}
          className="w-full bg-[#e2231a] hover:bg-[#b01b13] text-white text-xs h-10 font-bold gap-1.5 disabled:opacity-40"
        >
          <FileText className="w-4 h-4" /> Create Quote
        </Button>
      </div>
    </div>
  );
}