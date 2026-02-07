import React, { useState, useEffect } from 'react';

// In development backend runs on 3001; in production both frontend & backend are proxied on 3000
const API_BASE = (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');
import DatabaseConnections from './DatabaseConnections.jsx';

async function getClientUsers(clientId) {
  try {
    const token = localStorage.getItem('jwt');
    const res = await fetch(`${API_BASE}/clients/${clientId}/users`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': clientId
      }
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

async function inviteUser(clientId, email, role) {
  try {
    const token = localStorage.getItem('jwt');
    const res = await fetch(`${API_BASE}/clients/${clientId}/users`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': clientId
      },
      body: JSON.stringify({ email, role })
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

async function getManagerAssignments(clientId) {
  try {
    const token = localStorage.getItem('jwt');
    const res = await fetch(`${API_BASE}/clients/${clientId}/managers`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': clientId
      }
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

async function getUserPermissions(clientId, userId) {
  try {
    const token = localStorage.getItem('jwt');
    const res = await fetch(`${API_BASE}/clients/${clientId}/users/${userId}/permissions`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': clientId
      }
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

async function updateUserPermissions(clientId, userId, permissions) {
  try {
    const token = localStorage.getItem('jwt');
    const res = await fetch(`${API_BASE}/clients/${clientId}/users/${userId}/permissions`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': clientId
      },
      body: JSON.stringify(permissions)
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

export default function ClientPanel({ clientId, clientName }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [error, setError] = useState(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('delegate');
  const [inviting, setInviting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  console.log('ClientPanel loaded - activeTab:', activeTab);

  useEffect(() => {
    loadData();
  }, [clientId]);

  async function loadData() {
    const usersData = await getClientUsers(clientId);
    if (Array.isArray(usersData)) {
      setUsers(usersData);
    } else if (usersData?.error) {
      console.error('Failed to load users:', usersData);
      // Don't show error for empty user list
      setUsers([]);
    }

    const managersData = await getManagerAssignments(clientId);
    if (Array.isArray(managersData)) {
      setManagers(managersData);
    } else if (managersData?.error) {
      console.error('Failed to load managers:', managersData);
      setManagers([]);
    }
  }

  async function handleInviteUser() {
    if (!newUserEmail.trim()) {
      setError('Email is required');
      return;
    }
    
    setInviting(true);
    setError(null);
    const result = await inviteUser(clientId, newUserEmail.trim(), newUserRole);
    setInviting(false);
    
    if (result?.error) {
      setError(result.error + (result.body ? `: ${result.body}` : ''));
    } else if (result?.emailSent === false) {
      // Email was not sent, show warning but user was created
      setError(`User invitation created but email could not be sent: ${result.emailError || 'Email service not configured'}`);
    } else {
      setSuccessMessage(`Invitation sent to ${newUserEmail}`);
      setNewUserEmail('');
      setTimeout(() => setSuccessMessage(null), 3000);
      loadData();
    }
  }

  async function handleSelectUser(user) {
    setSelectedUser(user);
    setUserPermissions(null);
    setError(null);
    
    const perms = await getUserPermissions(clientId, user.id);
    if (perms?.error) {
      setError('Failed to load user permissions');
    } else {
      setUserPermissions(perms);
    }
  }

  async function handlePermissionToggle(permissionName) {
    if (!selectedUser || !userPermissions) return;
    
    const currentValue = userPermissions.overrides?.[permissionName];
    const effectiveValue = userPermissions.effective?.[permissionName];
    
    // Toggle: null -> true -> false -> null
    let newValue;
    if (currentValue === null || currentValue === undefined) {
      newValue = !effectiveValue; // Invert the default
    } else if (currentValue === true) {
      newValue = false;
    } else {
      newValue = null; // Reset to default
    }
    
    setSavingPermissions(true);
    const result = await updateUserPermissions(clientId, selectedUser.id, {
      [permissionName]: newValue
    });
    setSavingPermissions(false);
    
    if (result?.error) {
      setError('Failed to update permission');
    } else {
      // Refresh permissions
      const perms = await getUserPermissions(clientId, selectedUser.id);
      if (perms?.effective) {
        setUserPermissions(perms);
        setSuccessMessage('Permission updated');
        setTimeout(() => setSuccessMessage(null), 2000);
      }
    }
  }

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', marginTop: '1rem' }}>
      <h3>Organization Settings</h3>
      {clientName && <p style={{ color: '#666', fontSize: '0.9rem' }}>{clientName}</p>}

      {error && (
        <div style={{ padding: '.75rem', marginBottom: '1rem', background: '#ffe6e6', color: '#c41e3a', border: '1px solid #c41e3a', borderRadius: '4px' }}>
          {error}
        </div>
      )}

      {successMessage && (
        <div style={{ padding: '.75rem', marginBottom: '1rem', background: '#e6f7e6', color: '#2d6e2d', border: '1px solid #4CAF50', borderRadius: '4px' }}>
          {successMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #ddd', marginBottom: '1rem' }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '.75rem 1.5rem',
            background: activeTab === 'users' ? '#0078d4' : 'transparent',
            color: activeTab === 'users' ? 'white' : '#333',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid #0078d4' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'users' ? 'bold' : 'normal'
          }}
        >
          Users
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          style={{
            padding: '.75rem 1.5rem',
            background: activeTab === 'permissions' ? '#0078d4' : 'transparent',
            color: activeTab === 'permissions' ? 'white' : '#333',
            border: 'none',
            borderBottom: activeTab === 'permissions' ? '3px solid #0078d4' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'permissions' ? 'bold' : 'normal'
          }}
        >
          Permissions
        </button>
        <button
          onClick={() => setActiveTab('managers')}
          style={{
            padding: '.75rem 1.5rem',
            background: activeTab === 'managers' ? '#0078d4' : 'transparent',
            color: activeTab === 'managers' ? 'white' : '#333',
            border: 'none',
            borderBottom: activeTab === 'managers' ? '3px solid #0078d4' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'managers' ? 'bold' : 'normal'
          }}
        >
          Managers
        </button>
        <button
          onClick={() => setActiveTab('connections')}
          style={{
            padding: '.75rem 1.5rem',
            background: activeTab === 'connections' ? '#0078d4' : 'transparent',
            color: activeTab === 'connections' ? 'white' : '#333',
            border: 'none',
            borderBottom: activeTab === 'connections' ? '3px solid #0078d4' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'connections' ? 'bold' : 'normal'
          }}
        >
          Database Connections
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div style={{ marginBottom: '2rem' }}>
            <h4>Invite User</h4>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
              Invite team members to your organization. <strong>Delegates</strong> have full access to create and manage reports. <strong>Viewers</strong> can only view existing reports.
            </p>
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '.25rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Email</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleInviteUser()}
                  style={{ width: '100%', padding: '.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '.25rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Role</label>
                <select
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value)}
                  style={{ padding: '.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="delegate">Delegate (Full Access)</option>
                  <option value="viewer">Viewer (Read Only)</option>
                </select>
              </div>
              <button
                onClick={handleInviteUser}
                disabled={inviting}
                style={{ padding: '.5rem 1rem', background: '#28a745', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
              >
                {inviting ? 'Inviting...' : 'Send Invitation'}
              </button>
            </div>
          </div>

          <div>
            <h4>Organization Users ({users.length})</h4>
            {users.length === 0 ? (
              <p style={{ color: '#666' }}>No users yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Email</th>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Role</th>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '.5rem' }}>
                        {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '-'}
                      </td>
                      <td style={{ padding: '.5rem' }}>{user.email}</td>
                      <td style={{ padding: '.5rem' }}>
                        <span style={{ 
                          padding: '.25rem .5rem', 
                          borderRadius: '4px', 
                          fontSize: '0.85rem',
                          background: user.role === 'business_owner' ? '#0078d4' : user.role === 'delegate' ? '#28a745' : '#6c757d',
                          color: 'white'
                        }}>
                          {user.role}
                        </span>
                      </td>
                      <td style={{ padding: '.5rem', fontSize: '0.85rem' }}>
                        {user.emailVerified ? (
                          <span style={{ color: '#28a745' }}>✓ Verified</span>
                        ) : (
                          <span style={{ color: '#ff9800' }}>⚠ Pending Verification</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div style={{ display: 'flex', gap: '2rem' }}>
          {/* User list */}
          <div style={{ flex: '0 0 300px', borderRight: '1px solid #ddd', paddingRight: '1rem' }}>
            <h4>Team Members</h4>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>
              Select a user to manage their permissions
            </p>
            {users.filter(u => u.role !== 'business_owner').length === 0 ? (
              <p style={{ color: '#999', fontSize: '0.9rem' }}>No team members yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                {users.filter(u => u.role !== 'business_owner').map((user, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectUser(user)}
                    style={{
                      padding: '.75rem',
                      background: selectedUser?.id === user.id ? '#e3f2fd' : 'white',
                      border: selectedUser?.id === user.id ? '2px solid #0078d4' : '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>
                      {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {user.role}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Permission controls */}
          <div style={{ flex: 1 }}>
            {!selectedUser ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                Select a team member to view and manage their permissions
              </div>
            ) : !userPermissions ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                Loading permissions...
              </div>
            ) : (
              <div>
                <h4>
                  Permissions for {selectedUser.firstName && selectedUser.lastName 
                    ? `${selectedUser.firstName} ${selectedUser.lastName}` 
                    : selectedUser.email}
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem' }}>
                  Role: <strong>{userPermissions.role}</strong>
                  {' • '}
                  Toggle permissions to override role defaults. Grey = using role default.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { key: 'canViewReports', label: 'View Reports', desc: 'Can view existing reports and their results' },
                    { key: 'canCreateReports', label: 'Create Reports', desc: 'Can create new reports' },
                    { key: 'canEditReports', label: 'Edit Reports', desc: 'Can modify existing reports' },
                    { key: 'canDeleteReports', label: 'Delete Reports', desc: 'Can delete reports' },
                    { key: 'canManageConnections', label: 'Manage Connections', desc: 'Can create, edit, and delete database connections' },
                    { key: 'canInviteUsers', label: 'Invite Users', desc: 'Can invite new team members' },
                    { key: 'canManageUsers', label: 'Manage Users', desc: 'Can manage user permissions and settings' }
                  ].map(perm => {
                    const effectiveValue = userPermissions.effective?.[perm.key];
                    const overrideValue = userPermissions.overrides?.[perm.key];
                    const isOverridden = overrideValue !== null && overrideValue !== undefined;
                    
                    return (
                      <div 
                        key={perm.key}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '1rem',
                          padding: '1rem',
                          background: isOverridden ? '#fff8e1' : '#f5f5f5',
                          border: '1px solid ' + (isOverridden ? '#ffb74d' : '#ddd'),
                          borderRadius: '4px'
                        }}
                      >
                        <button
                          onClick={() => handlePermissionToggle(perm.key)}
                          disabled={savingPermissions}
                          style={{
                            width: '60px',
                            height: '32px',
                            background: effectiveValue ? '#28a745' : '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '16px',
                            cursor: savingPermissions ? 'wait' : 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.75rem',
                            position: 'relative',
                            transition: 'background 0.3s'
                          }}
                        >
                          {effectiveValue ? 'ON' : 'OFF'}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '.25rem' }}>
                            {perm.label}
                            {isOverridden && (
                              <span style={{ 
                                marginLeft: '.5rem', 
                                fontSize: '0.75rem', 
                                color: '#ff9800',
                                fontWeight: 'normal'
                              }}>
                                (Custom)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#666' }}>
                            {perm.desc}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '1rem', 
                  background: '#e3f2fd', 
                  borderRadius: '4px',
                  fontSize: '0.85rem'
                }}>
                  <strong>💡 Tip:</strong> Click a permission toggle to cycle through: Role Default → ON → OFF → Role Default
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Managers Tab */}
      {activeTab === 'managers' && (
        <div>
          <h4>Assigned Managers ({managers.length})</h4>
          <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
            These managers have been assigned to your organization by a platform administrator.
          </p>
          {managers.length === 0 ? (
            <p style={{ color: '#666' }}>No managers assigned yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
                  <th style={{ padding: '.5rem', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '.5rem', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '.5rem', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((mgr, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '.5rem' }}>
                      {mgr.firstName && mgr.lastName ? `${mgr.firstName} ${mgr.lastName}` : '-'}
                    </td>
                    <td style={{ padding: '.5rem' }}>{mgr.email}</td>
                    <td style={{ padding: '.5rem', fontSize: '0.85rem' }}>
                      {mgr.active ? (
                        <span style={{ color: '#28a745' }}>✓ Active</span>
                      ) : (
                        <span style={{ color: '#6c757d' }}>Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Database Connections Tab */}
      {activeTab === 'connections' && (
        <div>
          <DatabaseConnections clientId={clientId} />
        </div>
      )}
    </div>
  );
}
