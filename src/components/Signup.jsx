import React, { useState, useEffect } from 'react';
import { signup, checkHasUsers } from '../api.js';

export default function Signup({ onSignupSuccess }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [responseData, setResponseData] = useState(null);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [checkingUsers, setCheckingUsers] = useState(true);
  const [inviteClientId, setInviteClientId] = useState(null);
  const [inviteClientName, setInviteClientName] = useState('');
  const [invitationToken, setInvitationToken] = useState(null);

  useEffect(() => {
    // Check URL parameters for invitation token OR legacy invitation link
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const clientId = params.get('client');
    const clientName = params.get('clientName');
    
    if (token) {
      // New invitation token flow
      setInvitationToken(token);
      // Note: email will be validated on signup to match invitation email
    } else if (clientId && clientName) {
      // Legacy clientId flow (for backward compatibility)
      setInviteClientId(clientId);
      setInviteClientName(decodeURIComponent(clientName));
      setCompanyName(decodeURIComponent(clientName));
    }
    
    // Check if this will be the first user
    (async () => {
      const result = await checkHasUsers();
      if (result && !result.error) {
        setIsFirstUser(!result.hasUsers);
      }
      setCheckingUsers(false);
    })();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (isFirstUser && password && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (isFirstUser && password && password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Always send companyName; for legacy clientId flows keep clientId flag; for token flows backend will use companyName when clientId is absent
    const companyOrClient = inviteClientId || companyName.trim();
    const res = await signup(
      email.trim(), 
      firstName.trim(), 
      lastName.trim(), 
      companyOrClient,
      isFirstUser ? password : undefined,
      invitationToken ? false : (inviteClientId ? true : false),  // isClientId flag
      invitationToken  // Pass token if available
    );
    setLoading(false);
    
    if (res?.error) {
      setError(res.error + (res.body ? `: ${res.body}` : ''));
    } else if (res?.message) {
      setSuccess(true);
      setResponseData(res);
      setEmail('');
      setFirstName('');
      setLastName('');
      setCompanyName('');
      setTimeout(() => {
        if (onSignupSuccess) onSignupSuccess(res);
      }, 2000);
    } else {
      setError('Unexpected response');
    }
  }

  if (success) {
    const isPlatformAdmin = responseData?.role === 'platform_admin';
    return (
      <div style={{ maxWidth: 400, padding: '2rem', background: '#f0f8ff', border: '1px solid #4CAF50', borderRadius: '.5rem' }}>
        <h2 style={{ color: '#4CAF50', margin: '0 0 1rem 0' }}>✓ Account Created</h2>
        <p>Thank you for signing up!</p>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          {isPlatformAdmin 
            ? 'As the first user, your account is automatically verified. You can now log in. Please remember to set up email settings in the admin panel.' 
            : 'Please check your email to verify your account and set a password.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
      <h2>Create Account</h2>
      <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>Get started with your free account</p>
      {error && <div style={{ color: 'red', marginBottom: '.5rem', padding: '.5rem', background: '#ffe6e6', borderRadius: '.25rem' }}>{error}</div>}
      
      <label style={{ display: 'block', marginBottom: '.25rem', fontWeight: 'bold' }}>
        Company Name <span style={{ color: '#999', fontSize: '0.85rem', fontWeight: 'normal' }}>(optional)</span>
      </label>
      <input 
        type="text" 
        value={companyName} 
        onChange={e => setCompanyName(e.target.value)} 
        placeholder="Acme Pest Control"
        style={{ 
          width: '100%', 
          marginBottom: '1rem', 
          padding: '.5rem', 
          borderRadius: '.25rem', 
          border: '1px solid #ccc', 
          boxSizing: 'border-box',
          backgroundColor: inviteClientId ? '#f0f0f0' : 'white',
          cursor: inviteClientId ? 'not-allowed' : 'text'
        }}
        disabled={!!inviteClientId}
      />
      {inviteClientId && (
        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '-0.75rem', marginBottom: '1rem', fontStyle: 'italic' }}>
          You've been invited to join {inviteClientName}
        </p>
      )}

      <label style={{ display: 'block', marginBottom: '.25rem', fontWeight: 'bold' }}>First Name</label>
      <input 
        type="text" 
        value={firstName} 
        onChange={e => setFirstName(e.target.value)} 
        placeholder="John"
        style={{ width: '100%', marginBottom: '1rem', padding: '.5rem', borderRadius: '.25rem', border: '1px solid #ccc', boxSizing: 'border-box' }}
        required
      />

      <label style={{ display: 'block', marginBottom: '.25rem', fontWeight: 'bold' }}>Last Name</label>
      <input 
        type="text" 
        value={lastName} 
        onChange={e => setLastName(e.target.value)} 
        placeholder="Doe"
        style={{ width: '100%', marginBottom: '1rem', padding: '.5rem', borderRadius: '.25rem', border: '1px solid #ccc', boxSizing: 'border-box' }}
        required
      />

      <label style={{ display: 'block', marginBottom: '.25rem', fontWeight: 'bold' }}>Email</label>
      <input 
        type="email" 
        value={email} 
        onChange={e => setEmail(e.target.value)} 
        placeholder="you@example.com" 
        style={{ width: '100%', marginBottom: '1rem', padding: '.5rem', borderRadius: '.25rem', border: '1px solid #ccc', boxSizing: 'border-box' }}
        required
      />

      {isFirstUser && (
        <>
          <label style={{ display: 'block', marginBottom: '.25rem', fontWeight: 'bold' }}>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="At least 6 characters"
            style={{ width: '100%', marginBottom: '1rem', padding: '.5rem', borderRadius: '.25rem', border: '1px solid #ccc', boxSizing: 'border-box' }}
            required
          />

          <label style={{ display: 'block', marginBottom: '.25rem', fontWeight: 'bold' }}>Confirm Password</label>
          <input 
            type="password" 
            value={confirmPassword} 
            onChange={e => setConfirmPassword(e.target.value)} 
            placeholder="Re-enter password"
            style={{ width: '100%', marginBottom: '1.5rem', padding: '.5rem', borderRadius: '.25rem', border: '1px solid #ccc', boxSizing: 'border-box' }}
            required
          />
        </>
      )}

      {!isFirstUser && !checkingUsers && (
        <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem', fontStyle: 'italic' }}>
          You'll receive an email to verify your account and set your password.
        </p>
      )}

      <button 
        type="submit" 
        disabled={loading}
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
        {loading ? 'Creating Account...' : 'Sign Up'}
      </button>

      <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666', textAlign: 'center' }}>
        Already have an account? <a href="/login" style={{ color: '#0078d4', textDecoration: 'none' }}>Log in</a>
      </p>
    </form>
  );
}
