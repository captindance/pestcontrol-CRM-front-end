import React from 'react';

export function ReportCardSkeleton() {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: '6px',
      padding: '1rem',
      marginBottom: '1rem',
      animation: 'pulse 1.5s ease-in-out infinite'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.75rem' }}>
        <div style={{ height: '24px', width: '200px', background: '#e0e0e0', borderRadius: '4px' }} />
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <div style={{ height: '32px', width: '60px', background: '#e0e0e0', borderRadius: '4px' }} />
          <div style={{ height: '32px', width: '70px', background: '#e0e0e0', borderRadius: '4px' }} />
        </div>
      </div>
      <div style={{ height: '16px', width: '150px', background: '#e0e0e0', borderRadius: '4px', marginBottom: '.5rem' }} />
      <div style={{ height: '16px', width: '180px', background: '#e0e0e0', borderRadius: '4px' }} />

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #ddd',
      borderRadius: '6px',
      padding: '1rem',
      animation: 'pulse 1.5s ease-in-out infinite'
    }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '.5rem', marginBottom: '.75rem' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} style={{ height: '20px', background: '#e0e0e0', borderRadius: '4px' }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '.5rem', marginBottom: '.5rem' }}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} style={{ height: '16px', background: '#f0f0f0', borderRadius: '4px' }} />
          ))}
        </div>
      ))}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '3rem 1rem',
      background: '#f8f9fa',
      borderRadius: '8px',
      border: '2px dashed #ddd'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{icon}</div>
      <h3 style={{ margin: '0 0 .5rem 0', color: '#333' }}>{title}</h3>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>{message}</p>
      {action && action}
    </div>
  );
}
