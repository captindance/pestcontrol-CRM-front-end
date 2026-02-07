import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// In development backend runs on 3001; in production both frontend & backend are proxied on 3000
const API_BASE = (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) setError('Missing verification token');
  }, [token]);

  async function handleVerify(e) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSuccess(true);
      setLoading(false);
    } catch (e) {
      setError(e?.message || 'Network error');
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ fontFamily: 'system-ui', padding: '1.5rem', maxWidth: '400px', margin: '2rem auto' }}>
        <h2>Email Verified!</h2>
        <p>Your email has been verified and your password has been set. You can now <a href="/">log in</a>.</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: '1.5rem', maxWidth: '400px', margin: '2rem auto' }}>
      <h2>Verify Email & Set Password</h2>
      {error && <div style={{ color:'red', marginBottom:'.5rem' }}>{error}</div>}
      <form onSubmit={handleVerify}>
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••"
          style={{ width:'100%', marginBottom:'.5rem', padding:'.5rem' }}
        />
        <label>Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="••••••"
          style={{ width:'100%', marginBottom:'.75rem', padding:'.5rem' }}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify & Set Password'}
        </button>
      </form>
    </div>
  );
}
