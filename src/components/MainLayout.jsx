import React from 'react';

export default function MainLayout({ sidebar, children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      {sidebar && sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', background: '#fff' }}>
        <main style={{ flex: 1, padding: '1.5rem' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
