import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Building2, Users, DollarSign, ClipboardList } from 'lucide-react';
import BrokerWorkspaceSwitcher from '@/components/broker/BrokerWorkspaceSwitcher';
import DashboardAgentPanel from '@/components/agents/DashboardAgentPanel';
import { usePermissions } from '@/components/contexts/PermissionsContext';
import { loadAllBrokerInstances, loadBrokerContext, setActiveBrokerInstance, scopeItems } from '@/lib/brokerAccess';
export default function DesignerDashboard() {
  const navigate = useNavigate();
  const { permissions } = usePermissions() || {};
  const [context, setContext] = useState(null);
  const [brokerInstances, setBrokerInstances] = useState([]);
  const [orders, setOrders] = useState([]);
  const [members, setMembers] = useState([]);
  const [permissionSets, setPermissionSets] = useState([]);
  const [showGlobalPrompt, setShowGlobalPrompt] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const brokerContext = await loadBrokerContext();
    if (brokerContext.user?.role !== 'admin') {
      navigate(createPageUrl('SalesDashboard'));
      return;
    }

    const userAssignments = await base44.entities.UserPermissionAssignment.filter({ user_id: brokerContext.user.id });
    const userPermissionSetIds = userAssignments?.[0]?.permission_set_ids || [];

    const [instances, allOrders, allMembers, allPermissionSets] = await Promise.all([
      loadAllBrokerInstances(),
      base44.entities.Order.list('-created_date', 500),
      base44.entities.BrokerMember.list('user_email', 500),
      base44.entities.PermissionSet.list('name', 500),
    ]);

    setContext({ ...brokerContext, userPermissionSetIds });
    setBrokerInstances(instances || []);
    setOrders(allOrders || []);
    setMembers(allMembers || []);
    setPermissionSets(allPermissionSets || []);
  };

  const activeBroker = useMemo(
    () => brokerInstances.find((broker) => broker.id === context?.effectiveBrokerId) || null,
    [brokerInstances, context]
  );

  const isGlobalView = !context?.effectiveBrokerId;

  const scopedOrders = useMemo(
    () => isGlobalView ? orders : scopeItems(orders, context?.effectiveBrokerId),
    [orders, context, isGlobalView]
  );

  const scopedMembers = useMemo(
    () => isGlobalView ? members : scopeItems(members, context?.effectiveBrokerId),
    [members, context, isGlobalView]
  );

  const totalRevenue = scopedOrders.reduce((sum, order) => sum + (order.final_price || order.quoted_price || 0), 0);
  const globalAgentPermissionSet = permissionSets.find((item) => item.name === 'Global Agent');
  const userHasGlobalAgentPermission = permissions?._isAdmin || (context && globalAgentPermissionSet && Array.isArray(context.userPermissionSetIds) && context.userPermissionSetIds.includes(globalAgentPermissionSet.id));

  const handleSwitch = async (brokerId) => {
    await setActiveBrokerInstance(brokerId);
    await loadData();
  };

  const handleEnterGlobalView = async () => {
    await setActiveBrokerInstance('');
    setShowGlobalPrompt(false);
    await loadData();
  };

  const handleReturnToDealerView = async () => {
    const fallbackDealerId = context?.dealerInstance?.id || context?.user?.dealer_instance_id || brokerInstances[0]?.id || '';
    if (!fallbackDealerId) return;
    await setActiveBrokerInstance(fallbackDealerId);
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
            <p className="text-slate-600 mt-1">{isGlobalView ? 'Viewing all dealer data at the global level until you switch back into a dealer workspace.' : 'Switch between dealers, review isolated workspaces, and drill into a selected dealer safely.'}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <BrokerWorkspaceSwitcher
              brokerInstances={brokerInstances}
              activeBrokerId={context.effectiveBrokerId}
              onChange={handleSwitch}
            />
            {isGlobalView ? (
              <Button variant="outline" onClick={handleReturnToDealerView}>Return to Dealer View</Button>
            ) : (
              <Button variant="outline" onClick={() => setShowGlobalPrompt(true)}>Enter Global View</Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Building2} label={isGlobalView ? 'All Dealer Orgs' : 'Dealer Orgs'} value={isGlobalView ? brokerInstances.length : 1} onClick={() => navigate(`${createPageUrl('GlobalAdminMetricView')}?type=orgs`)} />
        <MetricCard icon={Users} label={isGlobalView ? 'All Dealer Users' : 'Dealer Users'} value={scopedMembers.length} onClick={() => navigate(`${createPageUrl('GlobalAdminMetricView')}?type=users`)} />
        <MetricCard icon={ClipboardList} label={isGlobalView ? 'All Dealer Orders' : 'Dealer Orders'} value={scopedOrders.length} onClick={() => navigate(`${createPageUrl('GlobalAdminMetricView')}?type=orders`)} />
        <MetricCard icon={DollarSign} label={isGlobalView ? 'Global Revenue' : 'Dealer Revenue'} value={formatPrice(totalRevenue)} onClick={() => navigate(`${createPageUrl('GlobalAdminMetricView')}?type=revenue`)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{isGlobalView ? 'Global Portfolio View' : activeBroker?.name || context?.dealerInstance?.name || 'No dealer selected'}</CardTitle>
            <CardDescription>{isGlobalView ? 'Showing combined data across all dealer workspaces.' : 'Current isolated workspace snapshot'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <InfoRow label="Workspace ID" value={isGlobalView ? 'All workspaces' : activeBroker?.id || '-'} />
              <InfoRow label="Owner Email" value={isGlobalView ? '-' : activeBroker?.owner_email || '-'} />
              <InfoRow label="Company" value={isGlobalView ? 'Combined portfolio' : activeBroker?.company_name || '-'} />
              <InfoRow label="Status" value={isGlobalView ? 'global' : activeBroker?.status || '-'} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => navigate(createPageUrl('Setup'))} variant="outline">Open Org Setup</Button>
              {!isGlobalView && <Button onClick={() => navigate(createPageUrl('SalesDashboard'))} className="bg-[#e2231a] hover:bg-[#b01b13]">Open Selected Org</Button>}
            </div>
          </CardContent>
        </Card>

        {userHasGlobalAgentPermission && (
          <DashboardAgentPanel
            agentName="executive_analytics_assistant"
            title="Global Agent"
            subtitle={isGlobalView ? 'Ask about the full multi-org portfolio.' : 'Ask about the selected org or the full multi-org portfolio.'}
            promptHint="Ask things like: which org has the largest pipeline, what are the quarterly projections for Q3 this year, or if we keep the same growth rate where do we land in Q3 2027."
            starterQuestions={[
              'Which org has the largest pipeline?',
              'What are the quarterly projections for Q3 this year?',
              'If we keep our growth rate the same, where does it put us in Q3 2027?'
            ]}
          />
        )}

        <AlertDialog open={showGlobalPrompt} onOpenChange={setShowGlobalPrompt}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Switch to Global View?</AlertDialogTitle>
              <AlertDialogDescription>
                Would you like to log out of the current dealer workspace and see everything at the global level until you choose another dealer instance?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay in Dealer View</AlertDialogCancel>
              <AlertDialogAction onClick={handleEnterGlobalView}>Yes, go global</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, onClick }) {
  return (
    <Card className={onClick ? 'cursor-pointer hover:shadow-md hover:border-[#e2231a] transition-all' : ''} onClick={onClick}>
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