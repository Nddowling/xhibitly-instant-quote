import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { clearPermissionsCache } from '@/components/utils/permissionsEngine';
import { Users, Save, X, Shield, Key, Building2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function SetupUsers() {
  const [users, setUsers] = useState([]);
  const [dealerMembers, setDealerMembers] = useState([]);
  const [dealerInstances, setDealerInstances] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [view, setView] = useState('org');
  const [profiles, setProfiles] = useState([]);
  const [permSets, setPermSets] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    const [me, u, p, ps, a, members, instances] = await Promise.all([
      base44.auth.me(),
      base44.entities.User.list(),
      base44.entities.Profile.list(),
      base44.entities.PermissionSet.list(),
      base44.entities.UserPermissionAssignment.list(),
      base44.entities.DealerMember.list(),
      base44.entities.DealerInstance.list(),
    ]);
    setCurrentUser(me);
    setUsers(u);
    setProfiles(p);
    setPermSets(ps);
    setAssignments(a);
    setDealerMembers(members);
    setDealerInstances(instances);
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
  const activeDealerId = currentUser?.active_dealer_instance_id || currentUser?.dealer_instance_id || currentUser?.active_broker_instance_id || currentUser?.broker_instance_id;
  const orgMemberUserIds = dealerMembers.filter(member => member.dealer_instance_id === activeDealerId).map(member => member.user_id);
  const orgUsers = users.filter(user => orgMemberUserIds.includes(user.id));
  const internalUsers = users.filter(user => !dealerMembers.some(member => member.user_id === user.id));
  const dealerUsers = users.filter(user => dealerMembers.some(member => member.user_id === user.id));
  const displayedUsers = view === 'org' ? orgUsers : users;
  const getDealerBadges = (userId) => dealerMembers
    .filter(member => member.user_id === userId)
    .map(member => ({
      id: member.id,
      name: dealerInstances.find(instance => instance.id === member.dealer_instance_id)?.name || 'Unknown org',
      role: member.member_role,
    }));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Users</h2>
          <p className="text-sm text-slate-500">Org Users follows the currently open org. Global Users shows everyone.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button onClick={() => setView('org')} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${view === 'org' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
            <Building2 className="w-4 h-4" /> Org Users
          </button>
          <button onClick={() => setView('global')} className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${view === 'global' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
            <Globe className="w-4 h-4" /> Global Users
          </button>
        </div>
      </div>

      {view === 'global' && (
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-900 mb-1">Internal Users</div>
            <div className="text-2xl font-bold text-slate-900">{internalUsers.length}</div>
            <p className="text-xs text-slate-500 mt-1">Platform users not assigned to a dealer org.</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-900 mb-1">Dealer Users</div>
            <div className="text-2xl font-bold text-slate-900">{dealerUsers.length}</div>
            <p className="text-xs text-slate-500 mt-1">Users assigned to one or more dealer orgs.</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Profile</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Permission Sets</th>
              <th className="text-left px-4 py-3 font-semibold text-slate-600">Org Access</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {displayedUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  {view === 'org' ? 'No users found for the currently open org.' : 'No users found.'}
                </td>
              </tr>
            )}
            {displayedUsers.map(user => {
              const assignment = getAssignment(user.id);
              const dealerBadges = getDealerBadges(user.id);
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
                    <div className="flex gap-1 flex-wrap">
                      {dealerBadges.length > 0 ? dealerBadges.map(item => (
                        <Badge key={item.id} variant="outline" className="text-xs gap-1">
                          {item.name}
                          <span className="text-slate-400">• {item.role}</span>
                        </Badge>
                      )) : (
                        <Badge variant="outline" className="text-xs">Internal</Badge>
                      )}
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