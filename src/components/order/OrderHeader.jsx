import React from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const STATUS_STYLES = {
  'Pending': 'bg-yellow-100 text-yellow-800',
  'Contacted': 'bg-blue-100 text-blue-800',
  'Quoted': 'bg-purple-100 text-purple-800',
  'Negotiating': 'bg-amber-100 text-amber-800',
  'Confirmed': 'bg-green-100 text-green-800',
  'In Production': 'bg-indigo-100 text-indigo-800',
  'Shipped': 'bg-cyan-100 text-cyan-800',
  'Delivered': 'bg-emerald-100 text-emerald-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

export default function OrderHeader({ order, formatPrice }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            {order.reference_number || 'Order Details'}
          </h1>
          <Badge className={`${STATUS_STYLES[order.status] || 'bg-slate-100 text-slate-800'} font-medium text-xs`}>
            {order.status}
          </Badge>
        </div>
        <p className="text-sm text-slate-400 mt-1">
          {order.dealer_company && <span className="text-slate-600 font-medium">{order.dealer_company}</span>}
          {order.dealer_company && ' · '}
          Created {format(new Date(order.created_date), 'MMM d, yyyy')}
        </p>
      </div>
      <div className="text-left sm:text-right">
        <div className="text-2xl font-bold text-[#e2231a]">
          {formatPrice(order.quoted_price)}
        </div>
        {order.final_price && order.final_price !== order.quoted_price && (
          <div className="text-sm text-green-600 font-medium">
            Final: {formatPrice(order.final_price)}
          </div>
        )}
      </div>
    </div>
  );
}