import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Users, DollarSign, ClipboardList } from 'lucide-react';
import BrokerWorkspaceSwitcher from '@/components/broker/BrokerWorkspaceSwitcher';
import { loadAllBrokerInstances, loadBrokerContext, setActiveBrokerInstance, scopeItems } from '@/lib/brokerAccess';

export default function DesignerDashboard() {
  const navigate = useNavigate();
  const [context, setContext] = useState(null);
  const [brokerInstances, setBrokerInstances] = useState([]);
  const [orders, setOrders] = useState([]);
  const [members, setMembers] = useState([]);

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
      base44.entities.Order.list('-created_date', 500),
      base44.entities.BrokerMember.list('user_email', 500),
    ]);

    setContext(brokerContext);
    setBrokerInstances(instances || []);
    setOrders(allOrders || []);
    setMembers(allMembers || []);
  };

  const activeBroker = useMemo(
    () => brokerInstances.find((broker) => broker.id === context?.effectiveBrokerId) || null,
    [brokerInstances, context]
  );

  const scopedOrders = useMemo(
    () => scopeItems(orders, context?.effectiveBrokerId),
    [orders, context]
  );

  const scopedMembers = useMemo(
    () => scopeItems(members, context?.effectiveBrokerId),
    [members, context]
  );

  const totalRevenue = scopedOrders.reduce((sum, order) => sum + (order.final_price || order.quoted_price || 0), 0);

  const handleSwitch = async (brokerId) => {
    await setActiveBrokerInstance(brokerId);
    await loadData();
  };

  if (!context) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-4 md:p-6 pb-24 md:pb-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900">Global Admin Dashboard</h1>
            <p className="text-slate-600 mt-1">Switch between orgs, review isolated workspaces, and drill into a selected org safely.</p>
          </div>
          <BrokerWorkspaceSwitcher
            brokerInstances={brokerInstances}
            activeBrokerId={context.effectiveBrokerId}
            onChange={handleSwitch}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard icon={Building2} label="Broker Orgs" value={brokerInstances.length} />
          <MetricCard icon={Users} label="Broker Users" value={scopedMembers.length} />
          <MetricCard icon={ClipboardList} label="Broker Orders" value={scopedOrders.length} />
          <MetricCard icon={DollarSign} label="Broker Revenue" value={formatPrice(totalRevenue)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{activeBroker?.name || 'No broker selected'}</CardTitle>
            <CardDescription>Current isolated workspace snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <InfoRow label="Workspace ID" value={activeBroker?.id || '-'} />
              <InfoRow label="Owner Email" value={activeBroker?.owner_email || '-'} />
              <InfoRow label="Company" value={activeBroker?.company_name || '-'} />
              <InfoRow label="Status" value={activeBroker?.status || '-'} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => navigate(createPageUrl('Setup'))} variant="outline">Open Org Setup</Button>
              <Button onClick={() => navigate(createPageUrl('SalesDashboard'))} className="bg-[#e2231a] hover:bg-[#b01b13]">Open Selected Org</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Icon className="w-5 h-5 text-[#e2231a]" />
        </div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="font-medium text-slate-900 break-all">{value}</p>
    </div>
  );
}

function formatPrice(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
}