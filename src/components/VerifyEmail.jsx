import React, { useState } from 'react';

// In development backend runs on 3001; in production both frontend & backend are proxied on 3000
const API_BASE = (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

export default function VerifyEmail() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');

  React.useEffect(() => {
    // Get token from URL
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setError('No verification token found');
    } else {
      setToken(t);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      setSuccess(true);
      setPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (e) {
      setError(e?.message || 'Verification failed');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 400, padding: '2rem', background: '#f0f8ff', border: '1px solid #4CAF50', borderRadius: '.5rem' }}>
        <h2 style={{ color: '#4CAF50', margin: '0 0 1rem 0' }}>✓ Email Verified</h2>
        <p>Your email has been verified and password has been set. Redirecting to login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
      <h2>Set Your Password</h2>
      {error && <div style={{ color: 'red', marginBottom: '.5rem', padding: '.5rem', background: '#ffe6e6', borderRadius: '.25rem' }}>{error}</div>}
      
      <label style={{ display: 'block', marginBottom: '.25rem', fontWeight: 'bold' }}>Password</label>
      <input 
        type="password" 
        value={password} 
        onChange={e => setPassword(e.target.value)} 
        placeholder="••••••"
        style={{ width: '100%', marginBottom: '1rem', padding: '.5rem', borderRadius: '.25rem', border: '1px solid #ccc', boxSizing: 'border-box' }}
        required
      />

      <label style={{ display: 'block', marginBottom: '.25rem', fontWeight: 'bold' }}>Confirm Password</label>
      <input 
        type="password" 
        value={confirmPassword} 
        onChange={e => setConfirmPassword(e.target.value)} 
        placeholder="••••••"
        style={{ width: '100%', marginBottom: '1.5rem', padding: '.5rem', borderRadius: '.25rem', border: '1px solid #ccc', boxSizing: 'border-box' }}
        required
      />

      <button 
        type="submit" 
        disabled={loading || !token}
        style={{ 
          width: '100%', 
          padding: '.75rem', 
          background: '#0078d4', 
          color: 'white', 
          border: 'none', 
          borderRadius: '.25rem', 
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 'bold'
        }}
      >
        {loading ? 'Verifying...' : 'Set Password & Verify'}
      </button>
    </form>
  );
}
