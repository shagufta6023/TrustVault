import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  ShieldAlert,
  Users,
  FileText,
  Key,
  AlertTriangle,
  Lock,
  UserCheck,
  UserX,
  History,
  TrendingUp
} from 'lucide-react';

export default function AdminDashboardView() {
  const { token, availableUsers } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userList, setUserList] = useState([]);

  const loadAdminData = async () => {
    try {
      const [resMetrics, resAnomalies, resUsers] = await Promise.all([
        fetch('/api/admin/metrics', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/anomalies', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/auth/users', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (resMetrics.ok) setMetrics((await resMetrics.json()).metrics);
      if (resAnomalies.ok) setAnomalies((await resAnomalies.json()).anomalies || []);
      if (resUsers.ok) setUserList((await resUsers.json()).users || []);
    } catch (err) {
      console.error('Error loading admin telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token]);

  const toggleUserStatus = async (userId) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        loadAdminData();
      }
    } catch (err) {
      console.error('Failed to toggle user status:', err);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#FFF', letterSpacing: '-0.5px' }}>
          Security Operations & Governance Center
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Administrative telemetry, access denial patterns, break-glass anomaly logs, and organization directory.
        </p>
      </div>

      {/* Top Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {[
          { label: 'Active Users', value: metrics?.totalUsers || 0, icon: Users, color: '#38BDF8' },
          { label: 'Vault Documents', value: metrics?.totalDocs || 0, icon: FileText, color: '#34D399' },
          { label: 'Active Grants', value: metrics?.activeGrants || 0, icon: Key, color: '#A78BFA' },
          { label: 'Revoked Grants', value: metrics?.revokedGrants || 0, icon: UserX, color: '#FDA4AF' },
          { label: 'Sealed Audit Blocks', value: metrics?.totalAuditEvents || 0, icon: History, color: 'var(--cyan)' },
          { label: 'Security Denials', value: metrics?.accessDenials || 0, icon: ShieldAlert, color: '#F43F5E' }
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: `${item.color}15`,
                border: `1px solid ${item.color}35`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon style={{ width: '20px', height: '20px', color: item.color }} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#FFF', fontFamily: 'var(--font-mono)' }}>
                  {item.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
        {/* Security Anomalies Feed */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <ShieldAlert style={{ width: '18px', height: '18px', color: '#F43F5E' }} />
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>Security Anomalies & Access Denials</h2>
          </div>

          {anomalies.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              No security anomalies or access violations recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto' }}>
              {anomalies.map((a) => (
                <div
                  key={a.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: a.status === 'DENIED' ? 'rgba(244, 63, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                    border: `1px solid ${a.status === 'DENIED' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '700', color: a.status === 'DENIED' ? '#FDA4AF' : '#FCD34D' }}>
                      {a.action}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      #{a.sequence_num} • {new Date(a.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ color: '#FFF', fontSize: '12px' }}>
                    Actor: {a.actor_email || 'Unauthenticated'} • Target: {a.document_title || a.document_id || 'System'}
                  </div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '11px', marginTop: '4px' }}>
                    Reason: {typeof a.details === 'object' ? (a.details.reason || JSON.stringify(a.details)) : a.details}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Management & Session Revocation */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: '22px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Users style={{ width: '18px', height: '18px', color: 'var(--cyan)' }} />
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#FFF' }}>Organization Directory & Sessions</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {userList.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#FFF' }}>{u.name}</span>
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-dim)',
                      textTransform: 'uppercase'
                    }}>
                      {u.role}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{u.email} • {u.department}</div>
                </div>

                <button
                  onClick={() => toggleUserStatus(u.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: u.is_active ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    border: `1px solid ${u.is_active ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    color: u.is_active ? '#FDA4AF' : '#34D399',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}
                >
                  {u.is_active ? 'Deactivate & Invalidate' : 'Activate User'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
