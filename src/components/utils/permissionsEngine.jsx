import { base44 } from '@/api/base44Client';

let _cache = null;
let _cacheUserId = null;

export async function loadEffectivePermissions(userId) {
  if (_cache && _cacheUserId === userId) return _cache;

  const assignments = await base44.entities.UserPermissionAssignment.filter({ user_id: userId });
  if (!assignments.length) {
    _cache = buildAdminPermissions();
    _cacheUserId = userId;
    return _cache;
  }

  const assignment = assignments[0];
  const profiles = await base44.entities.Profile.filter({ id: assignment.profile_id });
  const profile = profiles[0];
  let effective = JSON.parse(JSON.stringify(profile || {}));

  for (const psId of (assignment.permission_set_ids || [])) {
    const psets = await base44.entities.PermissionSet.filter({ id: psId });
    if (psets[0]) effective = mergePermissions(effective, psets[0]);
  }

  _cache = effective;
  _cacheUserId = userId;
  return effective;
}

function mergePermissions(base, pset) {
  const merged = JSON.parse(JSON.stringify(base));

  for (const [obj, perms] of Object.entries(pset.object_permissions || {})) {
    if (!merged.object_permissions) merged.object_permissions = {};
    merged.object_permissions[obj] = {
      ...(merged.object_permissions[obj] || {}),
      ...Object.fromEntries(Object.entries(perms).filter(([, v]) => v === true))
    };
  }

  for (const [obj, fields] of Object.entries(pset.field_permissions || {})) {
    if (!merged.field_permissions) merged.field_permissions = {};
    if (!merged.field_permissions[obj]) merged.field_permissions[obj] = {};
    for (const [field, fp] of Object.entries(fields)) {
      merged.field_permissions[obj][field] = {
        ...(merged.field_permissions[obj][field] || {}),
        ...Object.fromEntries(Object.entries(fp).filter(([, v]) => v === true))
      };
    }
  }

  const basePages = new Set(base.page_access || []);
  for (const p of (pset.page_access || [])) basePages.add(p);
  merged.page_access = [...basePages];

  return merged;
}

export function hasObjectPermission(permissions, objectName, action) {
  if (!permissions) return false;
  if (permissions.page_access?.includes('*')) return true;
  return permissions?.object_permissions?.[objectName]?.[action] === true;
}

export function hasFieldPermission(permissions, objectName, fieldName, action) {
  if (!permissions) return false;
  if (permissions.page_access?.includes('*')) return true;
  return permissions?.field_permissions?.[objectName]?.[fieldName]?.[action] === true;
}

export function hasPageAccess(permissions, pageKey) {
  if (!permissions) return false;
  if (permissions.page_access?.includes('*')) return true;
  return (permissions?.page_access || []).includes(pageKey);
}

function buildAdminPermissions() {
  return {
    object_permissions: {},
    field_permissions: {},
    page_access: ['*'],
    _isAdmin: true,
  };
}

export function clearPermissionsCache() {
  _cache = null;
  _cacheUserId = null;
}