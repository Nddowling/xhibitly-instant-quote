import React, { useState } from 'react';
import {
  LayoutGrid, Users, Shield, Key, Database, Settings,
  ChevronRight, Search, Wrench, Layers, ClipboardCheck, Upload, PlugZap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import ObjectManager from '@/components/setup/ObjectManager';
import ObjectTabsManager from '@/components/setup/ObjectTabsManager';
import SetupProfiles from '@/components/setup/SetupProfiles';
import SetupPermissionSets from '@/components/setup/SetupPermissionSets';
import SetupUsers from '@/components/setup/SetupUsers';
import SetupSeeder from '@/components/setup/SetupSeeder';
import SetupBrokerInstances from '@/components/setup/SetupBrokerInstances';
import SetupDataLoader from '@/components/setup/SetupDataLoader';
import SetupCrmConnectors from '@/components/setup/SetupCrmConnectors';
import HotspotAudit from '@/pages/HotspotAudit';
import CatalogAudit from '@/pages/CatalogAudit';

const SECTIONS = [
  {
    group: 'Administration',
    items: [
      { key: 'users',            label: 'Users',            icon: Users,    component: SetupUsers },
      { key: 'profiles',         label: 'Profiles',         icon: Shield,   component: SetupProfiles },
      { key: 'permission-sets',  label: 'Permission Sets',  icon: Key,      component: SetupPermissionSets },
      { key: 'users',            label: 'Users',            icon: Users,    component: SetupUsers },
      { key: 'profiles',         label: 'Profiles',         icon: Shield,   component: SetupProfiles },
      { key: 'permission-sets',  label: 'Permission Sets',  icon: Key,      component: SetupPermissionSets },
      { key: 'broker-instances', label: 'Broker Workspaces', icon: Layers,  component: SetupBrokerInstances },
      { key: 'data-loader',      label: 'Data Loader',      icon: Upload,   component: SetupDataLoader },
      { key: 'crm-connectors',   label: 'CRM Connectors',   icon: PlugZap,  component: SetupCrmConnectors },
      { key: 'seed',             label: 'Initialize Data',  icon: Wrench,   component: SetupSeeder },
    ]
  },
  {
    group: 'Catalog Tools',
    items: [
      { key: 'hotspot-audit', label: 'Hotspot Audit', icon: ClipboardCheck, component: HotspotAudit },
      { key: 'catalog-audit', label: 'Catalog Audit', icon: ClipboardCheck, component: CatalogAudit },
    ]
  },
  {
    group: 'Object Manager',
    items: [
      { key: 'object-manager',   label: 'Object Manager',   icon: Database, component: ObjectManager },
      { key: 'object-tabs',      label: 'Object Tabs',      icon: LayoutGrid, component: ObjectTabsManager },
    ]
  },
];

export default function Setup() {
  const [activeKey, setActiveKey] = useState('data-loader');
  const [search, setSearch] = useState('');

  const allItems = SECTIONS.flatMap(s => s.items);
  const ActiveComponent = allItems.find(i => i.key === activeKey)?.component || SetupUsers;

  const filtered = search.trim()
    ? allItems.filter(i => i.label.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 min-h-screen">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-[#e2231a] rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Setup</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Quick Find..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {filtered ? (
            <div>
              {filtered.length === 0 && (
                <p className="text-xs text-slate-400 px-2 py-4 text-center">No results</p>
              )}
              {filtered.map(item => (
                <SidebarItem key={item.key} item={item} active={activeKey === item.key} onClick={() => { setActiveKey(item.key); setSearch(''); }} />
              ))}
            </div>
          ) : (
            SECTIONS.map(section => (
              <div key={section.group} className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">{section.group}</p>
                {section.items.map(item => (
                  <SidebarItem key={item.key} item={item} active={activeKey === item.key} onClick={() => setActiveKey(item.key)} />
                ))}
              </div>
            ))
          )}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <ActiveComponent />
      </main>
    </div>
  );
}

function SidebarItem({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors text-left ${
        active ? 'bg-[#e2231a]/10 text-[#e2231a] font-medium' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{item.label}</span>
      {active && <ChevronRight className="w-3 h-3 ml-auto" />}
    </button>
  );
}