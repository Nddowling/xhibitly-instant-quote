import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Save, X } from 'lucide-react';

function makeDeveloperName(label) {
  return String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export default function RecordTypeManager({ objectApiName }) {
  const [recordTypes, setRecordTypes] = useState([]);
  const [layouts, setLayouts] = useState([]);
  const [editingId, setEditingId] = useState('new');
  const [draft, setDraft] = useState({ label: '', developer_name: '', page_layout_id: '', is_active: true, is_default: false });

  useEffect(() => {
    if (objectApiName) loadData();
  }, [objectApiName]);

  const loadData = async () => {
    const [types, pageLayouts] = await Promise.all([
      base44.entities.RecordType.filter({ object_api_name: objectApiName }, 'label', 100),
      base44.entities.PageLayout.filter({ object_api_name: objectApiName }, 'name', 100),
    ]);
    setRecordTypes(types || []);
    setLayouts(pageLayouts || []);
  };

  const startNew = () => {
    setEditingId('new');
    setDraft({ label: '', developer_name: '', page_layout_id: layouts[0]?.id || '', is_active: true, is_default: false });
  };

  const startEdit = (recordType) => {
    setEditingId(recordType.id);
    setDraft({
      label: recordType.label || '',
      developer_name: recordType.developer_name || '',
      page_layout_id: recordType.page_layout_id || '',
      is_active: recordType.is_active !== false,
      is_default: recordType.is_default === true,
    });
  };

  const handleSave = async () => {
    const payload = {
      object_api_name: objectApiName,
      label: draft.label,
      developer_name: draft.developer_name || makeDeveloperName(draft.label),
      page_layout_id: draft.page_layout_id || '',
      is_active: draft.is_active,
      is_default: draft.is_default,
    };

    if (editingId === 'new') {
      await base44.entities.RecordType.create(payload);
    } else {
      await base44.entities.RecordType.update(editingId, payload);
    }

    setEditingId('');
    setDraft({ label: '', developer_name: '', page_layout_id: '', is_active: true, is_default: false });
    loadData();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div>
          <p className="text-sm font-semibold text-slate-800">Record Types</p>
          <p className="text-xs text-slate-500">Add or update record types for this object.</p>
        </div>
        <Button size="sm" onClick={startNew} className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1"><Plus className="w-3.5 h-3.5" />New Record Type</Button>
      </div>

      <div className="divide-y divide-slate-100">
        {recordTypes.map((recordType) => (
          <div key={recordType.id} className="px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-slate-900">{recordType.label}</p>
                {recordType.is_default && <Badge variant="outline">Default</Badge>}
                {!recordType.is_active && <Badge variant="outline">Inactive</Badge>}
              </div>
              <p className="text-xs text-slate-500 mt-1">{recordType.developer_name}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => startEdit(recordType)}><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
          </div>
        ))}
        {recordTypes.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">No record types yet for this object.</div>}
      </div>

      {editingId && (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Label" value={draft.label} onChange={(e) => setDraft((s) => ({ ...s, label: e.target.value, developer_name: s.developer_name || makeDeveloperName(e.target.value) }))} />
            <Input placeholder="Developer Name" value={draft.developer_name} onChange={(e) => setDraft((s) => ({ ...s, developer_name: e.target.value }))} />
            <select value={draft.page_layout_id} onChange={(e) => setDraft((s) => ({ ...s, page_layout_id: e.target.value }))} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              <option value="">No layout</option>
              {layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name}</option>)}
            </select>
            <div className="flex items-center gap-4 text-sm text-slate-700">
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((s) => ({ ...s, is_active: e.target.checked }))} />Active</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft((s) => ({ ...s, is_default: e.target.checked }))} />Default</label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave} className="bg-[#e2231a] hover:bg-[#c41e17] text-white"><Save className="w-3.5 h-3.5 mr-1.5" />Save</Button>
            <Button variant="ghost" onClick={() => setEditingId('')}><X className="w-3.5 h-3.5 mr-1.5" />Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}