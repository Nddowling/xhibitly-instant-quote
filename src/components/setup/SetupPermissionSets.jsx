import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { BUILT_IN_OBJECTS } from '@/components/utils/reportEngine';
import { Plus, Key, Save, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ALL_PAGES = ['SalesDashboard','Contacts','CatalogQuote','RecentQuotes','PricingRules','Reports','Dashboards','Setup','Settings','Pipeline'];
const ACTIONS = ['read','create','edit','delete'];

export default function SetupPermissionSets() {
  const [permSets, setPermSets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('objects');

  useEffect(() => { loadSets(); }, []);

  const loadSets = async () => {
    const sets = await base44.entities.PermissionSet.list();
    setPermSets(sets);
  };

  const createSet = async () => {
    const s = await base44.entities.PermissionSet.create({ name: 'New Permission Set', object_permissions: {}, page_access: [] });
    loadSets();
    setSelected(JSON.parse(JSON.stringify(s)));
  };

  const toggleObjPerm = (obj, action, val) => {
    setSelected(s => ({
      ...s,
      object_permissions: {
        ...(s.object_permissions || {}),
        [obj]: { ...(s.object_permissions?.[obj] || {}), [action]: val }
      }
    }));
    setDirty(true);
  };

  const togglePage = (page) => {
    const pages = selected.page_access || [];
    const updated = pages.includes(page) ? pages.filter(p => p !== page) : [...pages, page];
    setSelected(s => ({ ...s, page_access: updated }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { id, ...data } = selected;
    await base44.entities.PermissionSet.update(id, data);
    setSaving(false);
    setDirty(false);
    loadSets();
  };

  const objects = Object.keys(BUILT_IN_OBJECTS);

  return (
    <div className="flex h-full min-h-screen">
      <div className="w-56 bg-white border-r border-slate-200 p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-700">Permission Sets</span>
          <Button size="sm" onClick={createSet} className="h-7 text-xs bg-[#e2231a] hover:bg-[#c41e17] text-white px-2">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        {permSets.map(ps => (
          <button key={ps.id} onClick={() => { setSelected(JSON.parse(JSON.stringify(ps))); setDirty(false); }}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-left mb-0.5 ${
              selected?.id === ps.id ? 'bg-[#e2231a]/10 text-[#e2231a]' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            <Key className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{ps.name}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 bg-slate-50 overflow-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-slate-400"><p className="text-sm">Select a permission set</p></div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <input value={selected.name} onChange={e => { setSelected(s => ({ ...s, name: e.target.value })); setDirty(true); }}
                className="bg-transparent font-bold text-xl text-slate-900 focus:outline-none focus:border-b border-slate-300" />
              <div className="flex items-center gap-2">
                {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
                <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1">
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4 text-xs text-blue-700">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Permission sets are <strong className="mx-1">additive only</strong> — they grant additional access on top of a user's Profile. To restrict access, edit the Profile.
            </div>

            <div className="flex gap-1 mb-4 border-b border-slate-200">
              {['objects','pages'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    tab === t ? 'border-b-2 border-[#e2231a] text-[#e2231a]' : 'text-slate-500 hover:text-slate-700'
                  }`}>{t === 'objects' ? 'Object Permissions' : 'Additional Pages'}</button>
              ))}
            </div>

            {tab === 'objects' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Object</th>
                      {ACTIONS.map(a => <th key={a} className="text-center px-4 py-2.5 font-semibold text-slate-600 capitalize">{a}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {objects.map(obj => (
                      <tr key={obj} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{obj}</td>
                        {ACTIONS.map(action => (
                          <td key={action} className="px-4 py-2.5 text-center">
                            <input type="checkbox"
                              checked={selected.object_permissions?.[obj]?.[action] === true}
                              onChange={e => toggleObjPerm(obj, action, e.target.checked)}
                              className="w-4 h-4 accent-[#e2231a]"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'pages' && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PAGES.map(page => (
                    <label key={page} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox"
                        checked={(selected.page_access || []).includes(page)}
                        onChange={() => togglePage(page)}
                        className="w-4 h-4 accent-[#e2231a]"
                      />
                      {page}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}