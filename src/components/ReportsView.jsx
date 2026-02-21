import React, { useState, useEffect } from 'react';
import ReportChart from './ReportChart.jsx';
import ScheduleModal from './ScheduleModal.jsx';
import { formatDateTime as formatDisplayDateTime } from '../utils/timeFormatting.js';

export default function ReportsView({
  tenantId,
  actingRole,
  assignments,
  clients,
  reports,
  availableConnections,
  loading,
  loadingRun,
  error,
  queryResults,
  chartFieldSelection,
  chartTypeSelection,
  chartAxisLabels,
  chartDisplayOptions,
  seriesFormats,
  seriesDisplayNames,
  expandedResultsReportId,
  showResultDetails,
  executingQuery,
  editingReportId,
  savingReport,
  deletingReportId,
  pendingDeleteId,
  showDeleteSnackbar,
  reportsTab,
  newReportName,
  editReportName,
  editReportConnectionId,
  editReportSqlQuery,
  canManageConnections,
  canCreateReports,
  canEditReports,
  canDeleteReports,
  onTenantChange,
  onRefreshReports,
  onRunReport,
  onSetReportsTab,
  onSetNewReportName,
  onCreateReport,
  onStartEditingReport,
  onCancelEditingReport,
  onUpdateReport,
  onSaveReportAndChart,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  onExecuteQuery,
  onLoadSavedResults,
  onSaveChartConfig,
  onUpdateChartFieldSelection,
  onUpdateChartTypeSelection,
  onUpdateChartAxisLabels,
  onUpdateChartDisplayOptions,
  onUpdateSeriesFormats,
  onUpdateSeriesDisplayNames,
  onToggleResultDetails,
  onExpandResults,
  onSetEditReportName,
  onSetEditReportConnectionId,
  onSetEditReportSqlQuery,
  showToast,
  currentUserId,
  userRole
}) {
  const [scheduleModalOpen, setScheduleModalOpen] = useState(null); // reportId when open

  const formatRunDateTime = (value) => formatDisplayDateTime(value) || 'Never';

  const buildChartData = (reportId) => {
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

    let categoryField = null;
    let valueFields = [];
    
    for (const field of selected) {
      const firstValue = resolveFieldValue(rows[0], field);
      const isNumeric = typeof firstValue === 'number' || !isNaN(parseFloat(firstValue));
      
      if (!isNumeric && !categoryField) {
        categoryField = field;
      } else {
        valueFields.push(field);
      }
    }
    
    if (!categoryField && selected.length > 0) {
      categoryField = selected[0];
      valueFields = selected.slice(1);
    }

    if (!categoryField) return null;

    const categories = rows.map(row => String(resolveFieldValue(row, categoryField) ?? ''));

    const series = valueFields.map(field => {
      const data = rows.map(row => {
        const val = resolveFieldValue(row, field);
        return typeof val === 'number' ? val : parseFloat(val) || 0;
      });
      const displayName = seriesDisplayNames[reportId]?.[field] || field;
      return { name: displayName, originalName: field, data };
    });

    let useSeparateScale = false;
    if (series.length > 1) {
      const maxVals = series.map(s => Math.max(...s.data, 0));
      const minMax = Math.min(...maxVals.filter(v => v > 0));
      const bigMax = Math.max(...maxVals);
      if (bigMax > minMax * 20) {
        useSeparateScale = true;
      }
    }

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
  };

  return (
    <>
      {error && (
        <div style={{ padding: '1rem', marginBottom: '1rem', background: '#ffe6e6', color: '#c41e3a', border: '1px solid #c41e3a', borderRadius: '4px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {actingRole === 'manager' && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Assigned Client: </label>
          <select
            value={tenantId}
            onChange={(e) => {
              const val = e.target.value;
              onTenantChange(val);
              onRefreshReports(val);
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
              onTenantChange(val);
              onRefreshReports(val);
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
                onTenantChange(val);
                onRefreshReports(val);
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
          {canManageConnections && (
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', borderBottom: '2px solid #dee2e6' }}>
              <button
                onClick={() => onSetReportsTab('reports')}
                style={{
                  padding: '.75rem 1.5rem',
                  background: 'transparent',
                  color: reportsTab === 'reports' ? '#007bff' : '#6c757d',
                  border: 'none',
                  borderBottom: reportsTab === 'reports' ? '3px solid #007bff' : '3px solid transparent',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: reportsTab === 'reports' ? 'bold' : 'normal',
                  transition: 'all 0.2s'
                }}
              >
                Reports
              </button>
              <button
                onClick={() => onSetReportsTab('connections')}
                style={{
                  padding: '.75rem 1.5rem',
                  background: 'transparent',
                  color: reportsTab === 'connections' ? '#007bff' : '#6c757d',
                  border: 'none',
                  borderBottom: reportsTab === 'connections' ? '3px solid #007bff' : '3px solid transparent',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: reportsTab === 'connections' ? 'bold' : 'normal',
                  transition: 'all 0.2s'
                }}
              >
                Database Connections
              </button>
            </div>
          )}

          {reportsTab === 'reports' && (
            <>
              {canCreateReports && (
                <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f0f8ff', border: '1px solid #b0d4ff', borderRadius: '4px' }}>
                  <h4 style={{ marginTop: 0 }}>Create New Report</h4>
                  <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
                    <input
                      type="text"
                      placeholder="Report name"
                      value={newReportName}
                      onChange={e => onSetNewReportName(e.target.value)}
                      style={{ padding: '.5rem', flex: 1, minWidth: '150px' }}
                    />
                    <button
                      onClick={onCreateReport}
                      disabled={savingReport || !newReportName.trim()}
                      style={{
                        padding: '.5rem 1rem',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {savingReport ? 'Creating...' : 'Create Report'}
                    </button>
                  </div>
                </div>
              )}
       
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Reports</h3>
                <button onClick={onRefreshReports} style={{ padding: '.4rem .8rem', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Refresh</button>
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
                              onChange={e => onSetEditReportName(e.target.value)}
                              style={{ padding: '.4rem', minWidth: '200px' }}
                            />
                          </div>
                          <div style={{ marginBottom: '.5rem' }}>
                            <label>Database Connection: </label>
                            <select
                              value={editReportConnectionId}
                              onChange={e => onSetEditReportConnectionId(e.target.value)}
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
                              onChange={e => onSetEditReportSqlQuery(e.target.value)}
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
                              onClick={() => onExecuteQuery(editingReportId)}
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
                                      onClick={() => onStartEditingReport(r)}
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
                                  <button
                                    onClick={() => setScheduleModalOpen(r.id)}
                                    title="Schedule this report to be emailed automatically"
                                    style={{
                                      padding: '.4rem .6rem',
                                      background: '#17a2b8',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '1rem'
                                    }}
                                  >
                                    📅 Schedule
                                  </button>
                                  {canDeleteReports() && (
                                    <button
                                      onClick={() => onDeleteClick(r.id)}
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

                          {(() => {
                            if (expandedResultsReportId === r.id) return null;
                            const chartData = buildChartData(r.id);
                            const hasRows = queryResults[r.id]?.data?.rows?.length;
                            if (!chartData || !hasRows) return null;
                            return (
                              <div style={{ marginTop: '0.75rem', padding: '.75rem', background: '#ffffff', borderRadius: '6px', border: '1px solid #e3e9ef' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.5rem' }}>
                                  <strong style={{ fontSize: '0.95rem' }}>Saved Chart</strong>
                                  <span style={{ fontSize: '0.85rem', color: '#555', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <span>Last run: {formatRunDateTime(queryResults[r.id]?.executedAt)}</span>
                                    {queryResults[r.id]?.data?.rows?.length > 0 && (
                                      <span>· Rows: {queryResults[r.id].data.rows.length}</span>
                                    )}
                                    {queryResults[r.id]?.data?.executionTimeMs > 0 && (
                                      <span>· Duration: {queryResults[r.id].data.executionTimeMs} ms</span>
                                    )}
                                  </span>
                                </div>
                                <ReportChart result={{ data: chartData }} />
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {showDeleteSnackbar && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#333',
          color: 'white',
          padding: '1rem 2rem',
          borderRadius: '4px',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <span>Are you sure you want to delete this report?</span>
          <button
            onClick={onConfirmDelete}
            disabled={deletingReportId === pendingDeleteId}
            style={{
              padding: '.4rem .8rem',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: deletingReportId === pendingDeleteId ? 'not-allowed' : 'pointer'
            }}
          >
            {deletingReportId === pendingDeleteId ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={onCancelDelete}
            style={{
              padding: '.4rem .8rem',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      )}
      
      {/* Schedule Modal */}
      {scheduleModalOpen && (
        <ScheduleModal
          reportId={scheduleModalOpen}
          reportName={reports.find(r => r.id === scheduleModalOpen)?.name || 'Unknown Report'}
          onClose={() => setScheduleModalOpen(null)}
          showToast={showToast}
          currentUserId={currentUserId}
          userRole={userRole || actingRole}
        />
      )}
    </>
  );
}
