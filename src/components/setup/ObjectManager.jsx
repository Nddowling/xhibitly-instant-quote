import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getAllObjects, getObjectFields, createCustomObject, createCustomField, buildCustomObjectApiName, buildHistoryObjectApiName } from '@/components/utils/metadataEngine';
import { Plus, Database, Search, Lock, Pencil, Trash2, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const FIELD_TYPES = ['text','number','currency','date','datetime','checkbox','picklist','multi_picklist','textarea','email','phone','url','lookup','formula'];

export default function ObjectManager() {
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [fields, setFields] = useState([]);
  const [search, setSearch] = useState('');
  const [showNewObject, setShowNewObject] = useState(false);
  const [showNewField, setShowNewField] = useState(false);
  const [newObj, setNewObj] = useState({ label: '', label_plural: '', description: '', icon: 'box', allow_reports: true, name_field_label: 'Name' });
  const [newField, setNewField] = useState({ label: '', field_type: 'text', is_required: false, help_text: '', picklist_values: '' });

  useEffect(() => { loadObjects(); }, []);

  const loadObjects = async () => {
    const objs = await getAllObjects();
    setObjects(objs);
  };

  const selectObject = async (obj) => {
    setSelectedObject(obj);
    const f = await getObjectFields(obj.api_name);
    setFields(f);
  };

  const handleCreateObject = async () => {
    await createCustomObject(newObj);
    setShowNewObject(false);
    setNewObj({ label: '', label_plural: '', description: '', icon: 'box', allow_reports: true, name_field_label: 'Name' });
    loadObjects();
  };

  const handleCreateField = async () => {
    const fieldDef = {
      ...newField,
      picklist_values: newField.picklist_values
        ? newField.picklist_values.split('\n').map(v => ({ label: v.trim(), value: v.trim().toLowerCase().replace(/\s+/g, '_') }))
        : [],
    };
    await createCustomField(selectedObject.api_name, fieldDef);
    setShowNewField(false);
    setNewField({ label: '', field_type: 'text', is_required: false, help_text: '', picklist_values: '' });
    const f = await getObjectFields(selectedObject.api_name);
    setFields(f);
  };

  const handleDeleteField = async (field) => {
    if (field.is_system) return;
    await base44.entities.CustomField.delete(field.id);
    setFields(fields.filter(f => f.id !== field.id));
  };

  const filtered = objects.filter(o =>
    !search || o.label.toLowerCase().includes(search.toLowerCase()) || o.api_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-full min-h-screen">
      {/* Object list */}
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">Objects</span>
            <Button size="sm" onClick={() => setShowNewObject(true)} className="h-7 text-xs bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1 px-2">
              <Plus className="w-3 h-3" /> New
            </Button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter objects..." className="pl-7 h-7 text-xs" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.map(obj => (
            <button key={obj.api_name} onClick={() => selectObject(obj)}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-left mb-0.5 transition-colors ${
                selectedObject?.api_name === obj.api_name ? 'bg-[#e2231a]/10 text-[#e2231a]' : 'text-slate-600 hover:bg-slate-100'
              }`}>
              <Database className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-medium block truncate">{obj.label}</span>
                <span className="text-xs text-slate-400 truncate block">{obj.api_name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!obj.is_custom && <Badge variant="outline" className="text-[9px] px-1 py-0">Built-in</Badge>}
                {obj.is_history_object && <Badge variant="outline" className="text-[9px] px-1 py-0">History</Badge>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Object detail */}
      <div className="flex-1 bg-slate-50 overflow-auto">
        {!selectedObject ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Database className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Select an object to view its fields</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedObject.label}</h2>
                <p className="text-sm text-slate-500 font-mono mt-0.5">{selectedObject.api_name}</p>
                {selectedObject.description && <p className="text-sm text-slate-500 mt-1">{selectedObject.description}</p>}
                {selectedObject.history_object_api_name && (
                  <p className="text-xs text-slate-400 mt-2">History Object: <span className="font-mono">{selectedObject.history_object_api_name}</span></p>
                )}
              </div>
              <Button size="sm" onClick={() => setShowNewField(true)} className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1">
                <Plus className="w-3.5 h-3.5" /> New Field
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Label</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">API Name</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Type</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Required</th>
                    <th className="px-4 py-2.5 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, i) => (
                    <tr key={field.api_name} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-800 flex items-center gap-2">
                        {field.is_system && <Lock className="w-3 h-3 text-slate-400" />}
                        {field.label}
                        {field.help_text && <span className="text-xs text-slate-400 font-normal">— {field.help_text}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{field.api_name}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs capitalize">{field.field_type}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{field.is_required ? '✓' : '—'}</td>
                      <td className="px-4 py-2.5">
                        {!field.is_system && (
                          <button onClick={() => handleDeleteField(field)} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* New Object Modal */}
      {showNewObject && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">New Object</h2>
              <button onClick={() => setShowNewObject(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <Input placeholder="Label (e.g. Trade Show)" value={newObj.label} onChange={e => setNewObj(o => ({ ...o, label: e.target.value }))} />
              <Input placeholder="Plural label (e.g. Trade Shows)" value={newObj.label_plural} onChange={e => setNewObj(o => ({ ...o, label_plural: e.target.value }))} />
              <Input placeholder="Description" value={newObj.description} onChange={e => setNewObj(o => ({ ...o, description: e.target.value }))} />
              <Input placeholder="Name field label (e.g. Trade Show Name)" value={newObj.name_field_label} onChange={e => setNewObj(o => ({ ...o, name_field_label: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={newObj.allow_reports} onChange={e => setNewObj(o => ({ ...o, allow_reports: e.target.checked }))} />
                Allow in Report Builder
              </label>
              {newObj.label && (
                <div className="space-y-1 text-xs text-slate-400">
                  <p>API name: <span className="font-mono">{buildCustomObjectApiName(newObj.label)}</span></p>
                  <p>History object: <span className="font-mono">{buildHistoryObjectApiName(buildCustomObjectApiName(newObj.label))}</span></p>
                </div>
              )}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                New objects automatically include system fields like Record ID, Created Date, Created By, Last Edited Date, and Last Edited By, plus a dedicated history object.
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={handleCreateObject} disabled={!newObj.label} className="flex-1 bg-[#e2231a] hover:bg-[#c41e17] text-white">Create Object</Button>
              <Button variant="ghost" onClick={() => setShowNewObject(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* New Field Modal */}
      {showNewField && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">New Field on {selectedObject?.label}</h2>
              <button onClick={() => setShowNewField(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Field Type</label>
                <div className="grid grid-cols-4 gap-1">
                  {FIELD_TYPES.map(t => (
                    <button key={t} onClick={() => setNewField(f => ({ ...f, field_type: t }))}
                      className={`px-2 py-1.5 rounded text-xs font-medium capitalize transition-colors ${
                        newField.field_type === t ? 'bg-[#e2231a] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>{t}</button>
                  ))}
                </div>
              </div>
              <Input placeholder="Field label" value={newField.label} onChange={e => setNewField(f => ({ ...f, label: e.target.value }))} />
              <Input placeholder="Help text (optional)" value={newField.help_text} onChange={e => setNewField(f => ({ ...f, help_text: e.target.value }))} />
              {(newField.field_type === 'picklist' || newField.field_type === 'multi_picklist') && (
                <textarea value={newField.picklist_values} onChange={e => setNewField(f => ({ ...f, picklist_values: e.target.value }))}
                  placeholder="One value per line..." className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm h-24 focus:outline-none" />
              )}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={newField.is_required} onChange={e => setNewField(f => ({ ...f, is_required: e.target.checked }))} />
                Required
              </label>
              {newField.label && (
                <p className="text-xs text-slate-400">API name: <span className="font-mono">{newField.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}__c</span></p>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={handleCreateField} disabled={!newField.label} className="flex-1 bg-[#e2231a] hover:bg-[#c41e17] text-white">Create Field</Button>
              <Button variant="ghost" onClick={() => setShowNewField(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}