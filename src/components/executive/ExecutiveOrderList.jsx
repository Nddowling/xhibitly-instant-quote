import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

function fmtMoney(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function ExecutiveOrderList({ title, subtitle, orders, preset }) {
  const navigate = useNavigate();

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>
      {orders.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">No orders in this category yet.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => navigate(`${createPageUrl('OrderDetail')}?id=${order.id}&returnTo=${encodeURIComponent(`${createPageUrl('ExecutiveListView')}?preset=${preset || 'active'}`)}`)}
              className="w-full grid grid-cols-1 md:grid-cols-5 gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{order.customer_company || order.customer_name || 'Untitled Order'}</p>
                <p className="text-xs text-slate-500 mt-1">{order.customer_name || order.customer_email || 'No contact'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                <p className="text-sm font-bold text-slate-800">{order.status || 'Draft'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Show</p>
                <p className="text-sm font-bold text-slate-800">{order.show_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Booth</p>
                <p className="text-sm font-bold text-slate-800">{order.booth_size || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Value</p>
                <p className="text-sm font-bold text-slate-800">{fmtMoney(order.final_price || order.quoted_price || 0)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}