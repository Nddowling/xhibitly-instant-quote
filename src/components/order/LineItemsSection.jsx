import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';

export default function LineItemsSection({ lineItems, products, order, formatPrice }) {
  const items = lineItems.length > 0 ? lineItems : [];
  const showProducts = products.length > 0 && lineItems.length === 0;

  if (items.length === 0 && !showProducts) return null;

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-[#e2231a]" />
          <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            {showProducts ? 'Included Products' : 'Line Items'}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="space-y-2">
          {items.length > 0 ? items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800">{item.product_name}</p>
                {item.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  {item.category && <Badge variant="outline" className="text-[10px] h-5">{item.category}</Badge>}
                  {item.quantity > 1 && <span className="text-xs text-slate-400">Qty: {item.quantity}</span>}
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-900 shrink-0">{formatPrice(item.total_price)}</p>
            </div>
          )) : products.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
              <div className="min-w-0 flex-1 flex items-center gap-3">
                {p.image_url && (
                  <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-md object-cover border shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-900 shrink-0">{formatPrice(p.base_price)}</p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-4 pt-3 border-t-2 border-slate-200 flex items-center justify-between">
          <span className="font-semibold text-slate-700">Total</span>
          <span className="text-xl font-bold text-[#e2231a]">{formatPrice(order.quoted_price)}</span>
        </div>
        {order.discount_amount > 0 && (
          <div className="flex items-center justify-between mt-1 text-sm">
            <span className="text-green-600">Discount</span>
            <span className="text-green-600 font-medium">-{formatPrice(order.discount_amount)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}