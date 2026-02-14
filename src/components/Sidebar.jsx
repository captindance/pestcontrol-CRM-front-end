import React, { useState, useEffect } from 'react';

export default function Sidebar({ role, roles, actingRole, onActingRoleChange, tenantId, tenantOptions, onTenantChange, navItems, currentNav, onNavSelect, onLogout }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Remember sidebar state in localStorage
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  }, [isCollapsed]);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {!isCollapsed && (
        <div 
          onClick={() => setIsCollapsed(true)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 998,
            display: 'none'
          }}
          className="mobile-overlay"
        />
      )}

      <div style={{
        width: isCollapsed ? '60px' : '280px',
        background: '#f5f5f5',
        borderRight: '1px solid #ddd',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        boxSizing: 'border-box',
        transition: 'width 0.3s ease',
        position: 'relative',
        zIndex: 999
      }}>
        {/* Header with toggle button */}
        <div style={{ 
          padding: isCollapsed ? '.5rem' : '1rem', 
          borderBottom: '1px solid #ddd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {!isCollapsed && (
            <div>
              <h3 style={{ margin: '0 0 .5rem 0' }}>PestControl CRM</h3>
              <small style={{ color: '#666' }}>v0.1</small>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '.4rem .6rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
              color: '#666',
              transition: 'all 0.2s',
              marginLeft: isCollapsed ? '0' : 'auto'
            }}
            onMouseEnter={e => e.target.style.background = '#e8e8e8'}
            onMouseLeave={e => e.target.style.background = 'none'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? '☰' : '◂'}
          </button>
        </div>

        {/* Role info + selector */}
        {!isCollapsed && (
          <div style={{ padding: '1rem', borderBottom: '1px solid #ddd' }}>
            <div style={{ marginBottom: '.5rem' }}>
              <small style={{ color: '#666' }}>Primary Role</small>
              <div><strong>{role || 'unknown'}</strong></div>
            </div>
            {Array.isArray(roles) && roles.length > 1 && (
              <div>
                <small style={{ color: '#666' }}>Acting As</small>
                <select 
                  value={actingRole} 
                  onChange={e => onActingRoleChange(e.target.value)} 
                  style={{ width: '100%', padding: '.25rem' }}
                >
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, padding: isCollapsed ? '.5rem 0' : '1rem 0' }}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => onNavSelect(item.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                width: '100%',
                padding: isCollapsed ? '.75rem' : '.75rem 1rem',
                background: currentNav === item.key ? '#0078d4' : 'transparent',
                color: currentNav === item.key ? '#fff' : '#333',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'background 0.2s',
                position: 'relative'
              }}
              onMouseEnter={e => !currentNav.includes(item.key) && (e.target.style.background = '#e8e8e8')}
              onMouseLeave={e => !currentNav.includes(item.key) && (e.target.style.background = 'transparent')}
              title={isCollapsed ? item.title : ''}
              aria-label={item.title}
            >
              <span style={{ fontSize: isCollapsed ? '1.3rem' : '1rem', marginRight: isCollapsed ? 0 : '.5rem' }}>
                {getNavIcon(item.key)}
              </span>
              {!isCollapsed && item.title}
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: isCollapsed ? '.5rem' : '1rem', borderTop: '1px solid #ddd', background: '#fff' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              padding: '.5rem',
              background: '#dc3545',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '.25rem',
              fontSize: isCollapsed ? '1.2rem' : '1rem'
            }}
            title={isCollapsed ? 'Logout' : ''}
            aria-label="Logout"
          >
            {isCollapsed ? '🚪' : 'Logout'}
          </button>
        </div>
      </div>

      {/* Mobile styles */}
      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-overlay {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
}

function getNavIcon(key) {
  const icons = {
    reports: '📊',
    admin: '⚙️',
    settings: '🔧',
    users: '👥',
    connections: '🔌'
  };
  return icons[key] || '📄';
}
