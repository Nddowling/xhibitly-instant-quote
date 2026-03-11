import React, { useState } from 'react';
import { CheckCircle2, Gift, Copy } from 'lucide-react';

function fmt(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PricingBreakdown({ order, rules = [], generatedPromos = [] }) {
  const [copied, setCopied] = useState({});

  const hasAdjustments = (order?.markup_amount > 0) || (order?.rule_discount_amount > 0) ||
    (order?.customer_discount_amount > 0) || (order?.promo_discount_amount > 0);

  if (!order?.list_price_total && !order?.quoted_price) return null;

  const listTotal = order.list_price_total || order.quoted_price;
  const markupAmt = order.markup_amount || 0;
  const subtotal = listTotal + markupAmt;
  const ruleDisc = order.rule_discount_amount || 0;
  const custDisc = order.customer_discount_amount || 0;
  const promoDisc = order.promo_discount_amount || 0;
  const firedRules = (rules || []).filter(r => (order.applied_rule_ids || []).includes(r.id));

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(p => ({ ...p, [code]: true }));
    setTimeout(() => setCopied(p => ({ ...p, [code]: false })), 2000);
  };

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2 text-sm">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Pricing Breakdown</p>

      <div className="flex justify-between text-slate-500 text-xs">
        <span>List Price</span><span>{fmt(listTotal)}</span>
      </div>
      {markupAmt > 0 && (
        <div className="flex justify-between text-slate-700 text-xs">
          <span>+ Markup ({order.dealer_markup_pct || 0}%)</span><span>+{fmt(markupAmt)}</span>
        </div>
      )}
      {hasAdjustments && (
        <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-700 text-xs font-semibold">
          <span>Subtotal</span><span>{fmt(subtotal)}</span>
        </div>
      )}
      {ruleDisc > 0 && (
        <div className="flex justify-between text-green-700 text-xs">
          <span className="flex items-center gap-1.5">
            - Bundle Discounts
            {firedRules.map(r => (
              <span key={r.id} className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0.5 rounded font-bold">{r.name}</span>
            ))}
          </span>
          <span>-{fmt(ruleDisc)}</span>
        </div>
      )}
      {custDisc > 0 && (
        <div className="flex justify-between text-blue-700 text-xs">
          <span>- Customer Disc ({order.customer_discount_pct || 0}%)</span><span>-{fmt(custDisc)}</span>
        </div>
      )}
      {promoDisc > 0 && (
        <div className="flex justify-between text-purple-700 text-xs">
          <span>- Promo: {order.promo_code_applied}</span><span>-{fmt(promoDisc)}</span>
        </div>
      )}

      <div className="flex justify-between border-t-2 border-slate-300 pt-2 font-black text-slate-900">
        <span>Total</span>
        <span className="text-[#e2231a] text-base">{fmt(order.quoted_price)}</span>
      </div>

      {firedRules.length > 0 && (
        <div className="pt-2 border-t border-slate-200">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Applied Rules</p>
          <div className="flex flex-wrap gap-1.5">
            {firedRules.map(r => (
              <span key={r.id} className="flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3 h-3" />{r.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {generatedPromos?.length > 0 && (
        <div className="pt-2 border-t border-slate-200 space-y-2">
          {generatedPromos.map((p, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Gift className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-700">🎁 A promo code was generated for this customer!</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-black text-amber-800 text-sm">{p.code}</span>
                <button onClick={() => copyCode(p.code)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 border border-amber-300 rounded-lg px-2 py-0.5">
                  <Copy className="w-3 h-3" />{copied[p.code] ? '✓ Copied' : 'Copy Code'}
                </button>
              </div>
              {p.message && <p className="text-xs text-amber-700">{p.message}</p>}
              {p.expires_at && (
                <p className="text-[10px] text-amber-500 mt-1">Expires: {new Date(p.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}