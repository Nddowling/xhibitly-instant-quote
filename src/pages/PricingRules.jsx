import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, X, ChevronDown, ChevronUp, Loader2, CheckCircle2, Gift } from 'lucide-react';

const CONDITION_TYPES = [
  { value: 'quantity_of_sku_gte', label: 'Qty of SKU ≥ N', hasTarget: true, hasValue: true },
  { value: 'quantity_of_category_gte', label: 'Qty of Category ≥ N', hasTarget: true, hasValue: true },
  { value: 'has_sku', label: 'Has SKU', hasTarget: true, hasValue: false },
  { value: 'has_category', label: 'Has Category', hasTarget: true, hasValue: false },
  { value: 'quote_total_gte', label: 'Quote Total ≥ $', hasTarget: false, hasValue: true },
  { value: 'quote_total_lte', label: 'Quote Total ≤ $', hasTarget: false, hasValue: true },
  { value: 'promo_code_applied', label: 'Promo Code Applied', hasTarget: false, hasValue: false },
];

const ACTION_TYPES = [
  { value: 'discount_pct', label: 'Discount %' },
  { value: 'discount_fixed', label: 'Discount $' },
  { value: 'nth_item_discount', label: 'Every Nth Item at X% Off' },
  { value: 'generate_promo', label: 'Generate Promo Code' },
];

const CATEGORIES = ['Structures', 'Displays', 'Lighting', 'Flooring', 'Signage', 'Technology', 'Furniture', 'Graphics', 'Accessories', 'Services', 'Logistics'];

function emptyRule() {
  return {
    name: '', description: '', is_active: true, priority: 10, scope: 'quote',
    condition_logic: 'ALL', conditions: [], actions: [], stackable: true, exclusive: false,
    is_dealer_specific: false,
  };
}

function summarizeRule(rule) {
  const cSummary = (rule.conditions || []).map(c => {
    const t = CONDITION_TYPES.find(x => x.value === c.type);
    return [t?.label || c.type, c.target, c.value].filter(Boolean).join(' ');
  }).join(', ');
  const aSummary = (rule.actions || []).map(a => {
    const t = ACTION_TYPES.find(x => x.value === a.type);
    return [t?.label || a.type, a.value ? `${a.value}` + (a.type === 'discount_pct' ? '%' : '') : ''].filter(Boolean).join(' ');
  }).join(', ');
  return { cSummary, aSummary };
}

export default function PricingRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // rule object being edited
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadRules(); }, []);

  const loadRules = async () => {
    setLoading(true);
    const res = await base44.entities.PricingRule.list('priority', 200);
    setRules(res || []);
    setLoading(false);
  };

  const openNew = () => setEditing(emptyRule());
  const openEdit = (rule) => setEditing({ ...rule });
  const closeEdit = () => setEditing(null);

  const toggleActive = async (rule) => {
    await base44.entities.PricingRule.update(rule.id, { is_active: !rule.is_active });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  };

  const deleteRule = async (rule) => {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    await base44.entities.PricingRule.delete(rule.id);
    setRules(prev => prev.filter(r => r.id !== rule.id));
  };

  const saveRule = async () => {
    if (!editing.name.trim()) return;
    setSaving(true);
    const user = await base44.auth.me();
    const payload = { ...editing, created_by_user_id: user.id };
    if (editing.id) {
      await base44.entities.PricingRule.update(editing.id, payload);
    } else {
      await base44.entities.PricingRule.create(payload);
    }
    await loadRules();
    setSaving(false);
    setEditing(null);
  };

  // ── Condition helpers ───────────────────────────────────────────────────────
  const addCondition = () => {
    const nextId = (editing.conditions?.length || 0) + 1;
    setEditing(e => ({ ...e, conditions: [...(e.conditions || []), { id: nextId, type: 'quote_total_gte', target: '', value: '' }] }));
  };
  const updateCondition = (idx, updates) => {
    setEditing(e => ({ ...e, conditions: e.conditions.map((c, i) => i === idx ? { ...c, ...updates } : c) }));
  };
  const removeCondition = (idx) => {
    setEditing(e => ({ ...e, conditions: e.conditions.filter((_, i) => i !== idx) }));
  };

  // ── Action helpers ──────────────────────────────────────────────────────────
  const addAction = () => {
    setEditing(e => ({ ...e, actions: [...(e.actions || []), { type: 'discount_pct', target: 'quote', target_value: '', value: 10 }] }));
  };
  const updateAction = (idx, updates) => {
    setEditing(e => ({ ...e, actions: e.actions.map((a, i) => i === idx ? { ...a, ...updates } : a) }));
  };
  const removeAction = (idx) => {
    setEditing(e => ({ ...e, actions: e.actions.filter((_, i) => i !== idx) }));
  };

  // ── Plain-English preview ───────────────────────────────────────────────────
  const preview = () => {
    if (!editing) return '';
    const cParts = (editing.conditions || []).map(c => {
      const t = CONDITION_TYPES.find(x => x.value === c.type);
      const parts = [t?.label || c.type];
      if (c.target) parts.push(`"${c.target}"`);
      if (c.value) parts.push(`${c.value}`);
      return parts.join(' ');
    });
    const aParts = (editing.actions || []).map(a => {
      if (a.type === 'discount_pct') return `${a.value}% off ${a.target}`;
      if (a.type === 'discount_fixed') return `$${a.value} off ${a.target}`;
      if (a.type === 'nth_item_discount') return `every ${a.nth_item}th item at ${a.value}% off`;
      if (a.type === 'generate_promo') return `generate promo code`;
      return a.type;
    });
    if (!cParts.length && !aParts.length) return 'No conditions or actions defined yet.';
    const condStr = cParts.length ? `When ${cParts.join(` ${editing.condition_logic} `)}` : 'Always';
    const actStr = aParts.length ? `apply ${aParts.join(' and ')}` : 'no actions';
    return `${condStr}, ${actStr}.`;
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#e2231a] animate-spin" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pricing Rules</h1>
            <p className="text-sm text-slate-500 mt-0.5">{rules.length} rule{rules.length !== 1 ? 's' : ''} configured</p>
          </div>
          <Button onClick={openNew} className="bg-[#e2231a] hover:bg-[#b01b13] text-white gap-2">
            <Plus className="w-4 h-4" />New Rule
          </Button>
        </div>

        {/* Rules table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {rules.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <p className="font-medium">No pricing rules yet</p>
              <p className="text-sm mt-1">Create your first rule to start automating pricing</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left py-3 px-5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wide hidden md:table-cell">Summary</th>
                  <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Priority</th>
                  <th className="text-center py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wide">Active</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map(rule => {
                  const { cSummary, aSummary } = summarizeRule(rule);
                  return (
                    <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="font-semibold text-slate-800 text-sm">{rule.name}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <Badge className="bg-slate-100 text-slate-600 text-[9px] border-0">{rule.scope}</Badge>
                          {!rule.stackable && <Badge className="bg-orange-100 text-orange-700 text-[9px] border-0">stops chain</Badge>}
                          {rule.exclusive && <Badge className="bg-purple-100 text-purple-700 text-[9px] border-0">exclusive</Badge>}
                          <span className="text-[10px] text-slate-400">{(rule.conditions || []).length} conditions · {(rule.actions || []).length} actions</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <p className="text-xs text-slate-500 line-clamp-1">{cSummary || 'Always'} → {aSummary || '—'}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-xs font-mono text-slate-600">{rule.priority ?? 10}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Switch checked={!!rule.is_active} onCheckedChange={() => toggleActive(rule)} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(rule)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteRule(rule)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Edit Drawer */}
      {editing && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={closeEdit} />
          <div className="w-full max-w-2xl bg-white shadow-2xl overflow-y-auto flex flex-col">
            {/* Drawer header */}
            <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-white font-bold">{editing.id ? 'Edit Rule' : 'New Rule'}</h2>
              <button onClick={closeEdit} className="text-white/50 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata */}
              <section>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Rule Info</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Name *</label>
                    <input value={editing.name} onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30" placeholder="e.g. Buy 2 Get 3rd 50% Off" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">Description</label>
                    <textarea value={editing.description || ''} onChange={e => setEditing(ed => ({ ...ed, description: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30 h-16 resize-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Priority</label>
                      <input type="number" min={1} max={999} value={editing.priority ?? 10}
                        onChange={e => setEditing(ed => ({ ...ed, priority: Number(e.target.value) }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 block mb-1">Scope</label>
                      <Select value={editing.scope || 'quote'} onValueChange={v => setEditing(ed => ({ ...ed, scope: v }))}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quote">Quote</SelectItem>
                          <SelectItem value="line_item">Line Item</SelectItem>
                          <SelectItem value="category">Category</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2 pt-5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                        <Switch checked={!!editing.stackable} onCheckedChange={v => setEditing(ed => ({ ...ed, stackable: v }))} />
                        Stackable
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                        <Switch checked={!!editing.exclusive} onCheckedChange={v => setEditing(ed => ({ ...ed, exclusive: v }))} />
                        Exclusive
                      </label>
                    </div>
                  </div>
                </div>
              </section>

              {/* Conditions */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Conditions</p>
                  <div className="flex items-center gap-2">
                    <Select value={editing.condition_logic || 'ALL'} onValueChange={v => setEditing(ed => ({ ...ed, condition_logic: v }))}>
                      <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">ALL must be true</SelectItem>
                        <SelectItem value="ANY">ANY one true</SelectItem>
                        <SelectItem value="custom">Custom expression</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editing.condition_logic === 'custom' && (
                  <input value={typeof editing.condition_logic === 'string' && editing.condition_logic !== 'ALL' && editing.condition_logic !== 'ANY' ? editing.condition_logic : ''}
                    onChange={e => setEditing(ed => ({ ...ed, condition_logic: e.target.value }))}
                    placeholder='e.g. (1 AND 2) OR 3'
                    className="w-full mb-2 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30" />
                )}
                <div className="space-y-2">
                  {(editing.conditions || []).map((cond, idx) => {
                    const meta = CONDITION_TYPES.find(x => x.value === cond.type);
                    return (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5 min-w-[28px] text-center">#{cond.id}</span>
                        <Select value={cond.type} onValueChange={v => updateCondition(idx, { type: v, target: '', value: '' })}>
                          <SelectTrigger className="h-8 text-xs flex-1 min-w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONDITION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {meta?.hasTarget && (
                          meta?.value?.includes('category') ?
                            <Select value={cond.target || ''} onValueChange={v => updateCondition(idx, { target: v })}>
                              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Category" /></SelectTrigger>
                              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          :
                            <input placeholder="SKU" value={cond.target || ''}
                              onChange={e => updateCondition(idx, { target: e.target.value })}
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                        )}
                        {meta?.hasValue && (
                          <input type="number" placeholder="Value" value={cond.value || ''}
                            onChange={e => updateCondition(idx, { value: e.target.value })}
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-20 focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                        )}
                        <button onClick={() => removeCondition(idx)} className="text-slate-300 hover:text-red-400 ml-auto"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    );
                  })}
                </div>
                <Button size="sm" variant="outline" onClick={addCondition} className="mt-2 gap-1 text-xs h-8">
                  <Plus className="w-3 h-3" />Add Condition
                </Button>
              </section>

              {/* Actions */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Actions</p>
                </div>
                <div className="space-y-3">
                  {(editing.actions || []).map((action, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Select value={action.type} onValueChange={v => updateAction(idx, { type: v, target: 'quote', target_value: '', value: 10 })}>
                          <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{ACTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <button onClick={() => removeAction(idx)} className="text-slate-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      {['discount_pct', 'discount_fixed'].includes(action.type) && (
                        <div className="flex gap-2">
                          <Select value={action.target || 'quote'} onValueChange={v => updateAction(idx, { target: v })}>
                            <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quote">Quote</SelectItem>
                              <SelectItem value="line_item">Line Item</SelectItem>
                              <SelectItem value="sku">SKU</SelectItem>
                              <SelectItem value="category">Category</SelectItem>
                            </SelectContent>
                          </Select>
                          {['sku', 'category'].includes(action.target) && (
                            action.target === 'category' ?
                              <Select value={action.target_value || ''} onValueChange={v => updateAction(idx, { target_value: v })}>
                                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Category" /></SelectTrigger>
                                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                              </Select>
                            :
                              <input placeholder="SKU" value={action.target_value || ''} onChange={e => updateAction(idx, { target_value: e.target.value })}
                                className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                          )}
                          <input type="number" min={0} value={action.value ?? 10} onChange={e => updateAction(idx, { value: Number(e.target.value) })}
                            className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                          <span className="text-xs text-slate-400 self-center">{action.type === 'discount_pct' ? '%' : '$'}</span>
                        </div>
                      )}
                      {action.type === 'nth_item_discount' && (
                        <div className="flex gap-2 items-center text-xs text-slate-600 flex-wrap">
                          <span>Every</span>
                          <input type="number" min={2} value={action.nth_item || 3} onChange={e => updateAction(idx, { nth_item: Number(e.target.value) })}
                            className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                          <span>th item at</span>
                          <input type="number" min={0} max={100} value={action.value || 50} onChange={e => updateAction(idx, { value: Number(e.target.value) })}
                            className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                          <span>% off</span>
                          {action.target_value !== undefined && (
                            <Select value={action.target_value || ''} onValueChange={v => updateAction(idx, { target_value: v })}>
                              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All items" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>All items</SelectItem>
                                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                          <Button size="sm" variant="outline" onClick={() => updateAction(idx, { target_value: action.target_value !== undefined ? undefined : '' })} className="text-xs h-7">
                            {action.target_value !== undefined ? 'Remove filter' : 'Add category filter'}
                          </Button>
                        </div>
                      )}
                      {action.type === 'generate_promo' && (
                        <div className="space-y-2 border-t border-slate-200 pt-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1"><Gift className="w-3 h-3" />Promo Config</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-0.5">Discount %</label>
                              <input type="number" min={0} value={action.promo_config?.discount_pct || 10}
                                onChange={e => updateAction(idx, { promo_config: { ...action.promo_config, discount_pct: Number(e.target.value) } })}
                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-500 block mb-0.5">Expires (days)</label>
                              <input type="number" min={1} value={action.promo_config?.expires_days || 90}
                                onChange={e => updateAction(idx, { promo_config: { ...action.promo_config, expires_days: Number(e.target.value) } })}
                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Applies To</label>
                            <Select value={action.promo_config?.applies_to || 'quote'} onValueChange={v => updateAction(idx, { promo_config: { ...action.promo_config, applies_to: v } })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="quote">Entire Quote</SelectItem>
                                <SelectItem value="category">Category</SelectItem>
                                <SelectItem value="sku">SKU</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {['category', 'sku'].includes(action.promo_config?.applies_to) && (
                            <input placeholder={action.promo_config?.applies_to === 'category' ? 'Category name' : 'SKU'}
                              value={action.promo_config?.applies_to_value || ''}
                              onChange={e => updateAction(idx, { promo_config: { ...action.promo_config, applies_to_value: e.target.value } })}
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                          )}
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Message to Customer</label>
                            <input value={action.promo_config?.message || ''}
                              onChange={e => updateAction(idx, { promo_config: { ...action.promo_config, message: e.target.value } })}
                              placeholder='e.g. 10% off Banner Stands on your next order!'
                              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#e2231a]/30" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={addAction} className="mt-2 gap-1 text-xs h-8">
                  <Plus className="w-3 h-3" />Add Action
                </Button>
              </section>

              {/* Preview */}
              <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-2">Plain-English Preview</p>
                <p className="text-sm text-blue-800 italic">{preview()}</p>
              </section>
            </div>

            {/* Drawer footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
              <Button onClick={saveRule} disabled={saving || !editing.name?.trim()} className="flex-1 bg-[#e2231a] hover:bg-[#b01b13] text-white h-10 font-bold gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</> : <><CheckCircle2 className="w-4 h-4" />Save Rule</>}
              </Button>
              <Button variant="outline" onClick={closeEdit} className="h-10">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}