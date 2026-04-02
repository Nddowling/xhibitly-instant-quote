import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { BUILT_IN_OBJECTS } from '@/components/utils/reportEngine';
import { Plus, Shield, Lock, Save, Sparkles, Copy, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const ALL_PAGES = ['SalesDashboard','Contacts','CatalogQuote','RecentQuotes','PricingRules','Reports','Dashboards','Setup','Settings','Pipeline'];
const ACTIONS = ['read','create','edit','delete'];

export default function SetupProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('objects');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [showCloneDialog, setShowCloneDialog] = useState(false);

  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    const p = await base44.entities.Profile.list();
    setProfiles(p);
  };

  const selectProfile = (p) => { setSelected(JSON.parse(JSON.stringify(p))); setDirty(false); };

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

  const toggleAllObjPerm = (action, val) => {
    setSelected(s => ({
      ...s,
      object_permissions: objects.reduce((acc, obj) => ({
        ...acc,
        [obj]: { ...(s.object_permissions?.[obj] || {}), [action]: val }
      }), { ...(s.object_permissions || {}) })
    }));
    setDirty(true);
  };

  const togglePageAccess = (page) => {
    const pages = selected.page_access || [];
    const updated = pages.includes(page) ? pages.filter(p => p !== page) : [...pages, page];
    setSelected(s => ({ ...s, page_access: updated }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { id, ...data } = selected;
    await base44.entities.Profile.update(id, data);
    setSaving(false);
    setDirty(false);
    loadProfiles();
  };

  const grantDesignerAccess = () => {
    if (!selected) return;
    setSelected(s => ({
      ...s,
      object_permissions: objects.reduce((acc, obj) => ({
        ...acc,
        [obj]: { read: true, create: true, edit: true, delete: true }
      }), {}),
      page_access: ['*'],
    }));
    setDirty(true);
  };

  const createProfile = async () => {
    const p = await base44.entities.Profile.create({
      name: 'New Profile',
      object_permissions: {},
      field_permissions: {},
      page_access: [],
    });
    loadProfiles();
    setSelected(p);
  };

  const openCloneDialog = () => {
    if (!selected) return;
    setCloneName(`${selected.name || 'Profile'} Copy`);
    setShowCloneDialog(true);
  };

  const handleCloneProfile = async () => {
    if (!selected || !cloneName.trim()) return;
    const { id, created_date, updated_date, created_by, ...profileData } = selected;
    const cloned = await base44.entities.Profile.create({
      ...profileData,
      name: cloneName.trim(),
      is_system: false,
    });
    setShowCloneDialog(false);
    setCloneName('');
    await loadProfiles();
    setSelected(cloned);
    setDirty(false);
  };

  const handleDeleteProfile = async () => {
    if (!selected) return;
    await base44.entities.Profile.delete(selected.id);
    setSelected(null);
    setDirty(false);
    loadProfiles();
  };

  const objects = Object.keys(BUILT_IN_OBJECTS);

  return (
    <div className="flex h-full min-h-screen">
      {/* List */}
      <div className="w-56 bg-white border-r border-slate-200 p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-700">Profiles</span>
          <Button size="sm" onClick={createProfile} className="h-7 text-xs bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1 px-2">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        {profiles.map(p => (
          <button key={p.id} onClick={() => selectProfile(p)}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-left mb-0.5 transition-colors ${
              selected?.id === p.id ? 'bg-[#e2231a]/10 text-[#e2231a]' : 'text-slate-600 hover:bg-slate-100'
            }`}>
            {p.is_system ? <Lock className="w-3.5 h-3.5 flex-shrink-0" /> : <Shield className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="truncate">{p.name}</span>
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="flex-1 bg-slate-50 overflow-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p className="text-sm">Select a profile</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {selected.is_system && <Lock className="w-4 h-4 text-slate-400" />}
                  <h2 className="text-xl font-bold text-slate-900">Profile Details</h2>
                </div>
                <div className="max-w-md">
                  <Input
                    value={selected.name || ''}
                    onChange={e => { setSelected(s => ({ ...s, name: e.target.value })); setDirty(true); }}
                    placeholder="Profile name"
                  />
                </div>
                {selected.is_system && <Badge variant="outline" className="text-xs mt-1">System Profile</Badge>}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {selected.name?.toLowerCase() === 'designer' && (
                  <Button onClick={grantDesignerAccess} variant="outline" size="sm" className="gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Full Access
                  </Button>
                )}
                <Button asChild variant="outline" size="sm" className="gap-1">
                  <a href={`${createPageUrl('ProfileAssignedContacts')}?profileId=${selected.id}`}>
                    <Users className="w-3.5 h-3.5" /> Assigned Contacts
                  </a>
                </Button>
                <Button onClick={openCloneDialog} variant="outline" size="sm" className="gap-1">
                  <Copy className="w-3.5 h-3.5" /> Clone
                </Button>
                <Button onClick={handleDeleteProfile} variant="outline" size="sm" className="gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
                {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
                <Button onClick={handleSave} disabled={saving || !dirty} size="sm" className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1">
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 border-b border-slate-200">
              {['objects','pages'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    tab === t ? 'border-b-2 border-[#e2231a] text-[#e2231a]' : 'text-slate-500 hover:text-slate-700'
                  }`}>{t === 'objects' ? 'Object Permissions' : 'Page Access'}</button>
              ))}
            </div>

            {tab === 'objects' && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Object</th>
                      {ACTIONS.map(a => (
                        <th key={a} className="text-center px-4 py-2.5 font-semibold text-slate-600 capitalize">
                          <div className="flex flex-col items-center gap-1">
                            <span>{a}</span>
                            <input
                              type="checkbox"
                              checked={objects.length > 0 && objects.every(obj => selected.object_permissions?.[obj]?.[a] === true)}
                              onChange={e => toggleAllObjPerm(a, e.target.checked)}
                              className="w-4 h-4 accent-[#e2231a]"
                            />
                          </div>
                        </th>
                      ))}
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
                <p className="text-sm font-semibold text-slate-700 mb-3">Accessible Pages</p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PAGES.map(page => (
                    <label key={page} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input type="checkbox"
                        checked={(selected.page_access || []).includes(page) || (selected.page_access || []).includes('*')}
                        onChange={() => togglePageAccess(page)}
                        disabled={(selected.page_access || []).includes('*')}
                        className="w-4 h-4 accent-[#e2231a]"
                      />
                      {page}
                    </label>
                  ))}
                </div>
                {(selected.page_access || []).includes('*') && (
                  <p className="text-xs text-amber-600 mt-3">This profile has wildcard (*) access — all pages are accessible.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showCloneDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-2 mb-4">
              <Copy className="w-4 h-4 text-slate-500" />
              <h3 className="text-lg font-semibold text-slate-900">Clone Profile</h3>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 block">New profile name</label>
              <Input value={cloneName} onChange={e => setCloneName(e.target.value)} placeholder="Enter cloned profile name" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setShowCloneDialog(false)}>Cancel</Button>
              <Button onClick={handleCloneProfile} disabled={!cloneName.trim()} className="bg-[#e2231a] hover:bg-[#c41e17] text-white">
                Create Clone
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}