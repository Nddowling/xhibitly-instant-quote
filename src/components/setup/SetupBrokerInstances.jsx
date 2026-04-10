import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SetupBrokerInstances() {
  const [brokers, setBrokers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [form, setForm] = useState({ name: '', company_name: '', owner_email: '' });

  useEffect(() => {
    loadBrokers();
  }, []);

  const loadBrokers = async () => {
    const [me, rows, dealerMembers] = await Promise.all([
      base44.auth.me(),
      base44.entities.DealerInstance.list('name', 500),
      base44.entities.DealerMember.list('created_date', 500),
    ]);
    setCurrentUser(me);
    setMemberships(dealerMembers || []);
    setBrokers(rows || []);
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.owner_email.trim()) return;
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    await base44.entities.DealerInstance.create({
      name: form.name,
      slug,
      owner_user_id: currentUser?.id || '',
      owner_email: form.owner_email,
      company_name: form.company_name,
      status: 'active'
    });
    setForm({ name: '', company_name: '', owner_email: '' });
    loadBrokers();
  };

  const visibleBrokers = useMemo(() => {
    const hasGlobalAccess = [currentUser?.profile_name, currentUser?.profile, currentUser?.role]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes('global');

    if (hasGlobalAccess) return brokers;

    const memberOrgIds = memberships
      .filter((member) => (member.user_id || member.data?.user_id) === currentUser?.id)
      .map((member) => member.dealer_instance_id || member.data?.dealer_instance_id)
      .filter(Boolean);

    return brokers.filter((broker) => memberOrgIds.includes(broker.id));
  }, [brokers, currentUser, memberships]);

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dealer Workspaces</CardTitle>
          <CardDescription>Create isolated dealer orgs under your umbrella.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Workspace name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Company name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <Input placeholder="Owner email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
          <Button onClick={handleCreate} className="bg-[#e2231a] hover:bg-[#b01b13]">Create Dealer Workspace</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Workspaces</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleBrokers.map((broker) => (
            <div key={broker.id} className="rounded-xl border border-slate-200 p-3">
              <div className="font-semibold text-slate-900">{broker.name}</div>
              <div className="text-sm text-slate-500">{broker.company_name || broker.owner_email}</div>
              <div className="text-xs text-slate-400 mt-1">{broker.owner_email}</div>
            </div>
          ))}
          {visibleBrokers.length === 0 && <p className="text-sm text-slate-500">No dealer workspaces available for this user.</p>}
        </CardContent>
      </Card>
    </div>
  );
}