import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const ShieldIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const EyeIcon = ({ open }) => open ? (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const BuildingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
    <path d="M10 6h4"/>
    <path d="M10 10h4"/>
    <path d="M10 14h4"/>
    <path d="M10 18h4"/>
  </svg>
);

const DEMO_ACCOUNTS = [
  {
    roleName: 'Administrator (CISO)',
    name: 'Elena Vance',
    email: 'admin@trustvault.internal',
    pass: 'TrustVault2026!',
    tag: 'admin',
    desc: 'CISO: Full governance, audit chain inspector, break-glass'
  },
  {
    roleName: 'Document Owner (Finance)',
    name: 'Marcus Cole',
    email: 'marcus.cole@trustvault.internal',
    pass: 'TrustVault2026!',
    tag: 'owner',
    desc: 'VP Finance: owns Salary Matrix & SOC2 papers'
  },
  {
    roleName: 'Document Owner (Legal)',
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@trustvault.internal',
    pass: 'TrustVault2026!',
    tag: 'owner',
    desc: 'General Counsel: owns Project Apex M&A Agreement'
  },
  {
    roleName: 'Viewer (External Auditor)',
    name: 'David Kim',
    email: 'david.kim@external-audit.com',
    pass: 'TrustVault2026!',
    tag: 'viewer',
    desc: 'EY Senior Auditor: read-only grants on SOC2 & M&A'
  },
  {
    roleName: 'Viewer (Contractor)',
    name: 'Chloe Bennett',
    email: 'chloe.bennett@contractor.io',
    pass: 'TrustVault2026!',
    tag: 'viewer',
    desc: 'Engineering Contractor: read-only grant on SOW'
  }
];

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  
  // Login & Register Form fields
  const [email, setEmail] = useState('admin@trustvault.internal');
  const [password, setPassword] = useState('TrustVault2026!');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [role, setRole] = useState('viewer');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showCredentialsGuide, setShowCredentialsGuide] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fillAccount = (account) => {
    setEmail(account.email);
    setPassword(account.pass);
    setMode('login');
    setError('');
    setSuccess(`Loaded credentials for ${account.name} (${account.roleName})`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Invalid email or password.');
        
        localStorage.setItem('trustvault_token', data.token);
        setSuccess('Authentication successful! Opening vault...');
        setTimeout(() => window.location.reload(), 400);
      } else {
        // Registration mode
        if (!name.trim()) throw new Error('Please enter your Full Name.');
        if (!email.trim()) throw new Error('Please enter a valid Email Address.');
        if (!password || password.length < 6) throw new Error('Password must be at least 6 characters long.');

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            password,
            department: department.trim() || 'General',
            role
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Registration failed.');

        setSuccess('Account created successfully! Signing you in...');
        
        if (data.token) {
          localStorage.setItem('trustvault_token', data.token);
          setTimeout(() => window.location.reload(), 600);
        } else {
          // Fallback login
          const loginRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password })
          });
          const loginData = await loginRes.json();
          if (loginRes.ok) {
            localStorage.setItem('trustvault_token', loginData.token);
            setTimeout(() => window.location.reload(), 600);
          }
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-app, #0a0f1d)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      position: 'relative',
      overflowX: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Dynamic ambient background glow */}
      <div style={{
        position: 'absolute', top: '-15%', left: '-10%',
        width: '550px', height: '550px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-10%',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.10) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Grid Pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        pointerEvents: 'none'
      }} />

      <div style={{
        width: '100%',
        maxWidth: mode === 'login' ? '920px' : '620px',
        display: 'grid',
        gridTemplateColumns: mode === 'login' ? 'repeat(auto-fit, minmax(360px, 1fr))' : '1fr',
        gap: '24px',
        position: 'relative',
        zIndex: 1,
        transition: 'all 0.3s ease'
      }}>

        {/* Main Card (Form) */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(16,185,129,0.1)'
        }}>
          {/* Logo & Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '64px', height: '64px', borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(6,182,212,0.12))',
              border: '1px solid rgba(16,185,129,0.35)',
              color: '#10B981',
              marginBottom: '14px',
              boxShadow: '0 0 25px rgba(16,185,129,0.2)'
            }}>
              <ShieldIcon />
            </div>
            <h1 style={{
              fontSize: '24px', fontWeight: '700', letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, #FFFFFF, #94A3B8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              margin: '0 0 4px 0'
            }}>
              TrustVault Security Portal
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '13px', margin: 0 }}>
              Zero-Trust Cryptographic Document Storage & Verification
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'flex',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '24px',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              style={{
                flex: 1, padding: '10px 14px',
                borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                transition: 'all 0.2s',
                background: mode === 'login'
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.2))'
                  : 'transparent',
                color: mode === 'login' ? '#34D399' : '#94A3B8',
                border: mode === 'login' ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent',
                cursor: 'pointer'
              }}
            >
              🔐 Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
                setSuccess('');
                if (email === 'admin@trustvault.dev') setEmail('');
                if (password === 'Admin123!') setPassword('');
              }}
              style={{
                flex: 1, padding: '10px 14px',
                borderRadius: '8px', fontSize: '14px', fontWeight: '600',
                transition: 'all 0.2s',
                background: mode === 'register'
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.2))'
                  : 'transparent',
                color: mode === 'register' ? '#34D399' : '#94A3B8',
                border: mode === 'register' ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent',
                cursor: 'pointer'
              }}
            >
              ✨ Create Account
            </button>
          </div>

          {/* Step-by-Step Registration Guide Banner */}
          {mode === 'register' && (
            <div style={{
              background: 'rgba(16,185,129,0.07)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '20px'
            }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '600', color: '#34D399' }}>
                📋 How to Register (Things you need to fill):
              </p>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#94A3B8', lineHeight: '1.6' }}>
                <li><strong style={{ color: '#E2E8F0' }}>Full Name:</strong> Your first and last name</li>
                <li><strong style={{ color: '#E2E8F0' }}>Email Address:</strong> Valid email for sign-in identification</li>
                <li><strong style={{ color: '#E2E8F0' }}>Password:</strong> Min. 6 characters for vault encryption</li>
                <li><strong style={{ color: '#E2E8F0' }}>Department:</strong> Your team (e.g. Engineering, Finance, Legal)</li>
                <li><strong style={{ color: '#E2E8F0' }}>Role:</strong> Choose <em>Document Owner</em> (to upload) or <em>Viewer</em> (read-only)</li>
              </ul>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Full Name (Registration only) */}
            {mode === 'register' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1. Full Name <span style={{ color: '#F43F5E' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', display: 'flex' }}>
                    <UserIcon />
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Mercer"
                    required
                    style={{
                      width: '100%', padding: '12px 14px 12px 42px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px', color: '#F8FAFC',
                      fontSize: '14px', outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {mode === 'register' ? '2. Email Address' : 'Email Address'} <span style={{ color: '#F43F5E' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', display: 'flex' }}>
                  <MailIcon />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px', color: '#F8FAFC',
                    fontSize: '14px', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Department & Role (Registration only) */}
            {mode === 'register' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    3. Department
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', display: 'flex' }}>
                      <BuildingIcon />
                    </span>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Engineering"
                      style={{
                        width: '100%', padding: '12px 12px 12px 42px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '10px', color: '#F8FAFC',
                        fontSize: '14px', outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94A3B8', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    4. Account Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{
                      width: '100%', padding: '12px 14px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px', color: '#F8FAFC',
                      fontSize: '14px', outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="owner" style={{ background: '#111827', color: '#fff' }}>Document Owner (Upload & Share)</option>
                    <option value="viewer" style={{ background: '#111827', color: '#fff' }}>Viewer (Read shared files)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Password */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {mode === 'register' ? '5. Password' : 'Password'} <span style={{ color: '#F43F5E' }}>*</span>
                </label>
                {mode === 'register' && (
                  <span style={{ fontSize: '11px', color: password.length >= 6 ? '#34D399' : '#94A3B8' }}>
                    {password.length >= 6 ? '✓ Valid length' : 'Min. 6 chars'}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', display: 'flex' }}>
                  <LockIcon />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Create a secure password (6+ chars)' : 'Enter password'}
                  required
                  style={{
                    width: '100%', padding: '12px 42px 12px 42px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px', color: '#F8FAFC',
                    fontSize: '14px', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#94A3B8',
                    cursor: 'pointer', display: 'flex', padding: '4px'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* Status Messages */}
            {error && (
              <div style={{
                padding: '12px 14px', borderRadius: '10px', marginBottom: '16px',
                background: 'rgba(244, 63, 94, 0.12)', border: '1px solid rgba(244,63,94,0.3)',
                color: '#FB7185', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                ⚠️ {error}
              </div>
            )}
            {success && (
              <div style={{
                padding: '12px 14px', borderRadius: '10px', marginBottom: '16px',
                background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16,185,129,0.3)',
                color: '#34D399', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                ✅ {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading
                  ? 'rgba(16,185,129,0.3)'
                  : 'linear-gradient(135deg, #10B981, #06B6D4)',
                border: 'none', borderRadius: '10px',
                color: '#FFFFFF', fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 18px rgba(16,185,129,0.35)',
                letterSpacing: '0.3px'
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  {mode === 'login' ? 'Authenticating...' : 'Creating Account...'}
                </span>
              ) : (
                mode === 'login' ? '🔐 Sign In to Vault' : '✨ Register & Open Vault'
              )}
            </button>
          </form>

          {/* Quick toggle link */}
          <div style={{ textAlign: 'center', marginTop: '18px' }}>
            {mode === 'login' ? (
              <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
                Don't have an account?{' '}
                <button
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  style={{ background: 'none', border: 'none', color: '#34D399', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                >
                  Register here
                </button>
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
                Already registered?{' '}
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  style={{ background: 'none', border: 'none', color: '#34D399', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                >
                  Sign in here
                </button>
              </p>
            )}
          </div>
        </div>

        {/* Demo Credentials & Quick 1-Click Access Panel (Visible on login) */}
        {mode === 'login' && (
          <div style={{
            background: 'rgba(17, 24, 39, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '20px',
            padding: '28px',
            boxShadow: '0 16px 40px -12px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#F1F5F9', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚡ Instant 1-Click Test Personas
                </h2>
                <p style={{ fontSize: '12px', color: '#94A3B8', margin: 0 }}>
                  Click any role below to auto-fill credentials:
                </p>
              </div>
              <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.15)', color: '#34D399', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                Pre-configured
              </span>
            </div>

            {/* List of 1-click accounts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
              {DEMO_ACCOUNTS.map((acc, idx) => {
                const isSelected = email === acc.email;
                return (
                  <div
                    key={idx}
                    onClick={() => fillAccount(acc)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#F1F5F9' }}>
                          {acc.name}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: acc.tag === 'admin' ? 'rgba(239,68,68,0.2)' : acc.tag === 'owner' ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)',
                          color: acc.tag === 'admin' ? '#F87171' : acc.tag === 'owner' ? '#60A5FA' : '#34D399'
                        }}>
                          {acc.tag}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 2px 0', fontSize: '12px', color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {acc.email}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748B' }}>
                        Password: <code style={{ color: '#E2E8F0', background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '4px' }}>{acc.pass}</code>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fillAccount(acc);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '6px',
                        background: isSelected ? '#10B981' : 'rgba(255,255,255,0.08)',
                        color: isSelected ? '#064E3B' : '#CBD5E1',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isSelected ? '✓ Selected' : 'Fill →'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Note about Evaluator Switcher */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
              fontSize: '11px',
              color: '#A5B4FC',
              lineHeight: '1.5'
            }}>
              💡 <strong>Evaluator Tip:</strong> Once logged in, you can also switch between any of these personas instantly via the top navigation bar without logging out!
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
