import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env?.DEV ? 'http://localhost:3001' : '';

function getAuthHeaders() {
  const token = localStorage.getItem('jwt') || localStorage.getItem('demo_jwt');
  const tenantId = localStorage.getItem('selected_tenant_id');
  const actingRole = localStorage.getItem('acting_role');
  const headers = { 'Authorization': `Bearer ${token}` };
  if (tenantId) headers['x-tenant-id'] = tenantId;
  if (actingRole) headers['x-acting-role'] = actingRole;
  return headers;
}

async function listConnections(clientId) {
  try {
    const res = await fetch(`${API_BASE}/api/connections?clientId=${encodeURIComponent(clientId)}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

async function createConnection(clientId, data) {
  try {
    const res = await fetch(`${API_BASE}/api/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ ...data, clientId })
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

async function updateConnection(clientId, connectionId, data) {
  try {
    const res = await fetch(`${API_BASE}/api/connections/${connectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ ...data, clientId })
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

async function deleteConnection(clientId, connectionId) {
  try {
    const res = await fetch(`${API_BASE}/api/connections/${connectionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return { ok: true };
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

async function testConnection(connectionId, password) {
  try {
    const body = password !== undefined ? { password } : {};
    const res = await fetch(`${API_BASE}/api/connections/${connectionId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body)
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

async function testConnectionPreSave(data) {
  try {
    const res = await fetch(`${API_BASE}/api/connections/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) {
    return { error: e?.message || 'Network error' };
  }
}

export default function DatabaseConnections({ clientId }) {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showTestSnackbar, setShowTestSnackbar] = useState(false);
  const [testSnackbarMessage, setTestSnackbarMessage] = useState('');
  const [testSnackbarSuccess, setTestSnackbarSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    engine: 'mysql',
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: '',
    options: ''
  });

  useEffect(() => {
    loadConnections();
  }, [clientId]);

  async function loadConnections() {
    setLoading(true);
    setError(null);
    const result = await listConnections(clientId);
    if (result.error) {
      setError(result.error + (result.body ? `: ${result.body}` : ''));
    } else {
      setConnections(Array.isArray(result) ? result : []);
    }
    setLoading(false);
  }

  function resetForm() {
    setFormData({
      name: '',
      engine: 'mysql',
      host: '',
      port: 3306,
      database: '',
      username: '',
      password: '',
      options: ''
    });
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSave() {
    setError(null);

    if (!formData.name || !formData.host || !formData.port || !formData.database || !formData.username) {
      setError('All fields except password and options are required.');
      return;
    }

    const payload = {
      name: formData.name,
      engine: formData.engine,
      host: formData.host,
      port: Number(formData.port),
      database: formData.database,
      username: formData.username
    };

    if (formData.password) {
      payload.password = formData.password;
    }

    if (formData.options && formData.options.trim()) {
      try {
        payload.options = JSON.parse(formData.options);
      } catch (e) {
        setError(`Invalid JSON in options: ${e.message}`);
        return;
      }
    }

    let result;
    if (editingId) {
      result = await updateConnection(clientId, editingId, payload);
    } else {
      result = await createConnection(clientId, payload);
    }

    if (result.error) {
      setError(result.error + (result.body ? `: ${result.body}` : ''));
    } else {
      await loadConnections();
      resetForm();
    }
  }

  async function handleEdit(conn) {
    setFormData({
      name: conn.name,
      engine: conn.engine,
      host: conn.host,
      port: conn.port,
      database: conn.database,
      username: conn.username,
      password: '', // passwords not returned
      options: conn.options ? JSON.stringify(conn.options) : ''
    });
    setEditingId(conn.id);
    setShowForm(true);
  }

  async function handleDelete(connectionId) {
    if (!window.confirm('Are you sure you want to delete this connection?')) return;
    setError(null);
    const result = await deleteConnection(clientId, connectionId);
    if (result.error) {
      setError(result.error + (result.body ? `: ${result.body}` : ''));
    } else {
      await loadConnections();
    }
  }

  async function handleTest(conn) {
    setError(null);
    
    // Determine password to use
    let password = undefined;
    if (editingId === conn.id && formData.password) {
      // Use password from form if currently editing
      password = formData.password;
    } else if (!conn.hasPassword) {
      // No password saved - can't test
      setTestSnackbarMessage('This connection has no password saved. Please edit to set a password first.');
      setTestSnackbarSuccess(false);
      setShowTestSnackbar(true);
      setTimeout(() => setShowTestSnackbar(false), 4000);
      return;
    }
    // If conn.hasPassword is true and we're not editing, use stored password (password stays undefined)

    const result = await testConnection(conn.id, password);
    if (result.error) {
      setError(`Test failed: ${result.error}`);
    } else if (result.ok) {
      const connInfo = conn.engine ? `${conn.engine} @ ` : '';
      const hostInfo = conn.host && conn.port ? `${conn.host}:${conn.port}` : conn.host || '';
      const dbInfo = conn.database ? ` → ${conn.database}` : '';
      setTestSnackbarMessage(`✓ Connection successful! ${connInfo}${hostInfo}${dbInfo}`);
      setTestSnackbarSuccess(true);
      setShowTestSnackbar(true);
      setTimeout(() => setShowTestSnackbar(false), 4000);
    } else {
      setTestSnackbarMessage(`Connection failed: ${result.message}`);
      setTestSnackbarSuccess(false);
      setShowTestSnackbar(true);
      setTimeout(() => setShowTestSnackbar(false), 4000);
    }
  }

  async function handleTestForm() {
    setError(null);

    if (!formData.password) {
      setError('Password is required to test the connection.');
      return;
    }

    setTestingConnection(true);

    const payload = {
      engine: formData.engine,
      host: formData.host,
      port: Number(formData.port),
      database: formData.database,
      username: formData.username,
      password: formData.password
    };

    if (formData.options && formData.options.trim()) {
      try {
        payload.options = JSON.parse(formData.options);
      } catch (e) {
        setError(`Invalid JSON in options: ${e.message}`);
        setTestingConnection(false);
        return;
      }
    }

    const result = await testConnectionPreSave(payload);
    setTestingConnection(false);

    if (result.error) {
      // Parse error response if it's JSON in the body
      let errorMsg = result.error;
      if (result.body) {
        try {
          const parsed = JSON.parse(result.body);
          errorMsg = parsed.message || parsed.error || result.error;
        } catch {
          errorMsg = result.error;
        }
      }
      setError(`⚠️ Connection test failed:\n${errorMsg}`);
    } else if (result.ok) {
      setTestSnackbarMessage(`✓ Connection successful! ${formData.engine} @ ${formData.host}:${formData.port} → ${formData.database}`);
      setTestSnackbarSuccess(true);
      setShowTestSnackbar(true);
      setTimeout(() => setShowTestSnackbar(false), 4000);
    } else {
      setError(`⚠️ Connection test failed:\n${result.message || 'Unknown error'}`);
    }
  }

  return (
    <div style={{ border: '1px solid #eee', padding: '.75rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Database Connections</h4>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '.4rem .8rem',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            + Add Connection
          </button>
        )}
      </div>

      {error && (
        <div style={{ 
          color: '#c41e3a', 
          marginBottom: '.5rem',
          padding: '.75rem',
          background: '#ffe6e6',
          border: '1px solid #c41e3a',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.5'
        }}>
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ border: '1px solid #ddd', padding: '1rem', marginBottom: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
          <h5>{editingId ? 'Edit Connection' : 'New Connection'}</h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '1rem' }}>
            <label>
              Name *
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Production DB"
              />
            </label>
            <label>
              Engine *
              <select value={formData.engine} onChange={e => setFormData({ ...formData, engine: e.target.value })}>
                <option value="mysql">MySQL</option>
                <option value="postgres">PostgreSQL</option>
                <option value="sqlserver">SQL Server</option>
                <option value="oracle">Oracle</option>
                <option value="snowflake">Snowflake</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Host *
              <input
                type="text"
                value={formData.host}
                onChange={e => setFormData({ ...formData, host: e.target.value })}
                placeholder="e.g., localhost or db.example.com"
              />
            </label>
            <label>
              Port *
              <input
                type="number"
                value={formData.port}
                onChange={e => setFormData({ ...formData, port: e.target.value })}
              />
            </label>
            <label>
              Database Name *
              <input
                type="text"
                value={formData.database}
                onChange={e => setFormData({ ...formData, database: e.target.value })}
              />
            </label>
            <label>
              Username *
              <input
                type="text"
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
              />
            </label>
            <label>
              Password {editingId && '(leave blank to keep existing)'}
              <input
                type="password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingId ? '(unchanged)' : 'Required for new connections'}
              />
            </label>
            <label>
              Options (JSON)
              <input
                type="text"
                value={formData.options}
                onChange={e => setFormData({ ...formData, options: e.target.value })}
                placeholder='e.g., {"ssl": true}'
              />
            </label>
          </div>
          <button
            onClick={handleSave}
            style={{
              padding: '.5rem 1rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '.5rem'
            }}
          >
            Save Connection
          </button>
          <button
            onClick={handleTestForm}
            disabled={testingConnection}
            style={{
              padding: '.5rem 1rem',
              background: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: testingConnection ? 'not-allowed' : 'pointer',
              marginRight: '.5rem',
              opacity: testingConnection ? 0.6 : 1
            }}
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            onClick={resetForm}
            style={{
              padding: '.5rem 1rem',
              background: '#dc3545',
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

      {/* List */}
      {loading ? (
        <div>Loading connections...</div>
      ) : connections.length === 0 ? (
        <div style={{ color: '#666' }}>No database connections yet. {showForm ? '' : 'Create one to get started.'}</div>
      ) : (
        <div>
          {connections.map(conn => (
            <div
              key={conn.id}
              style={{
                border: '1px solid #ddd',
                padding: '.75rem',
                marginBottom: '.5rem',
                borderRadius: '4px',
                background: '#fafafa'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '.25rem' }}>
                    {conn.name}
                  </div>
                  <div style={{ fontSize: '.9em', color: '#666' }}>
                    {conn.engine && <div>Engine: {conn.engine}</div>}
                    {conn.host && conn.port && <div>Host: {conn.host}:{conn.port}</div>}
                    {conn.database && <div>Database: {conn.database}</div>}
                    <div>Password: {conn.hasPassword ? '✓ Set' : '✗ Not set'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '.25rem', flexDirection: 'column' }}>
                  <button
                    onClick={() => handleTest(conn)}
                    style={{
                      padding: '.4rem .6rem',
                      background: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '.85em'
                    }}
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleEdit(conn)}
                    style={{
                      padding: '.4rem .6rem',
                      background: '#ffc107',
                      color: 'black',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '.85em'
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(conn.id)}
                    style={{
                      padding: '.4rem .6rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '.85em'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test Result Snackbar */}
      {showTestSnackbar && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          minWidth: '344px',
          maxWidth: '568px',
          background: testSnackbarSuccess ? '#2e7d32' : '#d32f2f',
          borderRadius: '4px',
          padding: '1rem 1.5rem',
          boxShadow: '0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{ color: '#ffffff', fontSize: '0.95rem', flex: 1 }}>
            {testSnackbarSuccess ? '✓ ' : '✗ '}{testSnackbarMessage}
          </div>
          <button
            onClick={() => setShowTestSnackbar(false)}
            style={{
              padding: '.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '.875rem',
              fontWeight: '500',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginLeft: '1rem'
            }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
