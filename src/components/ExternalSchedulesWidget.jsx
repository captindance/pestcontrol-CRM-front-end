import React, { useState, useEffect } from 'react';
import { getExternalSchedules } from '../api.js';
import { formatDateTime, formatTimeDisplay } from '../utils/timeFormatting.js';

const FREQ_LABELS = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
  quarterly: 'Quarterly', semi_annually: 'Semi-Annually', annually: 'Annually'
};

export default function ExternalSchedulesWidget({ showToast }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExternalSchedules();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadExternalSchedules, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadExternalSchedules() {
    try {
      setLoading(true);
      const data = await getExternalSchedules();
      if (data.error) {
        console.error('Failed to load external schedules:', data.error);
        showToast?.('Failed to load external schedules widget', 'error');
        setSchedules([]);
      } else {
        setSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error('Failed to load external schedules:', error);
      showToast?.('Failed to load external schedules widget', 'error');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="widget external-schedules-widget">
        <h3>🌐 Schedules with External Recipients</h3>
        <div className="widget-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="widget external-schedules-widget">
      <div className="widget-header">
        <h3>🌐 Schedules with External Recipients</h3>
        <span className="widget-count">{schedules.length}</span>
      </div>
      
      {schedules.length === 0 ? (
        <div className="widget-empty">
          <p>No schedules with external recipients</p>
        </div>
      ) : (
        <div className="widget-content">
          <table className="external-schedules-table">
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Report</th>
                <th>Created By</th>
                <th>External Recipients</th>
                <th>Frequency</th>
                <th>Next Run</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(schedule => (
                <tr key={schedule.id}>
                  <td>
                    <strong>{schedule.name}</strong>
                  </td>
                  <td>{schedule.reportName}</td>
                  <td>
                    <div className="creator-info">
                      <div>{schedule.createdBy.name}</div>
                      <div className="creator-email">{schedule.createdBy.email}</div>
                    </div>
                  </td>
                  <td>
                    <div className="external-recipients">
                      <span className="recipient-count">{schedule.externalCount}</span>
                      <div className="recipient-list">
                        {schedule.externalRecipients.map(email => (
                          <div key={email} className="recipient-email">
                            🌐 {email}
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="frequency-badge">{FREQ_LABELS[schedule.frequency] || schedule.frequency}</span>
                    {schedule.timeOfDay && (
                      <div style={{ fontSize: '0.8em', color: '#9ca3af', marginTop: '2px' }}>
                        at {formatTimeDisplay(schedule.timeOfDay)}
                      </div>
                    )}
                  </td>
                  <td>
                    {schedule.nextRunAt ? (
                      <span className="next-run">{formatDateTime(schedule.nextRunAt)}</span>
                    ) : (
                      <span className="no-run">Not scheduled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="widget-footer">
        <button onClick={loadExternalSchedules} className="btn-refresh">
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}
