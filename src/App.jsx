import React, { useEffect, useState } from 'react';
import { getReports, runReport, getReportResult, getAssignments, getAllClients, createReport, updateReport, deleteReport, executeQuery, getQueryResults, clearQueryResults, saveChartConfig, getClient, getUserClients, getMyPermissions } from './api.js';
import { ensureDemoAuth, logout, isSessionExpired } from './auth.js';
import ReportChart from './components/ReportChart.jsx';
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';
import VerifyEmail from './components/VerifyEmail.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import ClientPanel from './components/ClientPanel.jsx';
import DatabaseConnections from './components/DatabaseConnections.jsx';
import Sidebar from './components/Sidebar.jsx';
import MainLayout from './components/MainLayout.jsx';
import Toast from './components/Toast.jsx';
import { ReportCardSkeleton, EmptyState } from './components/LoadingStates.jsx';

// In development backend runs on 3001; in production both frontend & backend are proxied on 3000
const API_BASE = (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

export default function App() {
  const [reports, setReports] = useState([]);
  const [results, setResults] = useState({});
  const [loadingRun, setLoadingRun] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [roles, setRoles] = useState(() => {
    try { return JSON.parse(localStorage.getItem('roles') || '[]'); } catch { return []; }
  });
  const [permissions, setPermissions] = useState(null); // User's effective permissions
  const [page, setPage] = useState(() => {
    // Check URL for verify-email or signup pages
    const path = window.location.pathname;
    if (path.includes('verify-email')) return 'verify-email';
    if (path.includes('signup')) return 'signup';
    return 'login';
  });
  const [assignments, setAssignments] = useState([]); // manager
  const [clients, setClients] = useState([]); // platform_admin
  const [clientInfo, setClientInfo] = useState(null); // owner/delegate client info
  const [tenantId, setTenantId] = useState(localStorage.getItem('selected_tenant_id') || '');
  const [actingRole, setActingRole] = useState(localStorage.getItem('acting_role') || role || '');
  const [view, setView] = useState('reports');
  const [newReportName, setNewReportName] = useState('');
  const [newReportConnectionId, setNewReportConnectionId] = useState('');
  const [creatingReport, setCreatingReport] = useState(false);
  const [editingReportId, setEditingReportId] = useState(null);
  const [editReportName, setEditReportName] = useState('');
  const [editReportConnectionId, setEditReportConnectionId] = useState('');
  const [availableConnections, setAvailableConnections] = useState([]);
  const [savingReport, setSavingReport] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState(null);
  const [tenantSelectTouched, setTenantSelectTouched] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [showDeleteSnackbar, setShowDeleteSnackbar] = useState(false);
  const [reportsTab, setReportsTab] = useState('reports'); // Only 'reports' tab now - connections moved to Settings
  const [editReportSqlQuery, setEditReportSqlQuery] = useState('');
  const [queryResults, setQueryResults] = useState({});
  const [executingQuery, setExecutingQuery] = useState(null);
  const [expandedResultsReportId, setExpandedResultsReportId] = useState(null);
  const [chartFieldSelection, setChartFieldSelection] = useState({}); // { reportId: { field: true/false } }
  const [savingChartConfig, setSavingChartConfig] = useState(null);
  const [chartTypeSelection, setChartTypeSelection] = useState({}); // { reportId: 'bar' | 'line' | 'pie' | 'table' }
  const [reportChartConfig, setReportChartConfig] = useState({}); // { reportId: { selectedFields, chartType } }
  const [chartAxisLabels, setChartAxisLabels] = useState({}); // { reportId: { x: 'Category', y: 'Value' } }
  const [chartDisplayOptions, setChartDisplayOptions] = useState({}); // { reportId: { showValuesOnBars: bool, rotateCategoryLabels: bool } }
  const [loadingSavedResults, setLoadingSavedResults] = useState(null);
  const [showResultDetails, setShowResultDetails] = useState({}); // { reportId: bool }
  const [seriesFormats, setSeriesFormats] = useState({}); // { reportId: { seriesName: 'currency'|'percentage'|'number' } }
  const [seriesDisplayNames, setSeriesDisplayNames] = useState({}); // { reportId: { seriesName: 'Display Name' } }
  const [toast, setToast] = useState(null); // { message, type }
  const [loadingReports, setLoadingReports] = useState(true);

  const formatDateTime = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  // Check if user has permission to manage database connections
  const canManageConnections = () => {
    if (permissions) {
      return permissions.canManageConnections;
    }
    // Fallback to role-based check if permissions not loaded yet
    const editableRoles = ['business_owner', 'delegate', 'platform_admin', 'manager'];
    return roles && roles.some(r => editableRoles.includes(r));
  };

  // Check if user can edit reports
  const canEditReports = () => {
    if (permissions) {
      return permissions.canEditReports;
    }
    // Fallback to role-based check
    return roles && roles.some(r => ['business_owner', 'delegate', 'platform_admin', 'manager'].includes(r));
  };

  // Check if user can create reports
  const canCreateReports = () => {
    if (permissions) {
      return permissions.canCreateReports;
    }
    // Fallback to role-based check
    return roles && roles.some(r => ['business_owner', 'delegate', 'platform_admin', 'manager'].includes(r));
  };

  // Check if user can delete reports
  const canDeleteReports = () => {
    if (permissions) {
      return permissions.canDeleteReports;
    }
    // Fallback to role-based check
    return roles && roles.some(r => ['business_owner', 'delegate', 'platform_admin', 'manager'].includes(r));
  };

  // Load user's permissions for current tenant
  async function loadPermissions() {
    if (!tenantId || !roles.length) {
      setPermissions(null);
      return;
    }
    // Platform admins have all permissions
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
      return;
    }
    const perms = await getMyPermissions(tenantId);
    if (perms && !perms.error) {
      setPermissions(perms);
    }
  }

  // Reload permissions whenever tenant changes
  useEffect(() => {
    if (tenantId && page === 'app') {
      loadPermissions();
    }
  }, [tenantId, page]);

  // Load client info for Settings view
  useEffect(() => {
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
    (async () => {
      const data = await getClient(tenantId);
      if (data && !data.error) {
        setClientInfo({ id: data.id, name: data.name });
      } else {
        setClientInfo({ id: tenantId, name: '' });
      }
    })();
  }, [tenantId, clients, roles]);

  useEffect(() => {
    const maybeExpire = () => {
      if (isSessionExpired()) {
        console.warn('[auth] token expired; logging out');
        handleLogout();
        return true;
      }
      return false;
    };
    if (maybeExpire()) return;
    ensureDemoAuth();
    const hasJwt = !!localStorage.getItem('jwt');
    const r = localStorage.getItem('role');
    setRole(r);
    if (!hasJwt) return;
    if (r === 'manager') {
      loadAssignments();
      if (tenantId) refreshReports();
      else setLoading(false);
      
      // Listen for assignment updates via SSE
      const token = localStorage.getItem('jwt');
      const sseUrl = new URL(`${API_BASE}/manager/assignments/updates`);
      sseUrl.searchParams.append('token', token || '');
      const eventSource = new EventSource(sseUrl.toString());
      
      eventSource.addEventListener('assignmentUpdated', () => {
        console.log('[SSE] Assignment updated event received, refreshing assignments');
        loadAssignments();
      });
      
      eventSource.onerror = (err) => {
        console.error('[SSE] Connection error:', err);
        eventSource.close();
      };
      
      return () => {
        eventSource.close();
      };
    } else if (r === 'platform_admin') {
      (async () => {
        const clientsData = await getAllClients();
        if (Array.isArray(clientsData) && clientsData.length > 0) {
          // Auto-select first client if no tenant is selected
          if (!tenantId) {
            const firstClientId = clientsData[0].id;
            setTenantId(firstClientId);
            localStorage.setItem('selected_tenant_id', firstClientId);
            setClients(clientsData.map(c => ({ clientId: c.id, clientName: c.name })));
            await refreshReports(firstClientId);
          } else {
            setClients(clientsData.map(c => ({ clientId: c.id, clientName: c.name })));
            await refreshReports();
          }
        } else {
          // No clients yet - just show empty state
          setClients([]);
          setReports([]);
        }
        setLoading(false);
      })();
    } else if (r === 'business_owner' || r === 'delegate' || r === 'viewer') {
      (async () => {
        // Load all accessible clients for this user
        await loadUserClients();
        // Auto-select if only one client
        const clientsData = await getUserClients();
        if (Array.isArray(clientsData) && clientsData.length === 1 && !tenantId) {
          const singleClientId = clientsData[0].id;
          setTenantId(singleClientId);
          localStorage.setItem('selected_tenant_id', singleClientId);
        }
        await refreshReports();
      })();
    } else {
      refreshReports();
    }
    const id = setInterval(maybeExpire, 60_000);
    return () => clearInterval(id);
  }, []);

  async function onLoginSuccess() {
    const r = localStorage.getItem('role');
    setRole(r);
    setView('reports'); // Reset to reports view after login
    const rs = (() => { try { return JSON.parse(localStorage.getItem('roles') || '[]'); } catch { return []; } })();
    setRoles(rs);
    // Set acting role from roles array - prioritize platform_admin, then first role
    const primaryRole = rs.includes('platform_admin') ? 'platform_admin' : rs[0] || '';
    localStorage.setItem('acting_role', primaryRole);
    setActingRole(primaryRole);
    
    // Set role if not set (for backward compatibility with !role check)
    if (!r && rs.length > 0) {
      localStorage.setItem('role', primaryRole);
      setRole(primaryRole);
    }
    
    if (rs.includes('manager')) {
      await loadAssignments();
      if (tenantId) await refreshReports();
      else setLoading(false);
    } else {
      if (rs.includes('platform_admin')) {
        const clientsData = await getAllClients();
        if (Array.isArray(clientsData) && clientsData.length > 0) {
          // Auto-select the first client
          const firstClientId = clientsData[0].id;
          setTenantId(firstClientId);
          localStorage.setItem('selected_tenant_id', firstClientId);
          setClients(clientsData.map(c => ({ clientId: c.id, clientName: c.name })));
          await refreshReports(firstClientId);
        } else {
          // No clients yet - just show empty state
          setClients([]);
          setReports([]);
        }
        setLoading(false);
      } else if (rs.includes('business_owner') || rs.includes('delegate') || rs.includes('viewer')) {
        // Load all accessible clients for this user
        await loadUserClients();
        // Auto-select if only one client
        const clientsData = await getUserClients();
        if (Array.isArray(clientsData) && clientsData.length === 1 && !tenantId) {
          const singleClientId = clientsData[0].id;
          setTenantId(singleClientId);
          localStorage.setItem('selected_tenant_id', singleClientId);
        }
        await refreshReports();
        setLoading(false);
      } else {
        await refreshReports();
      }
    }
  }

  async function loadAssignments() {
    const data = await getAssignments();
    if (Array.isArray(data)) {
      setAssignments(data);
    }
    setLoading(false);
  }

  async function loadAdminClients() {
    const data = await getAllClients();
    if (Array.isArray(data)) {
      // Normalize to { clientId, clientName }
      const normalized = data.map(c => ({ clientId: c.id, clientName: c.name }));
      setClients(normalized);
    }
  }

  async function loadUserClients() {
    const data = await getUserClients();
    if (Array.isArray(data)) {
      // Normalize to { clientId, clientName }
      const normalized = data.map(c => ({ clientId: c.id, clientName: c.name }));
      setClients(normalized);
    }
  }

  async function refreshReports(selectedTenantId = tenantId) {
    const currentTenantId = selectedTenantId || tenantId;
    if (!currentTenantId) {
      setReports([]);
      setAvailableConnections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await getReports();
    if (list?.error) {
      setError(list.error + (list.body ? `: ${list.body}` : ''));
      setReports([]);
      setAvailableConnections([]);
    } else {
      setError(null);
      // Handle both old format (array) and new format (object with reports and availableConnections)
      if (Array.isArray(list)) {
        setReports(list);
        setAvailableConnections([]);
      } else if (list?.reports) {
        setReports(list.reports);
        setAvailableConnections(list.availableConnections || []);

        // Sync chart configuration from server
        const newFieldSelection = { ...chartFieldSelection };
        const newChartTypeSelection = { ...chartTypeSelection };
        const newReportChartConfig = { ...reportChartConfig };
        const newAxisLabels = { ...chartAxisLabels };
        const newDisplayOptions = { ...chartDisplayOptions };
        const newSeriesFormats = { ...seriesFormats };
        const newSeriesDisplayNames = { ...seriesDisplayNames };
        list.reports.forEach(r => {
          if (r.chartConfig) {
            newReportChartConfig[r.id] = r.chartConfig;
            if (r.chartConfig.selectedFields) {
              newFieldSelection[r.id] = r.chartConfig.selectedFields;
            }
            if (r.chartConfig.chartType) {
              newChartTypeSelection[r.id] = r.chartConfig.chartType;
            }
            if (r.chartConfig.axisLabels) {
              newAxisLabels[r.id] = r.chartConfig.axisLabels;
            }
            if (r.chartConfig.displayOptions) {
              newDisplayOptions[r.id] = r.chartConfig.displayOptions;
            }
            if (r.chartConfig.seriesFormats) {
              newSeriesFormats[r.id] = r.chartConfig.seriesFormats;
            }
            if (r.chartConfig.seriesDisplayNames) {
              newSeriesDisplayNames[r.id] = r.chartConfig.seriesDisplayNames;
            }
          }
        });
        setReportChartConfig(newReportChartConfig);
        setChartFieldSelection(newFieldSelection);
        setChartTypeSelection(newChartTypeSelection);
        setChartAxisLabels(newAxisLabels);
        setChartDisplayOptions(newDisplayOptions);
        setSeriesFormats(newSeriesFormats);
        setSeriesDisplayNames(newSeriesDisplayNames);

        // Auto-load saved results for reports with chart configurations
        list.reports.forEach(async (r) => {
          if (r.chartConfig && Object.keys(r.chartConfig.selectedFields || {}).length > 0) {
            try {
              const res = await getQueryResults(r.id);
              if (res?.data?.rows && res.data.rows.length > 0) {
                const resultData = {
                  executedAt: res.executedAt || new Date().toISOString(),
                  data: res.data,
                  error: res.error || null,
                };
                setQueryResults(prev => ({ ...prev, [r.id]: resultData }));
                setExpandedResultsReportId(r.id);
                setShowResultDetails(prev => ({ ...prev, [r.id]: false })); // Hide details by default, show chart only
              }
            } catch (err) {
              console.error(`Failed to auto-load results for report ${r.id}:`, err);
            }
          }
        });
      } else {
        setReports([]);
        setAvailableConnections([]);
      }
    }
    setLoading(false);
  }

  async function handleRun(id) {
    setLoadingRun(id);
    await runReport(id);
    setLoadingRun(null);
    // Poll result after a short delay
    setTimeout(() => fetchResult(id), 1700);
  }

  async function fetchResult(id) {
    const result = await getReportResult(id);
    if (result?.error) {
      setError(result.error);
    } else if (result) {
      setResults(r => ({ ...r, [id]: result }));
    }
    refreshReports();
  }

  async function handleCreateReport() {
    if (!newReportName.trim()) {
      setError('Report name is required');
      return;
    }
    setCreatingReport(true);
    const res = await createReport(newReportName);
    setCreatingReport(false);
    if (res?.error) {
      setError('Failed to create report: ' + res.error);
    } else {
      setNewReportName('');
      setError(null);
      await refreshReports();
    }
  }

  async function handleUpdateReport() {
    if (!editReportName.trim()) {
      setError('Report name is required');
      return;
    }
    setSavingReport(true);
    
    const res = await updateReport(
      editingReportId, 
      editReportName, 
      editReportConnectionId || undefined,
      editReportSqlQuery || undefined
    );
    setSavingReport(false);
    if (res?.error) {
      setError('Failed to update report: ' + res.error);
    } else {
      setEditingReportId(null);
      setEditReportName('');
      setEditReportConnectionId('');
      setEditReportSqlQuery('');
      setError(null);
      await refreshReports();
    }
  }

  // Save report (name/query/connection) and chart configuration together
  async function handleSaveReportAndChart(reportId) {
    if (!editReportName.trim()) {
      setError('Report name is required');
      return;
    }
    setSavingReport(true);
    try {
      const res = await updateReport(
        editingReportId,
        editReportName,
        editReportConnectionId || undefined,
        editReportSqlQuery || undefined
      );
      if (res?.error) {
        setError('Failed to update report: ' + res.error);
        return;
      }
      setError(null);
      // Persist chart config after report update
      await handleSaveChartConfig(reportId);
      // Exit edit mode and clear edit buffers
      setEditingReportId(null);
      setEditReportName('');
      setEditReportConnectionId('');
      setEditReportSqlQuery('');
      setExpandedResultsReportId(null);
      setShowResultDetails(prev => ({ ...prev, [reportId]: false }));
      await refreshReports();
    } finally {
      setSavingReport(false);
    }
  }

  function startEditingReport(report) {
    setEditingReportId(report.id);
    setEditReportName(report.name);
    setEditReportConnectionId(report.connectionId || '');
    setEditReportSqlQuery(report.sqlQuery || '');

    // Load chart config for this report if available
    if (reportChartConfig[report.id]?.selectedFields) {
      setChartFieldSelection(prev => ({ ...prev, [report.id]: reportChartConfig[report.id].selectedFields }));
    }
    if (reportChartConfig[report.id]?.chartType) {
      setChartTypeSelection(prev => ({ ...prev, [report.id]: reportChartConfig[report.id].chartType }));
    }
  }

  function cancelEditingReport() {
    setEditingReportId(null);
    setEditReportName('');
    setEditReportConnectionId('');
    setEditReportSqlQuery('');
    setExpandedResultsReportId(null);
    setShowResultDetails(prev => ({ ...prev, [editingReportId]: false }));
  }

  function handleDeleteClick(id) {
    setPendingDeleteId(id);
    setShowDeleteSnackbar(true);
  }

  function cancelDelete() {
    setShowDeleteSnackbar(false);
    setPendingDeleteId(null);
  }

  async function handleExecuteQuery(reportId) {
    if (!editReportSqlQuery.trim()) {
      setError('Please enter a SQL query');
      return;
    }
    
    setExecutingQuery(reportId);
    setError(null); // Clear previous errors
    
    try {
      console.log('[Query] Executing query for report:', reportId);
      const res = await executeQuery(reportId, editReportSqlQuery, editReportConnectionId);
      
      console.log('[Query] Execute response:', res);
      
      // Handle API-level errors (HTTP errors like 500)
      if (res?.error) {
        let errorMsg = res.error;
        // Try to parse the body if it's a JSON string with an error message
        if (res?.body) {
          try {
            const parsed = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
            errorMsg = parsed?.error || res.body;
          } catch (e) {
            errorMsg = res.body;
          }
        }
        console.error('[Query] Execution error:', errorMsg);
        setError(`Query execution failed: ${errorMsg}`);
        setExecutingQuery(null);
        return;
      }
      
      // Check if we got success response with data
      if (res?.success && res?.rows !== undefined && res?.columns) {
        console.log('[Query] Execution successful, rows:', res.rows.length, 'columns:', res.columns);
        
        // Build the result object in the same format as getQueryResults
        const resultData = {
          executedAt: new Date().toISOString(),
          data: {
            columns: res.columns,
            rows: res.rows,
            rowCount: res.rowCount || res.rows.length,
            executionTimeMs: res.executionTimeMs || 0
          },
          error: null
        };
        
        console.log('[Query] Setting results:', resultData);
        setQueryResults(prev => ({ ...prev, [reportId]: resultData }));
        setExpandedResultsReportId(reportId);
        setError(null);
        
        // Initialize chart field selection with all fields if not already configured
        if (res?.columns && res.columns.length > 0) {
          setChartFieldSelection(prev => {
            // Only initialize if no existing config
            if (!prev[reportId] || Object.keys(prev[reportId]).length === 0) {
              const allFields = {};
              res.columns.forEach(col => {
                allFields[col] = true; // Select all fields by default
              });
              console.log('[Query] Initializing chart fields:', allFields);
              return { ...prev, [reportId]: allFields };
            }
            return prev;
          });
          // Default chart type to bar if not set
          setChartTypeSelection(prev => ({ ...prev, [reportId]: prev[reportId] || 'bar' }));
          // Set display options with default values
          setChartDisplayOptions(prev => ({
            ...prev,
            [reportId]: {
              showValuesOnBars: prev[reportId]?.showValuesOnBars ?? true,
              rotateCategoryLabels: prev[reportId]?.rotateCategoryLabels ?? false
            }
          }));
          // Show details by default after executing a query so user can configure
          setShowResultDetails(prev => ({ ...prev, [reportId]: true }));
        }
      } else {
        console.warn('[Query] Unexpected response structure:', res);
        setError('Query executed but response was invalid. Check browser console.');
      }
    } catch (err) {
      console.error('[Query] Exception:', err);
      setError(`Query execution error: ${err.message || 'Unknown error'}`);
    } finally {
      setExecutingQuery(null);
    }
  }

  async function handleLoadSavedResults(reportId) {
    setLoadingSavedResults(reportId);
    setError(null);
    try {
      const res = await getQueryResults(reportId);
      if (res?.error) {
        setError(`Failed to load saved results: ${res.error}`);
        return;
      }
      if (!res?.data?.rows) {
        setError(res?.message || 'No saved results available for this report.');
        return;
      }

      const resultData = {
        executedAt: res.executedAt || new Date().toISOString(),
        data: res.data,
        error: res.error || null,
      };

      setQueryResults(prev => ({ ...prev, [reportId]: resultData }));
      setExpandedResultsReportId(reportId);

      // Initialize chart field selection if not already set
      if (res.data?.columns?.length && !chartFieldSelection[reportId]) {
        const allFields = {};
        res.data.columns.forEach(col => { allFields[col] = true; });
        setChartFieldSelection(prev => ({ ...prev, [reportId]: allFields }));
        setChartTypeSelection(prev => ({ ...prev, [reportId]: prev[reportId] || 'bar' }));
      }
    } catch (err) {
      setError(`Error loading saved results: ${err?.message || 'Unknown error'}`);
    } finally {
      setLoadingSavedResults(null);
    }
  }

  async function handleSaveChartConfig(reportId) {
    setSavingChartConfig(reportId);
    try {
      const config = {
        selectedFields: chartFieldSelection[reportId] || {},
        chartType: chartTypeSelection[reportId] || 'bar',
        axisLabels: chartAxisLabels[reportId] || {},
        displayOptions: chartDisplayOptions[reportId] || {},
        seriesFormats: seriesFormats[reportId] || {},
        seriesDisplayNames: seriesDisplayNames[reportId] || {},
      };
      const res = await saveChartConfig(reportId, config);
      if (res?.error) {
        setError(`Failed to save chart configuration: ${res.error}`);
      } else {
        setError(null);
        setReportChartConfig(prev => ({ ...prev, [reportId]: config }));
      }
    } catch (err) {
      setError(`Error saving chart configuration: ${err.message}`);
    } finally {
      setSavingChartConfig(null);
    }
  }

  function buildChartData(reportId) {
    const result = queryResults[reportId];
    if (!result?.data) return null;
    const selected = Object.entries(chartFieldSelection[reportId] || {})
      .filter(([_, v]) => v)
      .map(([col]) => col);
    if (selected.length === 0) return null;

    const chartType = chartTypeSelection[reportId] || 'bar';
    const rows = result.data.rows || [];

    const normalizeKey = key => (key ?? '').toString().toLowerCase().replace(/[\s_]/g, '');
    const resolveFieldValue = (row, field) => {
      if (!row || !field) return undefined;
      if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
      const lowerMatch = Object.keys(row).find(k => k.toLowerCase() === field.toLowerCase());
      if (lowerMatch) return row[lowerMatch];
      const normTarget = normalizeKey(field);
      const normalizedMatch = Object.keys(row).find(k => normalizeKey(k) === normTarget);
      if (normalizedMatch) return row[normalizedMatch];
      return undefined;
    };

    if (chartType === 'table') {
      return {
        type: 'table',
        columns: selected,
        rows
      };
    }

    // For bar/line/pie charts
    // Auto-detect category field (first non-numeric field) vs value fields (numeric)
    let categoryField = null;
    let valueFields = [];
    
    // Try to detect the category field by checking if values are non-numeric strings
    // Check first few rows to handle NULL values in first row
    for (const field of selected) {
      let isNumeric = false;
      
      // Check up to first 3 rows to determine if field is numeric
      for (let i = 0; i < Math.min(3, rows.length); i++) {
        const value = resolveFieldValue(rows[i], field);
        if (value !== null && value !== undefined) {
          if (typeof value === 'number' || !isNaN(parseFloat(value))) {
            isNumeric = true;
            break;
          }
        }
      }
      
      if (!isNumeric && !categoryField) {
        categoryField = field;
      } else {
        valueFields.push(field);
      }
    }
    
    // Fallback: if all fields are numeric, use first as category
    if (!categoryField && selected.length > 0) {
      categoryField = selected[0];
      valueFields = selected.slice(1);
    }

    if (!categoryField) return null;

    const categories = rows.map(row => String(resolveFieldValue(row, categoryField) ?? ''));

    // Build series data
    const series = valueFields.map(field => {
      const data = rows.map(row => {
        const val = resolveFieldValue(row, field);
        return typeof val === 'number' ? val : parseFloat(val) || 0;
      });
      const displayName = seriesDisplayNames[reportId]?.[field] || field;
      return { name: displayName, originalName: field, data };
    });

    // Check if we need separate scaling (when value ranges are very different)
    let useSeparateScale = false;
    if (series.length > 1) {
      const maxVals = series.map(s => Math.max(...s.data, 0));
      const minMax = Math.min(...maxVals.filter(v => v > 0));
      const bigMax = Math.max(...maxVals);
      if (bigMax > minMax * 20) {
        useSeparateScale = true;
      }
    }

    // Map formats to use originalName as key but display name will show in chart
    const formatsMap = {};
    series.forEach(s => {
      const originalName = s.originalName || s.name;
      if (seriesFormats[reportId]?.[originalName]) {
        formatsMap[s.name] = seriesFormats[reportId][originalName];
      }
    });

    return {
      type: chartType,
      categories,
      series,
      xLabel: chartAxisLabels[reportId]?.x || '',
      yLabel: chartAxisLabels[reportId]?.y || '',
      seriesFormats: formatsMap,
      displayOptions: {
        ...chartDisplayOptions[reportId],
        useSeparateScale
      }
    };
  }

  // Confirm delete handler
  async function confirmDelete() {
    if (!pendingDeleteId) return;
    setDeletingReportId(pendingDeleteId);
    setShowDeleteSnackbar(false);
    const res = await deleteReport(pendingDeleteId);
    setDeletingReportId(null);
    setPendingDeleteId(null);
    if (res?.error) {
      setError('Failed to delete report: ' + res.error);
    } else {
      setError(null);
      await refreshReports();
    }
  }

  // Logout handler
  function handleLogout() {
    logout();
    setRole(null);
    setRoles([]);
    setActingRole('');
    setView('reports'); // Reset to reports view
    setReports([]);
    setClients([]);
    setAssignments([]);
    setLoading(false);
  }

  // Sidebar JSX
  const navItems = [
    { key: 'reports', title: 'Reports' },
    ...(roles.includes('platform_admin') ? [{ key: 'admin', title: 'Admin' }] : []),
    ...(((permissions && (permissions.canManageUsers || permissions.canInviteUsers)) || (roles.includes('business_owner') || roles.includes('delegate'))) ? [{ key: 'settings', title: 'Settings' }] : [])
  ];

  const sidebar = (
    <Sidebar
      role={role}
      roles={roles}
      actingRole={actingRole}
      onActingRoleChange={setActingRole}
      navItems={navItems}
      currentNav={view}
      onNavSelect={setView}
      onLogout={handleLogout}
    />
  );

  // Main content JSX
  const mainContent = (
    <>
      {!role ? (
        <>
          {page === 'signup' && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: '.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: '500px' }}>
                <Signup onSignupSuccess={() => setPage('login')} />
              </div>
            </div>
          )}
          {page === 'verify-email' && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: '.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: '500px' }}>
                <VerifyEmail />
              </div>
            </div>
          )}
          {page === 'login' && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
              <div style={{ background: 'white', padding: '2rem', borderRadius: '.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
                <Login onLoginSuccess={onLoginSuccess} />
                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
                  Don't have an account? <a onClick={() => setPage('signup')} style={{ color: '#0078d4', textDecoration: 'none', cursor: 'pointer' }}>Sign up</a>
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <>
              {error && (
                <div style={{ padding: '1rem', marginBottom: '1rem', background: '#ffe6e6', color: '#c41e3a', border: '1px solid #c41e3a', borderRadius: '4px' }}>
                  <strong>Error:</strong> {error}
                </div>
              )}
              
              {view === 'reports' && (
                <>
                  {actingRole === 'manager' && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label>Assigned Client: </label>
                      <select
                        value={tenantId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTenantId(val);
                          localStorage.setItem('selected_tenant_id', val);
                          setTenantSelectTouched(true);
                          refreshReports(val);
                        }}
                        style={{ padding: '.5rem', minWidth: '200px' }}
                      >
                        <option value="">Select a client...</option>
                        {assignments.map(a => (
                          <option key={a.clientId} value={a.clientId}>{a.clientName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {actingRole === 'platform_admin' && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label>Client: </label>
                      <select
                        value={tenantId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTenantId(val);
                          localStorage.setItem('selected_tenant_id', val);
                          setTenantSelectTouched(true);
                          refreshReports(val);
                        }}
                        style={{ padding: '.5rem', minWidth: '200px' }}
                      >
                        <option value="">Select a client...</option>
                        {clients.map(c => (
                          <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {(['business_owner','delegate','viewer'].includes(actingRole)) && clients.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label>Client: </label>
                      {clients.length === 1 ? (
                        <strong style={{ marginLeft: '.5rem' }}>{clients[0].clientName}</strong>
                      ) : (
                        <select
                          value={tenantId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTenantId(val);
                            localStorage.setItem('selected_tenant_id', val);
                            setTenantSelectTouched(true);
                            refreshReports(val);
                          }}
                          style={{ padding: '.5rem', minWidth: '200px' }}
                        >
                          <option value="">Select a client...</option>
                          {clients.map(c => (
                            <option key={c.clientId} value={c.clientId}>{c.clientName}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  
                  {tenantId && (
                    <>
                      {/* Reports Content */}
                      {reportsTab === 'reports' && (
                        <>
                          {canCreateReports() && (
                            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f8ff', border: '1px solid #b0d4ff', borderRadius: '4px' }}>
                              <h4 style={{ marginTop: 0 }}>Create New Report</h4>
                              <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
                                <input
                                  type="text"
                                  placeholder="Report name"
                                  value={newReportName}
                                  onChange={e => setNewReportName(e.target.value)}
                                  style={{ padding: '.5rem', flex: 1, minWidth: '150px' }}
                                />
                                <button
                                  onClick={handleCreateReport}
                                  disabled={creatingReport || !newReportName.trim()}
                                  style={{
                                    padding: '.5rem 1rem',
                                    background: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {creatingReport ? 'Creating...' : 'Create Report'}
                                </button>
                              </div>
                            </div>
                          )}
                  
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Reports</h3>
                            <button onClick={refreshReports} style={{ padding: '.4rem .8rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Refresh</button>
                          </div>
                          <div style={{ marginTop: '1rem' }}>
                            {reports.map(r => {
                      const isEditing = editingReportId === r.id;
                      return (
                        <div key={r.id} style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem' }}>
                          {isEditing ? (
                            <div>
                              <div style={{ marginBottom: '.5rem' }}>
                                <label>Name: </label>
                                <input
                                  type="text"
                                  value={editReportName}
                                  onChange={e => setEditReportName(e.target.value)}
                                  style={{ padding: '.4rem', minWidth: '200px' }}
                                />
                              </div>
                              <div style={{ marginBottom: '.5rem' }}>
                                <label>Database Connection: </label>
                                <select
                                  value={editReportConnectionId}
                                  onChange={e => setEditReportConnectionId(e.target.value)}
                                  style={{ padding: '.4rem', minWidth: '200px' }}
                                >
                                  <option value="">None</option>
                                  {availableConnections?.map(conn => (
                                    <option key={conn.id} value={conn.id}>{conn.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div style={{ marginBottom: '.5rem' }}>
                                <label>SQL Query: </label>
                                <textarea
                                  value={editReportSqlQuery}
                                  onChange={e => setEditReportSqlQuery(e.target.value)}
                                  placeholder="SELECT * FROM your_table..."
                                  style={{ 
                                    padding: '.4rem', 
                                    width: '100%', 
                                    minHeight: '100px',
                                    fontFamily: 'monospace',
                                    fontSize: '0.85rem'
                                  }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.5rem', alignItems: 'center' }}>
                                <button
                                  onClick={() => handleExecuteQuery(editingReportId)}
                                  disabled={executingQuery === editingReportId || !editReportSqlQuery.trim() || !editReportConnectionId}
                                  title={!editReportConnectionId ? 'Select a database connection first' : !editReportSqlQuery.trim() ? 'Enter a SQL query first' : 'Execute the query'}
                                  style={{ padding: '.4rem .8rem', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: (executingQuery === editingReportId || !editReportSqlQuery.trim() || !editReportConnectionId) ? 'not-allowed' : 'pointer', opacity: (executingQuery === editingReportId || !editReportSqlQuery.trim() || !editReportConnectionId) ? 0.6 : 1 }}
                                >
                                  {executingQuery === editingReportId ? '⏳ Executing...' : '▶ Execute Query'}
                                </button>
                                {executingQuery === editingReportId && (
                                  <span style={{ fontSize: '0.85rem', color: '#17a2b8', fontStyle: 'italic' }}>
                                    ⏳ Query is running... Complex queries may take several minutes.
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                  <strong>{r.name}</strong> <em style={{ color: '#666' }}>({r.status})</em>
                                  {r.connectionId && <div style={{ fontSize: '.85em', color: '#666', marginTop: '.25rem' }}>Connection: {r.connectionId}</div>}
                                </div>
                                <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {(canEditReports() || canDeleteReports()) && (
                                    <div style={{ display: 'flex', gap: '.5rem' }}>
                                      {canEditReports() && (
                                        <button
                                          onClick={() => startEditingReport(r)}
                                          title="Edit report"
                                          style={{
                                            padding: '.4rem .6rem',
                                            background: '#007bff',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '1rem'
                                          }}
                                        >
                                          ✎ Edit
                                        </button>
                                      )}
                                      {canDeleteReports() && (
                                        <button
                                          onClick={() => handleDeleteClick(r.id)}
                                          disabled={deletingReportId === r.id}
                                          title="Delete report"
                                          style={{
                                            padding: '.4rem .6rem',
                                            background: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: deletingReportId === r.id ? 'not-allowed' : 'pointer',
                                            fontSize: '1rem',
                                            opacity: deletingReportId === r.id ? 0.6 : 1
                                          }}
                                        >
                                          {deletingReportId === r.id ? '⏳' : '🗑 Delete'}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Saved chart preview (read-only, uses saved config + cached results) */}
                              {(() => {
                                // Show saved chart only when the detailed results panel is collapsed to avoid duplicate charts
                                if (expandedResultsReportId === r.id) return null;
                                const chartData = buildChartData(r.id);
                                const hasRows = queryResults[r.id]?.data?.rows?.length;
                                if (!chartData || !hasRows) return null;
                                return (
                                  <div style={{ marginTop: '0.75rem', padding: '.75rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e3e9ef' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.5rem' }}>
                                      <strong style={{ fontSize: '0.95rem' }}>Saved Chart</strong>
                                      <span style={{ fontSize: '0.85rem', color: '#555' }}>Last run: {formatDateTime(queryResults[r.id]?.executedAt)}</span>
                                    </div>
                                    <ReportChart result={{ data: chartData }} />
                                  </div>
                                );
                              })()}
                            </>
                          )}
                          {/* Query Results */}
                          {expandedResultsReportId === r.id && queryResults[r.id] && (
                            <div style={{ marginTop: '1rem', padding: '.75rem', background: '#f0f8ff', border: '1px solid #b0d4ff', borderRadius: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.75rem' }}>
                                <h5 style={{ marginTop: 0, marginBottom: 0 }}>Query Results</h5>
                                {editingReportId === r.id && (
                                  <button
                                    onClick={() => setShowResultDetails(prev => ({ ...prev, [r.id]: !(prev[r.id] !== false) }))}
                                    style={{ padding: '.3rem .6rem', background: '#e1ecf4', color: '#055160', border: '1px solid #b6d4fe', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                                  >
                                    {showResultDetails[r.id] === false ? 'Show details' : 'Hide details'}
                                  </button>
                                )}
                              </div>
                              {queryResults[r.id]?.error ? (
                                <div style={{ color: '#c41e3a', padding: '.5rem', background: '#ffe6e6', borderRadius: '4px' }}>
                                  Error: {queryResults[r.id].error}
                                </div>
                              ) : queryResults[r.id]?.data?.rows ? (
                                <div>
                                  <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <span><strong>Rows:</strong> {queryResults[r.id].data.rows.length}</span>
                                    <span><strong>Executed:</strong> {formatDateTime(queryResults[r.id].executedAt)}</span>
                                    {queryResults[r.id].data.executionTimeMs && (
                                      <span><strong>Time:</strong> {queryResults[r.id].data.executionTimeMs}ms</span>
                                    )}
                                  </div>

                                  {showResultDetails[r.id] !== false && (
                                    <>
                                  {/* Raw Data Table */}
                                  <div style={{ marginBottom: '1rem' }}>
                                    <h6 style={{ marginTop: '.5rem', marginBottom: '.3rem' }}>Raw Data</h6>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                      <thead>
                                        <tr style={{ background: '#e8f4f8' }}>
                                          {queryResults[r.id].data.columns?.map((col, i) => (
                                            <th key={i} style={{ border: '1px solid #ccc', padding: '.4rem', textAlign: 'left' }}>{col}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {queryResults[r.id].data.rows?.slice(0, 10).map((row, idx) => (
                                          <tr key={idx}>
                                            {queryResults[r.id].data.columns?.map((col, i) => (
                                              <td key={i} style={{ border: '1px solid #eee', padding: '.4rem' }}>
                                                {String(row[col] ?? '').substring(0, 100)}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {queryResults[r.id].data.rows?.length > 10 && (
                                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '.5rem' }}>
                                        Showing 10 of {queryResults[r.id].data.rows.length} rows
                                      </div>
                                    )}
                                  </div>

                                  {/* Chart Configuration Section */}
                                  <div style={{ borderTop: '1px solid #b0d4ff', paddingTop: '.75rem', marginTop: '.75rem' }}>
                                    <h6 style={{ marginTop: 0, marginBottom: '.5rem' }}>Configure Chart Fields</h6>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '.5rem', marginBottom: '.75rem', padding: '.5rem', background: '#ffffff', borderRadius: '4px' }}>
                                      {queryResults[r.id].data.columns?.map((col, i) => (
                                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '.3rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                          <input
                                            type="checkbox"
                                            checked={chartFieldSelection[r.id]?.[col] || false}
                                            onChange={(e) => {
                                              setChartFieldSelection(prev => ({
                                                ...prev,
                                                [r.id]: {
                                                  ...prev[r.id],
                                                  [col]: e.target.checked
                                                }
                                              }));
                                            }}
                                          />
                                          <span>{col}</span>
                                        </label>
                                      ))}
                                    </div>

                                    {/* Chart Field Preview */}
                                    <div style={{ marginBottom: '.5rem' }}>
                                      <strong style={{ fontSize: '0.85rem' }}>Selected Fields Preview (first 5 rows):</strong>
                                      {Object.entries(chartFieldSelection[r.id] || {}).filter(([_, v]) => v).length > 0 ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginTop: '.3rem' }}>
                                          <thead>
                                            <tr style={{ background: '#d4e8f0' }}>
                                              {queryResults[r.id].data.columns
                                                ?.filter(col => chartFieldSelection[r.id]?.[col])
                                                ?.map((col, i) => (
                                                  <th key={i} style={{ border: '1px solid #ccc', padding: '.3rem', textAlign: 'left' }}>{col}</th>
                                                ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {queryResults[r.id].data.rows?.slice(0, 5).map((row, idx) => (
                                              <tr key={idx}>
                                                {queryResults[r.id].data.columns
                                                  ?.filter(col => chartFieldSelection[r.id]?.[col])
                                                  ?.map((col, i) => (
                                                    <td key={i} style={{ border: '1px solid #eee', padding: '.3rem' }}>
                                                      {String(row[col] ?? '').substring(0, 50)}
                                                    </td>
                                                  ))}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      ) : (
                                        <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '.3rem', padding: '.3rem', background: '#fffacd', borderRadius: '3px' }}>
                                          No fields selected. Please select at least one field to preview.
                                        </div>
                                      )}
                                    </div>

                                    {/* Chart type selector */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                                        <label style={{ fontSize: '0.85rem' }}>Chart Type:</label>
                                        <select
                                          value={chartTypeSelection[r.id] || 'bar'}
                                          onChange={(e) => setChartTypeSelection(prev => ({ ...prev, [r.id]: e.target.value }))}
                                          style={{ padding: '.3rem', minWidth: '140px' }}
                                        >
                                          <option value="bar">Bar</option>
                                          <option value="line">Line</option>
                                          <option value="pie">Pie</option>
                                          <option value="table">Table</option>
                                        </select>
                                      </div>
                                    </div>

                                    {/* Series configuration */}
                                    {(() => {
                                      const selectedFields = Object.entries(chartFieldSelection[r.id] || {}).filter(([_, v]) => v).map(([c]) => c);
                                      const rows = queryResults[r.id]?.data?.rows || [];

                                      // Use the same detection logic as buildChartData so UI matches rendered chart
                                      const normalizeKey = key => (key ?? '').toString().toLowerCase().replace(/[\s_]/g, '');
                                      const resolveFieldValue = (row, field) => {
                                        if (!row || !field) return undefined;
                                        if (Object.prototype.hasOwnProperty.call(row, field)) return row[field];
                                        const lowerMatch = Object.keys(row).find(k => k.toLowerCase() === field.toLowerCase());
                                        if (lowerMatch) return row[lowerMatch];
                                        const normTarget = normalizeKey(field);
                                        const normalizedMatch = Object.keys(row).find(k => normalizeKey(k) === normTarget);
                                        if (normalizedMatch) return row[normalizedMatch];
                                        return undefined;
                                      };

                                      let categoryField = null;
                                      let valueFields = [];

                                      for (const field of selectedFields) {
                                        const firstValue = resolveFieldValue(rows[0], field);
                                        const isNumeric = typeof firstValue === 'number' || !isNaN(parseFloat(firstValue));

                                        if (!isNumeric && !categoryField) {
                                          categoryField = field;
                                        } else {
                                          valueFields.push(field);
                                        }
                                      }

                                      if (!categoryField && selectedFields.length > 0) {
                                        categoryField = selectedFields[0];
                                        valueFields = selectedFields.slice(1);
                                      }

                                      if (valueFields.length === 0) return null;
                                      return (
                                        <div style={{ marginBottom: '.75rem', padding: '.5rem', background: '#f8f9fa', borderRadius: '4px' }}>
                                          <h6 style={{ margin: '0 0 .5rem 0', fontSize: '0.85rem' }}>Series Configuration</h6>
                                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '.75rem' }}>
                                            {valueFields.map(field => (
                                              <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', padding: '.5rem', background: '#fff', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>{field}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                                                  <label style={{ fontSize: '0.75rem', minWidth: '70px' }}>Display as:</label>
                                                  <input
                                                    type="text"
                                                    value={seriesDisplayNames[r.id]?.[field] || ''}
                                                    placeholder={field}
                                                    onChange={(e) => setSeriesDisplayNames(prev => ({
                                                      ...prev,
                                                      [r.id]: {
                                                        ...(prev[r.id] || {}),
                                                        [field]: e.target.value
                                                      }
                                                    }))}
                                                    style={{ padding: '.25rem', flex: 1, fontSize: '0.85rem' }}
                                                  />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                                                  <label style={{ fontSize: '0.75rem', minWidth: '70px' }}>Format:</label>
                                                  <select
                                                    value={seriesFormats[r.id]?.[field] || 'number'}
                                                    onChange={(e) => setSeriesFormats(prev => ({
                                                      ...prev,
                                                      [r.id]: {
                                                        ...(prev[r.id] || {}),
                                                        [field]: e.target.value
                                                      }
                                                    }))}
                                                    style={{ padding: '.25rem', flex: 1, fontSize: '0.85rem' }}
                                                  >
                                                    <option value="number">Number (5,962)</option>
                                                    <option value="number:1">Number (5,962.4)</option>
                                                    <option value="number:2">Number (5,962.42)</option>
                                                    <option value="currency">Currency ($5,962)</option>
                                                    <option value="currency:2">Currency ($5,962.42)</option>
                                                    <option value="percentage">Percentage (85%)</option>
                                                    <option value="percentage:2">Percentage (85.50%)</option>
                                                  </select>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Axis labels and display options */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.75rem', marginBottom: '.75rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                                        <label style={{ fontSize: '0.85rem' }}>X Axis Label:</label>
                                        <input
                                          type="text"
                                          value={(chartAxisLabels[r.id]?.x) ?? ''}
                                          onChange={e => setChartAxisLabels(prev => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), x: e.target.value } }))}
                                          placeholder="e.g. Employee"
                                          style={{ padding: '.3rem', minWidth: '140px' }}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                                        <label style={{ fontSize: '0.85rem' }}>Y Axis Label:</label>
                                        <input
                                          type="text"
                                          value={(chartAxisLabels[r.id]?.y) ?? ''}
                                          onChange={e => setChartAxisLabels(prev => ({ ...prev, [r.id]: { ...(prev[r.id] || {}), y: e.target.value } }))}
                                          placeholder="e.g. Ticket Count"
                                          style={{ padding: '.3rem', minWidth: '140px' }}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                                        <label style={{ fontSize: '0.85rem' }}>Show values on bars:</label>
                                        <input
                                          type="checkbox"
                                          checked={!!chartDisplayOptions[r.id]?.showValuesOnBars}
                                          onChange={e => setChartDisplayOptions(prev => ({
                                            ...prev,
                                            [r.id]: { ...(prev[r.id] || {}), showValuesOnBars: e.target.checked }
                                          }))}
                                        />
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                                        <label style={{ fontSize: '0.85rem' }}>Rotate labels 45°:</label>
                                        <input
                                          type="checkbox"
                                          checked={!!chartDisplayOptions[r.id]?.rotateCategoryLabels}
                                          onChange={e => setChartDisplayOptions(prev => ({
                                            ...prev,
                                            [r.id]: { ...(prev[r.id] || {}), rotateCategoryLabels: e.target.checked }
                                          }))}
                                        />
                                      </div>
                                    </div>

                                  </div>
                                  </>
                                  )}

                                  {/* Chart preview - always shown */}
                                  <div style={{ marginBottom: '.75rem', marginTop: '.75rem', padding: '.5rem', background: '#fff', borderRadius: '4px', border: '1px solid #e3e9ef' }}>
                                    <strong style={{ fontSize: '0.9rem' }}>Chart Preview</strong>
                                    <div style={{ marginTop: '.4rem' }}>
                                      {(() => {
                                        const chartData = buildChartData(r.id);
                                        if (!chartData) {
                                          return <div style={{ fontSize: '0.85rem', color: '#666' }}>Select at least one field to preview.</div>;
                                        }
                                        const selectedFields = Object.entries(chartFieldSelection[r.id] || {}).filter(([_, v]) => v).map(([c]) => c);
                                        return (
                                          <div style={{ display: 'grid', gap: '.5rem' }}>
                                            <ReportChart result={{ data: chartData }} />
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                {/* Save/Cancel for report + chart (while editing) */}
                                {editingReportId === r.id && (
                                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                                    <button
                                      onClick={() => handleSaveReportAndChart(r.id)}
                                      disabled={savingReport || savingChartConfig === r.id || executingQuery === editingReportId}
                                      style={{ padding: '.45rem .9rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: (savingReport || savingChartConfig === r.id || executingQuery === editingReportId) ? 'not-allowed' : 'pointer', opacity: (savingReport || savingChartConfig === r.id || executingQuery === editingReportId) ? 0.6 : 1 }}
                                    >
                                      {savingReport || savingChartConfig === r.id ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={cancelEditingReport}
                                      disabled={savingReport || savingChartConfig === r.id}
                                      style={{ padding: '.45rem .9rem', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: (savingReport || savingChartConfig === r.id) ? 'not-allowed' : 'pointer', opacity: (savingReport || savingChartConfig === r.id) ? 0.6 : 1 }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                                </div>
                              ) : (
                                <div>No results</div>
                              )}
                            </div>
                          )}
                        </div>
                            );
                            })}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {view === 'admin' && roles.includes('platform_admin') && (
        <AdminPanel />
      )}

      {view === 'settings' && (((permissions && (permissions.canManageUsers || permissions.canInviteUsers)) || (roles.includes('business_owner') || roles.includes('delegate')))) && clientInfo && (
        <ClientPanel clientId={clientInfo.id} clientName={clientInfo.name} />
      )}

      {showDeleteSnackbar && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          minWidth: '344px',
          maxWidth: '568px',
          background: '#323232',
          borderRadius: '4px',
          padding: '1rem 1.5rem',
          boxShadow: '0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{ color: '#ffffff', fontSize: '0.95rem', flex: 1 }}>
            Delete this report?
          </div>
          <div style={{ display: 'flex', gap: '.75rem', marginLeft: '1.5rem' }}>
            <button
              onClick={cancelDelete}
              style={{
                padding: '.5rem 1rem',
                background: '#616161',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '.875rem',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              style={{
                padding: '.5rem 1rem',
                background: '#d32f2f',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '.875rem',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  );

  return <MainLayout sidebar={role ? sidebar : null}>{mainContent}</MainLayout>
}
