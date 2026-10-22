import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  ShieldCheck,
  FileText,
  History,
  Activity,
  Zap,
  Users,
  ChevronDown,
  LogOut,
  Lock,
  ExternalLink
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenPlayground, auditStatus }) {
  const { user, availableUsers, switchPersona, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return { bg: 'rgba(139, 92, 246, 0.15)', text: '#A78BFA', border: 'rgba(139, 92, 246, 0.3)' };
      case 'owner': return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'viewer': return { bg: 'rgba(6, 182, 212, 0.15)', text: '#38BDF8', border: 'rgba(6, 182, 212, 0.3)' };
      default: return { bg: 'rgba(255, 255, 255, 0.1)', text: '#FFF', border: 'transparent' };
    }
  };

  const roleStyle = user ? getRoleColor(user.role) : {};

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 28px',
      background: 'rgba(12, 16, 25, 0.85)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #059669 0%, #064E3B 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)',
          border: '1px solid rgba(52, 211, 153, 0.3)'
        }}>
          <Shield style={{ width: '22px', height: '22px', color: '#FFF' }} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px', color: '#FFF' }}>TrustVault</span>
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34D399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontFamily: 'var(--font-mono)'
            }}>AES-256-GCM</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Server-Authoritative Cryptographic Vault</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          id="nav-tab-documents"
          onClick={() => setActiveTab('documents')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'documents' ? 'var(--bg-card-hover)' : 'transparent',
            color: activeTab === 'documents' ? '#FFF' : 'var(--text-muted)',
            border: activeTab === 'documents' ? '1px solid var(--border-medium)' : '1px solid transparent',
            fontWeight: activeTab === 'documents' ? '600' : '500',
            fontSize: '13px'
          }}
        >
          <FileText style={{ width: '16px', height: '16px' }} />
          Documents Vault
        </button>

        <button
          id="nav-tab-audit"
          onClick={() => setActiveTab('audit')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            background: activeTab === 'audit' ? 'var(--bg-card-hover)' : 'transparent',
            color: activeTab === 'audit' ? '#FFF' : 'var(--text-muted)',
            border: activeTab === 'audit' ? '1px solid var(--border-medium)' : '1px solid transparent',
            fontWeight: activeTab === 'audit' ? '600' : '500',
            fontSize: '13px'
          }}
        >
          <History style={{ width: '16px', height: '16px' }} />
          Audit Ledger
        </button>

        {user?.role === 'admin' && (
          <button
            id="nav-tab-admin"
            onClick={() => setActiveTab('admin')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              background: activeTab === 'admin' ? 'var(--bg-card-hover)' : 'transparent',
              color: activeTab === 'admin' ? '#A78BFA' : 'var(--text-muted)',
              border: activeTab === 'admin' ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
              fontWeight: activeTab === 'admin' ? '600' : '500',
              fontSize: '13px'
            }}
          >
            <Activity style={{ width: '16px', height: '16px' }} />
            Admin Telemetry
          </button>
        )}

        {/* Security Playground Launcher for Judge */}
        <button
          id="btn-open-judge-playground"
          onClick={onOpenPlayground}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
            color: '#FDA4AF',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            fontWeight: '600',
            fontSize: '13px',
            marginLeft: '8px'
          }}
        >
          <Zap style={{ width: '15px', height: '15px', color: '#F43F5E' }} />
          Judge Attack Simulator
        </button>
      </nav>

      {/* Right Telemetry & Persona Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Audit Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '6px 12px',
          borderRadius: '20px',
          background: auditStatus?.isValid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
          border: `1px solid ${auditStatus?.isValid ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.3)'}`,
          fontSize: '12px',
          fontFamily: 'var(--font-mono)'
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: auditStatus?.isValid ? '#10B981' : '#F43F5E',
            boxShadow: `0 0 8px ${auditStatus?.isValid ? '#10B981' : '#F43F5E'}`
          }} />
          <span style={{ color: auditStatus?.isValid ? '#34D399' : '#F43F5E' }}>
            {auditStatus?.isValid ? 'Ledger Verified' : 'Chain Broken!'}
          </span>
        </div>

        {/* Persona Switcher Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            id="btn-persona-switcher"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 14px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              color: '#FFF'
            }}
          >
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: roleStyle.bg,
              border: `1px solid ${roleStyle.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: roleStyle.text,
              fontSize: '12px',
              fontWeight: '700'
            }}>
              {user ? user.name[0] : '?'}
            </div>
            <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
              <div style={{ fontSize: '13px', fontWeight: '600' }}>{user?.name || 'Loading...'}</div>
              <div style={{ fontSize: '11px', color: roleStyle.text, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {user?.role} • {user?.department}
              </div>
            </div>
            <ChevronDown style={{ width: '15px', height: '15px', color: 'var(--text-dim)', marginLeft: '4px' }} />
          </button>

          {/* Persona Menu */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '320px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-card)',
              padding: '8px',
              zIndex: 100
            }}>
              <div style={{ padding: '8px 12px 6px', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Quick Switch Persona (For Judge Testing)
              </div>
              {availableUsers.map((u) => {
                const uColor = getRoleColor(u.role);
                const isCurrent = user?.id === u.id;
                return (
                  <button
                    key={u.id}
                    id={`persona-select-${u.id}`}
                    onClick={() => {
                      switchPersona(u.id);
                      setDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: isCurrent ? 'var(--bg-card-hover)' : 'transparent',
                      border: isCurrent ? `1px solid ${uColor.border}` : '1px solid transparent',
                      marginBottom: '4px',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: uColor.bg,
                        color: uColor.text,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>
                        {u.name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#FFF' }}>{u.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{u.email}</div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: uColor.bg,
                      color: uColor.text,
                      border: `1px solid ${uColor.border}`,
                      textTransform: 'uppercase',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {u.role}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
