import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getAllObjects } from '@/components/utils/metadataEngine';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

function buildRoutePath(apiName) {
  return `/objects/${apiName}`;
}

export default function ObjectTabsManager({ brokerInstanceId = null, compact = false }) {
  const dealerInstanceId = brokerInstanceId;
  const [objects, setObjects] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [selectedApiName, setSelectedApiName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
  }, [dealerInstanceId]);

  const loadData = async () => {
    const me = await base44.auth.me();
    const [allObjects, dealerTabs] = await Promise.all([
      getAllObjects(),
      dealerInstanceId
        ? base44.entities.ObjectTab.filter({ dealer_instance_id: dealerInstanceId, user_id: me.id, is_active: true }, 'sort_order', 100)
        : Promise.resolve([]),
    ]);

    const allTabs = dealerTabs || [];

    const normalizedTabs = Array.from(new Map((allTabs || []).map(tab => {
      const normalized = {
        id: tab.id,
        ...tab,
        ...(tab.data || {}),
      };
      return [normalized.object_api_name || normalized.id, normalized];
    })).values());

    setCurrentUser(me);
    setObjects(allObjects || []);
    setTabs(normalizedTabs);

    if (!selectedApiName && allObjects?.length) {
      setSelectedApiName(allObjects[0].api_name);
    }
  };

  const handleAdd = async () => {
    const objectDef = objects.find(object => object.api_name === selectedApiName) || mergedObjects.find(object => object.api_name === selectedApiName);
    if (!objectDef || !dealerInstanceId) return;

    const existing = tabs.find(tab => tab.object_api_name === selectedApiName);
    if (existing) return;

    const nextSortOrder = Math.max(0, ...tabs.map(tab => Number(tab.sort_order) || 0)) + 10;
    const createdTab = await base44.entities.ObjectTab.create({
    object_api_name: objectDef.api_name,
    label: objectDef.label,
    route_path: buildRoutePath(objectDef.api_name),
    sort_order: nextSortOrder,
    is_active: true,
    dealer_instance_id: dealerInstanceId,
    user_id: currentUser?.id,
    });

    const normalizedCreatedTab = {
      id: createdTab.id,
      ...createdTab,
      ...(createdTab.data || {}),
    };

    setTabs(prev => [...prev, normalizedCreatedTab]);
    const remainingObjects = availableObjects.filter(object => object.api_name !== objectDef.api_name);
    setSelectedApiName(remainingObjects[0]?.api_name || '');
  };

  const handleRemove = async (tabId) => {
    await base44.entities.ObjectTab.delete(tabId);
    setTabs(prev => prev.filter(tab => tab.id !== tabId));
  };

  const pinnedObjects = [
    { api_name: 'Account', label: 'Accounts' },
    { api_name: 'Contact', label: 'Contacts' },
    { api_name: 'Lead', label: 'Leads' },
  ];
  const mergedObjects = useMemo(() => [...pinnedObjects, ...objects.filter(object => !['Account', 'Contact', 'Lead'].includes(object.api_name))], [objects]);
  const availableObjects = useMemo(() => mergedObjects.filter(object => !tabs.some(tab => tab.object_api_name === object.api_name)), [mergedObjects, tabs]);

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Header Object Tabs</h3>
          <p className="text-sm text-slate-500">Add or remove object tabs shown in the top header for this specific user inside this org.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-5">
        <select
          value={selectedApiName}
          onChange={(e) => setSelectedApiName(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          {availableObjects.map(object => (
            <option key={object.api_name} value={object.api_name}>{object.label}</option>
          ))}
        </select>
        <Button onClick={handleAdd} disabled={!selectedApiName || availableObjects.length === 0} className="bg-[#e2231a] hover:bg-[#c41e17]">
          <Plus className="w-4 h-4 mr-2" /> Add Tab
        </Button>
      </div>

      <div className="space-y-2">
        {tabs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">No custom object tabs added yet.</div>
        ) : (
          tabs.map(tab => (
            <div key={tab.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">{tab.label}</p>
                <p className="text-xs text-slate-500 font-mono">{tab.object_api_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{tab.route_path}</Badge>
                <Button variant="ghost" size="icon" onClick={() => handleRemove(tab.id)}>
                  <Trash2 className="w-4 h-4 text-slate-500" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}