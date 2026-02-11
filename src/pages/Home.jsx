import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await base44.auth.isAuthenticated();
      if (isAuth) {
        const user = await base44.auth.me();
        if (!user.user_type) {
          navigate(createPageUrl('UserTypeSelection'));
        } else if (user.is_sales_rep) {
          navigate(createPageUrl('SalesDashboard'));
        } else if (user.user_type === 'student') {
          navigate(createPageUrl('StudentHome'));
        } else {
          navigate(createPageUrl('QuoteRequest'));
        }
        return;
      }
    } catch (e) {
      // Not authenticated
    }
    navigate(createPageUrl('Landing'));
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}