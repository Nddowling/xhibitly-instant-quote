import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link2, PlugZap, Building2 } from 'lucide-react';

const CONNECTORS = [
  {
    key: 'salesforce',
    name: 'Salesforce',
    description: 'Connect Salesforce so your team can work with CRM data without migrating it.',
    status: 'ready',
  },
  {
    key: 'hubspot',
    name: 'HubSpot',
    description: 'Connect HubSpot contacts, companies, and deals for quoting workflows.',
    status: 'ready',
  },
];

export default function SetupCrmConnectors() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">CRM Connectors</h2>
        <p className="text-sm text-slate-500">Use Base44 native shared connectors for admin-level CRM connections.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {CONNECTORS.map(connector => (
          <Card key={connector.key} className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {connector.name}</span>
                <Badge variant={connector.status === 'ready' ? 'default' : 'outline'}>
                  {connector.status === 'ready' ? 'Native' : 'Not Native'}
                </Badge>
              </CardTitle>
              <CardDescription>{connector.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {connector.status === 'ready' ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                  This connector is supported natively. The next step is authorizing the shared admin connection.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  This one will need a custom integration later if you want to add it.
                </div>
              )}
              <Button disabled className="w-full gap-2 bg-[#e2231a] hover:bg-[#c41e17] text-white disabled:opacity-60">
                <PlugZap className="w-4 h-4" />
                {connector.status === 'ready' ? 'Authorize from chat' : 'Native connector unavailable'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Link2 className="w-4 h-4" /> What this supports</CardTitle>
          <CardDescription>This setup area prepares your CRM connection strategy for quoting without forcing a CRM migration.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>• Shared admin connectors are best when your internal team is using one connected CRM account.</p>
          <p>• Salesforce and HubSpot are available as native Base44 connectors.</p>
        </CardContent>
      </Card>
    </div>
  );
}