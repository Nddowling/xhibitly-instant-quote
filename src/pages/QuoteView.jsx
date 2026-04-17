import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Printer, Link2, Send, CheckCircle2, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import BoothConceptRender from '@/components/catalog/BoothConceptRender';

function ExhibitlyLogo({ className = '' }) {
  return (
    <img
      src="https://media.base44.com/images/public/69834d9e0d7220d671bfd124/f3c8fd783_IMG_1062.png"
      alt="Xhibitly"
      className={`object-contain block rounded-[28px] overflow-hidden ${className}`}
    />
  );
}

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuoteView() {
  const [order, setOrder] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailed, setEmailed] = useState(false);

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
        setDeliveryEmail(res.data.order?.customer_email || '');
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    }
    setLoading(false);
  };

  const shareUrl = order?.share_token ? `${window.location.origin}/QuoteView?token=${order.share_token}` : '';
  const urlParams = new URLSearchParams(window.location.search);
  const isEditMode = urlParams.get('edit') === '1';

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const sendQuote = async () => {
    if (!order?.id || !deliveryEmail || emailing) return;
    setEmailing(true);
    await base44.entities.Order.update(order.id, { customer_email: deliveryEmail });
    await base44.functions.invoke('emailQuote', { order_id: order.id });
    setOrder((prev) => prev ? { ...prev, customer_email: deliveryEmail } : prev);
    setEmailed(true);
    setEmailing(false);
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
    rows.push({ SKU: '', 'Product Name': 'GRAND TOTAL', Category: '', Qty: '', 'Unit Price': '', Total: grandTotal });

    const ws = XLSX.utils.json_to_sheet(rows);
    const acctFmt = '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
      const qtyCell = ws[XLSX.utils.encode_cell({ r: R, c: 3 })];
      if (qtyCell && typeof qtyCell.v === 'number') qtyCell.z = '0';
      const upCell = ws[XLSX.utils.encode_cell({ r: R, c: 4 })];
      if (upCell && typeof upCell.v === 'number') upCell.z = acctFmt;
      const totCell = ws[XLSX.utils.encode_cell({ r: R, c: 5 })];
      if (totCell && typeof totCell.v === 'number') totCell.z = acctFmt;
    }
    // Auto column widths
    ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 6 }, { wch: 14 }, { wch: 14 }];

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
        <ExhibitlyLogo className="w-16 h-16 mx-auto mb-4" />
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
          body { font-size: 10px; background: white; margin: 0; }
          @page { margin: 0.5in; size: letter; }
          .max-w-4xl { max-width: 100% !important; padding: 0 !important; }
          .space-y-8 > * + * { margin-top: 0.6rem !important; }
          .py-10 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
          .print-break { page-break-inside: avoid; break-inside: avoid; }
          .rounded-xl, .rounded-2xl { border-radius: 4px !important; }
          .shadow-sm { box-shadow: none !important; }
          table { font-size: 9px; }
          td, th { padding: 3px 8px !important; }
          .px-6 { padding-left: 8px !important; padding-right: 8px !important; }
          .py-3 { padding-top: 3px !important; padding-bottom: 3px !important; }
          .py-4 { padding-top: 4px !important; padding-bottom: 4px !important; }
          .p-4, .p-5 { padding: 8px !important; }
          .text-xl, .text-2xl { font-size: 14px !important; }
          .text-base { font-size: 12px !important; }
          .mb-3 { margin-bottom: 4px !important; }
          .mt-1 { margin-top: 2px !important; }
          .gap-4 { gap: 6px !important; }
          h1, h2, h3 { page-break-after: avoid; }
        }
      `}</style>

      {/* Action bar */}
      <div className="no-print bg-[#1a1a1a] px-4 md:px-6 py-3 sticky top-0 z-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <ExhibitlyLogo className="w-7 h-7" />
            <span className="text-white font-bold text-sm">Xhibitly Quote</span>
            <span className="truncate text-white/30 text-xs font-mono">· {order.reference_number}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full sm:w-auto">
            <Button onClick={() => window.print()} variant="outline" size="sm"
              className="w-full border-white/20 text-white bg-transparent hover:bg-white/10 gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" /> Print / PDF
            </Button>
            <Button onClick={downloadExcel} variant="outline" size="sm"
              className="w-full border-white/20 text-white bg-transparent hover:bg-white/10 gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Excel
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6 md:space-y-8">
        {isEditMode && (
          <div className="rounded-2xl border border-[#0D4FB3]/20 bg-white p-4 md:p-5 shadow-sm print-break">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black text-slate-900">Quote Delivery</p>
                <p className="mt-1 text-sm text-slate-500">Share this quote or send it by email. An account representative will be reaching out shortly.</p>
              </div>
              <div className="flex flex-col gap-3 lg:w-[28rem]">
                <Input
                  type="email"
                  value={deliveryEmail}
                  onChange={(e) => setDeliveryEmail(e.target.value)}
                  placeholder="Customer email for quote delivery"
                  className="h-11"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Button onClick={sendQuote} disabled={!deliveryEmail || emailing} className="bg-[#0D4FB3] hover:bg-[#0b428f] text-white gap-2">
                    {emailing ? <><Send className="w-4 h-4" />Sending…</> : emailed ? <><CheckCircle2 className="w-4 h-4" />Sent</> : <><Send className="w-4 h-4" />Email Quote</>}
                  </Button>
                  <Button onClick={copyLink} variant="outline" className="gap-2">
                    <Link2 className="w-4 h-4" />{copied ? 'Copied' : 'Copy Link'}
                  </Button>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button variant="outline" className="w-full gap-2">
                      <ExternalLink className="w-4 h-4" />Open Share Link
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header block */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <ExhibitlyLogo className="w-12 h-12 flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-black text-lg sm:text-xl text-slate-900 break-words">{order.dealer_company || 'Xhibitly'}</p>
              {order.dealer_name && <p className="text-sm text-slate-400 break-words">{order.dealer_name}</p>}
              {order.dealer_email && <p className="text-xs text-slate-400 break-all">{order.dealer_email}</p>}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xl sm:text-2xl font-black text-slate-900 break-words">{order.reference_number}</p>
            <p className="text-sm text-slate-400 mt-1">{quoteDate}</p>
            <span className="inline-block mt-1 bg-[#0D4FB3]/10 text-[#0D4FB3] text-xs font-bold px-2.5 py-0.5 rounded-full">
              {order.status}
            </span>
          </div>
        </div>

        {/* Booth Concept Rendering — always shown when there are line items */}
        {lineItems.length > 0 && (
          <div className="print-break">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Booth Concept Rendering</p>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <BoothConceptRender order={order} lineItems={lineItems} />
            </div>
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
            <table className="w-[760px] sm:w-full text-sm">
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
                    <span className="text-xl font-black text-[#0D4FB3]">{fmt(grandTotal)}</span>
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