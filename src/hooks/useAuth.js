import { useState, useEffect, useCallback } from 'react';
import { ensureDemoAuth, logout, isSessionExpired } from '../auth.js';
import { getAssignments, getAllClients, getUserClients } from '../api.js';

export function useAuth() {
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [roles, setRoles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('roles') || '[]'); } catch { return []; }
  });
  const [actingRole, setActingRole] = useState(localStorage.getItem('acting_role') || role || '');
  const [page, setPage] = useState(() => {
    const path = window.location.pathname;
    if (path.includes('verify-email')) return 'verify-email';
    if (path.includes('signup')) return 'signup';
    return 'login';
  });
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [clients, setClients] = useState([]);

  const checkSessionExpiry = useCallback(() => {
    if (isSessionExpired()) {
      console.warn('[auth] token expired; logging out');
      handleLogout();
      return true;
    }
    return false;
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setRole(null);
    setRoles([]);
    setActingRole('');
    setAssignments([]);
    setClients([]);
    setLoading(false);
  }, []);

  const onLoginSuccess = useCallback(async () => {
    const r = localStorage.getItem('role');
    setRole(r);
    const rs = (() => { 
      try { return JSON.parse(localStorage.getItem('roles') || '[]'); } catch { return []; }
    })();
    setRoles(rs);
    
    const primaryRole = rs.includes('platform_admin') ? 'platform_admin' : rs[0] || '';
    localStorage.setItem('acting_role', primaryRole);
    setActingRole(primaryRole);
    
    if (!r && rs.length > 0) {
      localStorage.setItem('role', primaryRole);
      setRole(primaryRole);
    }
    
    if (rs.includes('manager')) {
      await loadAssignments();
    } else if (rs.includes('platform_admin')) {
      await loadAdminClients();
    } else if (rs.includes('business_owner') || rs.includes('delegate') || rs.includes('viewer')) {
      await loadUserClients();
    }
    
    setLoading(false);
  }, []);

  const loadAssignments = useCallback(async () => {
    const data = await getAssignments();
    if (Array.isArray(data)) {
      setAssignments(data);
    }
  }, []);

  const loadAdminClients = useCallback(async () => {
    const data = await getAllClients();
    if (Array.isArray(data)) {
      const normalized = data.map(c => ({ clientId: c.id, clientName: c.name }));
      setClients(normalized);
    }
  }, []);

  const loadUserClients = useCallback(async () => {
    const data = await getUserClients();
    if (Array.isArray(data)) {
      const normalized = data.map(c => ({ clientId: c.id, clientName: c.name }));
      setClients(normalized);
    }
  }, []);

  useEffect(() => {
    if (checkSessionExpiry()) return;
    
    ensureDemoAuth();
    const hasJwt = !!localStorage.getItem('jwt');
    const r = localStorage.getItem('role');
    setRole(r);
    
    if (!hasJwt) {
      setLoading(false);
      return;
    }

    const rs = JSON.parse(localStorage.getItem('roles') || '[]');
    setRoles(rs);
    const primaryRole = rs.includes('platform_admin') ? 'platform_admin' : rs[0] || '';
    setActingRole(primaryRole);
    
    if (rs.includes('manager')) {
      loadAssignments();
    } else if (rs.includes('platform_admin')) {
      loadAdminClients();
    } else if (rs.includes('business_owner') || rs.includes('delegate') || rs.includes('viewer')) {
      loadUserClients();
    }
    
    setLoading(false);
    const id = setInterval(checkSessionExpiry, 60_000);
    return () => clearInterval(id);
  }, [checkSessionExpiry, loadAssignments, loadAdminClients, loadUserClients]);

  return {
    role,
    roles,
    actingRole,
    setActingRole,
    page,
    setPage,
    loading,
    assignments,
    clients,
    handleLogout,
    onLoginSuccess,
    isAuthenticated: !!role
  };
}