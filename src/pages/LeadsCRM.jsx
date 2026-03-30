import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS = {
  new: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  emailed: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  qualified: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  converted: 'bg-[#00c9a7]/15 text-[#00c9a7] border-[#00c9a7]/25',
  unsubscribed: 'bg-white/5 text-white/30 border-white/10',
};

const STATUSES = ['new', 'emailed', 'qualified', 'converted', 'unsubscribed'];

export default function LeadsCRM() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => { loadLeads(); }, []);

  const loadLeads = async () => {
    try {
      const data = await base44.entities.Lead.list('-created_date', 200);
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    setUpdatingId(id);
    try {
      await base44.entities.Lead.update(id, { status });
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchesSearch = !q || l.email?.toLowerCase().includes(q) || l.name?.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-[#00c9a7]" />
            Store Leads
          </h1>
          <p className="text-sm text-white/40 mt-1">Email leads captured from the RecoverEdge store</p>
        </div>
        <div className="flex gap-2 text-sm text-white/40">
          <span className="bg-white/5 border border-white/8 rounded-lg px-3 py-1.5">
            {leads.length} total leads
          </span>
          <span className="bg-[#00c9a7]/10 border border-[#00c9a7]/20 rounded-lg px-3 py-1.5 text-[#00c9a7]">
            {leads.filter(l => l.status === 'converted').length} converted
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30 h-9 focus:border-[#00c9a7]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-white/10">
            <SelectItem value="" className="text-white/60">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="text-white capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-white/30">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading leads...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-white/25">
          <UserPlus className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No leads yet</p>
          <p className="text-sm mt-1">Leads from the store will appear here automatically.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block border border-white/8 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/4 border-b border-white/8">
                <tr>
                  {['Email', 'Name', 'Source', 'Lead Magnet', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-white/40 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, i) => (
                  <tr key={lead.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/1'}`}>
                    <td className="px-5 py-3.5 font-medium text-white">{lead.email}</td>
                    <td className="px-5 py-3.5 text-white/60">{lead.name || '—'}</td>
                    <td className="px-5 py-3.5 text-white/50 text-xs">{lead.source?.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-3.5 text-white/50 text-xs">{lead.lead_magnet?.replace(/-/g, ' ') || '—'}</td>
                    <td className="px-5 py-3.5">
                      <Select
                        value={lead.status}
                        onValueChange={val => updateStatus(lead.id, val)}
                        disabled={updatingId === lead.id}
                      >
                        <SelectTrigger className={`w-36 h-7 text-xs border rounded-full px-3 ${STATUS_COLORS[lead.status] ?? ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#1a1a1a] border-white/10">
                          {STATUSES.map(s => (
                            <SelectItem key={s} value={s} className="text-white capitalize text-xs">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-5 py-3.5 text-white/35 text-xs">
                      {lead.created_date ? format(new Date(lead.created_date), 'MMM d, yyyy') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(lead => (
              <div key={lead.id} className="bg-white/4 border border-white/8 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-sm text-white">{lead.email}</p>
                    {lead.name && <p className="text-xs text-white/50 mt-0.5">{lead.name}</p>}
                  </div>
                  <Badge className={`text-xs border ${STATUS_COLORS[lead.status] ?? ''}`}>{lead.status}</Badge>
                </div>
                <p className="text-xs text-white/35">{lead.source?.replace(/_/g, ' ')} · {lead.created_date ? format(new Date(lead.created_date), 'MMM d') : ''}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
