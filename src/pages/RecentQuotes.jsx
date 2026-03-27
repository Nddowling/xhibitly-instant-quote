import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, FileText, ExternalLink, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { ensureBrokerInstance } from '@/lib/brokerInstance';

const STATUSES = ['All', 'Draft', 'Pending', 'Contacted', 'Quoted', 'Negotiating', 'Accepted', 'Confirmed', 'Declined', 'Ordered', 'In Production', 'Shipped', 'Delivered', 'Cancelled'];
const BOOTH_SIZES = ['All', '10x10', '10x20', '20x20', '20x30', 'island'];

function statusColor(status) {
  switch (status) {
    case 'Confirmed': case 'Delivered': case 'Accepted': return 'bg-green-100 text-green-700';
    case 'Quoted': case 'Negotiating': return 'bg-yellow-100 text-yellow-700';
    case 'In Production': case 'Shipped': case 'Ordered': return 'bg-purple-100 text-purple-700';
    case 'Pending': case 'Contacted': return 'bg-blue-100 text-blue-700';
    case 'Cancelled': case 'Declined': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function fmt(n) {
  if (!n) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function RecentQuotes() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [boothFilter, setBoothFilter] = useState('All');

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const currentUser = await base44.auth.me();
        const brokerInstance = await ensureBrokerInstance(currentUser);
        const res = await base44.entities.Order.list('-created_date', 500);
        setOrders((res || []).filter(order => order.broker_instance_id === (brokerInstance?.id || currentUser.broker_instance_id)));
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  const filtered = orders.filter(o => {
    if (statusFilter !== 'All' && o.status !== statusFilter) return false;
    if (boothFilter !== 'All' && o.booth_size !== boothFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_company?.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q) ||
        o.show_name?.toLowerCase().includes(q) ||
        o.reference_number?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 pb-24 md:pb-10">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Recent Quotes</h1>
              <p className="text-sm text-slate-500 mt-0.5">{filtered.length} of {orders.length} quotes</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, company, email, show, or ref#..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Status:</span>
              {['All', 'Draft', 'Quoted', 'Accepted', 'Confirmed', 'Cancelled'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                    statusFilter === s
                      ? 'bg-[#e2231a] text-white border-[#e2231a]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#e2231a]/40'
                  }`}
                >
                  {s}
                </button>
              ))}
              {/* More statuses dropdown-style — show all */}
              {!['All', 'Draft', 'Quoted', 'Accepted', 'Confirmed', 'Cancelled'].includes(statusFilter) && (
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e2231a] text-white border border-[#e2231a]`}>
                  {statusFilter}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap ml-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Booth:</span>
              {BOOTH_SIZES.map(s => (
                <button
                  key={s}
                  onClick={() => setBoothFilter(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                    boothFilter === s
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No quotes match your filters</p>
          </div>
        ) : (
          filtered.map((order, idx) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.3) }}
              onClick={() => navigate(createPageUrl('OrderDetail') + '?orderId=' + order.id)}
              className="bg-white rounded-xl border border-slate-200 hover:border-[#e2231a]/40 hover:shadow-md transition-all cursor-pointer p-4"
            >
              <div className="flex items-start gap-4">
                {/* Left: customer info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-slate-900 truncate">
                      {order.customer_name || order.customer_email || 'Unknown'}
                    </span>
                    {order.customer_company && (
                      <span className="text-xs text-slate-400">· {order.customer_company}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                    {order.show_name && <span>{order.show_name}</span>}
                    {order.booth_size && (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono font-semibold">
                        {order.booth_size}
                      </span>
                    )}
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-slate-400">{order.reference_number || order.id?.slice(0, 8)}</span>
                  </div>
                </div>

                {/* Right: status + price + date */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-black text-slate-800">{fmt(order.quoted_price)}</p>
                    <p className="text-[10px] text-slate-400">
                      {order.created_date ? new Date(order.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                  </div>
                  <Badge className={`${statusColor(order.status)} text-xs font-semibold border-0`}>
                    {order.status || 'Draft'}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </div>

              {/* Mobile: price row */}
              <div className="sm:hidden flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  {order.created_date ? new Date(order.created_date).toLocaleDateString() : '—'}
                </span>
                <span className="text-sm font-black text-slate-800">{fmt(order.quoted_price)}</span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}