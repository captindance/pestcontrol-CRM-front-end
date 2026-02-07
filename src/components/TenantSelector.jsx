import React from 'react';

export default function TenantSelector({ assignments, selected, onSelect }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ marginRight: '.5rem' }}>Client:</label>
      <select value={selected || ''} onChange={e => onSelect(e.target.value)}>
        <option value="">Select a client</option>
        {assignments.map(a => (
          <option key={a.clientId} value={a.clientId}>{a.clientName || a.clientId}</option>
        ))}
      </select>
    </div>
  );
}
