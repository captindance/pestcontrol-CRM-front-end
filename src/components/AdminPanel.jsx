import React, { useEffect, useState } from 'react';
import { getAllClients, getEmailSettings, updateEmailSettings, sendInvitation, resendInvitation, getInvitations } from '../api.js';
import DatabaseConnections from './DatabaseConnections.jsx';

// In development backend runs on 3001; in production both frontend & backend are proxied on 3000
const API_BASE = (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

async function createUser(email, role, clientId) {
  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt')}` },
      body: JSON.stringify({ email, role, clientId })
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

async function listManagers() {
  try {
    const res = await fetch(`${API_BASE}/admin/managers`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt')}` }
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

async function listAssignments(userId) {
  try {
    const res = await fetch(`${API_BASE}/admin/managers/${userId}/assignments`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt')}` }
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

async function addAssignment(userId, clientId) {
  try {
    const res = await fetch(`${API_BASE}/admin/managers/${userId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt')}` },
      body: JSON.stringify({ clientId })
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

async function resendVerification(userId) {
  try {
    const res = await fetch(`${API_BASE}/admin/managers/${userId}/resend-verification`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwt')}` }
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

async function setAssignmentActive(userId, clientId, active) {
  try {
    const res = await fetch(`${API_BASE}/admin/managers/${userId}/assignments/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt')}` },
      body: JSON.stringify({ active })
    });
    if (!res.ok) return { error: `HTTP ${res.status}`, body: await res.text() };
    return await res.json();
  } catch (e) { return { error: e?.message || 'Network error' }; }
}

export default function AdminPanel() {
  const [clients, setClients] = useState([]);
  const [managers, setManagers] = useState([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('clients'); // 'clients', 'email' or 'managers'
  const [creationNotice, setCreationNotice] = useState(null);
  const [invitationNotice, setInvitationNotice] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [smtp, setSmtp] = useState({ host:'', port:465, secure:true, username:'', password:'', fromAddress:'' });
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testEmailSnackbar, setTestEmailSnackbar] = useState(null); // { message, type: 'success'|'error' }

  useEffect(() => {
    (async () => {
      const c = await getAllClients();
      if (Array.isArray(c)) setClients(c);
      const m = await listManagers();
      if (Array.isArray(m)) setManagers(m);
      const s = await getEmailSettings();
      if (s && !s.error) {
        if (s.configured) {
          setSmtpConfigured(true);
          setSmtp(prev => ({
            ...prev,
            host: s.host,
            port: s.port,
            secure: s.secure,
            username: s.username,
            fromAddress: s.fromAddress,
            password: '' // not returned
          }));
        }
      }
    })();
    
    // Connect to SSE stream for real-time manager updates
    const token = localStorage.getItem('jwt');
    const sseUrl = new URL(`${API_BASE}/admin/managers/updates`);
    sseUrl.searchParams.append('token', token || '');
    
    const eventSource = new EventSource(sseUrl.toString());
    
    eventSource.addEventListener('open', () => {
      console.log('[SSE] Connected to manager updates');
    });
    
    eventSource.addEventListener('managerVerified', () => {
      console.log('[SSE] Manager verified event received, refreshing managers');
      handleRefreshManagers();
    });
    
    eventSource.addEventListener('message', (event) => {
      console.log('[SSE] Message event received:', event.data);
    });
    
    eventSource.onerror = (err) => {
      console.error('[SSE] Connection error:', err);
      eventSource.close();
    };
    
    return () => {
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'invitations') {
      loadInvitations();
    }
  }, [activeTab]);

  async function loadInvitations() {
    setInvitationsLoading(true);
    setInvitationNotice(null);
    const res = await getInvitations();
    setInvitationsLoading(false);
    if (Array.isArray(res)) {
      setInvitations(res);
    } else if (res?.error) {
      setError(res.error + (res.body ? `: ${res.body}` : ''));
    }
  }

  async function handleCreateManager() {
    setError(null);
    setCreationNotice(null);
    const res = await createUser(email, 'manager');
    if (res?.error) setError(res.error + (res.body ? `: ${res.body}` : ''));
    else {
      setManagers(m => [...m, res]);
      setEmail('');
      if (res.emailSent) {
        setCreationNotice({ type: 'sent', email: res.email, message: 'Verification email sent. The manager will receive a link to verify and set their password.' });
      } else {
        const detail = res.emailError ? ` (${res.emailError})` : '';
        const msg = res.message || (res.emailError?.includes('SMTP not configured') ? 'SMTP not configured. Configure Email Settings, then use "Resend verification".' : 'Verification email could not be sent. Use "Resend verification" after SMTP is configured.') + detail;
        setCreationNotice({ type: 'error', email: res.email, message: msg });
      }
    }
  }

  async function handleAddAssignment(userId, clientId) {
    setError(null);
    const res = await addAssignment(userId, clientId);
    if (res?.error) {
      setError(res.error + (res.body ? `: ${res.body}` : ''));
    } else {
      // Refresh managers to show the new assignment
      const m = await listManagers();
      if (Array.isArray(m)) setManagers(m);
    }
  }

  async function handleToggleActive(userId, clientId, active) {
    setError(null);
    const res = await setAssignmentActive(userId, clientId, active);
    if (res?.error) setError(res.error + (res.body ? `: ${res.body}` : ''));
  }

  async function handleRefreshManagers() {
    const m = await listManagers();
    if (Array.isArray(m)) setManagers(m);
  }

  async function handleSendInvitation() {
    if (!inviteEmail.trim()) {
      setError('Invitation email is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    const res = await sendInvitation(inviteEmail.trim(), null);
    if (res?.error) {
      setError(res.error + (res.body ? `: ${res.body}` : ''));
    } else {
      setInvitationNotice(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      loadInvitations();
      setTimeout(() => setInvitationNotice(null), 4000);
    }
  }

  async function handleResendInvitation(invitationId) {
    setError(null);
    const res = await resendInvitation(invitationId);
    if (res?.error) {
      setError(res.error + (res.body ? `: ${res.body}` : ''));
    } else {
      setInvitationNotice('Invitation resent');
      loadInvitations();
      setTimeout(() => setInvitationNotice(null), 4000);
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }

  return (
    <div>
      <div style={{ border:'1px solid #ddd', padding:'1rem', marginTop:'1rem' }}>
        <h3>Admin Panel</h3>
        {error && <div style={{ color:'red', marginBottom:'.5rem', padding:'.5rem', background:'#ffe6e6', borderRadius:'.25rem' }}>{error}</div>}
        {creationNotice && <div style={{ color:'green', marginBottom:'.5rem', padding:'.5rem', background:'#e6ffe6', borderRadius:'.25rem' }}>{creationNotice}</div>}
        
        {/* Tab Navigation */}
        <div style={{ display:'flex', gap:'.5rem', marginBottom:'1rem', borderBottom:'2px solid #eee', paddingBottom:'.5rem' }}>
        <button
          onClick={() => setActiveTab('clients')}
          style={{
            padding:'.5rem 1rem',
            background: activeTab === 'clients' ? '#007bff' : '#f0f0f0',
            color: activeTab === 'clients' ? 'white' : 'black',
            border: 'none',
            borderRadius:'4px',
            cursor: 'pointer',
            fontWeight: activeTab === 'clients' ? 'bold' : 'normal'
          }}
        >
          Clients
        </button>
        <button
          onClick={() => setActiveTab('invitations')}
          style={{
            padding:'.5rem 1rem',
            background: activeTab === 'invitations' ? '#007bff' : '#f0f0f0',
            color: activeTab === 'invitations' ? 'white' : 'black',
            border: 'none',
            borderRadius:'4px',
            cursor: 'pointer',
            fontWeight: activeTab === 'invitations' ? 'bold' : 'normal'
          }}
        >
          Invitations
        </button>
        <button
          onClick={() => setActiveTab('managers')}
          style={{
            padding:'.5rem 1rem',
            background: activeTab === 'managers' ? '#007bff' : '#f0f0f0',
            color: activeTab === 'managers' ? 'white' : 'black',
            border: 'none',
            borderRadius:'4px',
            cursor: 'pointer',
            fontWeight: activeTab === 'managers' ? 'bold' : 'normal'
          }}
        >
          Manager Delegation
        </button>
        <button
          onClick={() => setActiveTab('email')}
          style={{
            padding:'.5rem 1rem',
            background: activeTab === 'email' ? '#007bff' : '#f0f0f0',
            color: activeTab === 'email' ? 'white' : 'black',
            border: 'none',
            borderRadius:'4px',
            cursor: 'pointer',
            fontWeight: activeTab === 'email' ? 'bold' : 'normal'
          }}
        >
          Email Settings
        </button>

      </div>

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div style={{ border:'1px solid #eee', padding:'.75rem', marginBottom:'1rem' }}>
          <h4>Email (SMTP) Settings</h4>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.5rem' }}>
            <label>
              Host
              <input type="text" value={smtp.host} onChange={e=>setSmtp(s=>({ ...s, host:e.target.value }))} />
            </label>
            <label>
              Port
              <input type="number" value={smtp.port} onChange={e=>setSmtp(s=>({ ...s, port:Number(e.target.value) }))} />
            </label>
            <label>
              Username
              <input type="text" value={smtp.username} onChange={e=>setSmtp(s=>({ ...s, username:e.target.value }))} />
            </label>
            <label>
              Password
              <input type="password" value={smtp.password} onChange={e=>setSmtp(s=>({ ...s, password:e.target.value }))} placeholder={smtpConfigured ? '(unchanged)' : ''} />
            </label>
            <label>
              From Address
              <input type="email" value={smtp.fromAddress} onChange={e=>setSmtp(s=>({ ...s, fromAddress:e.target.value }))} />
            </label>
            <label>
              Test Email Address
              <input type="email" value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="where to send test email" />
            </label>
          </div>
          <div style={{ marginTop:'.5rem' }}>
            <button disabled={smtpSaving || !smtp.host || !smtp.port || !smtp.username || !smtp.fromAddress || (!smtpConfigured && !smtp.password)} onClick={async ()=>{
              setSmtpSaving(true);
              const res = await updateEmailSettings({ ...smtp });
              setSmtpSaving(false);
              if (res?.error) setError(res.error + (res.body ? `: ${res.body}` : ''));
              else {
                setSmtpConfigured(true);
                if (!smtp.password) {
                  // keep unchanged marker
                } else {
                  setSmtp(s=>({ ...s, password:'' }));
                }
                alert('SMTP settings saved.');
              }
            }}>Save SMTP Settings</button>
            {smtpConfigured && <span style={{ marginLeft:'.5rem', color:'green' }}>Configured</span>}
            <button disabled={!testEmail} style={{ marginLeft:'.5rem', background: testEmail ? '#17a2b8' : '#ccc', color:'white', border:'none', padding:'.4rem .8rem', borderRadius:'4px', cursor: testEmail ? 'pointer' : 'not-allowed' }} onClick={async ()=>{
              if (!testEmail) return;
              try {
                const res = await fetch(`${API_BASE}/admin/email-test`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('jwt')}` },
                  body: JSON.stringify({ testEmail })
                });
                const data = await res.json();
                if (res.ok) {
                  const acceptedList = data.accepted?.length > 0 ? `Accepted: ${data.accepted.join(', ')}` : '';
                  const rejectedList = data.rejected?.length > 0 ? `Rejected: ${data.rejected.join(', ')}` : '';
                  const details = [
                    `✓ Test email sent successfully!`,
                    `\nMessage ID: ${data.messageId}`,
                    `Recipient: ${testEmail}`,
                    acceptedList ? `\n${acceptedList}` : '',
                    rejectedList ? `${rejectedList}` : '',
                    `\nSMTP Response: ${data.response || 'N/A'}`
                  ].filter(Boolean).join('\n');
                  setTestEmailSnackbar({ message: details, type: 'success' });
                } else {
                  setTestEmailSnackbar({ message: `✗ Failed to send test email:\n\n${data.error || 'Unknown error'}`, type: 'error' });
                }
              } catch (e) {
                setTestEmailSnackbar({ message: `✗ Error: ${e?.message || 'Network error'}`, type: 'error' });
              }
            }}>Send Test Email</button>
          </div>
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div style={{ border:'1px solid #eee', padding:'.75rem', marginBottom:'1rem' }}>
          <h4>Invitations</h4>
          <p style={{ fontSize:'0.9rem', color:'#666' }}>Send a generic invitation link and track whether the email recipient has created their account.</p>

          <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', marginBottom:'1rem' }}>
            <input 
              type="email" 
              placeholder="invitee@example.com" 
              value={inviteEmail} 
              onChange={e => setInviteEmail(e.target.value)}
              style={{ flex: '1 1 280px', padding: '.5rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <button 
              onClick={handleSendInvitation}
              style={{ padding:'.55rem 1rem', background:'#007bff', color:'white', border:'none', borderRadius:'4px', cursor:'pointer' }}
            >
              Send Invitation
            </button>
          </div>

          {invitationNotice && (
            <div style={{ marginBottom:'1rem', padding:'.5rem', background:'#e6ffe6', border:'1px solid #b2e6b2', borderRadius:'4px', color:'#1e7e34' }}>
              {invitationNotice}
            </div>
          )}

          {invitationsLoading ? (
            <p>Loading invitations...</p>
          ) : invitations.length === 0 ? (
            <p style={{ color:'#666' }}>No invitations sent yet.</p>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid #ddd', background:'#f5f5f5' }}>
                  <th style={{ padding:'.5rem', textAlign:'left' }}>Email</th>
                  <th style={{ padding:'.5rem', textAlign:'left' }}>Client</th>
                  <th style={{ padding:'.5rem', textAlign:'left' }}>Status</th>
                  <th style={{ padding:'.5rem', textAlign:'left' }}>Sent</th>
                  <th style={{ padding:'.5rem', textAlign:'left' }}>Accepted</th>
                  <th style={{ padding:'.5rem', textAlign:'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => {
                  const statusBadgeStyle = inv.accountCreated || inv.status === 'accepted'
                    ? { background:'#e6f4ea', color:'#1e7e34' }
                    : { background:'#fff4e5', color:'#b36b00' };
                  return (
                    <tr key={inv.id} style={{ borderBottom:'1px solid #eee' }}>
                      <td style={{ padding:'.5rem' }}>{inv.email}</td>
                      <td style={{ padding:'.5rem', color:'#555' }}>{inv.clientName || '—'}</td>
                      <td style={{ padding:'.5rem' }}>
                        <span style={{ padding:'0 .4rem', borderRadius:'4px', fontSize:'0.9rem', ...statusBadgeStyle }}>
                          {inv.accountCreated || inv.status === 'accepted' ? 'Account created ✓' : inv.status}
                        </span>
                      </td>
                      <td style={{ padding:'.5rem', color:'#555' }}>{formatDate(inv.sentAt)}</td>
                      <td style={{ padding:'.5rem', color:'#555' }}>{formatDate(inv.acceptedAt)}</td>
                      <td style={{ padding:'.5rem' }}>
                        {inv.status === 'pending' && (
                          <button 
                            onClick={() => handleResendInvitation(inv.id)}
                            style={{ padding:'.35rem .7rem', background:'#17a2b8', color:'white', border:'none', borderRadius:'4px', cursor:'pointer' }}
                          >
                            Resend
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Clients Tab */}
      {activeTab === 'clients' && (
        <div>
          <div>
            <h4>Existing Clients ({clients.length})</h4>
            {clients.length === 0 ? (
              <p style={{ color: '#666' }}>No clients yet. Send an invitation; the client record will be created when the invitee signs up.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Client Name</th>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Client ID</th>
                    <th style={{ padding: '.5rem', textAlign: 'left' }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client, i) => {
                    const date = new Date(client.createdAt);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    const formattedDate = `${month}/${day}/${year}`;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '.5rem' }}>{client.name}</td>
                        <td style={{ padding: '.5rem', fontSize: '0.85rem', color: '#666' }}>{client.id}</td>
                        <td style={{ padding: '.5rem', fontSize: '0.85rem', color: '#666' }}>{formattedDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Managers Tab */}
      {activeTab === 'managers' && (
        <div>
          <div style={{ marginBottom:'1rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.5rem' }}>
              <h4 style={{ margin:0 }}>Create Manager</h4>
              <button onClick={handleRefreshManagers} style={{ padding:'.4rem .8rem', background:'#f0f0f0', border:'1px solid #ccc', cursor:'pointer', borderRadius:'4px' }}>Refresh Managers</button>
            </div>
            <div style={{ display:'flex', gap:'.5rem' }}>
              <input type="email" placeholder="manager@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
              <button onClick={handleCreateManager}>Create Manager</button>
            </div>
            {creationNotice && (
              <div style={{ marginTop:'.75rem', border:'1px solid #e0e0e0', padding:'.75rem', background:'#fafafa' }}>
                <div style={{ fontWeight:'bold', marginBottom:'.25rem' }}>Manager created: {creationNotice.email}</div>
                <div style={{ color: creationNotice.type === 'sent' ? 'green' : '#b36b00' }}>{creationNotice.message}</div>
              </div>
            )}
          </div>
          <div>
            <h4>Managers</h4>
            {managers.map(m => (
              <ManagerRow key={m.id} manager={m} clients={clients} onAddAssignment={handleAddAssignment} onToggleActive={handleToggleActive} />
            ))}
          </div>
        </div>
      )}
      {testEmailSnackbar && (
        <div style={{
          position: 'fixed',
          bottom: '1rem',
          right: '1rem',
          background: testEmailSnackbar.type === 'success' ? '#d4edda' : '#f8d7da',
          color: testEmailSnackbar.type === 'success' ? '#155724' : '#721c24',
          border: `1px solid ${testEmailSnackbar.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px',
          padding: '1rem',
          maxWidth: '400px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 1000,
          whiteSpace: 'pre-wrap',
          userSelect: 'text',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          lineHeight: '1.4'
        }}>
          {testEmailSnackbar.message}
          <button onClick={() => setTestEmailSnackbar(null)} style={{
            marginTop: '.5rem',
            marginLeft: '.5rem',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: 0,
            fontWeight: 'bold'
          }}>×</button>
        </div>
      )}
    </div>
    </div>
  );
}

function ManagerRow({ manager, clients, onAddAssignment, onToggleActive }) {
  const [assignments, setAssignments] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [resendStatus, setResendStatus] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    (async () => {
      const a = await listAssignments(manager.id);
      if (Array.isArray(a)) setAssignments(a);
    })();
  }, [manager.id, manager]);

  const handleCopyVerificationLink = () => {
    if (!manager.emailVerificationToken) return;
    const baseUrl = import.meta.env?.DEV ? 'http://localhost:3001' : window.location.origin;
    const link = `${baseUrl}/verify-email?token=${manager.emailVerificationToken}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <div style={{ border:'1px solid #eee', padding:'.5rem', marginBottom:'.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap' }}>
        <span><strong>{manager.email}</strong> <small>({manager.id})</small></span>
        <span style={{ padding:'0 .4rem', borderRadius:'4px', background: manager.emailVerified ? '#e6f4ea' : '#fff4e5', color: manager.emailVerified ? '#1e7e34' : '#b36b00' }}>
          {manager.emailVerified ? 'Verified' : 'Unverified'}
        </span>
        {!manager.emailVerified && (
          <>
            <button onClick={async ()=>{
              setResendStatus('');
              const res = await resendVerification(manager.id);
              if (res?.error) {
                const detail = res.body && typeof res.body === 'string' ? res.body : '';
                const combined = `${res.error}${detail ? ` ${detail}` : ''}`;
                const friendly = combined.includes('SMTP not configured')
                  ? 'SMTP not configured. Configure Email Settings and try again.'
                  : combined;
                setResendStatus(`Failed to resend: ${friendly}`);
              } else setResendStatus('Verification email resent.');
            }}>Resend verification</button>
            {manager.emailVerificationToken && (
              <button style={{ background:'#0066cc', color:'white', border:'none', padding:'.4rem .8rem', borderRadius:'4px', cursor:'pointer' }} onClick={handleCopyVerificationLink}>
                {copiedLink ? '✓ Copied link' : 'Copy verification link'}
              </button>
            )}
          </>
        )}
        {resendStatus && <span style={{ color: resendStatus.startsWith('Failed') ? 'red' : 'green' }}>{resendStatus}</span>}
      </div>
      <div style={{ marginTop:'.5rem' }}>
        <label>Assign client: </label>
        <select value={selectedClientId} onChange={e=>setSelectedClientId(e.target.value)} disabled={!manager.emailVerified}>
          <option value="">Select client</option>
          {clients.filter(c => !assignments.some(a => a.clientId === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button style={{ marginLeft:'.5rem' }} disabled={!selectedClientId || !manager.emailVerified} onClick={() => onAddAssignment(manager.id, selectedClientId)}>Assign</button>
        {!manager.emailVerified && <span style={{ marginLeft:'.5rem', color:'#b36b00' }}>Verify manager before assigning clients.</span>}
      </div>
      <div style={{ marginTop:'.5rem' }}>
        <strong>Assigned Clients</strong>
        {assignments.length === 0 && <div><small>None</small></div>}
        {assignments.map(a => (
          <div key={a.clientId} style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
            <span>{a.clientId}</span>
            <span style={{ color: a.active ? 'green' : 'gray' }}>{a.active ? 'active' : 'inactive'}</span>
            <button onClick={() => onToggleActive(manager.id, a.clientId, !a.active)}>
              {a.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
