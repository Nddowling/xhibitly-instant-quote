import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search } from 'lucide-react';
import { loadAllBrokerInstances, loadBrokerContext, scopeItems } from '@/lib/brokerAccess';

const VIEW_CONFIG = {
  orgs: { title: 'Dealer Organizations', description: 'All dealer workspaces in the current view.' },
  users: { title: 'Dealer Users', description: 'Users connected to the current dealer scope.' },
  orders: { title: 'Dealer Orders', description: 'Orders included in the current dealer scope.' },
  revenue: { title: 'Revenue Orders', description: 'Orders contributing to the current revenue total.' },
};

export default function GlobalAdminMetricView() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type') || 'orgs';
  const [context, setContext] = useState(null);
  const [brokerInstances, setBrokerInstances] = useState([]);
  const [orders, setOrders] = useState([]);
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const brokerContext = await loadBrokerContext();
    if (brokerContext.user?.role !== 'admin') {
      navigate(createPageUrl('SalesDashboard'));
      return;
    }

    const [instances, allOrders, allMembers] = await Promise.all([
      loadAllBrokerInstances(),
      base44.entities.Order.list('-created_date', 1000),
      base44.entities.BrokerMember.list('user_email', 1000),
    ]);

    setContext(brokerContext);
    setBrokerInstances(instances || []);
    setOrders(allOrders || []);
    setMembers(allMembers || []);
    setLoading(false);
  };

  const isGlobalView = !context?.effectiveBrokerId;
  const scopedOrders = useMemo(() => isGlobalView ? orders : scopeItems(orders, context?.effectiveBrokerId), [orders, context, isGlobalView]);
  const scopedMembers = useMemo(() => isGlobalView ? members : scopeItems(members, context?.effectiveBrokerId), [members, context, isGlobalView]);
  const scopedInstances = useMemo(() => isGlobalView ? brokerInstances : brokerInstances.filter((broker) => broker.id === context?.effectiveBrokerId), [brokerInstances, context, isGlobalView]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matches = (value) => String(value || '').toLowerCase().includes(query);

    if (type === 'users') {
      return scopedMembers.filter((item) => !query || matches(item.user_email) || matches(item.member_role) || matches(item.user_id));
    }

    if (type === 'orders' || type === 'revenue') {
      return scopedOrders.filter((item) => !query || matches(item.reference_number) || matches(item.dealer_company) || matches(item.dealer_name) || matches(item.customer_company) || matches(item.status));
    }

    return scopedInstances.filter((item) => !query || matches(item.company_name) || matches(item.name) || matches(item.owner_email) || matches(item.status));
  }, [type, scopedMembers, scopedOrders, scopedInstances, searchQuery]);

  const config = VIEW_CONFIG[type] || VIEW_CONFIG.orgs;

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-4 md:p-6 pb-24 md:pb-10">
      <div className="max-w-7xl mx-auto space-y-5">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <button onClick={() => navigate(createPageUrl('DesignerDashboard'))} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Global Admin
                </button>
                <CardTitle className="mt-4 text-3xl font-black text-slate-900">{config.title}</CardTitle>
                <CardDescription className="mt-1">{config.description}</CardDescription>
              </div>
              <Badge variant="outline" className="w-fit text-sm">{filteredItems.length} results</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search this list..." className="pl-9" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {filteredItems.map((item) => {
            if (type === 'users') {
              return (
                <Card key={item.id}>
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.user_email || 'No email'}</p>
                      <p className="text-sm text-slate-500">User ID: {item.user_id || '-'}</p>
                    </div>
                    <Badge variant="outline">{item.member_role || 'member'}</Badge>
                  </CardContent>
                </Card>
              );
            }

            if (type === 'orders' || type === 'revenue') {
              return (
                <Card key={item.id}>
                  <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{item.reference_number || `Order #${item.id.slice(-6)}`}</p>
                      <p className="text-sm text-slate-500">{item.dealer_company || item.customer_company || 'No company'} · {item.dealer_name || item.customer_name || 'No contact'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{item.status || 'No status'}</Badge>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Value</p>
                        <p className="font-semibold text-slate-900">{formatPrice(item.final_price || item.quoted_price || 0)}</p>
                      </div>
                      <Button variant="outline" onClick={() => navigate(`${createPageUrl('OrderDetail')}?id=${item.id}`)}>Open</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card key={item.id}>
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{item.company_name || item.name || 'Unnamed dealer'}</p>
                    <p className="text-sm text-slate-500">Owner: {item.owner_email || '-'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{item.status || 'unknown'}</Badge>
                    <Button variant="outline" onClick={() => navigate(createPageUrl('DesignerDashboard'))}>Open Dashboard</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}