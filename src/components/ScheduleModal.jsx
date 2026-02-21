import React, { useState, useEffect } from 'react';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, getScheduleExecutions } from '../api.js';
import { convertToUTC, convertFromUTC, formatTimeDisplay, formatDateTime } from '../utils/timeFormatting.js';
import AuditTrail from './AuditTrail.jsx';
import TabNav from './TabNav.jsx';

// Execution Log Component
function ExecutionLogContent({ scheduleId, showToast }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadExecutions();
  }, [scheduleId]);
  
  const loadExecutions = async () => {
    try {
      setLoading(true);
      const data = await getScheduleExecutions(scheduleId);
      setExecutions(data.executions || []);
    } catch (err) {
      console.error('Failed to load execution history:', err);
      showToast?.('Failed to load execution history', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '1.125rem' }}>
      Loading execution history...
    </div>;
  }
  
  if (executions.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '1.125rem' }}>
      No execution history yet
    </div>;
  }
  
  return (
    <div style={{ fontSize: '1.125rem' }}>
      {executions.map(exec => (
        <div key={exec.id} style={{ padding: '0.75rem', marginBottom: '0.5rem', background: '#1e1e1e', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: '500',
                background: exec.status === 'success' ? '#10b981' : exec.status === 'failed' ? '#ef4444' : '#f59e0b',
                color: '#fff'
              }}>
                {exec.status}
              </div>
              <div style={{ color: '#d1d5db', fontSize: '1.125rem' }}>
                {formatDateTime(exec.startedAt || exec.completedAt)}
              </div>
            </div>
            <div style={{ fontSize: '1.125rem', color: '#9ca3af' }}>
              Sent: {exec.emailsSent} | Failed: {exec.emailsFailed}
            </div>
          </div>
          {exec.errorMessage && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '1.125rem',
              color: '#fca5a5',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '4px',
              padding: '0.5rem'
            }}>
              {exec.errorMessage}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ScheduleModal({ reportId, reportName, userEmail, onClose, showToast, currentUserId, userRole }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('list'); // 'list', 'create', 'edit'
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [expandedScheduleId, setExpandedScheduleId] = useState(null);
  const [detailTab, setDetailTab] = useState('execution'); // 'execution' or 'changes'
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    frequency: 'weekly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    hour: 9,
    minute: 0,
    recipients: [userEmail || ''],
    enabled: true
  });

  useEffect(() => {
    loadSchedules();
  }, [reportId]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const data = await getSchedules(reportId, true);
      if (data?.error) {
        throw new Error(data.body || data.error);
      }
      setSchedules(data.schedules || []);
    } catch (err) {
      console.error('Failed to load schedules:', err);
      showToast?.('Failed to load schedules', 'error');
      setLoadError('Failed to load schedules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validRecipients = formData.recipients.filter(r => r.trim() && r.includes('@'));
    if (validRecipients.length === 0) {
      showToast?.('Please add at least one valid email recipient', 'error');
      return;
    }

    try {
      const payload = {
        reportId: reportId,
        name: selectedSchedule ? selectedSchedule.name : `${reportName || 'Report'} Schedule`,
        frequency: formData.frequency,
        timeOfDay: convertToUTC(parseInt(formData.hour), parseInt(formData.minute)),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        recipients: validRecipients,
        emailSecurityLevel: 'database_only'
      };

      if (formData.frequency === 'weekly') {
        payload.dayOfWeek = parseInt(formData.dayOfWeek);
      } else if (['monthly', 'quarterly', 'semi_annually', 'annually'].includes(formData.frequency)) {
        payload.dayOfMonth = parseInt(formData.dayOfMonth);
      }

      let result;
      if (selectedSchedule) {
        result = await updateSchedule(selectedSchedule.id, payload);
      } else {
        result = await createSchedule(payload);
      }

      if (result?.error) {
        const message = result.body
          ? (() => { try { return JSON.parse(result.body).error || result.body; } catch { return result.body; } })()
          : result.error;
        showToast?.(message || 'Failed to save schedule', 'error');
        return;
      }

      showToast?.(selectedSchedule ? 'Schedule updated successfully' : 'Schedule created successfully', 'success');
      resetForm();
      setView('list');
      await loadSchedules();
    } catch (err) {
      console.error('Failed to save schedule:', err);
      showToast?.(err.message || 'Failed to save schedule', 'error');
    }
  };

  const handleDelete = async (scheduleId) => {
    if (confirmDeleteId !== scheduleId) {
      setConfirmDeleteId(scheduleId);
      return;
    }
    setConfirmDeleteId(null);
    try {
      const result = await deleteSchedule(scheduleId);
      if (result?.error) {
        showToast?.('Failed to delete schedule', 'error');
        return;
      }
      showToast?.('Schedule deleted successfully', 'success');
      await loadSchedules();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      showToast?.('Failed to delete schedule', 'error');
    }
  };

  const handleEdit = (schedule) => {
    setSelectedSchedule(schedule);
    const { hour, minute } = convertFromUTC(schedule.timeOfDay);
    setFormData({
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek ?? 1,
      dayOfMonth: schedule.dayOfMonth ?? 1,
      hour,
      minute,
      recipients: schedule.recipients?.length ? schedule.recipients : [userEmail || ''],
      enabled: schedule.isEnabled
    });
    setView('edit');
  };

  const handleToggleEnabled = async (schedule) => {
    try {
      const result = await updateSchedule(schedule.id, { isEnabled: !schedule.isEnabled });
      if (result?.error) {
        showToast?.('Failed to update schedule', 'error');
        return;
      }
      showToast?.(`Schedule ${!schedule.isEnabled ? 'enabled' : 'disabled'}`, 'success');
      await loadSchedules();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
      showToast?.('Failed to update schedule', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      frequency: 'weekly',
      dayOfWeek: 1,
      dayOfMonth: 1,
      hour: 9,
      minute: 0,
      recipients: [userEmail || ''],
      enabled: true
    });
    setSelectedSchedule(null);
  };

  const addRecipient = () => {
    setFormData({ ...formData, recipients: [...formData.recipients, ''] });
  };

  const removeRecipient = (index) => {
    const newRecipients = formData.recipients.filter((_, i) => i !== index);
    setFormData({ ...formData, recipients: newRecipients.length > 0 ? newRecipients : [''] });
  };

  const updateRecipient = (index, value) => {
    const newRecipients = [...formData.recipients];
    newRecipients[index] = value;
    setFormData({ ...formData, recipients: newRecipients });
  };

  const formatFrequency = (freq) => {
    const map = {
      'daily': 'Daily',
      'weekly': 'Weekly',
      'monthly': 'Monthly',
      'quarterly': 'Quarterly',
      'semi_annually': 'Semi-Annually',
      'annually': 'Annually'
    };
    return map[freq] || freq;
  };

  const formatNextRun = (date) => {
    return formatDateTime(date) || 'Not scheduled';
  };

  const getFrequencyDetails = (schedule) => {
    const timeDisplay = formatTimeDisplay(schedule.timeOfDay);
    
    if (schedule.frequency === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = schedule.dayOfWeek ?? 1;
      return `Every ${days[dayOfWeek]} at ${timeDisplay}`;
    } else if (schedule.frequency === 'monthly') {
      const day = schedule.dayOfMonth ?? 1;
      const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
      return `${day}${suffix} of each month at ${timeDisplay}`;
    } else if (schedule.frequency === 'quarterly') {
      const day = schedule.dayOfMonth ?? 1;
      const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
      return `${day}${suffix} of each quarter at ${timeDisplay}`;
    } else if (schedule.frequency === 'semi_annually') {
      const day = schedule.dayOfMonth ?? 1;
      const suffix = day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th';
      return `${day}${suffix} of every 6 months at ${timeDisplay}`;
    } else if (schedule.frequency === 'annually') {
      return `January ${schedule.dayOfMonth ?? 1} at ${timeDisplay}`;
    } else {
      // daily
      return `Every day at ${timeDisplay}`;
    }
  };

  const toggleScheduleExpansion = (scheduleId) => {
    setExpandedScheduleId(expandedScheduleId === scheduleId ? null : scheduleId);
    if (expandedScheduleId !== scheduleId) {
      setDetailTab('execution');
    }
  };

  // Render modal
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          background: '#1e1e1e',
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: view === 'list' ? '900px' : '600px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          color: '#fff'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 id="modal-title" style={{ margin: '0 0 0.25rem 0', fontSize: '1.5rem' }}>Schedule: {reportName}</h2>
            <p style={{ margin: 0, color: '#aaa', fontSize: '1.125rem' }}>
              {view === 'list' ? `${schedules.length} schedule${schedules.length !== 1 ? 's' : ''} configured` : 
               view === 'create' ? 'Create new schedule' : 'Edit schedule'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem'
            }}
          >
            ×
          </button>
        </div>

        {/* VIEW: List (default) */}
        {view === 'list' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#aaa', fontSize: '1.125rem' }}>
                Loading schedules...
              </div>
            ) : (
              <>
                <button
                  onClick={() => { 
                    setSelectedSchedule(null);
                    resetForm();
                    setView('create'); 
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    marginBottom: '1rem'
                  }}
                >
                  + Create New Schedule
                </button>

                {loadError ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '1rem',
                    marginBottom: '1rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    borderRadius: '6px',
                    color: '#fca5a5'
                  }}>
                    <div style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>{loadError}</div>
                    <button
                      onClick={loadSchedules}
                      style={{
                        padding: '0.45rem 0.9rem',
                        background: '#374151',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : schedules.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem',
                    background: '#2a2a2a',
                    borderRadius: '6px',
                    color: '#aaa'
                  }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>No schedules yet</p>
                    <p style={{ margin: 0, fontSize: '1.125rem' }}>
                      Click "Create New Schedule" to send this report automatically
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {schedules.map((schedule) => {
                      const isOwner = schedule.createdBy === currentUserId;
                      const canModify = isOwner || userRole === 'business_owner';
                      const isExpanded = expandedScheduleId === schedule.id;
                      
                      return (
                        <div key={schedule.id} className="schedule-item" style={{
                          background: '#2a2a2a',
                          borderRadius: '6px',
                          padding: '1rem'
                        }}>
                          {/* Schedule Header (Always Visible) */}
                          <div className="schedule-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '500',
                                background: '#3b82f6',
                                color: '#fff'
                              }}>
                                {formatFrequency(schedule.frequency)}
                              </span>
                            </div>

                            <div className="schedule-info" style={{ marginBottom: '0.75rem' }}>
                              <h3 style={{ fontSize: '1.125rem', margin: '0 0 0.25rem 0', color: '#fff' }}>
                                {getFrequencyDetails(schedule)}
                              </h3>
                              <div style={{ fontSize: '1.125rem', lineHeight: '1.6', color: '#d1d5db', marginBottom: '0.25rem' }}>
                                Recipients: {schedule.recipients?.join(', ') || 'None'}
                              </div>
                              <div style={{ fontSize: '1rem', color: '#9ca3af' }}>
                                Next run: {formatNextRun(schedule.nextRunAt)}
                              </div>
                              
                              {schedule.creator && (
                                <div style={{ marginTop: '0.75rem', fontSize: '1rem', color: '#9ca3af' }}>
                                  <div>
                                    <span style={{ fontWeight: '500' }}>Created by:</span>{' '}
                                    <span style={{ fontSize: '1.125rem' }}>
                                      {schedule.creator.firstName} {schedule.creator.lastName}
                                    </span>
                                  </div>
                                  {schedule.lastModifiedBy && schedule.lastModifiedBy !== schedule.createdBy && (
                                    <div>
                                      <span style={{ fontWeight: '500' }}>Last modified by:</span>{' '}
                                      <span style={{ fontSize: '1.125rem' }}>
                                        {schedule.modifier?.firstName} {schedule.modifier?.lastName}
                                      </span>
                                      <span style={{ fontSize: '1rem' }}> on {formatDateTime(schedule.lastModifiedAt)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {!canModify && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#fbbf24' }}>
                                  View only: only the schedule owner or a business owner can modify this schedule.
                                </div>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="schedule-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                onClick={() => handleToggleEnabled(schedule)}
                                disabled={!canModify}
                                title={!canModify ? 'You can only enable/disable your own schedules' : ''}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: schedule.isEnabled ? '#10b981' : '#f59e0b',
                                  border: 'none',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '1rem',
                                  fontWeight: '500',
                                  cursor: canModify ? 'pointer' : 'not-allowed',
                                  opacity: canModify ? 1 : 0.5
                                }}
                              >
                                {schedule.isEnabled ? '✓ Enabled' : '⏸ Disabled'}
                              </button>
                              <button
                                onClick={() => handleEdit(schedule)}
                                disabled={!canModify}
                                title={!canModify ? 'You can only edit your own schedules' : ''}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: '#2563eb',
                                  border: 'none',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '1rem',
                                  fontWeight: '500',
                                  cursor: canModify ? 'pointer' : 'not-allowed',
                                  opacity: canModify ? 1 : 0.5
                                }}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => toggleScheduleExpansion(schedule.id)}
                                aria-expanded={isExpanded}
                                aria-controls={`details-${schedule.id}`}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: '#6b7280',
                                  border: 'none',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '1rem',
                                  fontWeight: '500',
                                  cursor: 'pointer'
                                }}
                              >
                                {isExpanded ? '▲ Hide Details' : '▼ Show Details'}
                              </button>
                              {confirmDeleteId === schedule.id ? (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <span style={{ color: '#fca5a5', fontSize: '0.875rem' }}>Delete this schedule?</span>
                                  <button
                                    onClick={() => handleDelete(schedule.id)}
                                    style={{ padding: '0.4rem 0.75rem', background: '#dc2626', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', cursor: 'pointer' }}
                                  >Confirm</button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    style={{ padding: '0.4rem 0.75rem', background: '#4b5563', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.875rem', cursor: 'pointer' }}
                                  >Cancel</button>
                                </div>
                              ) : (
                              <button
                                onClick={() => handleDelete(schedule.id)}
                                disabled={!canModify}
                                title={!canModify ? 'You can only delete your own schedules' : ''}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: '#dc2626',
                                  border: 'none',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '1rem',
                                  fontWeight: '500',
                                  cursor: canModify ? 'pointer' : 'not-allowed',
                                  opacity: canModify ? 1 : 0.5
                                }}
                              >
                                Delete
                              </button>
                              )}
                            </div>
                          </div>

                          {/* Expandable Details Section */}
                          {isExpanded && (
                            <div 
                              id={`details-${schedule.id}`}
                              className="schedule-details"
                              style={{
                                marginTop: '1rem',
                                padding: '1rem',
                                background: '#1a1a1a',
                                borderRadius: '8px'
                              }}
                            >
                              <TabNav 
                                tabs={[
                                  { id: 'execution', label: '📊 Execution Log', disabled: false },
                                  { id: 'changes', label: '📝 Change Log', disabled: false }
                                ]}
                                activeTab={detailTab}
                                onTabChange={setDetailTab}
                              />
                              
                              <div style={{ marginTop: '1rem' }}>
                                {detailTab === 'execution' && (
                                  <ExecutionLogContent scheduleId={schedule.id} showToast={showToast} />
                                )}
                                
                                {detailTab === 'changes' && (
                                  <div style={{ fontSize: '1.125rem' }}>
                                    <AuditTrail scheduleId={schedule.id} showToast={showToast} />
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* VIEW: Create/Edit Form */}
        {(view === 'create' || view === 'edit') && (
          <div>
            <button
              onClick={() => {
                setView('list');
                resetForm();
              }}
              style={{
                marginBottom: '1rem',
                padding: '0.5rem 1rem',
                background: '#374151',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              ← Back to List
            </button>

            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#2a2a2a', borderRadius: '6px', fontSize: '1.125rem' }}>
              <strong>Report:</strong> {reportName}
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Frequency */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}>
                  Frequency *
                </label>
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '1rem'
                  }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semi_annually">Semi-Annually</option>
                  <option value="annually">Annually</option>
                </select>
              </div>

              {/* Day of Week (weekly) */}
              {formData.frequency === 'weekly' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}>
                    Day of Week *
                  </label>
                  <select
                    value={formData.dayOfWeek}
                    onChange={(e) => setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                    <option value="0">Sunday</option>
                  </select>
                </div>
              )}

              {/* Day of Month (monthly, quarterly, etc.) */}
              {['monthly', 'quarterly', 'semi_annually', 'annually'].includes(formData.frequency) && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}>
                    Day of Month *
                  </label>
                  <select
                    value={formData.dayOfMonth}
                    onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}>
                  Time (your local timezone) *
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={formData.hour}
                    onChange={(e) => setFormData({ ...formData, hour: parseInt(e.target.value) })}
                    required
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map(hour => (
                      <option key={hour} value={hour}>
                        {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                      </option>
                    ))}
                  </select>
                  <select
                    value={formData.minute}
                    onChange={(e) => setFormData({ ...formData, minute: parseInt(e.target.value) })}
                    required
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="0">:00</option>
                    <option value="15">:15</option>
                    <option value="30">:30</option>
                    <option value="45">:45</option>
                  </select>
                </div>
              </div>

              {/* Recipients */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', fontWeight: '500' }}>
                  Recipients *
                </label>
                {formData.recipients.map((recipient, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="email"
                      value={recipient}
                      onChange={(e) => updateRecipient(index, e.target.value)}
                      placeholder="email@example.com"
                      required
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: '#2a2a2a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '1rem'
                      }}
                    />
                    {formData.recipients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRecipient(index)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#dc2626',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '1rem',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRecipient}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#374151',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  + Add Recipient
                </button>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {view === 'create' ? 'Create Schedule' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('list');
                    resetForm();
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#6b7280',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
