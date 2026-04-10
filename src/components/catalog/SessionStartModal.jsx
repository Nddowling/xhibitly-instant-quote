import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Search, Building, Loader2, Plus, FileText, ChevronRight, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BOOTH_SIZES = ['10x10', '10x20', '20x20', '20x30'];
const BOOTH_TYPES = ['Inline', 'Corner', 'Island'];
const OPEN_STATUSES = ['Draft', 'Pending', 'Quoted', 'Negotiating', 'Contacted'];

function fmt(n) {
  if (!n && n !== 0) return null;
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Step 1: Search for a customer
function CustomerStep({ onSelect, onNewCustomer, onDismiss, canDismiss }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    base44.entities.Order.list('-created_date', 300).then(orders => {
      const map = new Map();
      orders.forEach(o => {
        if (o.customer_email && !map.has(o.customer_email)) {
          map.set(o.customer_email, {
            client_email: o.customer_email,
            client_company: o.customer_company || '',
            contact_name: o.customer_name || '',
          });
        }
      });
      setRecentCustomers(Array.from(map.values()));
    }).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q || q.length < 1) { setSearchResults([]); setShowDropdown(false); return; }
    const lower = q.toLowerCase();
    const filtered = recentCustomers.filter(c =>
      c.client_email?.toLowerCase().includes(lower) ||
      c.client_company?.toLowerCase().includes(lower) ||
      c.contact_name?.toLowerCase().includes(lower)
    ).slice(0, 8);
    setSearchResults(filtered);
    setShowDropdown(true);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Search Customer</label>
        {canDismiss && (
          <button onClick={onDismiss} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <div>
        <div className="relative" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
          <input
            value={searchQuery}
            onChange={handleSearch}
            onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder="Type name, email, or company..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#18C3F8]/30"
            autoFocus
          />
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
              {searchResults.map(cp => (
                <button
                  key={cp.client_email}
                  onMouseDown={() => onSelect(cp)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0 transition-colors"
                >
                  <div className="w-8 h-8 bg-[#e2231a]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Building className="w-4 h-4 text-[#e2231a]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{cp.client_company || cp.client_email}</p>
                    <p className="text-xs text-slate-400 truncate">{cp.contact_name ? `${cp.contact_name} · ` : ''}{cp.client_email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        {searchQuery.length >= 1 && searchResults.length === 0 && (
          <p className="text-xs text-slate-400 mt-2">
            No matches found.{' '}
            <button onClick={onNewCustomer} className="text-[#18C3F8] font-semibold hover:underline">
              Add new customer →
            </button>
          </p>
        )}
      </div>

      {/* Recent customers (show when no query) */}
      {!searchQuery && recentCustomers.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Recent Customers</p>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {recentCustomers.slice(0, 6).map(cp => (
              <button
                key={cp.client_email}
                onClick={() => onSelect(cp)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-[#e2231a]/30 hover:bg-[#e2231a]/5 text-left transition-all"
              >
                <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700 truncate">{cp.client_company || cp.client_email}</p>
                  <p className="text-[10px] text-slate-400 truncate">{cp.contact_name}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={onNewCustomer}
          className="flex items-center gap-2 text-sm font-semibold text-[#e2231a] hover:underline"
        >
          <Plus className="w-4 h-4" /> New Customer
        </button>
      </div>
    </div>
  );
}

// Step 2 (existing client): New or Existing Quote choice + open quotes list
function QuoteChoiceStep({ client, onNewQuote, onResumeQuote, onBack, onDismiss, canDismiss }) {
  const [openQuotes, setOpenQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Order.filter({ customer_email: client.client_email }, '-created_date', 50)
      .then(orders => {
        const open = (orders || []).filter(o => OPEN_STATUSES.includes(o.status));
        setOpenQuotes(open);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [client.client_email]);

  return (
    <div className="p-6 space-y-4">
      {/* Client badge */}
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <Building className="w-4 h-4 text-green-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-green-800">{client.client_company || client.client_email}</p>
          <p className="text-xs text-green-600">{client.contact_name ? `${client.contact_name} · ` : ''}{client.client_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-green-400 hover:text-green-600">
            <X className="w-4 h-4" />
          </button>
          {canDismiss && (
            <button onClick={onDismiss} className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* New Quote button */}
      <button
        onClick={onNewQuote}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#18C3F8] hover:bg-[#0fb2e4] text-white rounded-xl transition-colors font-semibold text-sm"
      >
        <Plus className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">Start New Quote</span>
        <ChevronRight className="w-4 h-4 opacity-60" />
      </button>

      {/* Open quotes */}
      {loading ? (
        <div className="flex items-center justify-center py-4 gap-2 text-slate-400 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading open quotes…
        </div>
      ) : openQuotes.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Open Quotes ({openQuotes.length})</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {openQuotes.map(order => (
              <button
                key={order.id}
                onClick={() => onResumeQuote(order)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-slate-200 hover:border-[#e2231a]/40 hover:bg-[#e2231a]/5 text-left transition-all group"
              >
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{order.show_name || 'Unnamed Show'}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-2.5 h-2.5" />
                    {order.reference_number} · {order.booth_size}
                    {order.quoted_price ? ` · ${fmt(order.quoted_price)}` : ''}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    order.status === 'Draft' ? 'bg-slate-100 text-slate-500' :
                    order.status === 'Quoted' ? 'bg-blue-100 text-blue-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>{order.status}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#e2231a] transition-colors" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-2">No open quotes for this customer.</p>
      )}
    </div>
  );
}

// Step 3: New quote show info form
function NewQuoteStep({ client, user, onBack, onComplete, onDismiss, canDismiss }) {
  const [starting, setStarting] = useState(false);
  const [form, setForm] = useState({
    first_name: client?.contact_name?.split(' ')[0] || '',
    last_name: client?.contact_name?.split(' ').slice(1).join(' ') || '',
    show_name: '',
    booth_size: '10x10',
    booth_type: 'Inline',
  });
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const canSubmit = form.show_name.trim();

  const handleStart = async () => {
    if (!canSubmit) return;
    setStarting(true);
    const customerName = `${form.first_name} ${form.last_name}`.trim() || client.contact_name || '';
    const exhibitlyOrg = await base44.entities.DealerInstance.filter({ slug: 'exhibitly' }, 'name', 1);
    const exhibitlyDealer = exhibitlyOrg?.[0] || null;

    const order = await base44.entities.Order.create({
      reference_number: 'XQ-' + Date.now(),
      status: 'Draft',
      catalog_session: true,
      show_name: form.show_name,
      booth_size: form.booth_size,
      booth_type: form.booth_type,
      show_date: new Date().toISOString().split('T')[0],
      customer_name: customerName,
      customer_email: client.client_email || client.customer_email || '',
      customer_company: client.client_company || client.customer_company || '',
      dealer_instance_id: exhibitlyDealer?.id || '',
      dealer_id: exhibitlyDealer?.id || user?.id || '',
      dealer_email: exhibitlyDealer?.owner_email || user?.email || '',
      dealer_name: exhibitlyDealer?.name || user?.full_name || '',
      dealer_company: exhibitlyDealer?.company_name || 'Exhibitly',
    });
    onComplete(order);
    setStarting(false);
  };

  return (
    <div className="p-6 space-y-4">
      {/* Client badge */}
      <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        <Building className="w-4 h-4 text-green-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-green-800">{client.client_company || client.client_email}</p>
          <p className="text-xs text-green-600">{client.client_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-green-400 hover:text-green-600">
            <X className="w-4 h-4" />
          </button>
          {canDismiss && (
            <button onClick={onDismiss} className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contact name */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">First Name</label>
          <input value={form.first_name} onChange={e => setField('first_name', e.target.value)}
            placeholder="Jane"
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#18C3F8]/30" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Last Name</label>
          <input value={form.last_name} onChange={e => setField('last_name', e.target.value)}
            placeholder="Smith"
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#18C3F8]/30" />
        </div>
      </div>

      {/* Show info */}
      <div className="space-y-3 pt-2 border-t border-slate-100">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Show Information</label>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Show Name *</label>
          <input
            value={form.show_name} onChange={e => setField('show_name', e.target.value)}
            placeholder="e.g. EXHIBITORLIVE 2026"
            autoFocus
            className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#18C3F8]/30"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Booth Size</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {BOOTH_SIZES.map(s => (
              <button key={s} onClick={() => setField('booth_size', s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  form.booth_size === s ? 'bg-[#18C3F8] text-white border-[#18C3F8]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#18C3F8]/40'
                }`}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Booth Type</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {BOOTH_TYPES.map(t => (
              <button key={t} onClick={() => setField('booth_type', t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  form.booth_type === t ? 'bg-[#18C3F8] text-white border-[#18C3F8]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#18C3F8]/40'
                }`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <Button
        onClick={handleStart}
        disabled={starting || !canSubmit}
        className="w-full bg-[#18C3F8] hover:bg-[#0fb2e4] text-white h-11 font-bold disabled:opacity-40"
      >
        {starting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating Quote…</> : 'Start Session →'}
      </Button>
    </div>
  );
}

// Step: New Customer form
function NewCustomerStep({ user, onBack, onComplete, onDismiss, canDismiss }) {
  const [starting, setStarting] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', customer_email: '', customer_phone: '', customer_company: '',
    show_name: '', booth_size: '10x10', booth_type: 'Inline',
  });
  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const customerName = `${form.first_name} ${form.last_name}`.trim();
  const canSubmit = customerName && form.customer_email && form.show_name;

  const handleStart = async () => {
    if (!canSubmit) return;
    setStarting(true);
    const exhibitlyOrg = await base44.entities.DealerInstance.filter({ slug: 'exhibitly' }, 'name', 1);
    const exhibitlyDealer = exhibitlyOrg?.[0] || null;
    const contactEmail = form.customer_email.trim().toLowerCase();
    const existingContacts = contactEmail
      ? await base44.entities.Contact.filter({ email: contactEmail }, 'created_date', 10)
      : [];

    if (!existingContacts.some((entry) => (entry.dealer_instance_id || entry.data?.dealer_instance_id) === exhibitlyDealer?.id)) {
      await base44.entities.Contact.create({
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: customerName,
        email: contactEmail,
        phone: form.customer_phone,
        dealer_instance_id: exhibitlyDealer?.id || '',
        owner_user_id: exhibitlyDealer?.owner_user_id || user?.id || '',
      });
    }

    const order = await base44.entities.Order.create({
      reference_number: 'XQ-' + Date.now(),
      status: 'Draft',
      catalog_session: true,
      show_name: form.show_name,
      booth_size: form.booth_size,
      booth_type: form.booth_type,
      show_date: new Date().toISOString().split('T')[0],
      customer_name: customerName,
      customer_email: contactEmail,
      customer_phone: form.customer_phone,
      customer_company: form.customer_company,
      dealer_instance_id: exhibitlyDealer?.id || '',
      dealer_id: exhibitlyDealer?.id || user?.id || '',
      dealer_email: exhibitlyDealer?.owner_email || user?.email || '',
      dealer_name: exhibitlyDealer?.name || user?.full_name || '',
      dealer_company: exhibitlyDealer?.company_name || 'Exhibitly',
    });
    onComplete(order);
    setStarting(false);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">New Customer</label>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-xs text-slate-400 hover:text-slate-600">← Back</button>
          {canDismiss && (
            <button onClick={onDismiss} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'first_name', label: 'First Name *', placeholder: 'Jane' },
          { key: 'last_name', label: 'Last Name *', placeholder: 'Smith' },
          { key: 'customer_company', label: 'Company *', placeholder: 'Acme Inc.', span: 2 },
          { key: 'customer_email', label: 'Email *', placeholder: 'jane@acme.com', type: 'email', span: 2 },
          { key: 'customer_phone', label: 'Phone', placeholder: '(555) 000-0000', type: 'tel', span: 2 },
        ].map(f => (
          <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{f.label}</label>
            <input type={f.type || 'text'} value={form[f.key]} onChange={e => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#18C3F8]/30" />
          </div>
        ))}
      </div>

      <div className="space-y-3 pt-2 border-t border-slate-100">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Show Information</label>
        <input value={form.show_name} onChange={e => setField('show_name', e.target.value)}
          placeholder="Show Name *"
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#18C3F8]/30" />
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Booth Size</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {BOOTH_SIZES.map(s => (
              <button key={s} onClick={() => setField('booth_size', s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  form.booth_size === s ? 'bg-[#18C3F8] text-white border-[#18C3F8]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#18C3F8]/40'
                }`}>{s}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Booth Type</label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {BOOTH_TYPES.map(t => (
              <button key={t} onClick={() => setField('booth_type', t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  form.booth_type === t ? 'bg-[#18C3F8] text-white border-[#18C3F8]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#18C3F8]/40'
                }`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      <Button onClick={handleStart} disabled={starting || !canSubmit}
        className="w-full bg-[#18C3F8] hover:bg-[#0fb2e4] text-white h-11 font-bold disabled:opacity-40">
        {starting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : 'Start Session →'}
      </Button>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function SessionStartModal({ onComplete, onDismiss, user }) {
  const canDismiss = typeof onDismiss === 'function';
  // step: 'search' | 'choice' | 'new_quote' | 'new_customer'
  const [step, setStep] = useState('search');
  const [selectedClient, setSelectedClient] = useState(null);

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setStep('choice');
  };

  const handleResumeQuote = (order) => {
    onComplete(order);
  };

  const STEP_TITLES = {
    search: { title: 'Start a Quote Session', sub: 'Search for a customer or add a new one' },
    choice: { title: selectedClient?.client_company || 'Select Quote', sub: 'Continue an existing quote or start a new one' },
    new_quote: { title: 'New Quote', sub: 'Set show and booth details' },
    new_customer: { title: 'New Customer', sub: 'Add a new customer and start a quote' },
  };

  const { title, sub } = STEP_TITLES[step] || STEP_TITLES.search;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={() => canDismiss && onDismiss()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">{title}</h2>
            <p className="text-xs text-white/40 mt-0.5">{sub}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#e2231a] rounded-lg flex items-center justify-center text-white font-black text-xs">XQ</div>
            {onDismiss && (
              <button onClick={onDismiss} className="text-white/40 hover:text-white/80 transition-colors ml-1">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 'search' && (
              <motion.div key="search" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <CustomerStep
                  onSelect={handleSelectClient}
                  onNewCustomer={() => setStep('new_customer')}
                  onDismiss={onDismiss}
                  canDismiss={canDismiss}
                />
              </motion.div>
            )}

            {step === 'choice' && selectedClient && (
              <motion.div key="choice" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <QuoteChoiceStep
                  client={selectedClient}
                  onNewQuote={() => setStep('new_quote')}
                  onResumeQuote={handleResumeQuote}
                  onBack={() => { setSelectedClient(null); setStep('search'); }}
                  onDismiss={onDismiss}
                  canDismiss={canDismiss}
                />
              </motion.div>
            )}

            {step === 'new_quote' && selectedClient && (
              <motion.div key="new_quote" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <NewQuoteStep
                  client={selectedClient}
                  user={user}
                  onBack={() => setStep('choice')}
                  onComplete={onComplete}
                  onDismiss={onDismiss}
                  canDismiss={canDismiss}
                />
              </motion.div>
            )}

            {step === 'new_customer' && (
              <motion.div key="new_customer" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <NewCustomerStep
                  user={user}
                  onBack={() => setStep('search')}
                  onComplete={onComplete}
                  onDismiss={onDismiss}
                  canDismiss={canDismiss}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}