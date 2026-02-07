import React, { useState } from 'react';

export default function Sidebar({ role, roles, actingRole, onActingRoleChange, tenantId, tenantOptions, onTenantChange, navItems, currentNav, onNavSelect, onLogout }) {
  const [showCapabilities, setShowCapabilities] = useState(false);

  const capabilities = buildCapabilities(roles, actingRole);

  return (
    <div style={{
      width: '280px',
      background: '#f5f5f5',
      borderRight: '1px solid #ddd',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      boxSizing: 'border-box'
    }}>
      {/* Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid #ddd' }}>
        <h3 style={{ margin: '0 0 .5rem 0' }}>PestControl CRM</h3>
        <small style={{ color: '#666' }}>v0.1</small>
      </div>

      {/* Role info + selector */}
      <div style={{ padding: '1rem', borderBottom: '1px solid #ddd' }}>
        <div style={{ marginBottom: '.5rem' }}>
          <small style={{ color: '#666' }}>Primary Role</small>
          <div><strong>{role || 'unknown'}</strong></div>
        </div>
        {Array.isArray(roles) && roles.length > 1 && (
          <div>
            <small style={{ color: '#666' }}>Acting As</small>
            <select value={actingRole} onChange={e => onActingRoleChange(e.target.value)} style={{ width: '100%', padding: '.25rem' }}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => onNavSelect(item.key)}
            style={{
              display: 'block',
              width: '100%',
              padding: '.75rem 1rem',
              background: currentNav === item.key ? '#0078d4' : 'transparent',
              color: currentNav === item.key ? '#fff' : '#333',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => !currentNav.includes(item.key) && (e.target.style.background = '#e8e8e8')}
            onMouseLeave={e => !currentNav.includes(item.key) && (e.target.style.background = 'transparent')}
          >
            {item.title}
          </button>
        ))}
      </nav>

      {/* Capabilities */}
      <div style={{ padding: '1rem', borderTop: '1px solid #ddd', background: '#fff' }}>
        <button
          onClick={() => setShowCapabilities(!showCapabilities)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0078d4', textDecoration: 'underline', padding: 0 }}
        >
          {showCapabilities ? '▼' : '▶'} Capabilities
        </button>
        {showCapabilities && (
          <div style={{ marginTop: '.5rem' }}>
            {capabilities.length === 0 ? (
              <small style={{ color: '#666' }}>None</small>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                {capabilities.map((c, i) => <li key={i}><small>{c}</small></li>)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* User footer */}
      <div style={{ padding: '1rem', borderTop: '1px solid #ddd', background: '#fff' }}>
        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '.5rem',
            background: '#dc3545',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '.25rem'
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

function buildCapabilities(roles, actingRole) {
  const set = new Set();
  const has = (r) => Array.isArray(roles) && roles.includes(r);

  if (has('delegate')) set.add('View reports (read-only)');
  if (has('business_owner')) {
    set.add('View & run reports');
    set.add('Manage client users');
  }
  if (has('manager')) {
    set.add('Manage assigned clients');
    set.add('Run cross-client reports');
  }
  if (has('platform_admin')) {
    set.add('Create clients');
    set.add('Create & assign managers');
    set.add('Manage all users');
    set.add('Access platform admin tools');
  }

  return Array.from(set);
}
