import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { ensureBrokerInstance } from '@/lib/brokerInstance';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const currentUser = await base44.auth.me();
        await ensureBrokerInstance(currentUser);

        const assignments = currentUser?.id
          ? await base44.entities.UserPermissionAssignment.filter({ user_id: currentUser.id }, 'updated_date', 20)
          : [];

        const directProfileText = [currentUser?.profile_name, currentUser?.profile, currentUser?.role]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const assignmentProfileNames = (assignments || [])
          .flatMap(item => [item.profile_name, item.data?.profile_name, item?.data?.data?.profile_name])
          .filter(Boolean)
          .map(value => String(value).toLowerCase());

        const profileIds = [...new Set((assignments || []).map(item => item.profile_id || item.data?.profile_id || item?.data?.data?.profile_id).filter(Boolean))];
        const profiles = profileIds.length > 0 ? await base44.entities.Profile.list('name', 200) : [];
        const hasGlobalProfile =
          directProfileText.includes('global') ||
          assignmentProfileNames.some(name => name.includes('global')) ||
          (profiles || []).some(profile => profileIds.includes(profile.id) && String(profile.name || profile.data?.name || profile?.data?.data?.name || '').toLowerCase().includes('global'));

        const isCustomer = String(currentUser?.role || '').toLowerCase() === 'user';
        navigate(createPageUrl(isCustomer ? 'CustomerOrders' : hasGlobalProfile ? 'ExecutiveDashboard' : currentUser?.role === 'designer' ? 'DesignerDashboard' : 'SalesDashboard'));
        return;
      }
    } catch (e) {}
    navigate(createPageUrl('Landing'));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}