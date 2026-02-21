import React, { useState, useEffect } from 'react';
import { getDashboardStats } from '../api.js';

export default function DashboardStatsWidget({ showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadStats() {
    try {
      setLoading(true);
      const data = await getDashboardStats();
      if (data.error) {
        console.error('Failed to load dashboard stats:', data.error);
        showToast?.('Failed to load dashboard stats', 'error');
        setStats(null);
      } else {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
      showToast?.('Failed to load dashboard stats', 'error');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="widget stats-widget"><div className="widget-loading">Loading...</div></div>;
  }

  if (!stats) {
    return <div className="widget stats-widget"><div className="widget-empty">Failed to load stats</div></div>;
  }

  return (
    <div className="widget stats-widget">
      <h3>Schedule Statistics</h3>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalSchedules}</div>
          <div className="stat-label">Total Schedules</div>
        </div>
        <div className="stat-card">
          <div className="stat-value active">{stats.activeSchedules}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{stats.externalSchedules}</div>
          <div className="stat-label">🌐 External Recipients</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.recentExecutions}</div>
          <div className="stat-label">Executions (7 days)</div>
        </div>
      </div>
    </div>
  );
}
