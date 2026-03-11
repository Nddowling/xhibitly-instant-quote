import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuoteView() {
  const [order, setOrder] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) loadQuote(token);
    else { setLoading(false); setNotFound(true); }
  }, []);

  useEffect(() => {
    if (!loading && order) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('print') === '1') setTimeout(() => window.print(), 800);
    }
  }, [loading, order]);

  const loadQuote = async (token) => {
    try {
      const res = await base44.functions.invoke('getQuoteByToken', { share_token: token });
      if (res.data?.order) {
        setOrder(res.data.order);
        setLineItems(res.data.lineItems || []);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  };

  const downloadExcel = () => {
    const rows = lineItems.map(i => ({
      SKU: i.sku || '',
      'Product Name': i.product_name || '',
      Category: i.category || '',
      Qty: i.quantity || 1,
      'Unit Price': i.unit_price || 0,
      Total: i.total_price || 0,
    }));
    const grandTotal = lineItems.reduce((s, i) => s + (i.total_price || 0), 0);
    rows.push({ SKU: '', 'Product Name': '', Category: '', Qty: '', 'Unit Price': 'TOTAL', Total: grandTotal });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Quote ${order?.reference_number || ''}`);
    XLSX.writeFile(wb, `Xhibitly_Quote_${order?.reference_number || 'export'}.xlsx`);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !order) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center px-4">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-black text-slate-300">XQ</span>
        </div>
        <p className="text-xl font-bold text-slate-700">Quote not found</p>
        <p className="text-slate-400 mt-2 text-sm">This quote may have expired or the link is invalid.</p>
      </div>
    </div>
  );

  const grandTotal = lineItems.reduce((s, i) => s + (i.total_price || 0), 0);
  const quoteDate = new Date(order.created_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11px; background: white; }
          .print-break { page-break-inside: avoid; }
        }
      `}</style>

      {/* Action bar */}
      <div className="no-print bg-[#1a1a1a] px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#e2231a] rounded-lg flex items-center justify-center font-black text-xs text-white">XQ</div>
          <span className="text-white font-bold text-sm">Xhibitly Quote</span>
          <span className="text-white/30 text-xs font-mono">· {order.reference_number}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} variant="outline" size="sm"
            className="border-white/20 text-white bg-transparent hover:bg-white/10 gap-1.5 text-xs">
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </Button>
          <Button onClick={downloadExcel} variant="outline" size="sm"
            className="border-white/20 text-white bg-transparent hover:bg-white/10 gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Header block */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#e2231a] rounded-xl flex items-center justify-center font-black text-sm text-white">XQ</div>
            <div>
              <p className="font-black text-xl text-slate-900">{order.dealer_company || 'Xhibitly'}</p>
              {order.dealer_name && <p className="text-sm text-slate-400">{order.dealer_name}</p>}
              {order.dealer_email && <p className="text-xs text-slate-400">{order.dealer_email}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-slate-900">{order.reference_number}</p>
            <p className="text-sm text-slate-400 mt-1">{quoteDate}</p>
            <span className="inline-block mt-1 bg-[#e2231a]/10 text-[#e2231a] text-xs font-bold px-2.5 py-0.5 rounded-full">
              {order.status}
            </span>
          </div>
        </div>

        {/* Rendering image */}
        {order.booth_rendering_url && (
          <div className="print-break">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Booth Layout</p>
            <img
              src={order.booth_rendering_url}
              alt="Booth Layout"
              className="w-full max-h-[300px] object-contain rounded-xl border border-slate-200 bg-slate-50"
            />
          </div>
        )}

        {/* Customer + show info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print-break">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Customer</p>
            <p className="font-bold text-slate-800 text-base">{order.customer_name}</p>
            {order.customer_company && <p className="text-sm text-slate-500 mt-0.5">{order.customer_company}</p>}
            {order.customer_email && <p className="text-sm text-slate-400 mt-1">{order.customer_email}</p>}
            {order.customer_phone && <p className="text-sm text-slate-400">{order.customer_phone}</p>}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Show Details</p>
            <p className="font-bold text-slate-800 text-base">{order.show_name}</p>
            <p className="text-sm text-slate-500 mt-0.5">Booth Size: <span className="font-semibold">{order.booth_size}</span></p>
            {order.show_date && (
              <p className="text-sm text-slate-400 mt-1">
                {new Date(order.show_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
          </div>
        </div>

        {/* Line items table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print-break">
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Line Items — {lineItems.length} product{lineItems.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide">Product</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide hidden sm:table-cell">SKU</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide hidden md:table-cell">Category</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide">Qty</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide">Unit Price</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, idx) => (
                  <tr key={item.id} className={`border-b border-slate-50 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-6 py-3 font-medium text-slate-800">{item.product_name}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs hidden sm:table-cell">{item.sku}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">{item.category}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{fmt(item.unit_price)}</td>
                    <td className="px-6 py-3 text-right font-bold text-slate-800">{fmt(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={5} className="px-6 py-4 text-right text-sm font-bold text-slate-700">Grand Total</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-xl font-black text-[#e2231a]">{fmt(grandTotal)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 py-4 border-t border-slate-200">
          Generated by Xhibitly · {order.dealer_company}{order.dealer_name ? ` · ${order.dealer_name}` : ''}{order.dealer_email ? ` · ${order.dealer_email}` : ''}
        </div>
      </div>
    </div>
  );
}