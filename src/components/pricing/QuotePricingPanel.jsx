import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { runPricingEngine } from './pricingEngine';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Zap, CheckCircle2, AlertTriangle, Gift, Copy } from 'lucide-react';

function fmt(n) {
  if (n == null || n === '') return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function QuotePricingPanel({
  order,
  lineItems,
  dealerSettings,
  rules,
  onPricingResult,
}) {
  const [markupPct, setMarkupPct] = useState(order?.dealer_markup_pct ?? dealerSettings?.default_markup_pct ?? 0);
  const [discountPct, setDiscountPct] = useState(order?.customer_discount_pct ?? 0);
  const [promoInput, setPromoInput] = useState(order?.promo_code_applied || '');
  const [promoCode, setPromoCode] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [result, setResult] = useState(null);
  const [firedRuleNames, setFiredRuleNames] = useState([]);
  const [open, setOpen] = useState(true);
  const [running, setRunning] = useState(false);
  const [promoCopied, setPromoCopied] = useState({});

  const maxDiscount = dealerSettings?.max_discount_pct ?? 30;

  // Auto-run whenever inputs change
  useEffect(() => {
    if (lineItems.length === 0) { setResult(null); return; }
    runEngine();
  }, [lineItems, markupPct, discountPct, promoCode]);

  const runEngine = () => {
    const syntheticOrder = { ...order, dealer_markup_pct: markupPct, customer_discount_pct: discountPct };
    const res = runPricingEngine({ order: syntheticOrder, lineItems, rules: rules || [], dealerSettings, promoCode });
    setResult(res);
    const fired = (rules || []).filter(r => res.appliedRuleIds.includes(r.id)).map(r => r.name);
    setFiredRuleNames(fired);
    onPricingResult?.({ ...res, markupPct, discountPct, promoCode });
  };

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoError('');
    try {
      const res = await base44.entities.PromoCode.filter({ code, is_used: false });
      if (!res || res.length === 0) { setPromoError('Invalid or already used promo code.'); return; }
      const promo = res[0];
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) { setPromoError('This promo code has expired.'); return; }
      setPromoCode(promo);
    } catch { setPromoError('Error validating promo code.'); }
  };

  const copyPromo = (code) => {
    navigator.clipboard.writeText(code);
    setPromoCopied(p => ({ ...p, [code]: true }));
    setTimeout(() => setPromoCopied(p => ({ ...p, [code]: false })), 2000);
  };

  const discountWarning = discountPct > maxDiscount;

  if (lineItems.length === 0) return null;

  return (
    <div className="border-t border-slate-200 bg-slate-50/90">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
      >
        <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-[#e2231a]" />Pricing Engine</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-2.5">
          {/* Markup + Discount */}
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Markup %</label>
              <div className="relative">
                <input
                  type="number" min={0} max={200} value={markupPct}
                  onChange={e => setMarkupPct(Number(e.target.value))}
                  className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 pr-6 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30 bg-white"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">%</span>
              </div>
              {markupPct === 0 && (
                <p className="text-[9px] text-amber-500 flex items-center gap-0.5 mt-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" />Set your margin
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Customer Disc %</label>
              <div className="relative">
                <input
                  type="number" min={0} max={100} value={discountPct}
                  onChange={e => setDiscountPct(Number(e.target.value))}
                  className={`w-full text-xs border rounded-lg px-2 py-1.5 pr-6 focus:outline-none focus:ring-2 bg-white ${discountWarning ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-[#e2231a]/30'}`}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">%</span>
              </div>
              {discountWarning && (
                <p className="text-[9px] text-red-500 flex items-center gap-0.5 mt-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" />Exceeds max ({maxDiscount}%)
                </p>
              )}
            </div>
          </div>

          {/* Promo code */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Promo Code</label>
            <div className="flex gap-1.5">
              <input
                placeholder="e.g. SAVE10XYZ"
                value={promoInput}
                onChange={e => { setPromoInput(e.target.value.toUpperCase()); if (promoCode) setPromoCode(null); }}
                onKeyDown={e => e.key === 'Enter' && applyPromo()}
                className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30 bg-white"
              />
              <Button size="sm" variant="outline" onClick={applyPromo} className="text-xs px-2 h-7">Apply</Button>
            </div>
            {promoError && <p className="text-[9px] text-red-500 mt-0.5">{promoError}</p>}
            {promoCode && <p className="text-[9px] text-green-600 flex items-center gap-0.5 mt-0.5"><CheckCircle2 className="w-2.5 h-2.5" />Applied: {promoCode.code}</p>}
          </div>

          {/* Breakdown */}
          {result && (
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-500">
                <span>List Price</span><span>{fmt(result.listTotal)}</span>
              </div>
              {result.markupAmount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>+ Markup ({markupPct}%)</span><span>+{fmt(result.markupAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-1.5 text-slate-700 font-semibold">
                <span>Subtotal</span><span>{fmt(result.listTotal + result.markupAmount)}</span>
              </div>
              {result.ruleDiscountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span className="flex items-center gap-1">- Rule Discounts
                    {firedRuleNames.map(n => (
                      <span key={n} className="bg-green-100 text-green-700 text-[8px] px-1 py-0.5 rounded font-bold">{n}</span>
                    ))}
                  </span>
                  <span>-{fmt(result.ruleDiscountAmount)}</span>
                </div>
              )}
              {result.customerDiscountAmount > 0 && (
                <div className="flex justify-between text-blue-700">
                  <span>- Customer Disc ({discountPct}%)</span><span>-{fmt(result.customerDiscountAmount)}</span>
                </div>
              )}
              {result.promoDiscountAmount > 0 && (
                <div className="flex justify-between text-purple-700">
                  <span>- Promo: {promoCode?.code}</span><span>-{fmt(result.promoDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-slate-200 pt-2 font-black text-slate-900">
                <span>QUOTE TOTAL</span>
                <span className="text-[#e2231a] text-sm">{fmt(result.finalTotal)}</span>
              </div>

              {/* Fired rules */}
              {firedRuleNames.length > 0 && (
                <div className="pt-1.5 border-t border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Rules Applied</p>
                  <div className="flex flex-wrap gap-1">
                    {firedRuleNames.map(n => (
                      <span key={n} className="flex items-center gap-0.5 bg-green-50 border border-green-200 text-green-700 text-[9px] px-1.5 py-0.5 rounded-full font-semibold">
                        <CheckCircle2 className="w-2.5 h-2.5" />{n}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated promos */}
              {result.generatedPromos?.length > 0 && (
                <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
                  {result.generatedPromos.map((p, i) => (
                    <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Gift className="w-3 h-3 text-amber-600" />
                        <span className="text-[9px] font-bold text-amber-700">Promo Generated!</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-amber-800 text-[11px]">{p.code}</span>
                        <button onClick={() => copyPromo(p.code)} className="text-[9px] text-amber-600 hover:text-amber-800 flex items-center gap-0.5">
                          <Copy className="w-2.5 h-2.5" />{promoCopied[p.code] ? '✓' : 'Copy'}
                        </button>
                      </div>
                      {p.message && <p className="text-[9px] text-amber-600 mt-0.5">{p.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}