import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Database, Users, ClipboardList } from 'lucide-react';

export default function MultiTenantAudit() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ dealers: [], members: [], orders: [], lineItems: [] });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const currentUser = await base44.auth.me();
    if (currentUser?.role !== 'admin') {
      navigate(createPageUrl('SalesDashboard'));
      return;
    }

    const [dealers, members, orders, lineItems] = await Promise.all([
      base44.entities.DealerInstance.list('name', 500),
      base44.entities.DealerMember.list('-created_date', 5000),
      base44.entities.Order.list('-created_date', 5000),
      base44.entities.LineItem.list('-created_date', 5000),
    ]);

    setData({ dealers: dealers || [], members: members || [], orders: orders || [], lineItems: lineItems || [] });
    setLoading(false);
  };

  const audit = useMemo(() => {
    const dealerMap = new Map(data.dealers.map(item => [item.id, item]));
    const seededMembers = data.members.filter(item => String(item.user_id || '').startsWith('seed-'));
    const seededOrders = data.orders.filter(item => String(item.reference_number || '').startsWith('TEST-'));
    const seededOrderIds = new Set(seededOrders.map(item => item.id));
    const seededLineItems = data.lineItems.filter(item => seededOrderIds.has(item.order_id));

    const orgRows = data.dealers.slice(0, 50).map((dealer) => {
      const members = seededMembers.filter(member => member.dealer_instance_id === dealer.id);
      const orders = seededOrders.filter(order => order.dealer_instance_id === dealer.id);
      const missingAssignments = orders.filter(order => !members.some(member => member.user_id === order.assigned_sales_rep_id)).length;
      return {
        id: dealer.id,
        name: dealer.company_name || dealer.name,
        reps: members.length,
        orders: orders.length,
        integrityOk: missingAssignments === 0,
        missingAssignments,
      };
    });

    return {
      dealerCount: data.dealers.length,
      seededRepCount: seededMembers.length,
      seededOrderCount: seededOrders.length,
      seededLineItemCount: seededLineItems.length,
      healthyOrgs: orgRows.filter(row => row.integrityOk).length,
      flaggedOrgs: orgRows.filter(row => !row.integrityOk),
      orgRows,
      orphanOrders: seededOrders.filter(order => !dealerMap.has(order.dealer_instance_id)),
    };
  }, [data]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-4 md:p-6 pb-24 md:pb-10">
      <div className="max-w-7xl mx-auto space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-3xl font-black">Multi-Tenant Audit</CardTitle>
                <CardDescription>Checks seeded org, sales rep, order, and line item tenant separation.</CardDescription>
              </div>
              <Button variant="outline" onClick={() => navigate(createPageUrl('DesignerDashboard'))}>Back to Global Admin</Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard icon={Database} label="Dealer Orgs" value={audit.dealerCount} />
          <MetricCard icon={Users} label="Seeded Reps" value={audit.seededRepCount} />
          <MetricCard icon={ClipboardList} label="Seeded Orders" value={audit.seededOrderCount} />
          <MetricCard icon={CheckCircle2} label="Healthy Orgs" value={audit.healthyOrgs} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Org Integrity</CardTitle>
            <CardDescription>Each org should have 3 seeded reps and 6 seeded orders with matching assignments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {audit.orgRows.map((row) => (
              <div key={row.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-xl border border-slate-200 p-4 bg-white">
                <div>
                  <p className="font-semibold text-slate-900">{row.name}</p>
                  <p className="text-sm text-slate-500">{row.reps} reps · {row.orders} orders</p>
                </div>
                <div className="flex items-center gap-3">
                  {row.integrityOk ? (
                    <Badge className="bg-green-100 text-green-700 border-0">Healthy</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-0">Flagged</Badge>
                  )}
                  {!row.integrityOk && <span className="text-sm text-red-600">{row.missingAssignments} assignment issues</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {(audit.flaggedOrgs.length > 0 || audit.orphanOrders.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500" /> Audit Flags</CardTitle>
              <CardDescription>These items need review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              {audit.flaggedOrgs.map((row) => (
                <div key={row.id}>Org {row.name} has {row.missingAssignments} seeded orders without matching rep membership.</div>
              ))}
              {audit.orphanOrders.map((order) => (
                <div key={order.id}>Order {order.reference_number || order.id} is missing a valid dealer_instance_id link.</div>
              ))}
            </CardContent>
          </Card>
        )}
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