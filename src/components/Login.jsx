import React, { useState } from 'react';
import { login } from '../auth.js';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await login(email, password);
    setLoading(false);
    if (res?.error) {
      setError(res.error + (res.body ? `: ${res.body}` : ''));
    } else if (res?.token) {
      onLoginSuccess?.(res);
    } else {
      setError('Unexpected response');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 360 }}>
      <h2>Login</h2>
      {error && <div style={{ color:'red', marginBottom: '.5rem' }}>{error}</div>}
      <label>Email</label>
      <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={{ width:'100%', marginBottom: '.5rem' }} />
      <label>Password</label>
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••" style={{ width:'100%', marginBottom: '.75rem' }} />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
