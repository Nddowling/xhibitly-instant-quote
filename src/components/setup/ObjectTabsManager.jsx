import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getAllObjects } from '@/components/utils/metadataEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';

function buildRoutePath(apiName) {
  return `/objects/${apiName}`;
}

export default function ObjectTabsManager() {
  const [objects, setObjects] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [selectedApiName, setSelectedApiName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allObjects, allTabs] = await Promise.all([
      getAllObjects(),
      base44.entities.ObjectTab.list('sort_order', 100),
    ]);
    setObjects(allObjects || []);
    setTabs(allTabs || []);
    if (!selectedApiName && allObjects?.length) {
      setSelectedApiName(allObjects[0].api_name);
    }
  };

  const handleAdd = async () => {
    const objectDef = objects.find(object => object.api_name === selectedApiName);
    if (!objectDef) return;
    const existing = tabs.find(tab => tab.object_api_name === selectedApiName);
    if (existing) return;

    await base44.entities.ObjectTab.create({
      object_api_name: objectDef.api_name,
      label: objectDef.label,
      route_path: buildRoutePath(objectDef.api_name),
      sort_order: (tabs[tabs.length - 1]?.sort_order || 0) + 10,
      is_active: true,
    });
    loadData();
  };

  const handleRemove = async (tabId) => {
    await base44.entities.ObjectTab.delete(tabId);
    loadData();
  };

  const availableObjects = objects.filter(object => !tabs.some(tab => tab.object_api_name === object.api_name));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Header Object Tabs</h3>
          <p className="text-sm text-slate-500">Add or remove object tabs shown in the top header.</p>
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