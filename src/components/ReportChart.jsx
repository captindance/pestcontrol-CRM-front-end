import React from 'react';

// Clean chart renderer (bar/line/pie/table)
export default function ReportChart({ result }) {
  if (!result?.data) return <div style={{ color: '#999' }}>Waiting for data...</div>;
  const { data } = result;
  const xLabel = typeof data.xLabel === 'string' ? data.xLabel.trim() : '';
  const yLabel = data.yLabel || 'Value';
  const formatMap = data.seriesFormats || {};
  const opts = data.displayOptions || {};

  if (data.type === 'table') {
    return (
      <div className="chart-container" data-chart-type="table" data-chart-ready="true">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{data.columns.map(c => <th key={c} style={{ border: '1px solid #ccc', padding: '4px' }}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {data.rows.map((row, idx) => (
              <tr key={idx}>{row.map((cell, i) => <td key={i} style={{ border: '1px solid #eee', padding: '4px' }}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const categories = data.categories || [];
  const series = data.series || [];
  
  console.log('[ReportChart] Categories:', categories);
  console.log('[ReportChart] Series:', series);
  
  const numericValues = series
    .flatMap(s => s.data || [])
    .map(v => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    });
  const seriesMaxValues = series.map(s => {
    const nums = (s.data || []).map(v => Number.isFinite(Number(v)) ? Number(v) : 0);
    const max = nums.length ? Math.max(...nums) : 0;
    return Math.max(1, max);
  });
  const sharedMax = Math.max(1, ...seriesMaxValues, 1);
  const minSeriesMax = seriesMaxValues.length ? Math.max(1, Math.min(...seriesMaxValues)) : 1;
  const useSeparateScale = sharedMax / minSeriesMax > 20;

  if (data.type === 'bar') {
    return (
      <div className="chart-container" data-chart-type="bar" data-chart-ready="true" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '100%' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: '#555', fontSize: '0.85rem', minWidth: '20px', textAlign: 'center' }}>{yLabel}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e3e9ef', borderRadius: '6px', overflowX: 'auto', maxWidth: '100%' }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                {categories.map((cat, idx) => {
                  const barWidth = series.length === 1 ? 36 : 28;
                  const barGap = 8;
                  const totalBarWidth = series.length * barWidth + (series.length - 1) * barGap;
                  
                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: Math.max(totalBarWidth, 80) }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: `${barGap}px`, height: '300px', width: '100%', overflow: 'visible', paddingTop: '60px' }}>
                        {series.map((s, si) => {
                          const val = Number(s.data[idx]);
                          const numVal = Number.isFinite(val) ? val : 0;
                          const denom = useSeparateScale ? (seriesMaxValues[si] || 1) : sharedMax;
                          const height = (numVal / denom) * 100;
                          const formattedVal = formatValue(val, formatMap[s.name]);
                          
                          // Simple rule: if bar is tall enough (>= 50px height), label goes inside; otherwise above
                          const canFitInside = height >= 50;
                          
                          return (
                            <div
                              key={si}
                              title={`${s.name}: ${formattedVal}`}
                              style={{
                                width: `${barWidth}px`,
                                height: `${height}%`,
                                minHeight: numVal > 0 ? '6px' : '0px',
                                background: palette(si),
                                borderRadius: '4px 4px 0 0',
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center'
                              }}
                            >
                              {opts.showValuesOnBars && numVal > 0 && (
                                canFitInside ? (
                                  <span style={{ 
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%) rotate(-90deg)',
                                    fontSize: '1.35rem', 
                                    color: '#fff', 
                                    fontWeight: 700, 
                                    textShadow: '0 2px 6px rgba(0,0,0,0.75)',
                                    whiteSpace: 'nowrap',
                                    pointerEvents: 'none',
                                    letterSpacing: '0.04em',
                                    fontFamily: 'Segoe UI, Arial, sans-serif',
                                    fontVariantNumeric: 'tabular-nums'
                                  }}>
                                    {formattedVal}
                                  </span>
                                ) : (
                                  <span style={{ 
                                    position: 'absolute', 
                                    top: '-50px', 
                                    fontSize: '1.05rem', 
                                    color: '#111',
                                    background: 'rgba(255,255,255,0.98)',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    padding: '3px 7px',
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                    letterSpacing: '0.03em',
                                    fontFamily: 'Segoe UI, Arial, sans-serif',
                                    fontVariantNumeric: 'tabular-nums'
                                  }}>
                                    {formattedVal}
                                  </span>
                                )
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{
                        marginTop: '12px',
                        fontSize: '0.8rem',
                        color: '#555',
                        textAlign: 'center',
                        maxWidth: '140px',
                        wordBreak: 'break-word',
                        lineHeight: '1.2',
                        transform: opts.rotateCategoryLabels ? 'rotate(-45deg)' : 'none',
                        transformOrigin: opts.rotateCategoryLabels ? 'center top' : 'center'
                      }} title={cat}>
                        {formatCategoryLabel(cat)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Legend series={series} style={{ marginTop: '16px' }} />
              {useSeparateScale && (
                <div style={{ marginTop: '8px', fontSize: '0.82rem', color: '#666' }}>
                  Note: Series are scaled independently for visibility; bar heights are not cross-comparable.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (data.type === 'line') {
    return (
      <div className="chart-container" data-chart-type="line" data-chart-ready="true">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', fontSize: '0.85rem', color: '#555' }}>
          <span>Categories:</span>
          <span>{categories.join(' | ')}</span>
        </div>
        {series.map((s, si) => (
          <div key={si} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <div style={{ width: '10px', height: '10px', background: palette(si), borderRadius: '2px' }} />
              <strong style={{ fontSize: '0.9rem' }}>{s.name}</strong>
            </div>
            <Sparkline data={s.data} color={palette(si)} />
          </div>
        ))}
      </div>
    );
  }

  if (data.type === 'pie') {
    const total = series[0]?.data?.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) || 0;
    return (
      <div className="chart-container" data-chart-type="pie" data-chart-ready="true" style={{ display: 'grid', gap: '6px' }}>
        {categories.map((cat, idx) => {
          const rawVal = Number.isFinite(series[0]?.data[idx]) ? series[0].data[idx] : 0;
          const pct = total ? ((rawVal / total) * 100).toFixed(1) : '0.0';
          const valLabel = formatValue(rawVal, formatMap[series[0]?.name]);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', background: palette(idx), borderRadius: '2px' }} />
              <div style={{ fontSize: '0.9rem' }}>{cat}</div>
              <div style={{ fontSize: '0.85rem', color: '#555' }}>{valLabel} ({pct}%)</div>
            </div>
          );
        })}
      </div>
    );
  }

  return <div style={{ color: '#999' }}>Unsupported chart type.</div>;
}

function palette(i) {
  const colors = ['#2f80ed', '#27ae60', '#f2994a', '#9b51e0', '#eb5757', '#219653', '#f2c94c'];
  return colors[i % colors.length];
}

function Sparkline({ data, color }) {
  const nums = (data || []).map(v => (Number.isFinite(v) ? v : 0));
  const max = Math.max(1, ...nums);
  const points = nums.map((v, idx) => {
    const x = (idx / Math.max(1, nums.length - 1)) * 100;
    const y = 100 - (v / max) * 100;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '60px', background: '#f7f9fb', border: '1px solid #e3e9ef', borderRadius: '4px' }}>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}

function Legend({ series, style }) {
  if (!series?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.85rem', color: '#555', ...style }}>
      {series.map((s, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '12px', height: '12px', background: palette(idx), borderRadius: '2px' }} />
          <span>{s.name || `Series ${idx + 1}`}</span>
        </div>
      ))}
    </div>
  );
}

function formatValue(val, fmt) {
  if (!Number.isFinite(val)) return val;
  
  // Parse format string: "currency:2" or "percentage:1" or just "currency"
  const [formatType, decimalsStr] = (fmt || 'number').split(':');
  const decimals = decimalsStr ? parseInt(decimalsStr, 10) : undefined;
  
  if (formatType === 'currency') {
    const decimalPlaces = decimals !== undefined ? decimals : 0;
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces 
    }).format(val);
  }
  
  if (formatType === 'percentage') {
    const decimalPlaces = decimals !== undefined ? decimals : 1;
    return new Intl.NumberFormat('en-US', { 
      style: 'decimal',
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces 
    }).format(val) + '%';
  }
  
  // Plain number with thousand separators
  const decimalPlaces = decimals !== undefined ? decimals : 0;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces
  }).format(val);
}

function formatCategoryLabel(cat) {
  // If category looks like a large decimal number, truncate/format it
  const asNumber = parseFloat(cat);
  if (Number.isFinite(asNumber) && Math.abs(asNumber) > 100 && cat.includes('.')) {
    // It's a numeric value being used as category - format it nicely
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2
    }).format(asNumber);
  }
  return cat;
}
