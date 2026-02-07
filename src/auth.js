// Demo auth: generate a pseudo JWT matching backend expectations.
// In production replace with proper login flow.

// In development backend runs on 3001; in production both frontend & backend are proxied on 3000
const API_BASE = (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

function base64url(obj) { return btoa(JSON.stringify(obj)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }

let refreshing = null;

function decodeJwt(token) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isJwtExpired(token, skewSeconds = 30) {
  const data = decodeJwt(token);
  if (!data || !data.exp) return false; // demo tokens have no exp
  const now = Math.floor(Date.now() / 1000);
  return data.exp <= now + skewSeconds;
}

export function getToken() {
  const real = localStorage.getItem('jwt');
  if (real && isJwtExpired(real)) {
    localStorage.removeItem('jwt');
    localStorage.removeItem('role');
    localStorage.removeItem('clientId');
    return localStorage.getItem('demo_jwt');
  }
  return real || localStorage.getItem('demo_jwt');
}

async function fetchDevToken() {
  try {
    console.log('[auth] requesting dev token...');
    const res = await fetch('http://localhost:3001/api/dev/token');
    if (res.ok) {
      const data = await res.json();
      if (data?.token) {
        localStorage.setItem('demo_jwt', data.token);
        console.log('[auth] stored new dev token');
        return data.token;
      }
    } else {
      console.warn('[auth] dev token endpoint returned status', res.status);
    }
  } catch (e) {
    console.warn('[auth] dev token fetch failed', e);
  }
  return null;
}

function generateFallbackToken() {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { userId: 'user_owner_a', tenantId: 'client_a', roles: ['business_owner'], iat: Math.floor(Date.now()/1000) };
  return `${base64url(header)}.${base64url(payload)}.demo_signature`;
}

export async function ensureDemoAuth() {
  // If real login token exists, do nothing; otherwise ensure a dev token/fallback in development
  const real = localStorage.getItem('jwt');
  if (real && !isJwtExpired(real)) return;
  if (getToken()) return; // demo token already present
  if (import.meta.env?.DEV) {
    const t = await fetchDevToken();
    if (t) return;
  }
  const fallback = generateFallbackToken();
  localStorage.setItem('demo_jwt', fallback);
}

export async function refreshToken() {
  if (!import.meta.env?.DEV) return null;
  if (refreshing) return refreshing; // dedupe concurrent 401s
  refreshing = (async () => {
    const newTok = await fetchDevToken();
    if (!newTok) {
      console.warn('[auth] falling back to unsigned token after failed refresh');
      localStorage.setItem('demo_jwt', generateFallbackToken());
    }
    return getToken();
  })();
  try {
    return await refreshing;
  } finally {
    refreshing = null;
  }
}

// Real login against backend
export async function login(email, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `HTTP ${res.status}`, body: text };
    }
    const data = await res.json();
    if (data?.token) {
      localStorage.setItem('jwt', data.token);
      localStorage.removeItem('demo_jwt');
      // store roles array and client for convenience
      if (Array.isArray(data.roles)) {
        localStorage.setItem('roles', JSON.stringify(data.roles));
        // Set primary role for backward compatibility
        const primaryRole = data.roles.includes('platform_admin') ? 'platform_admin' : data.roles[0];
        if (primaryRole) localStorage.setItem('role', primaryRole);
      }
      if (data.clientId) localStorage.setItem('clientId', data.clientId);
    }
    return data;
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

export function logout() {
  localStorage.removeItem('jwt');
  localStorage.removeItem('role');
  localStorage.removeItem('roles');
  localStorage.removeItem('acting_role');
  localStorage.removeItem('clientId');
  localStorage.removeItem('selected_tenant_id');
  localStorage.removeItem('demo_jwt');
}

export function isSessionExpired() {
  const real = localStorage.getItem('jwt');
  return !!real && isJwtExpired(real);
}
