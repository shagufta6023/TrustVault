import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Hash,
  Key,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function AuditTrailView({ onChainVerified }) {
  const { token, user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [verificationReport, setVerificationReport] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = async () => {
    try {
      let url = `/api/audit?limit=150`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (actionFilter) url += `&action=${actionFilter}`;
      if (statusFilter) url += `&status=${statusFilter}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const runVerification = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/audit/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVerificationReport(data.report);
        if (onChainVerified) onChainVerified(data.report);
      }
    } catch (err) {
      console.error('Verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    runVerification();
  }, [search, actionFilter, statusFilter, token]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34D399', border: 'rgba(16, 185, 129, 0.3)', icon: CheckCircle2 };
      case 'DENIED':
        return { bg: 'rgba(244, 63, 94, 0.15)', text: '#FDA4AF', border: 'rgba(244, 63, 94, 0.3)', icon: XCircle };
      case 'ANOMALY':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#FCD34D', border: 'rgba(245, 158, 11, 0.3)', icon: AlertTriangle };
      default:
        return { bg: 'rgba(255, 255, 255, 0.1)', text: '#FFF', border: 'transparent', icon: CheckCircle2 };
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#FFF', letterSpacing: '-0.5px' }}>
          Cryptographic Audit Trail
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Immutable SHA-256 hash-chained ledger signed with server HMAC. Every access attempt and denial is permanently recorded.
        </p>
      </div>

      {/* Cryptographic Verification Banner */}
      <div style={{
        background: verificationReport?.isValid
          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(244, 63, 94, 0.18) 0%, rgba(245, 158, 11, 0.12) 100%)',
        border: `1px solid ${verificationReport?.isValid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.4)'}`,
        borderRadius: 'var(--radius-xl)',
        padding: '20px 24px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: verificationReport?.isValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${verificationReport?.isValid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`
          }}>
            {verificationReport?.isValid ? (
              <ShieldCheck style={{ width: '26px', height: '26px', color: '#34D399' }} />
            ) : (
              <ShieldAlert style={{ width: '26px', height: '26px', color: '#FDA4AF' }} />
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#FFF' }}>
                {verificationReport?.isValid ? 'Hash Chain Integrity: 100% Cryptographically Verified' : 'CRITICAL: Hash Chain Tampering Detected!'}
              </h2>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: verificationReport?.isValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                color: verificationReport?.isValid ? '#34D399' : '#FDA4AF',
                fontFamily: 'var(--font-mono)'
              }}>
                {verificationReport?.totalVerified || 0} BLOCKS SEALED
              </span>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {verificationReport?.details || 'Recalculating hash chain continuity and HMAC signatures...'}
            </div>
            {verificationReport?.tipHash && (
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '6px' }}>
                Tip Hash: {verificationReport.tipHash}
              </div>
            )}
          </div>
        </div>

        <button
          id="btn-verify-audit-chain"
          onClick={runVerification}
          disabled={verifying}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            background: verificationReport?.isValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
            border: `1px solid ${verificationReport?.isValid ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}`,
            color: verificationReport?.isValid ? '#34D399' : '#FDA4AF',
            fontSize: '13px',
            fontWeight: '600'
          }}
        >
          <RefreshCw style={{ width: '15px', height: '15px', animation: verifying ? 'spin 1s linear infinite' : 'none' }} />
          {verifying ? 'Scanning Hash Chain...' : 'Re-verify Hash Chain'}
        </button>
      </div>

      {/* Filters */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search style={{ width: '15px', height: '15px', color: 'var(--text-dim)', position: 'absolute', left: '12px' }} />
          <input
            id="input-audit-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit trail by actor, document, action, details..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              color: '#FFF',
              fontSize: '13px'
            }}
          />
        </div>

        <select
          id="select-audit-action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            color: '#FFF',
            fontSize: '13px'
          }}
        >
          <option value="">All Actions</option>
          <option value="DOCUMENT_UPLOAD">Upload</option>
          <option value="DOCUMENT_DOWNLOAD">Download</option>
          <option value="PERMISSION_GRANT">Permission Grant</option>
          <option value="PERMISSION_REVOKE">Permission Revoke</option>
          <option value="ACCESS_DENIED_UNAUTHORIZED">Access Denied (Unauthorized)</option>
          <option value="ACCESS_DENIED_REVOKED">Access Denied (Revoked)</option>
          <option value="ADMIN_BREAK_GLASS_OVERRIDE">Admin Break-Glass</option>
          <option value="SECURITY_FILE_VALIDATION_FAILED">File Validation Rejection</option>
        </select>

        <select
          id="select-audit-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            color: '#FFF',
            fontSize: '13px'
          }}
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="DENIED">DENIED (Security Rejection)</option>
          <option value="ANOMALY">ANOMALY (High Priority)</option>
        </select>
      </div>

      {/* Audit Blocks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {logs.map((log) => {
          const badge = getStatusBadge(log.status);
          const StatusIcon = badge.icon;
          const isExpanded = expandedLogId === log.id;

          return (
            <div
              key={log.id}
              id={`audit-row-${log.sequence_num}`}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
              }}
            >
              <div
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                {/* Block Sequence & Timestamp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: 'var(--cyan)'
                  }}>
                    #{log.sequence_num}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#FFF' }}>{log.action}</span>
                      <span style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: badge.bg,
                        color: badge.text,
                        border: `1px solid ${badge.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: '600'
                      }}>
                        <StatusIcon style={{ width: '10px', height: '10px' }} />
                        {log.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                      {new Date(log.timestamp).toLocaleString()} • IP: {log.ip_address || '127.0.0.1'}
                    </div>
                  </div>
                </div>

                {/* Actor & Document */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '10px', textTransform: 'uppercase' }}>Actor</div>
                    <div style={{ color: '#FFF', fontWeight: '500' }}>{log.actor_email || 'SYSTEM'}</div>
                  </div>

                  {log.document_title && (
                    <div style={{ maxWidth: '220px' }}>
                      <div style={{ color: 'var(--text-dim)', fontSize: '10px', textTransform: 'uppercase' }}>Target Document</div>
                      <div style={{ color: '#FFF', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.document_title}
                      </div>
                    </div>
                  )}

                  {isExpanded ? <ChevronUp style={{ width: '16px', height: '16px', color: 'var(--text-dim)' }} /> : <ChevronDown style={{ width: '16px', height: '16px', color: 'var(--text-dim)' }} />}
                </div>
              </div>

              {/* Expanded Cryptographic Drawer */}
              {isExpanded && (
                <div style={{
                  padding: '16px 20px',
                  background: 'var(--bg-card)',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Previous Block Hash (Link)
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '4px' }}>
                        {log.previous_hash}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Record SHA-256 Hash
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#34D399', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '4px' }}>
                        {log.record_hash}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      HMAC-SHA256 Signature (Server Sealed)
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#A78BFA', wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '4px' }}>
                      {log.hmac_signature}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Event Details Payload
                    </div>
                    <pre style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      background: 'rgba(0,0,0,0.4)',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      color: 'var(--cyan-light)',
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
