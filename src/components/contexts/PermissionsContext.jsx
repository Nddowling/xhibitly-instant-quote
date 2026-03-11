import React, { createContext, useContext, useEffect, useState } from 'react';
import { loadEffectivePermissions } from '@/components/utils/permissionsEngine';
import { base44 } from '@/api/base44Client';

const PermissionsContext = createContext(null);

export function PermissionsProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.id) {
        loadEffectivePermissions(u.id).then(p => {
          setPermissions(p);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  }, []);

  return (
    <PermissionsContext.Provider value={{ permissions, loading, user }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);

export function useCanAccess(pageKey) {
  const { permissions } = usePermissions() || {};
  if (!permissions) return true; // fallback: allow if not loaded yet
  if (permissions.page_access?.includes('*') || permissions._isAdmin) return true;
  return (permissions.page_access || []).includes(pageKey);
}

export function useObjectPermission(objectName, action) {
  const { permissions } = usePermissions() || {};
  if (!permissions) return true;
  if (permissions._isAdmin || permissions.page_access?.includes('*')) return true;
  return permissions?.object_permissions?.[objectName]?.[action] === true;
}

export function useFieldPermission(objectName, fieldName, action) {
  const { permissions } = usePermissions() || {};
  if (!permissions) return true;
  if (permissions._isAdmin || permissions.page_access?.includes('*')) return true;
  return permissions?.field_permissions?.[objectName]?.[fieldName]?.[action] === true;
}