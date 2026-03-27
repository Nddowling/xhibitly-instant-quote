import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ensureBrokerInstance } from '@/lib/brokerInstance';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, BriefcaseBusiness, ArrowLeft } from 'lucide-react';

const WON_STATUSES = ['Confirmed', 'Delivered', 'Accepted'];
const LOST_STATUSES = ['Declined', 'Cancelled'];
const ACTIVE_STATUSES = ['Pending', 'Contacted', 'Quoted', 'Negotiating', 'Ordered', 'In Production', 'Shipped'];
const STATUS_OPTIONS = ['all', 'Pending', 'Contacted', 'Quoted', 'Negotiating', 'Ordered', 'In Production', 'Shipped', 'Accepted', 'Confirmed', 'Delivered', 'Declined', 'Cancelled'];

function fmtMoney(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function getPresetConfig(preset) {
  switch (preset) {
    case 'pipelineValue':
      return {
        title: 'Pipeline Orders',
        subtitle: 'Orders currently included in active pipeline value',
        statuses: ACTIVE_STATUSES,
      };
    case 'won':
      return {
        title: 'Won Orders',
        subtitle: 'All confirmed, delivered, and accepted business',
        statuses: WON_STATUSES,
      };
    case 'lost':
      return {
        title: 'Lost Orders',
        subtitle: 'Declined and cancelled opportunities',
        statuses: LOST_STATUSES,
      };
    case 'closedWon':
      return {
        title: 'Closed Won Orders',
        subtitle: 'Orders contributing to closed-won value',
        statuses: WON_STATUSES,
      };
    case 'pending':
      return {
        title: 'Pending Orders',
        subtitle: 'Orders currently in pending status',
        statuses: ['Pending'],
      };
    case 'contacted':
      return {
        title: 'Contacted Orders',
        subtitle: 'Orders currently in contacted status',
        statuses: ['Contacted'],
      };
    case 'quoted':
      return {
        title: 'Quoted Orders',
        subtitle: 'Orders currently in quoted status',
        statuses: ['Quoted'],
      };
    case 'negotiating':
      return {
        title: 'Negotiating Orders',
        subtitle: 'Orders currently in negotiating status',
        statuses: ['Negotiating'],
      };
    case 'production':
      return {
        title: 'Production Orders',
        subtitle: 'Orders in ordered, in production, or shipped stages',
        statuses: ['Ordered', 'In Production', 'Shipped'],
      };
    case 'active':
    default:
      return {
        title: 'Active Orders',
        subtitle: 'Open deals currently moving through the broker pipeline',
        statuses: ACTIVE_STATUSES,
      };
  }
}

function getStatusBadgeStyle(status) {
  switch (status) {
    case 'Confirmed':
    case 'Delivered':
    case 'Accepted':
      return 'bg-green-100 text-green-700';
    case 'Pending':
    case 'Contacted':
      return 'bg-blue-100 text-blue-700';
    case 'Quoted':
    case 'Negotiating':
      return 'bg-yellow-100 text-yellow-700';
    case 'In Production':
    case 'Ordered':
    case 'Shipped':
      return 'bg-purple-100 text-purple-700';
    case 'Declined':
    case 'Cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function ExecutiveListView() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const preset = urlParams.get('preset') || 'active';
  const presetConfig = getPresetConfig(preset);

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [boothFilter, setBoothFilter] = useState('all');

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser?.role !== 'admin') {
          navigate(createPageUrl('SalesDashboard'));
          return;
        }

        const brokerInstance = await ensureBrokerInstance(currentUser);
        const allOrders = await base44.entities.Order.list('-created_date', 1000);
        const scopedOrders = (allOrders || []).filter(order => {
          if (order.broker_instance_id) {
            return order.broker_instance_id === (brokerInstance?.id || currentUser.broker_instance_id);
          }
          return order.dealer_email === currentUser.email || order.created_by === currentUser.email;
        });

        setOrders(scopedOrders);
        if (presetConfig.statuses.length === 1) {
          setStatusFilter(presetConfig.statuses[0]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [preset]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!presetConfig.statuses.includes(order.status)) return false;
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (boothFilter !== 'all' && order.booth_size !== boothFilter) return false;
      if (!searchQuery) return true;

      const q = searchQuery.toLowerCase();
      return (
        order.customer_name?.toLowerCase().includes(q) ||
        order.customer_company?.toLowerCase().includes(q) ||
        order.customer_email?.toLowerCase().includes(q) ||
        order.dealer_company?.toLowerCase().includes(q) ||
        order.dealer_name?.toLowerCase().includes(q) ||
        order.show_name?.toLowerCase().includes(q) ||
        order.reference_number?.toLowerCase().includes(q)
      );
    });
  }, [orders, presetConfig, searchQuery, statusFilter, boothFilter]);

  const availableStatuses = STATUS_OPTIONS.filter(
    (status) => status === 'all' || presetConfig.statuses.includes(status)
  );
  const boothSizes = ['all', '10x10', '10x20', '20x20', '20x30', 'island'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-6 pb-24 md:pb-10">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <button
                onClick={() => navigate(createPageUrl('ExecutiveDashboard'))}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Executive Dashboard
              </button>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#e2231a]/15 bg-[#e2231a]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e2231a]">
                Executive List View
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-slate-900">{presetConfig.title}</h1>
              <p className="mt-2 text-sm md:text-base text-slate-600">{presetConfig.subtitle}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Visible Orders</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{filteredOrders.length}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by company, contact, show, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === 'all' ? 'All statuses' : status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={boothFilter} onValueChange={setBoothFilter}>
                <SelectTrigger>
                  <BriefcaseBusiness className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Booth size" />
                </SelectTrigger>
                <SelectContent>
                  {boothSizes.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size === 'all' ? 'All booth sizes' : size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {filteredOrders.length === 0 ? (
              <div className="px-6 py-16 text-center text-slate-500">No orders match the current filters.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => navigate(`${createPageUrl('OrderDetail')}?id=${order.id}&returnTo=${encodeURIComponent(`/ExecutiveListView?preset=${preset}`)}`)}
                    className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_150px_150px_130px_120px] gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{order.customer_company || order.dealer_company || order.customer_name || 'Untitled Order'}</p>
                      <p className="text-xs text-slate-500 mt-1 truncate">{order.customer_name || order.dealer_name || order.customer_email || 'No contact'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                      <Badge className={`${getStatusBadgeStyle(order.status)} mt-1 border-0`}>{order.status || 'Draft'}</Badge>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Show</p>
                      <p className="text-sm font-bold text-slate-800 mt-1">{order.show_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Booth</p>
                      <p className="text-sm font-bold text-slate-800 mt-1">{order.booth_size || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Value</p>
                      <p className="text-sm font-bold text-slate-800 mt-1">{fmtMoney(order.final_price || order.quoted_price || 0)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}