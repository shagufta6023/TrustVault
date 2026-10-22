import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const ShieldIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Invalid credentials');
        localStorage.setItem('trustvault_token', data.token);
        window.location.reload();
      } else {
        if (!name.trim()) throw new Error('Full name is required');
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Registration failed');
        setSuccess('Account created! Signing you in...');
        // Auto-login after register
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok) {
          localStorage.setItem('trustvault_token', loginData.token);
          setTimeout(() => window.location.reload(), 800);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (e) => {
    e.preventDefault();
    setEmail('admin@trustvault.dev');
    setPassword('Admin123!');
    setMode('login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-app)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Animated background orbs */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '15%',
        width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Grid pattern overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        pointerEvents: 'none'
      }} />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '440px',
        background: 'rgba(17, 23, 38, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 32px 80px -12px rgba(0,0,0,0.7), 0 0 0 1px rgba(16,185,129,0.05)',
        animation: 'fadeIn 0.4s ease-out',
        position: 'relative', zIndex: 1
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '72px', height: '72px', borderRadius: '18px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1))',
            border: '1px solid rgba(16,185,129,0.3)',
            color: 'var(--emerald)',
            marginBottom: '16px',
            boxShadow: '0 0 30px rgba(16,185,129,0.15)'
          }}>
            <ShieldIcon />
          </div>
          <h1 style={{
            fontSize: '26px', fontWeight: '700', letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #F3F4F6, #94A3B8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            TrustVault
          </h1>
          <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginTop: '4px' }}>
            Cryptographic Document Security Platform
          </p>
        </div>

        {/* Mode Toggle */}
        <div style={{
          display: 'flex', background: 'rgba(0,0,0,0.3)',
          borderRadius: '10px', padding: '4px', marginBottom: '28px',
          border: '1px solid var(--border-subtle)'
        }}>
          {['login', 'register'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              style={{
                flex: 1, padding: '9px',
                borderRadius: '7px', fontSize: '14px', fontWeight: '500',
                transition: 'all 0.2s',
                background: mode === m
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.15))'
                  : 'transparent',
                color: mode === m ? 'var(--emerald-light)' : 'var(--text-dim)',
                border: mode === m ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
                cursor: 'pointer'
              }}
            >
              {m === 'login' ? '🔐 Sign In' : '✨ Register'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Name field (register only) */}
          {mode === 'register' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', display: 'flex' }}>
                  <UserIcon />
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  required
                  style={{
                    width: '100%', padding: '13px 14px 13px 44px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '10px', color: 'var(--text-main)',
                    fontSize: '15px', outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(16,185,129,0.5)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border-medium)'}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', display: 'flex' }}>
                <MailIcon />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                style={{
                  width: '100%', padding: '13px 14px 13px 44px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '10px', color: 'var(--text-main)',
                  fontSize: '15px', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(16,185,129,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-medium)'}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', display: 'flex' }}>
                <LockIcon />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min 8 chars, 1 uppercase, 1 number' : '••••••••'}
                required
                style={{
                  width: '100%', padding: '13px 44px 13px 44px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '10px', color: 'var(--text-main)',
                  fontSize: '15px', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(16,185,129,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-medium)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-dim)',
                  cursor: 'pointer', display: 'flex', padding: '4px'
                }}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{
              padding: '12px 14px', borderRadius: '8px', marginBottom: '16px',
              background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244,63,94,0.3)',
              color: '#FB7185', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: '12px 14px', borderRadius: '8px', marginBottom: '16px',
              background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16,185,129,0.3)',
              color: 'var(--emerald-light)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              ✅ {success}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: loading
                ? 'rgba(16,185,129,0.3)'
                : 'linear-gradient(135deg, #10B981, #06B6D4)',
              border: 'none', borderRadius: '10px',
              color: '#fff', fontSize: '15px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(16,185,129,0.35)',
              letterSpacing: '0.3px'
            }}
            onMouseEnter={(e) => { if (!loading) e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 28px rgba(16,185,129,0.45)'; }}
            onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = loading ? 'none' : '0 4px 20px rgba(16,185,129,0.35)'; }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                {mode === 'login' ? 'Authenticating...' : 'Creating Account...'}
              </span>
            ) : (
              mode === 'login' ? '🔐 Sign In Securely' : '✨ Create Account'
            )}
          </button>
        </form>

        {/* Demo credentials */}
        {mode === 'login' && (
          <div style={{
            marginTop: '20px', padding: '14px',
            background: 'rgba(139,92,246,0.08)',
            border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: '10px'
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
              🎯 Demo Access
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Email: </span>admin@trustvault.dev
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Pass: </span>Admin123!
                </p>
              </div>
              <button
                onClick={fillDemo}
                style={{
                  padding: '7px 14px', fontSize: '12px', fontWeight: '600',
                  background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: '7px', color: '#A78BFA', cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(139,92,246,0.35)'}
                onMouseLeave={(e) => e.target.style.background = 'rgba(139,92,246,0.2)'}
              >
                Fill →
              </button>
            </div>
          </div>
        )}

        {/* Security note */}
        <p style={{
          textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)',
          marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
        }}>
          🔒 AES-256-GCM encrypted · Zero-trust architecture · Tamper-evident audit trail
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #4B5563; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 30px #111726 inset !important; -webkit-text-fill-color: #F3F4F6 !important; }
      `}</style>
    </div>
  );
}
