import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  FileText,
  History,
  Activity,
  Zap,
  ChevronDown,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenPlayground, auditStatus }) {
  const { user, availableUsers, switchPersona, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' };
      case 'owner': return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'viewer': return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      default: return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  const roleStyle = user ? getRoleBadge(user.role) : {};
  const userInitial = user?.name ? user.name[0].toUpperCase() : 'U';

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 32px',
      background: '#FFFFFF',
      borderBottom: '1px solid #E2E8F0',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
          color: '#FFF'
        }}>
          <Shield style={{ width: '22px', height: '22px' }} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.4px', color: '#0F172A' }}>TrustVault</span>
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '20px',
              background: '#ECFDF5',
              color: '#059669',
              border: '1px solid #A7F3D0',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🔒 AES-256-GCM
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>Server-Authoritative Cryptographic Vault</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          id="nav-tab-documents"
          onClick={() => setActiveTab('documents')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '12px',
            background: activeTab === 'documents' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'documents' ? '#2563EB' : '#475569',
            border: activeTab === 'documents' ? '1px solid #BFDBFE' : '1px solid transparent',
            fontWeight: activeTab === 'documents' ? '600' : '500',
            fontSize: '13px'
          }}
        >
          <FileText style={{ width: '16px', height: '16px', color: activeTab === 'documents' ? '#2563EB' : '#64748B' }} />
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
            borderRadius: '12px',
            background: activeTab === 'audit' ? '#EFF6FF' : 'transparent',
            color: activeTab === 'audit' ? '#2563EB' : '#475569',
            border: activeTab === 'audit' ? '1px solid #BFDBFE' : '1px solid transparent',
            fontWeight: activeTab === 'audit' ? '600' : '500',
            fontSize: '13px'
          }}
        >
          <History style={{ width: '16px', height: '16px', color: activeTab === 'audit' ? '#2563EB' : '#64748B' }} />
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
              borderRadius: '12px',
              background: activeTab === 'admin' ? '#F5F3FF' : 'transparent',
              color: activeTab === 'admin' ? '#7C3AED' : '#475569',
              border: activeTab === 'admin' ? '1px solid #DDD6FE' : '1px solid transparent',
              fontWeight: activeTab === 'admin' ? '600' : '500',
              fontSize: '13px'
            }}
          >
            <Activity style={{ width: '16px', height: '16px', color: activeTab === 'admin' ? '#7C3AED' : '#64748B' }} />
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
            borderRadius: '20px',
            background: '#FFF1F2',
            color: '#E11D48',
            border: '1px solid #FECDD3',
            fontWeight: '600',
            fontSize: '13px',
            marginLeft: '6px'
          }}
        >
          <Shield style={{ width: '15px', height: '15px', color: '#E11D48' }} />
          Judge Attack Simulator
        </button>

        {/* Audit Status Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '8px 16px',
          borderRadius: '20px',
          background: auditStatus?.isValid ? '#ECFDF5' : '#FFF1F2',
          border: `1px solid ${auditStatus?.isValid ? '#BBF7D0' : '#FECDD3'}`,
          fontSize: '13px',
          fontWeight: '600',
          color: auditStatus?.isValid ? '#16A34A' : '#E11D48'
        }}>
          {auditStatus?.isValid ? (
            <CheckCircle2 style={{ width: '16px', height: '16px', color: '#16A34A' }} />
          ) : (
            <AlertCircle style={{ width: '16px', height: '16px', color: '#E11D48' }} />
          )}
          <span>{auditStatus?.isValid ? 'Ledger Verified' : 'Chain Broken!'}</span>
        </div>
      </nav>

      {/* Right User Avatar Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          id="btn-persona-switcher"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 6px',
            background: 'transparent',
            borderRadius: '20px',
            cursor: 'pointer'
          }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFF',
            fontSize: '14px',
            fontWeight: '700',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
          }}>
            {userInitial}
          </div>
          <ChevronDown style={{ width: '16px', height: '16px', color: '#64748B' }} />
        </button>

        {/* Persona Menu / Profile Dropdown */}
        {dropdownOpen && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '320px',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '16px',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.12)',
            padding: '16px',
            zIndex: 100
          }}>
            {/* Profile Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              paddingBottom: '14px',
              borderBottom: '1px solid #E2E8F0',
              marginBottom: '12px'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                fontSize: '16px',
                fontWeight: '700'
              }}>
                {userInitial}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{user?.name}</div>
                <div style={{ fontSize: '12px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
                <div style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: roleStyle.text,
                  background: roleStyle.bg,
                  border: `1px solid ${roleStyle.border}`,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-block',
                  marginTop: '4px',
                  textTransform: 'uppercase'
                }}>
                  {user?.role} • {user?.department}
                </div>
              </div>
            </div>

            {/* ADMIN: Can switch every profile */}
            {user?.role === 'admin' ? (
              <>
                <div style={{
                  padding: '4px 2px 8px',
                  fontSize: '11px',
                  color: '#2563EB',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>⚡ Admin Switch Persona</span>
                  <span style={{ fontSize: '10px', color: '#64748B' }}>5 Profiles</span>
                </div>

                <div style={{ maxHeight: '230px', overflowY: 'auto' }}>
                  {availableUsers.map((u) => {
                    const uColor = getRoleBadge(u.role);
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
                          padding: '8px 10px',
                          borderRadius: '10px',
                          background: isCurrent ? '#EFF6FF' : 'transparent',
                          border: isCurrent ? '1px solid #BFDBFE' : '1px solid transparent',
                          marginBottom: '4px',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A' }}>{u.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748B' }}>{u.email}</div>
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
                          fontWeight: '600'
                        }}>
                          {u.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              /* NON-ADMIN: Only sees their own profile */
              <div style={{ padding: '4px 0 8px' }}>
                <div style={{
                  background: '#F8FAFC',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  marginBottom: '10px',
                  fontSize: '12px'
                }}>
                  <div style={{ color: '#0F172A', fontWeight: '700', marginBottom: '6px' }}>
                    👤 Your Active Profile
                  </div>
                  <div style={{ color: '#475569', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div>Role: <span style={{ color: '#059669', fontWeight: '700', textTransform: 'capitalize' }}>{user?.role}</span></div>
                    <div>Department: <span style={{ color: '#0F172A', fontWeight: '500' }}>{user?.department || 'General'}</span></div>
                    <div>Vault Status: <span style={{ color: '#059669', fontWeight: '700' }}>Active & Isolated</span></div>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                  🔒 <em>Zero-Trust Security: Persona switching is strictly restricted to Administrators.</em>
                </p>
              </div>
            )}

            {/* Sign Out Button */}
            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: '10px' }}>
              <button
                onClick={() => {
                  logout();
                  setDropdownOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '9px',
                  borderRadius: '10px',
                  background: '#F5F3FF',
                  border: '1px solid #DDD6FE',
                  color: '#6D28D9',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                🚪 Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
