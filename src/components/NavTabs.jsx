import React from 'react';

export default function NavTabs({ views, current, onSelect }) {
  return (
    <div style={{ display:'flex', gap:'.5rem', borderBottom:'1px solid #ddd', marginBottom:'1rem' }}>
      {views.map(v => (
        <button
          key={v.key}
          onClick={() => onSelect(v.key)}
          style={{
            padding:'.5rem .75rem',
            border:'none',
            borderBottom: current === v.key ? '2px solid #0078d4' : '2px solid transparent',
            background:'transparent',
            cursor:'pointer',
            color: current === v.key ? '#0078d4' : '#333'
          }}
          title={v.title}
        >
          {v.title}
        </button>
      ))}
    </div>
  );
}
