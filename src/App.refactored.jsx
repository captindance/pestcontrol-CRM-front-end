import React, { useEffect, useState } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useReports } from './hooks/useReports.js';
import { usePermissions, useTenantState } from './hooks/usePermissions.js';
import { useCharts } from './hooks/useCharts.js';
import ReportChart from './components/ReportChart.jsx';
import Login from './components/Login.jsx';
import Signup from './components/Signup.jsx';
import VerifyEmail from './components/VerifyEmail.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import ClientPanel from './components/ClientPanel.jsx';
import DatabaseConnections from './components/DatabaseConnections.jsx';
import Sidebar from './components/Sidebar.jsx';
import MainLayout from './components/MainLayout.jsx';
import ReportsView from './components/ReportsView.jsx';

export default function App() {
  // Authentication state
  const auth = useAuth();
  
  // Tenant state
  const tenant = useTenantState();
  
  // Permissions and client info
  const permissions = usePermissions(tenant.tenantId, auth.roles);
  
  // Reports management
  const reports = useReports(tenant.tenantId);
  
  // Charts management
  const charts = useCharts();

  // Local UI state
  const [view, setView] = useState('reports');
  const [reportsTab, setReportsTab] = useState('reports');
  const [newReportName, setNewReportName] = useState('');
  const [editingReportId, setEditingReportId] = useState(null);
  const [editReportName, setEditReportName] = useState('');
  const [editReportConnectionId, setEditReportConnectionId] = useState('');
  const [editReportSqlQuery, setEditReportSqlQuery] = useState('');
  const [executingQuery, setExecutingQuery] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [showDeleteSnackbar, setShowDeleteSnackbar] = useState(false);

  // Load client info when tenant changes
  useEffect(() => {
    if (tenant.tenantId && auth.roles.length > 0) {
      permissions.loadClientInfo(auth.clients);
    }
  }, [tenant.tenantId, auth.roles, auth.clients, permissions.loadClientInfo]);

  // Auto-load saved results for reports with chart configurations
  useEffect(() => {
    if (reports.reports.length > 0) {
      charts.syncChartConfigFromServer(reports.reports);
      
      reports.reports.forEach(async (r) => {
        if (r.chartConfig && Object.keys(r.chartConfig.selectedFields || {}).length > 0) {
          try {
            const res = await reports.handleLoadSavedResults(r.id);
            if (res) {
              charts.setQueryResult(r.id, res);
              charts.expandResults(r.id);
              charts.toggleResultDetails(r.id, false);
            }
          } catch (err) {
            console.error(`Failed to auto-load results for report ${r.id}:`, err);
          }
        }
      });
    }
  }, [reports.reports, charts, reports.handleLoadSavedResults]);

  // Event handlers
  const handleCreateReport = async () => {
    const success = await reports.handleCreateReport(newReportName);
    if (success) {
      setNewReportName('');
    }
  };

  const startEditingReport = (report) => {
    setEditingReportId(report.id);
    setEditReportName(report.name);
    setEditReportConnectionId(report.connectionId || '');
    setEditReportSqlQuery(report.sqlQuery || '');
  };

  const handleExecuteQuery = async (reportId) => {
    setExecutingQuery(reportId);
    const result = await reports.handleExecuteQuery(reportId, editReportSqlQuery);
    
    if (result) {
      charts.setQueryResult(reportId, result);
      charts.expandResults(reportId);
      
      // Initialize chart fields if not already set
      if (result.data?.columns?.length) {
        charts.initializeChartFields(reportId, result.data.columns);
        charts.toggleResultDetails(reportId, true);
      }
    }
    
    setExecutingQuery(null);
  };

  const handleSaveReportAndChart = async (reportId) => {
    const success = await reports.handleUpdateReport(
      reportId,
      editReportName,
      editReportConnectionId || undefined,
      editReportSqlQuery || undefined
    );
    
    if (success) {
      const config = {
        selectedFields: charts.chartFieldSelection[reportId] || {},
        chartType: charts.chartTypeSelection[reportId] || 'bar',
        axisLabels: charts.chartAxisLabels[reportId] || {},
        displayOptions: charts.chartDisplayOptions[reportId] || {},
        seriesFormats: charts.seriesFormats[reportId] || {},
        seriesDisplayNames: charts.seriesDisplayNames[reportId] || {},
      };
      
      await charts.handleSaveChartConfig(reportId, config);
      
      setEditingReportId(null);
      setEditReportName('');
      setEditReportConnectionId('');
      setEditReportSqlQuery('');
      charts.expandResults(null);
      charts.toggleResultDetails(reportId, false);
    }
  };

  const handleDeleteClick = (id) => {
    setPendingDeleteId(id);
    setShowDeleteSnackbar(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      await reports.handleDeleteReport(pendingDeleteId);
      setPendingDeleteId(null);
      setShowDeleteSnackbar(false);
    }
  };

  // Navigation items for sidebar
  const navItems = [
    { key: 'reports', title: 'Reports' },
    ...(auth.roles.includes('platform_admin') ? [{ key: 'admin', title: 'Admin' }] : []),
    ...((permissions.canManageUsers() || auth.roles.includes('business_owner') || auth.roles.includes('delegate'))) 
      ? [{ key: 'settings', title: 'Settings' }] : []
  ];

  // Render different views
  if (!auth.isAuthenticated) {
    return (
      <>
        {auth.page === 'signup' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
            <div style={{ background: 'white', padding: '2rem', borderRadius: '.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: '500px' }}>
              <Signup onSignupSuccess={() => auth.setPage('login')} />
            </div>
          </div>
        )}
        {auth.page === 'verify-email' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
            <div style={{ background: 'white', padding: '2rem', borderRadius: '.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: '500px' }}>
              <VerifyEmail />
            </div>
          </div>
        )}
        {auth.page === 'login' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
            <div style={{ background: 'white', padding: '2rem', borderRadius: '.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
              <Login onLoginSuccess={auth.onLoginSuccess} />
              <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
                Don't have an account? <a onClick={() => auth.setPage('signup')} style={{ color: '#0078d4', textDecoration: 'none', cursor: 'pointer' }}>Sign up</a>
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  const sidebar = (
    <Sidebar
      role={auth.role}
      roles={auth.roles}
      actingRole={auth.actingRole}
      onActingRoleChange={auth.setActingRole}
      navItems={navItems}
      currentNav={view}
      onNavSelect={setView}
      onLogout={auth.handleLogout}
    />
  );

  const mainContent = (
    <>
      {auth.loading ? (
        <p>Loading...</p>
      ) : (
        <>
          {view === 'reports' && (
            <ReportsView
              tenantId={tenant.tenantId}
              actingRole={auth.actingRole}
              assignments={auth.assignments}
              clients={auth.clients}
              reports={reports.reports}
              availableConnections={reports.availableConnections}
              loading={reports.loading}
              loadingRun={reports.loadingRun}
              error={reports.error}
              queryResults={charts.queryResults}
              chartFieldSelection={charts.chartFieldSelection}
              chartTypeSelection={charts.chartTypeSelection}
              chartAxisLabels={charts.chartAxisLabels}
              chartDisplayOptions={charts.chartDisplayOptions}
              seriesFormats={charts.seriesFormats}
              seriesDisplayNames={charts.seriesDisplayNames}
              expandedResultsReportId={charts.expandedResultsReportId}
              showResultDetails={charts.showResultDetails}
              executingQuery={executingQuery}
              editingReportId={editingReportId}
              savingReport={reports.loading}
              deletingReportId={reports.loading}
              pendingDeleteId={pendingDeleteId}
              showDeleteSnackbar={showDeleteSnackbar}
              reportsTab={reportsTab}
              newReportName={newReportName}
              editReportName={editReportName}
              editReportConnectionId={editReportConnectionId}
              editReportSqlQuery={editReportSqlQuery}
              canManageConnections={permissions.canManageConnections}
              canCreateReports={permissions.canCreateReports}
              canEditReports={permissions.canEditReports}
              canDeleteReports={permissions.canDeleteReports}
              onTenantChange={tenant.setTenantId}
              onRefreshReports={reports.refreshReports}
              onRunReport={reports.handleRun}
              onSetReportsTab={setReportsTab}
              onSetNewReportName={setNewReportName}
              onCreateReport={handleCreateReport}
              onStartEditingReport={startEditingReport}
              onCancelEditingReport={() => {
                setEditingReportId(null);
                setEditReportName('');
                setEditReportConnectionId('');
                setEditReportSqlQuery('');
              }}
              onUpdateReport={async (id, name, connId, query) => {
                await reports.handleUpdateReport(id, name, connId, query);
                setEditingReportId(null);
                setEditReportName('');
                setEditReportConnectionId('');
                setEditReportSqlQuery('');
              }}
              onSaveReportAndChart={handleSaveReportAndChart}
              onDeleteClick={handleDeleteClick}
              onConfirmDelete={confirmDelete}
              onCancelDelete={() => {
                setShowDeleteSnackbar(false);
                setPendingDeleteId(null);
              }}
              onExecuteQuery={handleExecuteQuery}
              onLoadSavedResults={async (id) => {
                const result = await reports.handleLoadSavedResults(id);
                if (result) {
                  charts.setQueryResult(id, result);
                  charts.expandResults(id);
                }
              }}
              onSaveChartConfig={charts.handleSaveChartConfig}
              onUpdateChartFieldSelection={charts.updateChartFieldSelection}
              onUpdateChartTypeSelection={charts.updateChartTypeSelection}
              onUpdateChartAxisLabels={charts.updateChartAxisLabels}
              onUpdateChartDisplayOptions={charts.updateChartDisplayOptions}
              onUpdateSeriesFormats={charts.updateSeriesFormats}
              onUpdateSeriesDisplayNames={charts.updateSeriesDisplayNames}
              onToggleResultDetails={charts.toggleResultDetails}
              onExpandResults={charts.expandResults}
              onSetEditReportName={setEditReportName}
              onSetEditReportConnectionId={setEditReportConnectionId}
              onSetEditReportSqlQuery={setEditReportSqlQuery}
            />
          )}
          
          {view === 'admin' && auth.roles.includes('platform_admin') && (
            <AdminPanel />
          )}
          
          {view === 'settings' && (
            <ClientPanel
              clientInfo={permissions.clientInfo}
              canManageUsers={permissions.canManageUsers()}
            />
          )}
        </>
      )}
    </>
  );

  return (
    <MainLayout sidebar={sidebar}>
      {mainContent}
    </MainLayout>
  );
}