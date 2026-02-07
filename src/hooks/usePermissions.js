import { useState, useCallback, useEffect } from 'react';
import { getMyPermissions, getClient } from '../api.js';

export function usePermissions(tenantId, roles) {
  const [permissions, setPermissions] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadPermissions = useCallback(async () => {
    if (!tenantId || !roles.length) {
      setPermissions(null);
      return;
    }
    
    setLoading(true);
    
    try {
      if (roles.includes('platform_admin')) {
        setPermissions({
          canViewReports: true,
          canCreateReports: true,
          canEditReports: true,
          canDeleteReports: true,
          canManageConnections: true,
          canInviteUsers: true,
          canManageUsers: true
        });
      } else {
        const perms = await getMyPermissions(tenantId);
        if (perms && !perms.error) {
          setPermissions(perms);
        }
      }
    } catch (err) {
      console.error('Failed to load permissions:', err);
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, roles]);

  const loadClientInfo = useCallback(async (clients) => {
    if (!(roles.includes('business_owner') || roles.includes('delegate'))) {
      setClientInfo(null);
      return;
    }
    
    if (!tenantId) {
      setClientInfo(null);
      return;
    }
    
    const match = clients.find(c => c.clientId === tenantId);
    if (match) {
      setClientInfo({ id: match.clientId, name: match.clientName });
      return;
    }
    
    try {
      const data = await getClient(tenantId);
      if (data && !data.error) {
        setClientInfo({ id: data.id, name: data.name });
      } else {
        setClientInfo({ id: tenantId, name: '' });
      }
    } catch (err) {
      console.error('Failed to load client info:', err);
      setClientInfo({ id: tenantId, name: '' });
    }
  }, [tenantId, roles]);

  const canManageConnections = useCallback(() => {
    if (permissions) {
      return permissions.canManageConnections;
    }
    const editableRoles = ['business_owner', 'delegate', 'platform_admin', 'manager'];
    return roles && roles.some(r => editableRoles.includes(r));
  }, [permissions, roles]);

  const canEditReports = useCallback(() => {
    if (permissions) {
      return permissions.canEditReports;
    }
    return roles && roles.some(r => ['business_owner', 'delegate', 'platform_admin', 'manager'].includes(r));
  }, [permissions, roles]);

  const canCreateReports = useCallback(() => {
    if (permissions) {
      return permissions.canCreateReports;
    }
    return roles && roles.some(r => ['business_owner', 'delegate', 'platform_admin', 'manager'].includes(r));
  }, [permissions, roles]);

  const canDeleteReports = useCallback(() => {
    if (permissions) {
      return permissions.canDeleteReports;
    }
    return roles && roles.some(r => ['business_owner', 'delegate', 'platform_admin', 'manager'].includes(r));
  }, [permissions, roles]);

  const canManageUsers = useCallback(() => {
    if (permissions) {
      return permissions.canManageUsers || permissions.canInviteUsers;
    }
    return roles && roles.some(r => ['business_owner', 'delegate', 'platform_admin'].includes(r));
  }, [permissions, roles]);

  useEffect(() => {
    if (tenantId) {
      loadPermissions();
    }
  }, [tenantId, loadPermissions]);

  return {
    permissions,
    clientInfo,
    loading,
    loadPermissions,
    loadClientInfo,
    canManageConnections,
    canEditReports,
    canCreateReports,
    canDeleteReports,
    canManageUsers
  };
}

export function useTenantState() {
  const [tenantId, setTenantId] = useState(localStorage.getItem('selected_tenant_id') || '');
  const [tenantSelectTouched, setTenantSelectTouched] = useState(false);

  const updateTenantId = useCallback((newTenantId) => {
    setTenantId(newTenantId);
    localStorage.setItem('selected_tenant_id', newTenantId);
    setTenantSelectTouched(true);
  }, []);

  return {
    tenantId,
    setTenantId: updateTenantId,
    tenantSelectTouched,
    setTenantSelectTouched
  };
}