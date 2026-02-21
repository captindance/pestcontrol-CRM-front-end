import React, { useState, useEffect } from 'react';
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, getScheduleExecutions } from '../api.js';
import { convertToUTC, convertFromUTC, formatTimeDisplay, formatDateTime } from '../utils/timeFormatting.js';

export default function SchedulesView({ tenantId, showToast }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [showExecutionHistory, setShowExecutionHistory] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loadingExecutions, setLoadingExecutions] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    reportId: '',
    name: '',
    frequency: 'weekly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    hour: 9,
    minute: 0,
    recipients: [''],
    enabled: true
  });

  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    loadSchedules();
    loadReports();
  }, [tenantId]);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const data = await getSchedules();
      setSchedules(data.schedules || []);
    } catch (err) {
      console.error('Failed to load schedules:', err);
      showToast?.('Failed to load schedules', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadReports = async () => {
    try {
      setLoadingReports(true);
      const { getReports } = await import('../api.js');
      const data = await getReports();
      setReports(data.data || []);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const loadExecutionHistory = async (scheduleId) => {
    try {
      setLoadingExecutions(true);
      const data = await getScheduleExecutions(scheduleId);
      setExecutions(data.executions || []);
      setShowExecutionHistory(scheduleId);
    } catch (err) {
      console.error('Failed to load execution history:', err);
      showToast?.('Failed to load execution history', 'error');
    } finally {
      setLoadingExecutions(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate recipients
    const validRecipients = formData.recipients.filter(r => r.trim() && r.includes('@'));
    if (validRecipients.length === 0) {
      showToast?.('Please add at least one valid email recipient', 'error');
      return;
    }

    try {
      const payload = {
        reportId: parseInt(formData.reportId),
        name: formData.name || 'Schedule',
        frequency: formData.frequency,
        timeOfDay: convertToUTC(parseInt(formData.hour), parseInt(formData.minute)),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        recipients: validRecipients,
        isEnabled: formData.enabled,
        emailSecurityLevel: 'database_only'
      };

      // Add frequency-specific fields
      if (formData.frequency === 'weekly') {
        payload.dayOfWeek = parseInt(formData.dayOfWeek);
      } else if (formData.frequency === 'monthly' || formData.frequency === 'quarterly' || 
                 formData.frequency === 'semi_annually' || formData.frequency === 'annually') {
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
      setShowCreateForm(false);
      setSelectedSchedule(null);
      resetForm();
      loadSchedules();
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
      loadSchedules();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      showToast?.('Failed to delete schedule', 'error');
    }
  };

  const handleEdit = (schedule) => {
    setSelectedSchedule(schedule);
    const { hour, minute } = convertFromUTC(schedule.timeOfDay);
    setFormData({
      reportId: schedule.reportId?.toString() || '',
      name: schedule.name || '',
      frequency: schedule.frequency,
      dayOfWeek: schedule.dayOfWeek ?? 1,
      dayOfMonth: schedule.dayOfMonth ?? 1,
      hour,
      minute,
      recipients: schedule.recipients?.length ? schedule.recipients : [''],
      enabled: schedule.isEnabled
    });
    setShowCreateForm(true);
  };

  const handleToggleEnabled = async (schedule) => {
    try {
      const result = await updateSchedule(schedule.id, { isEnabled: !schedule.isEnabled });
      if (result?.error) {
        showToast?.('Failed to update schedule', 'error');
        return;
      }
      showToast?.(`Schedule ${!schedule.isEnabled ? 'enabled' : 'disabled'}`, 'success');
      loadSchedules();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
      showToast?.('Failed to update schedule', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      reportId: '',
      name: '',
      frequency: 'weekly',
      dayOfWeek: 1,
      dayOfMonth: 1,
      hour: 9,
      minute: 0,
      recipients: [''],
      enabled: true
    });
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

  const getFrequencyDetails = (schedule) => {
    const timeDisplay = formatTimeDisplay(schedule.timeOfDay);
    if (schedule.frequency === 'weekly') {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const day = schedule.dayOfWeek ?? 1;
      return `Every ${days[day]} at ${timeDisplay}`;
    } else if (schedule.frequency === 'monthly') {
      const d = schedule.dayOfMonth ?? 1;
      const sfx = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';
      return `${d}${sfx} of each month at ${timeDisplay}`;
    } else if (schedule.frequency === 'quarterly') {
      const d = schedule.dayOfMonth ?? 1;
      const sfx = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';
      return `${d}${sfx} of each quarter at ${timeDisplay}`;
    } else if (schedule.frequency === 'semi_annually') {
      const d = schedule.dayOfMonth ?? 1;
      const sfx = d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th';
      return `${d}${sfx} of every 6 months at ${timeDisplay}`;
    } else if (schedule.frequency === 'annually') {
      return `January ${schedule.dayOfMonth ?? 1} at ${timeDisplay}`;
    }else {
      return `Every day at ${timeDisplay}`;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400">Loading schedules...</div>
        </div>
      </div>
    );
  }

  if (showExecutionHistory) {
    const schedule = schedules.find(s => s.id === showExecutionHistory);
    return (
      <div className="p-6">
        <div className="mb-6">
          <button
            onClick={() => setShowExecutionHistory(null)}
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Schedules
          </button>
          <h2 className="text-2xl font-bold text-white mt-2">
            Execution History: {schedule?.reportName || 'Unknown Report'}
          </h2>
        </div>

        {loadingExecutions ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading history...</div>
          </div>
        ) : executions.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400">No executions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {executions.map((exec) => (
              <div key={exec.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded text-sm font-medium ${
                      exec.status === 'success' ? 'bg-green-500/20 text-green-400' :
                      exec.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {exec.status}
                    </div>
                    <div className="text-gray-300">
                      {formatDateTime(exec.startedAt || exec.completedAt)}
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    Sent: {exec.emailsSent} | Failed: {exec.emailsFailed}
                  </div>
                </div>
                {exec.errorMessage && (
                  <div className="mt-2 text-sm text-red-400 bg-red-500/10 rounded p-2">
                    {exec.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <button
            onClick={() => {
              setShowCreateForm(false);
              setSelectedSchedule(null);
              resetForm();
            }}
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Schedules
          </button>
          <h2 className="text-2xl font-bold text-white mt-2">
            {selectedSchedule ? 'Edit Schedule' : 'Create New Schedule'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 max-w-2xl">
          <div className="space-y-4">
            {/* Report Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Report *
              </label>
              <select
                value={formData.reportId}
                onChange={(e) => setFormData({ ...formData, reportId: e.target.value })}
                required
                disabled={selectedSchedule}
                className="w-full bg-gray-700 text-white rounded px-3 py-2 disabled:opacity-50"
              >
                <option value="">Select a report</option>
                {reports.map(report => (
                  <option key={report.id} value={report.id}>{report.name}</option>
                ))}
              </select>
              {selectedSchedule && (
                <p className="text-xs text-gray-400 mt-1">Report cannot be changed after creation</p>
              )}
            </div>

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Frequency *
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                required
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="semi_annually">Semi-Annually</option>
                <option value="annually">Annually</option>
              </select>
            </div>

            {/* Day of Week (for weekly) */}
            {formData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Day of Week *
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) => setFormData({ ...formData, dayOfWeek: e.target.value })}
                  required
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
            )}

            {/* Day of Month (for monthly, quarterly, etc.) */}
            {['monthly', 'quarterly', 'semi_annually', 'annually'].includes(formData.frequency) && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Day of Month *
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: e.target.value })}
                  required
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
                />
                <p className="text-xs text-gray-400 mt-1">For months with fewer days, the last day of the month will be used</p>
              </div>
            )}

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Time (your local timezone) *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={formData.hour}
                  onChange={(e) => setFormData({ ...formData, hour: parseInt(e.target.value) })}
                  required
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
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
                  className="w-full bg-gray-700 text-white rounded px-3 py-2"
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Recipients * (max 5)
              </label>
              {formData.recipients.map((recipient, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={recipient}
                    onChange={(e) => updateRecipient(index, e.target.value)}
                    placeholder="email@example.com"
                    required
                    className="flex-1 bg-gray-700 text-white rounded px-3 py-2"
                  />
                  {formData.recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRecipient(index)}
                      className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {formData.recipients.length < 5 && (
                <button
                  type="button"
                  onClick={addRecipient}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  + Add another recipient
                </button>
              )}
            </div>

            {/* Enabled Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="enabled" className="text-sm text-gray-300">
                Schedule enabled (will run automatically)
              </label>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {selectedSchedule ? 'Update Schedule' : 'Create Schedule'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedSchedule(null);
                  resetForm();
                }}
                className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // Main list view
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Scheduled Reports</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Create Schedule
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">No scheduled reports yet</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="text-blue-400 hover:text-blue-300"
          >
            Create your first schedule →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">
                      {schedule.reportName || 'Unknown Report'}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      schedule.isEnabled 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-gray-600 text-gray-400'
                    }`}>
                      {schedule.isEnabled ? 'Active' : 'Disabled'}
                    </span>
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                      {formatFrequency(schedule.frequency)}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>{getFrequencyDetails(schedule)}</div>
                    <div>Next run: <span className="text-gray-300">{schedule.nextRunAt ? formatDateTime(schedule.nextRunAt) : 'Not scheduled'}</span></div>
                    <div>
                      Recipients: <span className="text-gray-300">
                        {schedule.recipients?.join(', ') || 'None'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleEnabled(schedule)}
                    className={`px-3 py-1 rounded text-sm ${
                      schedule.isEnabled
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {schedule.isEnabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => loadExecutionHistory(schedule.id)}
                    className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
                  >
                    History
                  </button>
                  <button
                    onClick={() => handleEdit(schedule)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  {confirmDeleteId === schedule.id ? (
                    <>
                      <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>Delete?</span>
                      <button onClick={() => handleDelete(schedule.id)} className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">Confirm</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700">Cancel</button>
                    </>
                  ) : (
                  <button
                    onClick={() => handleDelete(schedule.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
