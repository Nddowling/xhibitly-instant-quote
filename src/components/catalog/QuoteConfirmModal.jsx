import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Link2, Download, X, FileText, ExternalLink, Send, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import BoothConceptRender from '@/components/catalog/BoothConceptRender';
import PricingBreakdown from '@/components/pricing/PricingBreakdown';
import { base44 } from '@/api/base44Client';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuoteConfirmModal({ order, lineItems, onClose, isPreview = false, generatedPromos = [], appliedRules = [] }) {
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailed, setEmailed] = useState(false);

  const submitToQueue = async () => {
    if (!order?.id || submitted) return;
    setSubmitting(true);
    try {
      const user = await base44.auth.me();
      const todayStr = new Date().toLocaleDateString('en-CA');

      // Find this user's SalesRep record
      let salesRepId = null;
      const reps = await base44.entities.SalesRep.filter({ email: user.email });
      if (reps?.length > 0) salesRepId = reps[0].id;

      // Update the order: assign rep + set today as urgent follow-up
      await base44.entities.Order.update(order.id, {
        assigned_sales_rep_id: salesRepId || undefined,
        follow_up_date: todayStr,
        status: order.status === 'Draft' || order.status === 'Pending' ? 'Quoted' : order.status,
      });

      // Log a "quote_sent" activity
      await base44.entities.Activity.create({
        order_id: order.id,
        activity_type: 'quote_sent',
        subject: `Quote submitted to follow-up queue`,
        description: `Quote ${order.reference_number} submitted for ${order.customer_name || order.customer_email}. Awaiting first contact.`,
        outcome: 'neutral',
        next_action: 'Make initial contact with customer',
        next_action_date: todayStr,
      });

      setSubmitted(true);
    } catch (e) {
      console.error('Submit to queue failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const shareUrl = order?.share_token
    ? `${window.location.origin}/QuoteView?token=${order.share_token}`
    : '';

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
    ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 18 }, { wch: 6 }, { wch: 14 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Quote ${order?.reference_number || ''}`);
    XLSX.writeFile(wb, `Xhibitly_Quote_${order?.reference_number || 'export'}.xlsx`);
  };

  const openPdf = () => {
    if (shareUrl) window.open(shareUrl + '&print=1', '_blank');
  };

  const emailQuote = async () => {
    if (!order?.id || emailing || !order?.customer_email) return;
    setEmailing(true);
    try {
      await base44.functions.invoke('emailQuote', { order_id: order.id });
      setEmailed(true);
    } finally {
      setEmailing(false);
    }
  };

  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden" style={{ maxHeight: '95vh' }}>
        {/* Header */}
        <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 ${isPreview ? 'bg-[#e2231a]' : 'bg-green-500'} rounded-full flex items-center justify-center flex-shrink-0`}>
              {isPreview ? <FileText className="w-5 h-5 text-white" /> : <CheckCircle2 className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{isPreview ? 'Current Quote' : 'Quote Created!'}</h2>
              <p className="text-xs text-white/40 font-mono">{order?.reference_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-column body */}
        <div className="flex overflow-hidden" style={{ maxHeight: 'calc(95vh - 72px)' }}>

          {/* LEFT: Summary + actions */}
          <div className="w-72 flex-shrink-0 border-r border-slate-200 overflow-y-auto p-5 space-y-4">
            {/* Summary */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              {[
                { label: 'Customer', value: order?.customer_name },
                { label: 'Company', value: order?.customer_company },
                { label: 'Show', value: order?.show_name },
                { label: 'Booth', value: order?.booth_size },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-slate-500 flex-shrink-0">{label}</span>
                  <span className="font-semibold text-slate-800 text-right">{value}</span>
                </div>
              ))}
            </div>

            <PricingBreakdown order={order} rules={appliedRules} generatedPromos={generatedPromos} />

            {/* Share link */}
            {shareUrl && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Shareable Link</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-[9px] text-slate-400 truncate font-mono">
                    {shareUrl}
                  </div>
                  <Button onClick={copyLink} size="sm" variant="outline" className="flex-shrink-0 text-xs h-9 px-2">
                    <Link2 className="w-3.5 h-3.5" />
                    <span className="ml-1">{copied ? '✓' : 'Copy'}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={openPdf} variant="outline" className="gap-1.5 text-xs h-9">
                <FileText className="w-3.5 h-3.5" /> PDF
              </Button>
              <Button onClick={downloadExcel} variant="outline" className="gap-1.5 text-xs h-9">
                <Download className="w-3.5 h-3.5" /> Excel
              </Button>
            </div>

            <Button
              onClick={emailQuote}
              disabled={emailing || emailed || !order?.customer_email}
              className="w-full h-10 text-sm font-bold gap-2 bg-[#0D4FB3] hover:bg-[#0b428f] text-white disabled:opacity-50"
            >
              {emailing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending Quote…</>
              ) : emailed ? (
                <><CheckCircle2 className="w-4 h-4" /> Quote Emailed</>
              ) : (
                <><Send className="w-4 h-4" /> Email Quote to Customer</>
              )}
            </Button>

            {shareUrl && (
              <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-[#e2231a] hover:underline font-semibold">
                <ExternalLink className="w-3.5 h-3.5" /> Open Quote View
              </a>
            )}

            <Button
              onClick={submitToQueue}
              disabled={submitting || submitted}
              className={`w-full h-10 text-sm font-bold gap-2 ${submitted ? 'bg-green-600 hover:bg-green-600' : 'bg-[#e2231a] hover:bg-[#b01b13]'} text-white`}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
              ) : submitted ? (
                <><CheckCircle2 className="w-4 h-4" /> Submitted to Queue</>
              ) : (
                <><Send className="w-4 h-4" /> Submit Quote to Queue</>
              )}
            </Button>

            <Button onClick={onClose} className="w-full bg-[#1a1a1a] hover:bg-black text-white h-10 text-sm font-bold">
              Continue Browsing
            </Button>
          </div>

          {/* RIGHT: Booth render + products */}
          <div className="flex-1 overflow-y-auto p-5">
            {lineItems.length > 0 && (
              <BoothConceptRender order={order} lineItems={lineItems} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}