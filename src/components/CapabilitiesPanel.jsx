import React from 'react';

export default function CapabilitiesPanel({ roles, actingRole, tenantId }) {
  const capabilities = buildCapabilities(roles, actingRole);
  return (
    <div style={{ border:'1px solid #eee', padding:'.75rem', marginBottom:'1rem' }}>
      <div style={{ marginBottom:'.5rem' }}>
        <strong>Current Context</strong>
        <div><small>Roles: {Array.isArray(roles) && roles.length ? roles.join(', ') : 'none'}</small></div>
        <div><small>Acting as: {actingRole || 'none'}</small></div>
        <div><small>Tenant: {tenantId || 'none selected'}</small></div>
      </div>
      <div>
        <strong>Available Actions</strong>
        {capabilities.length === 0 ? (
          <div><small>None</small></div>
        ) : (
          <ul style={{ margin:0, paddingLeft:'1rem' }}>
            {capabilities.map((c, i) => <li key={i}><small>{c}</small></li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function buildCapabilities(roles, actingRole) {
  const set = new Set();
  const has = (r) => Array.isArray(roles) && roles.includes(r);
  const role = actingRole || (Array.isArray(roles) ? roles[0] : null);

  // Baseline per role
  if (has('delegate')) {
    set.add('View reports');
  }
  if (has('business_owner')) {
    set.add('View reports');
    set.add('Run reports');
    set.add('Manage client users');
  }
  if (has('manager')) {
    set.add('Select tenant (assigned)');
    set.add('View/run reports for selected tenant');
  }
  if (has('platform_admin')) {
    set.add('Select any tenant');
    set.add('Create clients');
    set.add('Create users (owner/manager/delegate)');
    set.add('Assign/deactivate managers for clients');
  }

  // Acting role may restrict capabilities shown as primary
  if (role === 'delegate') {
    // read-only emphasis
  } else if (role === 'business_owner') {
    // client management emphasis
  } else if (role === 'manager') {
    // cross-client operations limited by assignments
  } else if (role === 'platform_admin') {
    // platform-wide operations
  }

  return Array.from(set);
}
