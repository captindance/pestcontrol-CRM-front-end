import { useState, useCallback, useEffect } from 'react';
import { 
  getReports, 
  runReport, 
  getReportResult, 
  createReport, 
  updateReport, 
  deleteReport,
  executeQuery,
  getQueryResults,
  saveChartConfig
} from '../api.js';

export function useReports(tenantId) {
  const [reports, setReports] = useState([]);
  const [results, setResults] = useState({});
  const [availableConnections, setAvailableConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRun, setLoadingRun] = useState(null);
  const [error, setError] = useState(null);

  const refreshReports = useCallback(async (selectedTenantId = tenantId) => {
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
      if (Array.isArray(list)) {
        setReports(list);
        setAvailableConnections([]);
      } else if (list?.reports) {
        setReports(list.reports);
        setAvailableConnections(list.availableConnections || []);
      } else {
        setReports([]);
        setAvailableConnections([]);
      }
    }
    setLoading(false);
  }, [tenantId]);

  const handleRun = useCallback(async (id) => {
    setLoadingRun(id);
    await runReport(id);
    setLoadingRun(null);
    setTimeout(() => fetchResult(id), 1700);
  }, []);

  const fetchResult = useCallback(async (id) => {
    const result = await getReportResult(id);
    if (result?.error) {
      setError(result.error);
    } else if (result) {
      setResults(r => ({ ...r, [id]: result }));
    }
    refreshReports();
  }, [refreshReports]);

  const handleCreateReport = useCallback(async (reportName) => {
    if (!reportName.trim()) {
      setError('Report name is required');
      return false;
    }
    
    setLoading(true);
    const res = await createReport(reportName);
    setLoading(false);
    
    if (res?.error) {
      setError('Failed to create report: ' + res.error);
      return false;
    } else {
      setError(null);
      await refreshReports();
      return true;
    }
  }, [refreshReports]);

  const handleUpdateReport = useCallback(async (reportId, reportName, connectionId, sqlQuery) => {
    if (!reportName.trim()) {
      setError('Report name is required');
      return false;
    }
    
    setLoading(true);
    const res = await updateReport(reportId, reportName, connectionId || undefined, sqlQuery || undefined);
    setLoading(false);
    
    if (res?.error) {
      setError('Failed to update report: ' + res.error);
      return false;
    } else {
      setError(null);
      await refreshReports();
      return true;
    }
  }, [refreshReports]);

  const handleDeleteReport = useCallback(async (reportId) => {
    setLoading(true);
    const res = await deleteReport(reportId);
    setLoading(false);
    
    if (res?.error) {
      setError('Failed to delete report: ' + res.error);
      return false;
    } else {
      setError(null);
      await refreshReports();
      return true;
    }
  }, [refreshReports]);

  const handleExecuteQuery = useCallback(async (reportId, sqlQuery) => {
    if (!sqlQuery.trim()) {
      setError('Please enter a SQL query');
      return null;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await executeQuery(reportId, sqlQuery);
      
      if (res?.error) {
        let errorMsg = res.error;
        if (res?.body) {
          try {
            const parsed = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
            errorMsg = parsed?.error || res.body;
          } catch (e) {
            errorMsg = res.body;
          }
        }
        setError(`Query execution failed: ${errorMsg}`);
        return null;
      }
      
      if (res?.success && res?.rows !== undefined && res?.columns) {
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
        
        return resultData;
      } else {
        setError('Query executed but response was invalid. Check browser console.');
        return null;
      }
    } catch (err) {
      setError(`Query execution error: ${err.message || 'Unknown error'}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoadSavedResults = useCallback(async (reportId) => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await getQueryResults(reportId);
      if (res?.error) {
        setError(`Failed to load saved results: ${res.error}`);
        return null;
      }
      if (!res?.data?.rows) {
        setError(res?.message || 'No saved results available for this report.');
        return null;
      }

      const resultData = {
        executedAt: res.executedAt || new Date().toISOString(),
        data: res.data,
        error: res.error || null,
      };

      return resultData;
    } catch (err) {
      setError(`Error loading saved results: ${err?.message || 'Unknown error'}`);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveChartConfig = useCallback(async (reportId, config) => {
    setLoading(true);
    try {
      const res = await saveChartConfig(reportId, config);
      if (res?.error) {
        setError(`Failed to save chart configuration: ${res.error}`);
        return false;
      } else {
        setError(null);
        return true;
      }
    } catch (err) {
      setError(`Error saving chart configuration: ${err.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenantId) {
      refreshReports();
    }
  }, [tenantId, refreshReports]);

  return {
    reports,
    results,
    availableConnections,
    loading,
    loadingRun,
    error,
    refreshReports,
    handleRun,
    fetchResult,
    handleCreateReport,
    handleUpdateReport,
    handleDeleteReport,
    handleExecuteQuery,
    handleLoadSavedResults,
    handleSaveChartConfig,
    clearError: () => setError(null)
  };
}