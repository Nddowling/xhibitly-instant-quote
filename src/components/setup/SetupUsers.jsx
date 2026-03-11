import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { clearPermissionsCache } from '@/components/utils/permissionsEngine';
import { Users, Save, X, Shield, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SetupUsers() {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [permSets, setPermSets] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [u, p, ps, a] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.Profile.list(),
      base44.entities.PermissionSet.list(),
      base44.entities.UserPermissionAssignment.list(),
    ]);
    setUsers(u);
    setProfiles(p);
    setPermSets(ps);
    setAssignments(a);
  };

  const openUser = (user) => {
    const assignment = assignments.find(a => a.user_id === user.id) || {
      user_id: user.id,
      profile_id: '',
      permission_set_ids: [],
    };
    setSelected({ user, assignment: JSON.parse(JSON.stringify(assignment)) });
  };

  const handleSave = async () => {
    setSaving(true);
    const { assignment } = selected;
    const existing = assignments.find(a => a.user_id === selected.user.id);
    if (existing) {
      await base44.entities.UserPermissionAssignment.update(existing.id, {
        profile_id: assignment.profile_id,
        permission_set_ids: assignment.permission_set_ids,
        last_computed_at: new Date().toISOString(),
      });
    } else {
      await base44.entities.UserPermissionAssignment.create({
        user_id: selected.user.id,
        profile_id: assignment.profile_id,
        permission_set_ids: assignment.permission_set_ids,
        last_computed_at: new Date().toISOString(),
      });
    }
    clearPermissionsCache();
    setSaving(false);
    setSelected(null);
    loadAll();
  };

  const togglePermSet = (psId) => {
    const ids = selected.assignment.permission_set_ids || [];
    const updated = ids.includes(psId) ? ids.filter(id => id !== psId) : [...ids, psId];
    setSelected(s => ({ ...s, assignment: { ...s.assignment, permission_set_ids: updated } }));
  };

  const getAssignment = (userId) => assignments.find(a => a.user_id === userId);
  const getProfileName = (profileId) => profiles.find(p => p.id === profileId)?.name || 'None';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">Users</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Profile</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Permission Sets</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {users.map(user => {
              const assignment = getAssignment(user.id);
              return (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{user.full_name}</td>
                  <td className="px-4 py-3 text-slate-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Shield className="w-3 h-3" />
                      {getProfileName(assignment?.profile_id)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(assignment?.permission_set_ids || []).map(psId => {
                        const ps = permSets.find(p => p.id === psId);
                        return ps ? <Badge key={psId} className="text-xs bg-blue-100 text-blue-700">{ps.name}</Badge> : null;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => openUser(user)} className="text-xs">Edit</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* User drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selected.user.full_name}</h2>
                <p className="text-xs text-slate-500">{selected.user.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1 block">
                  <Shield className="w-3.5 h-3.5" /> Profile
                </label>
                <select value={selected.assignment.profile_id}
                  onChange={e => setSelected(s => ({ ...s, assignment: { ...s.assignment, profile_id: e.target.value } }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">No Profile</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1 block">
                  <Key className="w-3.5 h-3.5" /> Permission Sets
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {permSets.map(ps => (
                    <label key={ps.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-1.5 rounded hover:bg-slate-50">
                      <input type="checkbox"
                        checked={(selected.assignment.permission_set_ids || []).includes(ps.id)}
                        onChange={() => togglePermSet(ps.id)}
                        className="w-4 h-4 accent-[#e2231a]"
                      />
                      {ps.name}
                      {ps.description && <span className="text-xs text-slate-400">— {ps.description}</span>}
                    </label>
                  ))}
                  {permSets.length === 0 && <p className="text-xs text-slate-400 italic">No permission sets created yet</p>}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1">
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}