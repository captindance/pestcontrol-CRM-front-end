import React, { useEffect } from 'react';

export default function Toast({ message, type = 'success', duration = 3000, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: { bg: '#28a745', icon: '✓' },
    error: { bg: '#dc3545', icon: '✕' },
    info: { bg: '#0078d4', icon: 'ⓘ' },
    warning: { bg: '#ffc107', icon: '⚠', color: '#000' }
  };

  const style = colors[type] || colors.info;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: style.bg,
        color: style.color || '#fff',
        padding: '1rem 1.5rem',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '.75rem',
        zIndex: 9999,
        animation: 'slideIn 0.3s ease',
        minWidth: '300px',
        maxWidth: '500px'
      }}
    >
      <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{style.icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: '1.2rem',
          padding: '0 .25rem',
          opacity: 0.8
        }}
        onMouseEnter={e => e.target.style.opacity = 1}
        onMouseLeave={e => e.target.style.opacity = 0.8}
        aria-label="Close notification"
      >
        ×
      </button>

      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
