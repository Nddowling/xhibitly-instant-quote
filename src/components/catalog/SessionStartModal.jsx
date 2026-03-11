import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, Search, Building, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';

const BOOTH_SIZES = ['10x10', '10x20', '20x20', '20x30', 'island'];

export default function SessionStartModal({ onComplete, onDismiss, user }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);

  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_company: '',
    show_name: '',
    booth_size: '10x10',
  });

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const searchClients = useCallback(debounce(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const [byEmail, byCompany] = await Promise.all([
        base44.entities.ClientProfile.filter({ client_email: q }),
        base44.entities.ClientProfile.filter({ client_company: q }),
      ]);
      const combined = [...(byEmail || []), ...(byCompany || [])];
      const unique = combined.filter((v, i, a) => a.findIndex(x => x.id === v.id) === i);
      setSearchResults(unique);
    } catch { setSearchResults([]); }
    setSearching(false);
  }, 400), []);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    searchClients(e.target.value);
  };

  const selectClient = (cp) => {
    setSelectedClient(cp);
    setSearchResults([]);
    setForm(p => ({
      ...p,
      customer_name: cp.client_company || '',
      customer_email: cp.client_email || '',
      customer_company: cp.client_company || '',
    }));
  };

  const clearClient = () => {
    setSelectedClient(null);
    setForm(p => ({ ...p, customer_name: '', customer_email: '', customer_company: '' }));
  };

  const handleStart = async () => {
    if (!form.customer_name || !form.customer_email || !form.show_name) return;
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
        show_date: new Date().toISOString().split('T')[0],
        customer_name: form.customer_name,
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

  const canSubmit = form.customer_name && form.customer_email && form.show_name;

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
          {/* Customer section */}
          {!selectedClient && !isNewCustomer && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Customer Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search by email or company name..."
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />}
              </div>

              {searchResults.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  {searchResults.map(cp => (
                    <button key={cp.id} onClick={() => selectClient(cp)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0 transition-colors">
                      <div className="w-8 h-8 bg-[#e2231a]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building className="w-4 h-4 text-[#e2231a]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{cp.client_company || cp.client_email}</p>
                        <p className="text-xs text-slate-400">{cp.client_email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
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

          {isNewCustomer && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">New Customer</label>
                <button onClick={() => setIsNewCustomer(false)} className="text-xs text-slate-400 hover:text-slate-600">← Back to search</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'customer_name', label: 'Name *', placeholder: 'Jane Smith', type: 'text' },
                  { key: 'customer_company', label: 'Company *', placeholder: 'Acme Inc.', type: 'text' },
                  { key: 'customer_email', label: 'Email *', placeholder: 'jane@acme.com', type: 'email' },
                  { key: 'customer_phone', label: 'Phone', placeholder: '(555) 000-0000', type: 'tel' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">{label}</label>
                    <input
                      type={type}
                      value={form[key]}
                      onChange={e => setField(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
                    />
                  </div>
                ))}
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