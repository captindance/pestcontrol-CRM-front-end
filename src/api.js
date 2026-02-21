// In development backend runs on 3001; in production both frontend & backend are proxied on 3000
const API_BASE = (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

// Request timeout in milliseconds (5 minutes for long-running queries)
const REQUEST_TIMEOUT = 300000;

// Export getAuthHeaders for use in other components
export function getAuthHeaders() {
  const token = localStorage.getItem('jwt') || localStorage.getItem('demo_jwt');
  const tenantId = localStorage.getItem('selected_tenant_id');
  const actingRole = localStorage.getItem('acting_role');
  const headers = { 'Authorization': `Bearer ${token}` };
  if (tenantId) headers['x-tenant-id'] = tenantId;
  if (actingRole) headers['x-acting-role'] = actingRole;
  return headers;
}

import { refreshToken, logout } from './auth.js';

/**
 * Create a fetch request with timeout
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server took too long to respond');
    }
    throw error;
  }
}

async function request(path, options = {}, attempt = 0) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...(options.headers || {})
      }
    });
    if (res.status === 401) {
      if (attempt === 0 && import.meta.env?.DEV && path !== '/dev/token') {
        console.warn('[api] 401 detected, refreshing dev token and retrying');
        await refreshToken();
        return await request(path, options, 1);
      }
      const text = await res.text().catch(() => '');
      logout();
      return { error: 'HTTP 401', body: text || 'Session expired. Please sign in again.' };
    }
    if (!res.ok) {
      const text = await res.text();
      return { error: `HTTP ${res.status}`, body: text };
    }
    // Handle 204 No Content responses
    if (res.status === 204) {
      return { success: true };
    }
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

export async function getReports() {
  return await request('/reports');
}

export async function createReport(name, connectionId) {
  const body = { name };
  if (connectionId) body.connectionId = connectionId;
  return await request('/reports', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateReport(id, name, connectionId, sqlQuery) {
  const body = { name };
  if (connectionId) body.connectionId = connectionId;
  if (sqlQuery !== undefined) body.sqlQuery = sqlQuery;
  return await request(`/reports/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function deleteReport(id) {
  return await request(`/reports/${id}`, { method: 'DELETE' });
}

export async function runReport(id) {
  return await request(`/reports/${id}/run`, { method: 'POST' });
}

export async function getReportResult(id) {
  return await request(`/reports/${id}/result`);
}

export async function getClient() {
  return await request('/clients/me');
}

// Get all clients accessible to current user (owner, delegate, viewer, or manager)
export async function getUserClients() {
  return await request('/clients/all');
}

export async function getAssignments() {
  return await request('/manager/me/assignments');
}

export async function getAllClients() {
  // Platform admin: list all clients to select a tenant context
  return await request('/admin/clients');
}

// Email settings (platform_admin)
export async function getEmailSettings() {
  return await request('/admin/email-settings');
}

export async function updateEmailSettings(settings) {
  return await request('/admin/email-settings', { method: 'PUT', body: JSON.stringify(settings) });
}

// SQL Query execution and caching
export async function executeQuery(reportId, sqlQuery, connectionId) {
  const body = { sqlQuery };
  if (connectionId) {
    // Convert connectionId to integer to match backend type expectations
    body.connectionId = parseInt(connectionId, 10);
  }
  return await request(`/reports/${reportId}/execute-query`, { 
    method: 'POST', 
    body: JSON.stringify(body) 
  });
}

export async function getQueryResults(reportId) {
  return await request(`/reports/${reportId}/results`);
}

export async function clearQueryResults(reportId) {
  return await request(`/reports/${reportId}/results`, { method: 'DELETE' });
}

export async function saveChartConfig(reportId, chartConfig) {
  return await request(`/reports/${reportId}/chart-config`, {
    method: 'PUT',
    body: JSON.stringify({ chartConfig })
  });
}

// Permissions
export async function getMyPermissions(clientId) {
  return await request(`/clients/${clientId}/my-permissions`);
}

// Authentication endpoints
export async function checkHasUsers() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/auth/has-users`);
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

export async function signup(email, firstName, lastName, companyNameOrClientId, password, isClientId = false, invitationToken = null) {
  try {
    const body = { email, firstName, lastName };
    
    // Handle token-based invitation flow
    if (invitationToken) {
      body.token = invitationToken;
      if (companyNameOrClientId) {
        body.companyName = companyNameOrClientId;
      }
    } else if (isClientId) {
      // Legacy clientId flow
      body.clientId = companyNameOrClientId;
    } else {
      // companyName flow
      body.companyName = companyNameOrClientId;
    }
    
    if (password) {
      body.password = password;
    }
    
    const res = await fetchWithTimeout(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `HTTP ${res.status}`, body: text };
    }
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

// Invitation functions (admin only)
export async function sendInvitation(email, clientId) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/admin/invitations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt')}` },
      body: JSON.stringify({ email, clientId })
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `HTTP ${res.status}`, body: text };
    }
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

export async function resendInvitation(invitationId) {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/admin/invitations/${invitationId}/resend`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt')}` }
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `HTTP ${res.status}`, body: text };
    }
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

export async function getInvitations(clientId = null) {
  try {
    const url = clientId ? `${API_BASE}/admin/invitations?clientId=${clientId}` : `${API_BASE}/admin/invitations`;
    const res = await fetchWithTimeout(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt')}` }
    });
    if (!res.ok) {
      const text = await res.text();
      return { error: `HTTP ${res.status}`, body: text };
    }
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

// Scheduled Reports API
export async function getSchedules(reportId, includeDisabled = true) {
  const params = new URLSearchParams();
  if (reportId) params.append('reportId', reportId);
  params.append('includeDisabled', includeDisabled ? 'true' : 'false');
  const query = params.toString() ? `?${params}` : '';
  return await request(`/schedules${query}`);
}

export async function createSchedule(scheduleData) {
  return await request('/schedules', { 
    method: 'POST', 
    body: JSON.stringify(scheduleData) 
  });
}

export async function updateSchedule(scheduleId, scheduleData) {
  return await request(`/schedules/${scheduleId}`, { 
    method: 'PATCH', 
    body: JSON.stringify(scheduleData) 
  });
}

export async function deleteSchedule(scheduleId) {
  return await request(`/schedules/${scheduleId}`, { method: 'DELETE' });
}

export async function getScheduleExecutions(scheduleId) {
  return await request(`/schedules/${scheduleId}/executions`);
}

export async function getAuditLogs(scheduleId, days = 30) {
  const params = new URLSearchParams();
  if (scheduleId) params.append('scheduleId', scheduleId);
  params.append('days', days.toString());
  
  return request(`/audit/schedule-changes?${params}`);
}

// Dashboard API
export async function getExternalSchedules() {
  return await request('/dashboard/external-schedules');
}

export async function getDashboardStats() {
  return await request('/dashboard/stats');
}