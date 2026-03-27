import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { BarChart3, BriefcaseBusiness, CircleCheckBig, CircleX, TrendingUp } from 'lucide-react';
import { ensureBrokerInstance } from '@/lib/brokerInstance';
import KpiCard from '@/components/executive/KpiCard';
import ExecutiveStatusBreakdown from '@/components/executive/ExecutiveStatusBreakdown';
import ExecutiveOrderList from '@/components/executive/ExecutiveOrderList';

const WON_STATUSES = ['Confirmed', 'Delivered', 'Accepted'];
const LOST_STATUSES = ['Declined', 'Cancelled'];
const ACTIVE_STATUSES = ['Pending', 'Contacted', 'Quoted', 'Negotiating', 'Ordered', 'In Production', 'Shipped'];

function fmtMoney(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function ExecutiveDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [brokerInstance, setBrokerInstance] = useState(null);
  const [selectedView, setSelectedView] = useState('active');
  const detailSectionRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (currentUser?.role !== 'admin') {
          navigate(createPageUrl('SalesDashboard'));
          return;
        }

        const instance = await ensureBrokerInstance(currentUser);
        setBrokerInstance(instance);
        const allOrders = await base44.entities.Order.list('-created_date', 1000);
        const scopedOrders = (allOrders || []).filter(order => {
          if (order.broker_instance_id) {
            return order.broker_instance_id === (instance?.id || currentUser.broker_instance_id);
          }
          return order.dealer_email === currentUser.email || order.created_by === currentUser.email;
        });
        setOrders(scopedOrders);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const metrics = useMemo(() => {
    const activeOrders = orders.filter(order => ACTIVE_STATUSES.includes(order.status));
    const wonOrders = orders.filter(order => WON_STATUSES.includes(order.status));
    const lostOrders = orders.filter(order => LOST_STATUSES.includes(order.status));
    const pipelineValue = activeOrders.reduce((sum, order) => sum + (order.final_price || order.quoted_price || 0), 0);
    const wonValue = wonOrders.reduce((sum, order) => sum + (order.final_price || order.quoted_price || 0), 0);
    const decisionCount = wonOrders.length + lostOrders.length;
    const winRate = decisionCount ? Math.round((wonOrders.length / decisionCount) * 100) : 0;

    return {
      activeOrders,
      wonOrders,
      lostOrders,
      pipelineValue,
      wonValue,
      winRate
    };
  }, [orders]);

  const handleSelectView = (viewKey) => {
    setSelectedView(viewKey);
    requestAnimationFrame(() => {
      detailSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const detailConfig = {
    active: {
      title: 'Active Orders',
      subtitle: 'Open deals currently moving through the broker pipeline',
      orders: metrics.activeOrders
    },
    pipelineValue: {
      title: 'Pipeline Orders',
      subtitle: 'Orders currently included in active pipeline value',
      orders: metrics.activeOrders
    },
    won: {
      title: 'Won Orders',
      subtitle: 'All confirmed, delivered, and accepted business',
      orders: metrics.wonOrders
    },
    lost: {
      title: 'Lost Orders',
      subtitle: 'Declined and cancelled opportunities',
      orders: metrics.lostOrders
    },
    closedWon: {
      title: 'Closed Won Orders',
      subtitle: 'Orders contributing to closed-won value',
      orders: metrics.wonOrders
    },
    pending: {
      title: 'Pending Orders',
      subtitle: 'Orders currently in pending status',
      orders: orders.filter(order => ['Pending'].includes(order.status))
    },
    contacted: {
      title: 'Contacted Orders',
      subtitle: 'Orders currently in contacted status',
      orders: orders.filter(order => ['Contacted'].includes(order.status))
    },
    quoted: {
      title: 'Quoted Orders',
      subtitle: 'Orders currently in quoted status',
      orders: orders.filter(order => ['Quoted'].includes(order.status))
    },
    negotiating: {
      title: 'Negotiating Orders',
      subtitle: 'Orders currently in negotiating status',
      orders: orders.filter(order => ['Negotiating'].includes(order.status))
    },
    production: {
      title: 'Production Orders',
      subtitle: 'Orders in ordered, in production, or shipped stages',
      orders: orders.filter(order => ['Ordered', 'In Production', 'Shipped'].includes(order.status))
    }
  };

  const breakdownRows = useMemo(() => {
    const groups = [
      { label: 'Pending', statuses: ['Pending'], key: 'pending' },
      { label: 'Contacted', statuses: ['Contacted'], key: 'contacted' },
      { label: 'Quoted', statuses: ['Quoted'], key: 'quoted' },
      { label: 'Negotiating', statuses: ['Negotiating'], key: 'negotiating' },
      { label: 'Production', statuses: ['Ordered', 'In Production', 'Shipped'], key: 'production' },
      { label: 'Won', statuses: WON_STATUSES, key: 'won' },
      { label: 'Lost', statuses: LOST_STATUSES, key: 'lost' }
    ];

    return groups.map((group) => {
      const items = orders.filter(order => group.statuses.includes(order.status));
      const value = items.reduce((sum, order) => sum + (order.final_price || order.quoted_price || 0), 0);
      return {
        key: group.key,
        label: group.label,
        count: items.length,
        value,
        share: orders.length ? Math.round((items.length / orders.length) * 100) : 0
      };
    });
  }, [orders, metrics.activeOrders, metrics.wonOrders, metrics.lostOrders]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-6 pb-24 md:pb-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e2231a]/15 bg-[#e2231a]/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e2231a]">
                Executive View
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-slate-900">Admin Sales Breakdown</h1>
              <p className="mt-2 text-sm md:text-base text-slate-600">
                Broker-level KPIs for active orders, won/lost performance, and pipeline health{brokerInstance?.name ? ` for ${brokerInstance.name}` : ''}.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total Orders</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{orders.length}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Active Orders" value={metrics.activeOrders.length} note="Open pipeline opportunities" tone="blue" isActive={selectedView === 'active'} onClick={() => handleSelectView('active')} />
          <KpiCard label="Pipeline Value" value={fmtMoney(metrics.pipelineValue)} note="Current active order value" tone="red" isActive={selectedView === 'pipelineValue'} onClick={() => handleSelectView('pipelineValue')} />
          <KpiCard label="Won / Lost" value={`${metrics.wonOrders.length} / ${metrics.lostOrders.length}`} note={`Win rate ${metrics.winRate}%`} tone="green" isActive={selectedView === 'won' || selectedView === 'lost'} onClick={() => handleSelectView(metrics.wonOrders.length > 0 ? 'won' : 'lost')} />
          <KpiCard label="Closed Won Value" value={fmtMoney(metrics.wonValue)} note="Value from won business" tone="amber" isActive={selectedView === 'closedWon'} onClick={() => handleSelectView('closedWon')} />
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1 space-y-4">
            <button onClick={() => handleSelectView('active')} className={`flex items-center gap-3 w-full text-left rounded-2xl p-2 transition-colors ${selectedView === 'active' ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><BriefcaseBusiness className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-bold text-slate-900">Active Pipeline</p>
                <p className="text-xs text-slate-500">Deals in progress</p>
              </div>
            </button>
            <button onClick={() => handleSelectView('won')} className={`flex items-center gap-3 w-full text-left rounded-2xl p-2 transition-colors ${selectedView === 'won' ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-600"><CircleCheckBig className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-bold text-slate-900">Won Deals</p>
                <p className="text-xs text-slate-500">{metrics.wonOrders.length} total won</p>
              </div>
            </button>
            <button onClick={() => handleSelectView('lost')} className={`flex items-center gap-3 w-full text-left rounded-2xl p-2 transition-colors ${selectedView === 'lost' ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-600"><CircleX className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-bold text-slate-900">Lost Deals</p>
                <p className="text-xs text-slate-500">{metrics.lostOrders.length} total lost</p>
              </div>
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-bold text-slate-900">Conversion</p>
                <p className="text-xs text-slate-500">{metrics.winRate}% close rate</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <ExecutiveStatusBreakdown rows={breakdownRows} onRowClick={(row) => handleSelectView(row.key)} />
          </div>
        </div>

        <div ref={detailSectionRef} className="scroll-mt-24">
          <ExecutiveOrderList
            title={detailConfig[selectedView].title}
            subtitle={detailConfig[selectedView].subtitle}
            orders={detailConfig[selectedView].orders}
          />
        </div>

        {orders.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-500 shadow-sm">
            No current orders were found for this executive workspace yet.
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><BarChart3 className="w-5 h-5" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Executive Summary</h2>
              <p className="text-sm text-slate-500">Quick readout for Orbus C-suite style reporting</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Most important now</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{metrics.activeOrders.length} active orders are still moving through the broker pipeline.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Revenue signal</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Current active pipeline is worth {fmtMoney(metrics.pipelineValue)}.</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Outcome signal</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Won deals are converting at {metrics.winRate}% against lost opportunities.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}