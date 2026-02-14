import React from 'react';

export default function MainLayout({ sidebar, children }) {
  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {sidebar && sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', background: '#fff' }}>
        <main style={{ flex: 1, padding: '1.5rem', maxWidth: '100%' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
