import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Mail, Phone, Shield, Users } from 'lucide-react';

export default function ProfileAssignedContacts() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const profileId = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('profileId');
  }, []);

  useEffect(() => {
    loadData();
  }, [profileId]);

  const loadData = async () => {
    if (!profileId) {
      setLoading(false);
      return;
    }

    const [profiles, allUsers, allContacts, allAssignments] = await Promise.all([
      base44.entities.Profile.list(),
      base44.entities.User.list(),
      base44.entities.Contact.list(),
      base44.entities.UserPermissionAssignment.list(),
    ]);

    const selectedProfile = (profiles || []).find(item => item.id === profileId) || null;
    const matchingAssignments = (allAssignments || []).filter(item => {
      const assignedProfileId = item.profile_id || item.data?.profile_id || item?.data?.data?.profile_id;
      return assignedProfileId === profileId;
    });

    const assignedUserIds = new Set(
      matchingAssignments
        .map(item => item.user_id || item.data?.user_id || item?.data?.data?.user_id)
        .filter(Boolean)
    );

    const assignedUsers = (allUsers || []).filter(user => assignedUserIds.has(user.id));
    const assignedUserEmails = new Set(assignedUsers.map(user => String(user.email || '').toLowerCase()).filter(Boolean));

    const assignedContacts = (allContacts || []).filter(contact => {
      const contactEmail = String(contact.email || contact.data?.email || '').toLowerCase();
      return contactEmail && assignedUserEmails.has(contactEmail);
    });

    setProfile(selectedProfile);
    setAssignments(matchingAssignments);
    setUsers(assignedUsers);
    setContacts(assignedContacts);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Assigned Contacts</h1>
              <p className="text-sm text-slate-500">{profile?.name || 'Profile'} assignments</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{users.length} Users</Badge>
            <Badge variant="outline" className="text-xs">{contacts.length} Contacts</Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Users with this Profile</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">No users are assigned to this profile.</div>
              ) : (
                users.map(user => (
                  <div key={user.id} className="px-4 py-4">
                    <div className="font-medium text-slate-900">{user.full_name || user.email}</div>
                    <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {user.email}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Matching Contacts</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {contacts.length === 0 ? (
                <div className="px-4 py-8 text-sm text-slate-500">No contact records match the assigned users yet.</div>
              ) : (
                contacts.map(contact => (
                  <div key={contact.id} className="px-4 py-4">
                    <div className="font-medium text-slate-900">{contact.full_name || contact.data?.full_name || contact.email}</div>
                    <div className="mt-1 space-y-1 text-sm text-slate-500">
                      {(contact.email || contact.data?.email) && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {contact.email || contact.data?.email}
                        </div>
                      )}
                      {(contact.phone || contact.data?.phone) && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" />
                          {contact.phone || contact.data?.phone}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}