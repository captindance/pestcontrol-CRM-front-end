import { useState, useCallback } from 'react';

export function useCharts() {
  const [chartFieldSelection, setChartFieldSelection] = useState({});
  const [chartTypeSelection, setChartTypeSelection] = useState({});
  const [reportChartConfig, setReportChartConfig] = useState({});
  const [chartAxisLabels, setChartAxisLabels] = useState({});
  const [chartDisplayOptions, setChartDisplayOptions] = useState({});
  const [seriesFormats, setSeriesFormats] = useState({});
  const [seriesDisplayNames, setSeriesDisplayNames] = useState({});
  const [queryResults, setQueryResults] = useState({});
  const [expandedResultsReportId, setExpandedResultsReportId] = useState(null);
  const [showResultDetails, setShowResultDetails] = useState({});
  const [savingChartConfig, setSavingChartConfig] = useState(null);
  const [loadingSavedResults, setLoadingSavedResults] = useState(null);

  const updateChartFieldSelection = useCallback((reportId, fields) => {
    setChartFieldSelection(prev => ({ ...prev, [reportId]: fields }));
  }, []);

  const updateChartTypeSelection = useCallback((reportId, chartType) => {
    setChartTypeSelection(prev => ({ ...prev, [reportId]: chartType }));
  }, []);

  const updateChartAxisLabels = useCallback((reportId, axisLabels) => {
    setChartAxisLabels(prev => ({ ...prev, [reportId]: axisLabels }));
  }, []);

  const updateChartDisplayOptions = useCallback((reportId, displayOptions) => {
    setChartDisplayOptions(prev => ({ ...prev, [reportId]: displayOptions }));
  }, []);

  const updateSeriesFormats = useCallback((reportId, formats) => {
    setSeriesFormats(prev => ({ ...prev, [reportId]: formats }));
  }, []);

  const updateSeriesDisplayNames = useCallback((reportId, displayNames) => {
    setSeriesDisplayNames(prev => ({ ...prev, [reportId]: displayNames }));
  }, []);

  const setQueryResult = useCallback((reportId, result) => {
    setQueryResults(prev => ({ ...prev, [reportId]: result }));
  }, []);

  const toggleResultDetails = useCallback((reportId, show) => {
    setShowResultDetails(prev => ({ ...prev, [reportId]: show }));
  }, []);

  const expandResults = useCallback((reportId) => {
    setExpandedResultsReportId(reportId);
  }, []);

  const buildChartData = useCallback((reportId) => {
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
  }, [queryResults, chartFieldSelection, chartTypeSelection, chartAxisLabels, chartDisplayOptions, seriesFormats, seriesDisplayNames]);

  const initializeChartFields = useCallback((reportId, columns) => {
    if (!columns || columns.length === 0) return;
    
    const allFields = {};
    columns.forEach(col => {
      allFields[col] = true;
    });
    
    updateChartFieldSelection(reportId, allFields);
    updateChartTypeSelection(reportId, 'bar');
    updateChartDisplayOptions(reportId, {
      showValuesOnBars: true,
      rotateCategoryLabels: false
    });
  }, [updateChartFieldSelection, updateChartTypeSelection, updateChartDisplayOptions]);

  const syncChartConfigFromServer = useCallback((reports) => {
    const newFieldSelection = { ...chartFieldSelection };
    const newChartTypeSelection = { ...chartTypeSelection };
    const newReportChartConfig = { ...reportChartConfig };
    const newAxisLabels = { ...chartAxisLabels };
    const newDisplayOptions = { ...chartDisplayOptions };
    const newSeriesFormats = { ...seriesFormats };
    const newSeriesDisplayNames = { ...seriesDisplayNames };
    
    reports.forEach(r => {
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
  }, [chartFieldSelection, chartTypeSelection, reportChartConfig, chartAxisLabels, chartDisplayOptions, seriesFormats, seriesDisplayNames]);

  return {
    chartFieldSelection,
    chartTypeSelection,
    reportChartConfig,
    chartAxisLabels,
    chartDisplayOptions,
    seriesFormats,
    seriesDisplayNames,
    queryResults,
    expandedResultsReportId,
    showResultDetails,
    savingChartConfig,
    loadingSavedResults,
    setSavingChartConfig,
    setLoadingSavedResults,
    updateChartFieldSelection,
    updateChartTypeSelection,
    updateChartAxisLabels,
    updateChartDisplayOptions,
    updateSeriesFormats,
    updateSeriesDisplayNames,
    setQueryResult,
    toggleResultDetails,
    expandResults,
    buildChartData,
    initializeChartFields,
    syncChartConfigFromServer
  };
}