import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Wrench, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ADMIN_PROFILE = {
  name: 'Admin',
  description: 'Full system access',
  is_system: true,
  object_permissions: {
    Order:    { read: true, create: true, edit: true, delete: true },
    Product:  { read: true, create: true, edit: true, delete: true },
    LineItem: { read: true, create: true, edit: true, delete: true },
  },
  field_permissions: {},
  page_access: ['*'],
  default_landing_page: 'SalesDashboard',
};

const DEALER_PROFILE = {
  name: 'Dealer',
  description: 'Standard dealer access',
  is_system: true,
  object_permissions: {
    Order:    { read: true, create: true, edit: true, delete: false },
    Product:  { read: true, create: false, edit: false, delete: false },
    LineItem: { read: true, create: true, edit: true, delete: false },
  },
  field_permissions: {
    Order: {
      dealer_markup_pct: { read: false, edit: false },
    }
  },
  page_access: ['SalesDashboard', 'CatalogQuote', 'RecentQuotes', 'Reports', 'Contacts', 'Settings', 'Pipeline'],
  default_landing_page: 'CatalogQuote',
};

export default function SetupSeeder() {
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);

  const addLog = (msg, type = 'info') => setLog(l => [...l, { msg, type }]);

  const runSeed = async () => {
    setRunning(true);
    setLog([]);
    setStatus(null);

    try {
      // Check if already seeded
      const existing = await base44.entities.Profile.list();
      const adminExists = existing.find(p => p.name === 'Admin');
      const dealerExists = existing.find(p => p.name === 'Dealer');

      if (!adminExists) {
        await base44.entities.Profile.create(ADMIN_PROFILE);
        addLog('✓ Created Admin profile', 'success');
      } else {
        addLog('Admin profile already exists — skipped', 'warn');
      }

      if (!dealerExists) {
        await base44.entities.Profile.create(DEALER_PROFILE);
        addLog('✓ Created Dealer profile', 'success');
      } else {
        addLog('Dealer profile already exists — skipped', 'warn');
      }

      setStatus('success');
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
      setStatus('error');
    }

    setRunning(false);
  };

  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-xl font-bold text-slate-900 mb-2">Initialize System Data</h2>
      <p className="text-sm text-slate-500 mb-6">
        Creates the default <strong>Admin</strong> and <strong>Dealer</strong> profiles with pre-configured permissions.
        Safe to run multiple times — existing profiles are skipped.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 space-y-3">
        <ProfilePreview name="Admin" color="bg-red-50 border-red-200" items={['All objects: Full CRUD', 'All pages: Wildcard access', 'All fields visible']} />
        <ProfilePreview name="Dealer" color="bg-blue-50 border-blue-200" items={['Orders: Read + Create + Edit (no Delete)', 'Products: Read only', 'Pages: Dashboard, Catalog, Quotes, Reports', 'Markup % field: Hidden']} />
      </div>

      <Button onClick={runSeed} disabled={running} className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-2">
        <Wrench className="w-4 h-4" />
        {running ? 'Initializing...' : 'Initialize System Profiles'}
      </Button>

      {log.length > 0 && (
        <div className="mt-4 bg-slate-900 rounded-xl p-4 font-mono text-xs space-y-1">
          {log.map((l, i) => (
            <div key={i} className={l.type === 'success' ? 'text-green-400' : l.type === 'error' ? 'text-red-400' : l.type === 'warn' ? 'text-yellow-400' : 'text-slate-400'}>
              {l.msg}
            </div>
          ))}
          {status === 'success' && <div className="text-green-400 mt-1">Done!</div>}
        </div>
      )}
    </div>
  );
}

function ProfilePreview({ name, color, items }) {
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <p className="font-semibold text-slate-800 text-sm mb-1.5">{name} Profile</p>
      <ul className="space-y-0.5">
        {items.map((item, i) => <li key={i} className="text-xs text-slate-600">• {item}</li>)}
      </ul>
    </div>
  );
}