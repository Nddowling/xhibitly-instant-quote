import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Link2, Download, X, FileText, ExternalLink } from 'lucide-react';
import * as XLSX from 'xlsx';
import BoothConceptRender from '@/components/catalog/BoothConceptRender';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuoteConfirmModal({ order, lineItems, onClose, isPreview = false }) {
  const [copied, setCopied] = useState(false);

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
    rows.push({ SKU: '', 'Product Name': '', Category: '', Qty: '', 'Unit Price': 'TOTAL', Total: grandTotal });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Quote ${order?.reference_number || ''}`);
    XLSX.writeFile(wb, `Xhibitly_Quote_${order?.reference_number || 'export'}.xlsx`);
  };

  const openPdf = () => {
    if (shareUrl) window.open(shareUrl + '&print=1', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-[#1a1a1a] px-6 py-5 text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className={`w-12 h-12 ${isPreview ? 'bg-[#e2231a]' : 'bg-green-500'} rounded-full flex items-center justify-center mx-auto mb-3`}>
            {isPreview ? <FileText className="w-7 h-7 text-white" /> : <CheckCircle2 className="w-7 h-7 text-white" />}
          </div>
          <h2 className="text-xl font-bold text-white">{isPreview ? 'Current Quote' : 'Quote Created!'}</h2>
          <p className="text-sm text-white/40 mt-1 font-mono">{order?.reference_number}</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            {[
              { label: 'Customer', value: order?.customer_name },
              { label: 'Company', value: order?.customer_company },
              { label: 'Show', value: order?.show_name },
              { label: 'Booth', value: order?.booth_size },
            ].filter(r => r.value).map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <span className="text-slate-500">{label}</span>
                <span className="font-semibold text-slate-800">{value}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
              <span className="font-semibold text-slate-700">Total</span>
              <span className="font-black text-[#e2231a] text-base">{fmt(order?.quoted_price)}</span>
            </div>
          </div>

          {/* Share link */}
          {shareUrl && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Shareable Link</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] text-slate-400 truncate font-mono">
                  {shareUrl}
                </div>
                <Button onClick={copyLink} size="sm" variant="outline" className="flex-shrink-0 text-xs h-9">
                  <Link2 className="w-3.5 h-3.5 mr-1" />
                  {copied ? '✓ Copied' : 'Copy'}
                </Button>
              </div>
            </div>
          )}

          {/* Booth Concept Rendering toggle */}
          {lineItems.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowConcept(v => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <LayoutPanelLeft className="w-3.5 h-3.5 text-[#e2231a]" />
                  <span className="text-xs font-bold text-slate-700">Booth Concept Rendering</span>
                </div>
                {showConcept
                  ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>
              {showConcept && (
                <div className="p-3 bg-white">
                  <BoothConceptRender order={order} lineItems={lineItems} />
                </div>
              )}
            </div>
          )}

          {/* Export buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={openPdf} variant="outline" className="gap-1.5 text-xs h-10">
              <FileText className="w-3.5 h-3.5" /> View / PDF
            </Button>
            <Button onClick={downloadExcel} variant="outline" className="gap-1.5 text-xs h-10">
              <Download className="w-3.5 h-3.5" /> Excel
            </Button>
          </div>

          {shareUrl && (
            <a href={shareUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-[#e2231a] hover:underline font-semibold">
              <ExternalLink className="w-3.5 h-3.5" /> Open Quote View
            </a>
          )}

          <Button onClick={onClose} className="w-full bg-[#1a1a1a] hover:bg-black text-white h-10 text-sm font-bold">
            Continue Browsing
          </Button>
        </div>
      </div>
    </div>
  );
}