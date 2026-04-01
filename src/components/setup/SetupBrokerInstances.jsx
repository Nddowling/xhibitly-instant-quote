import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SetupBrokerInstances() {
  const [brokers, setBrokers] = useState([]);
  const [form, setForm] = useState({ name: '', company_name: '', owner_email: '' });

  useEffect(() => {
    loadBrokers();
  }, []);

  const loadBrokers = async () => {
    const rows = await base44.entities.BrokerInstance.list('name', 500);
    setBrokers(rows || []);
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.owner_email.trim()) return;
    const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    await base44.entities.BrokerInstance.create({
      name: form.name,
      slug,
      owner_user_id: '',
      owner_email: form.owner_email,
      company_name: form.company_name,
      status: 'active'
    });
    setForm({ name: '', company_name: '', owner_email: '' });
    loadBrokers();
  };

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
          {brokers.map((broker) => (
            <div key={broker.id} className="rounded-xl border border-slate-200 p-3">
              <div className="font-semibold text-slate-900">{broker.name}</div>
              <div className="text-sm text-slate-500">{broker.company_name || broker.owner_email}</div>
            </div>
          ))}
          {brokers.length === 0 && <p className="text-sm text-slate-500">No dealer workspaces yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}