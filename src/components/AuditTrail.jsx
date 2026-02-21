import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../api.js';
import { formatDateTime } from '../utils/timeFormatting.js';

export default function AuditTrail({ scheduleId, showToast }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadLogs();
  }, [scheduleId, days]);

  async function loadLogs() {
    try {
      setLoading(true);
      const data = await getAuditLogs(scheduleId, days);
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
      showToast?.('Failed to load audit trail', 'error');
    } finally {
      setLoading(false);
    }
  }

  function formatAction(action) {
    const actionMap = {
      'SCHEDULE_CREATED': 'Created schedule',
      'SCHEDULE_CREATED_WITH_EXTERNAL': '⚠️ Created schedule with external recipients',
      'SCHEDULE_RECIPIENTS_CHANGED': 'Changed recipients',
      'SCHEDULE_EXTERNAL_RECIPIENT_ADDED': '⚠️ Added external recipient',
      'SCHEDULE_EXTERNAL_RECIPIENT_REMOVED': 'Removed external recipient',
      'SCHEDULE_UPDATED': 'Updated schedule',
      'SCHEDULE_DELETED': 'Deleted schedule',
      'SCHEDULE_PERMISSION_GRANTED': 'Granted scheduling permission',
      'SCHEDULE_PERMISSION_REVOKED': 'Revoked scheduling permission'
    };
    return actionMap[action] || action;
  }

  function renderDetails(log) {
    const { action, details } = log;

    if (!details) return null;

    switch (action) {
      case 'SCHEDULE_CREATED':
      case 'SCHEDULE_CREATED_WITH_EXTERNAL':
        return (
          <div style={{ marginTop: '0.5rem', fontSize: '1.125rem', color: '#d1d5db' }}>
            <div><strong>Report:</strong> {details.reportId}</div>
            <div><strong>Frequency:</strong> {details.frequency}</div>
            {details.externalEmails && details.externalEmails.length > 0 && (
              <div style={{ color: '#fbbf24' }}>
                <strong>External Recipients:</strong> {details.externalEmails.join(', ')}
              </div>
            )}
            {details.internalEmails && details.internalEmails.length > 0 && (
              <div><strong>Internal Recipients:</strong> {details.internalEmails.join(', ')}</div>
            )}
          </div>
        );

      case 'SCHEDULE_RECIPIENTS_CHANGED':
        return (
          <div style={{ marginTop: '0.5rem', fontSize: '1.125rem', color: '#d1d5db' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Before:</strong>
                <div>External: {details.before?.external?.join(', ') || 'None'}</div>
                <div>Internal: {details.before?.internal?.join(', ') || 'None'}</div>
              </div>
              <div>
                <strong>After:</strong>
                <div>External: {details.after?.external?.join(', ') || 'None'}</div>
                <div>Internal: {details.after?.internal?.join(', ') || 'None'}</div>
              </div>
            </div>
            {details.addedExternal && details.addedExternal.length > 0 && (
              <div style={{ color: '#fbbf24', marginTop: '0.5rem' }}>
                ⚠️ Added external: {details.addedExternal.join(', ')}
              </div>
            )}
            {details.removedExternal && details.removedExternal.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>Removed external: {details.removedExternal.join(', ')}</div>
            )}
          </div>
        );

      case 'SCHEDULE_EXTERNAL_RECIPIENT_ADDED':
        return (
          <div style={{ marginTop: '0.5rem', fontSize: '1.125rem', color: '#fbbf24' }}>
            <strong>Added:</strong> {details.addedEmails?.join(', ')}
          </div>
        );

      case 'SCHEDULE_EXTERNAL_RECIPIENT_REMOVED':
        return (
          <div style={{ marginTop: '0.5rem', fontSize: '1.125rem', color: '#d1d5db' }}>
            <strong>Removed:</strong> {details.removedEmails?.join(', ')}
          </div>
        );

      case 'SCHEDULE_UPDATED':
        return (
          <div style={{ marginTop: '0.5rem', fontSize: '1.125rem', color: '#d1d5db' }}>
            <strong>Updated fields:</strong> {details.updatedFields?.join(', ')}
          </div>
        );

      default:
        return null;
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '1.125rem' }}>Loading audit trail...</div>;
  }

  return (
    <div style={{ fontSize: '1.125rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', margin: 0, color: '#fff' }}>Change History</h3>
        <select 
          value={days} 
          onChange={(e) => setDays(parseInt(e.target.value))}
          style={{
            padding: '0.5rem',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '1rem'
          }}
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '1.125rem' }}>
          No changes found in the last {days} days
        </div>
      ) : (
        <div>
          {logs.map((log) => (
            <div 
              key={log.id} 
              style={{
                padding: '0.75rem',
                marginBottom: '0.75rem',
                background: '#1e1e1e',
                borderRadius: '6px',
                fontSize: '1.125rem',
                lineHeight: '1.6'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '1.125rem', color: '#fff' }}>
                    {log.user.name}
                  </div>
                  <div style={{ fontSize: '1rem', color: '#9ca3af' }}>
                    {log.user.email}
                  </div>
                </div>
                <span style={{ fontSize: '1rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                  {formatDateTime(log.timestamp)}
                </span>
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: '500', color: '#d1d5db', marginBottom: '0.5rem' }}>
                {formatAction(log.action)}
              </div>
              {renderDetails(log)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
