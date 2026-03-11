import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Search, Building, Loader2, User } from 'lucide-react';
import { motion } from 'framer-motion';

const BOOTH_SIZES = ['10x10', '10x20', '20x20', '20x30'];
const BOOTH_TYPES = ['Inline', 'Corner', 'Island'];

export default function SessionStartModal({ onComplete, onDismiss, user }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recentCustomers, setRecentCustomers] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    customer_email: '',
    customer_phone: '',
    customer_company: '',
    show_name: '',
    booth_size: '10x10',
    booth_type: 'Inline',
  });

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Preload recent customers for instant suggestions
  useEffect(() => {
    base44.entities.Order.list('-created_date', 200).then(orders => {
      const map = new Map();
      orders.forEach(o => {
        if (o.customer_email && !map.has(o.customer_email)) {
          map.set(o.customer_email, {
            id: o.id,
            client_email: o.customer_email,
            client_company: o.customer_company || '',
            contact_name: o.customer_name || '',
          });
        }
      });
      setRecentCustomers(Array.from(map.values()));
    }).catch(() => {});
  }, []);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q || q.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const lower = q.toLowerCase();
    const filtered = recentCustomers.filter(c =>
      c.client_email?.toLowerCase().includes(lower) ||
      c.client_company?.toLowerCase().includes(lower) ||
      c.contact_name?.toLowerCase().includes(lower)
    ).slice(0, 7);
    setSearchResults(filtered);
    setShowDropdown(true);
  };

  const selectClient = (cp) => {
    setSelectedClient(cp);
    setSearchResults([]);
    setShowDropdown(false);
    setSearchQuery('');
    const nameParts = (cp.contact_name || '').trim().split(' ');
    const first = nameParts[0] || '';
    const last = nameParts.slice(1).join(' ') || '';
    setForm(p => ({
      ...p,
      first_name: first,
      last_name: last,
      customer_email: cp.client_email || '',
      customer_company: cp.client_company || '',
    }));
  };

  const clearClient = () => {
    setSelectedClient(null);
    setForm(p => ({ ...p, first_name: '', last_name: '', customer_email: '', customer_company: '' }));
  };

  const customerName = `${form.first_name} ${form.last_name}`.trim();
  const canSubmit = customerName && form.customer_email && form.show_name;

  const handleStart = async () => {
    if (!canSubmit) return;
    setStarting(true);
    try {
      if (isNewCustomer) {
        base44.entities.ClientProfile.create({
          client_email: form.customer_email,
          client_company: form.customer_company,
          client_id: user?.id || 'dealer',
          objectives: [],
          desired_look: [],
          desired_feel: [],
          booth_size: form.booth_size || '10x10',
          show_date: new Date().toISOString().split('T')[0],
          website_url: '',
        }).catch(() => {});
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
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        customer_company: form.customer_company,
        dealer_id: user?.id || '',
        dealer_email: user?.email || '',
        dealer_name: user?.full_name || user?.contact_name || '',
        dealer_company: user?.company_name || '',
      });
      onComplete(order);
    } catch (err) {
      console.error('Failed to start session', err);
    }
    setStarting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[#1a1a1a] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Start a Quote Session</h2>
            <p className="text-xs text-white/40 mt-0.5">Find or add a customer, then set show details</p>
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

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Customer Search */}
          {!selectedClient && !isNewCustomer && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Customer Search</label>
              <div className="relative" ref={searchRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <input
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder="Type name, email, or company..."
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                  autoFocus
                />

                {/* Live suggestion dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    {searchResults.map(cp => (
                      <button
                        key={cp.id}
                        onMouseDown={() => selectClient(cp)}
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
                  No matches.{' '}
                  <button onClick={() => setIsNewCustomer(true)} className="text-[#e2231a] font-semibold hover:underline">
                    Add new customer →
                  </button>
                </p>
              )}
              {!searchQuery && (
                <button onClick={() => setIsNewCustomer(true)} className="mt-2 text-xs text-[#e2231a] font-semibold hover:underline">
                  + New Customer
                </button>
              )}
            </div>
          )}

          {/* Selected client badge */}
          {selectedClient && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <Building className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-green-800">{selectedClient.client_company}</p>
                <p className="text-xs text-green-600">{selectedClient.client_email}</p>
              </div>
              <button onClick={clearClient} className="text-green-400 hover:text-green-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* New customer form */}
          {isNewCustomer && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">New Customer</label>
                <button onClick={() => setIsNewCustomer(false)} className="text-xs text-slate-400 hover:text-slate-600">← Back to search</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">First Name *</label>
                  <input
                    value={form.first_name}
                    onChange={e => setField('first_name', e.target.value)}
                    placeholder="Jane"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Last Name *</label>
                  <input
                    value={form.last_name}
                    onChange={e => setField('last_name', e.target.value)}
                    placeholder="Smith"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Company *</label>
                  <input
                    value={form.customer_company}
                    onChange={e => setField('customer_company', e.target.value)}
                    placeholder="Acme Inc."
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Email *</label>
                  <input
                    type="email"
                    value={form.customer_email}
                    onChange={e => setField('customer_email', e.target.value)}
                    placeholder="jane@acme.com"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Phone</label>
                  <input
                    type="tel"
                    value={form.customer_phone}
                    onChange={e => setField('customer_phone', e.target.value)}
                    placeholder="(555) 000-0000"
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Name fields shown after selecting existing client */}
          {selectedClient && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">First Name</label>
                <input
                  value={form.first_name}
                  onChange={e => setField('first_name', e.target.value)}
                  placeholder="Jane"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Last Name</label>
                <input
                  value={form.last_name}
                  onChange={e => setField('last_name', e.target.value)}
                  placeholder="Smith"
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                />
              </div>
            </div>
          )}

          {/* Show info */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Show Information</label>
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Show Name *</label>
              <input
                value={form.show_name}
                onChange={e => setField('show_name', e.target.value)}
                placeholder="e.g. EXHIBITORLIVE 2026"
                className="w-full mt-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Booth Size</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {BOOTH_SIZES.map(s => (
                  <button
                    key={s}
                    onClick={() => setField('booth_size', s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      form.booth_size === s
                        ? 'bg-[#e2231a] text-white border-[#e2231a]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#e2231a]/40'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Booth Type</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {BOOTH_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setField('booth_type', t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      form.booth_type === t
                        ? 'bg-[#e2231a] text-white border-[#e2231a]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-[#e2231a]/40'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            onClick={handleStart}
            disabled={starting || !canSubmit}
            className="w-full bg-[#e2231a] hover:bg-[#b01b13] text-white h-11 font-bold disabled:opacity-40"
          >
            {starting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting Session...</>
              : 'Start Session →'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}