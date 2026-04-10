import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function useCustomerBootstrap(enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    base44.auth.isAuthenticated().then(async (authed) => {
      if (!authed) return;
      await base44.functions.invoke('linkCustomerOnFirstLogin', {});
    });
  }, [enabled]);
}