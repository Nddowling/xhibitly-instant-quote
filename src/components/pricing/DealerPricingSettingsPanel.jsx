import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Save, Loader2, TrendingUp } from 'lucide-react';

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DealerPricingSettingsPanel() {
  const [settings, setSettings] = useState(null);
  const [settingsId, setSettingsId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const user = await base44.auth.me();
    const res = await base44.entities.DealerPricingSettings.filter({ user_id: user.id });
    if (res && res.length > 0) {
      setSettingsId(res[0].id);
      setSettings(res[0]);
    } else {
      setSettings({ user_id: user.id, default_markup_pct: 0, max_discount_pct: 30, currency: 'USD', show_list_prices_to_customer: false, show_savings_on_quote: true, notes: '' });
    }
  };

  const save = async () => {
    setSaving(true);
    if (settingsId) {
      await base44.entities.DealerPricingSettings.update(settingsId, settings);
    } else {
      const res = await base44.entities.DealerPricingSettings.create(settings);
      setSettingsId(res.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!settings) return <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>;

  const listExample = 100;
  const markupExample = listExample * (1 + (settings.default_markup_pct || 0) / 100);

  return (
    <div className="space-y-4">
      {/* Markup */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1">Default Markup %</label>
          <p className="text-xs text-slate-400 mb-2">Your margin added on top of Orbus list prices</p>
          <div className="relative">
            <input type="number" min={0} max={500} value={settings.default_markup_pct || 0}
              onChange={e => setSettings(s => ({ ...s, default_markup_pct: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
          <div className="mt-2 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600">
            <TrendingUp className="w-3.5 h-3.5 text-[#e2231a]" />
            {fmt(listExample)} list → <span className="font-bold text-slate-800">{fmt(markupExample)}</span> at {settings.default_markup_pct || 0}% markup
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-1">Max Discount % Allowed</label>
          <p className="text-xs text-slate-400 mb-2">Maximum discount you can give to a customer per quote</p>
          <div className="relative">
            <input type="number" min={0} max={100} value={settings.max_discount_pct ?? 30}
              onChange={e => setSettings(s => ({ ...s, max_discount_pct: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-8 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3 border-t border-slate-100 pt-4">
        <label className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-slate-700">Show List Prices to Customer</p>
            <p className="text-xs text-slate-400">Display Orbus base prices on the customer quote view</p>
          </div>
          <Switch checked={!!settings.show_list_prices_to_customer} onCheckedChange={v => setSettings(s => ({ ...s, show_list_prices_to_customer: v }))} />
        </label>
        <label className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-slate-700">Show Savings Summary on Quote</p>
            <p className="text-xs text-slate-400">Show how much the customer is saving vs. list price</p>
          </div>
          <Switch checked={!!settings.show_savings_on_quote} onCheckedChange={v => setSettings(s => ({ ...s, show_savings_on_quote: v }))} />
        </label>
      </div>

      <Button onClick={save} disabled={saving} className={`w-full h-10 font-bold gap-2 ${saved ? 'bg-green-600 hover:bg-green-600' : 'bg-[#e2231a] hover:bg-[#b01b13]'} text-white`}>
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : saved ? '✓ Saved!' : <><Save className="w-4 h-4" />Save Pricing Settings</>}
      </Button>
    </div>
  );
}