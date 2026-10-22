import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  UserCheck,
  UserX,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  ChevronRight,
  Shield
} from 'lucide-react';

export default function PermissionModal({ document, onClose, onRefresh }) {
  const { token, availableUsers, user } = useAuth();
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [permissionLevel, setPermissionLevel] = useState('read');
  const [rationale, setRationale] = useState('');
  const [actionMessage, setActionMessage] = useState(null);

  // AI Advisor state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const loadPermissions = async () => {
    try {
      const res = await fetch(`/api/permissions/${document.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGrants(data.grants || []);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
  }, [document.id]);

  const handleGrant = async (e, customUserId = null, customLevel = null, isAi = false, aiRationale = null) => {
    if (e) e.preventDefault();
    const targetId = customUserId || selectedUserId;
    const level = customLevel || permissionLevel;

    if (!targetId) return;

    try {
      const res = await fetch(`/api/permissions/${document.id}/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId: targetId,
          permissionLevel: level,
          aiSuggested: isAi,
          aiRationale: aiRationale || rationale
        })
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Access granted successfully (${level.toUpperCase()}). Sealed in audit trail.` });
        setSelectedUserId('');
        setRationale('');
        loadPermissions();
        if (onRefresh) onRefresh();
      } else {
        setActionMessage({ type: 'error', text: data.message || 'Failed to grant permission.' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error granting permission.' });
    }
  };

  const handleRevoke = async (targetUserId) => {
    try {
      const res = await fetch(`/api/permissions/${document.id}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetUserId })
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          type: 'success',
          text: 'Access immediately revoked! All active sessions & ephemeral download tickets invalidated.'
        });
        loadPermissions();
        if (onRefresh) onRefresh();
      } else {
        setActionMessage({ type: 'error', text: data.message || 'Failed to revoke access.' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Network error revoking permission.' });
    }
  };

  const requestAiAdvisor = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/suggest-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ documentId: document.id })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSuggestion(data.suggestion);
      } else {
        const err = await res.json();
        setActionMessage({ type: 'error', text: err.message || 'AI Advisor unavailable.' });
      }
    } catch (err) {
      console.error('AI Advisor error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const activeGrants = grants.filter(g => g.is_active === 1);
  const revokedGrants = grants.filter(g => g.is_active === 0);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 7, 12, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '780px',
        maxHeight: '90vh',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(15, 21, 35, 0.5)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock style={{ width: '18px', height: '18px', color: 'var(--emerald)' }} />
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#FFF' }}>Manage Access Permissions</h2>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {document.title}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {actionMessage && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              border: `1px solid ${actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
              color: actionMessage.type === 'success' ? '#34D399' : '#FDA4AF',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              {actionMessage.type === 'success' ? <CheckCircle2 style={{ width: '16px', height: '16px' }} /> : <AlertTriangle style={{ width: '16px', height: '16px' }} />}
              {actionMessage.text}
            </div>
          )}

          {/* AI Access Advisor Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(6, 182, 212, 0.08) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles style={{ width: '18px', height: '18px', color: 'var(--violet)' }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#FFF' }}>AI Least-Privilege Advisor</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Policy-driven least privilege recommendations with mandatory human review.
                  </div>
                </div>
              </div>
              <button
                id="btn-request-ai-advice"
                onClick={requestAiAdvisor}
                disabled={aiLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  color: '#C4B5FD',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                {aiLoading ? 'Analyzing Policy...' : 'Analyze Sharing Policy'}
              </button>
            </div>

            {aiSuggestion && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11px',
                  color: '#FCD34D',
                  marginBottom: '12px'
                }}>
                  <AlertTriangle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                  <span>{aiSuggestion.warning}</span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
                  <strong>Policy Guidance:</strong> {aiSuggestion.policyGuidance}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {aiSuggestion.recommendations.map((rec) => (
                    <div
                      key={rec.userId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'rgba(0, 0, 0, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#FFF' }}>{rec.userName}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>({rec.userDepartment})</span>
                          <span style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: rec.recommendedLevel === 'edit' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                            color: rec.recommendedLevel === 'edit' ? '#FBBF24' : '#34D399',
                            fontFamily: 'var(--font-mono)'
                          }}>
                            {rec.recommendedLevel.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                          {rec.rationale}
                        </div>
                      </div>
                      <button
                        onClick={() => handleGrant(null, rec.userId, rec.recommendedLevel, true, rec.rationale)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: '#34D399',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}
                      >
                        Confirm & Grant
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Active Grants List */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.5px', marginBottom: '12px' }}>
              Active Access Grants ({activeGrants.length})
            </h3>
            {activeGrants.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', color: 'var(--text-dim)', fontSize: '13px' }}>
                No active grants. Only the document owner can access this document.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeGrants.map((grant) => (
                  <div
                    key={grant.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#FFF' }}>{grant.user_name}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{grant.user_email}</span>
                        <span style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: grant.permission_level === 'edit' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                          color: grant.permission_level === 'edit' ? '#FBBF24' : '#38BDF8',
                          border: `1px solid ${grant.permission_level === 'edit' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`,
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {grant.permission_level.toUpperCase()}
                        </span>
                        {grant.ai_suggested === 1 && (
                          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.15)', color: '#C4B5FD' }}>
                            AI Suggested
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                        Granted by {grant.granted_by_name} on {new Date(grant.granted_at).toLocaleString()}
                      </div>
                    </div>

                    {/* Instant Revoke Button */}
                    <button
                      id={`btn-revoke-${grant.user_id}`}
                      onClick={() => handleRevoke(grant.user_id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(244, 63, 94, 0.15)',
                        border: '1px solid rgba(244, 63, 94, 0.35)',
                        color: '#FDA4AF',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      <UserX style={{ width: '14px', height: '14px' }} />
                      Revoke Immediately
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grant Access Form */}
          <form onSubmit={handleGrant} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '18px 20px',
            marginBottom: '24px'
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.5px', marginBottom: '14px' }}>
              Grant Access to Named Person
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Select User</label>
                <select
                  id="select-grant-user"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: '#FFF',
                    fontSize: '13px'
                  }}
                >
                  <option value="">-- Choose recipient from directory --</option>
                  {availableUsers
                    .filter(u => u.id !== user.id && !activeGrants.some(g => g.user_id === u.id))
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email} - {u.department})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Permission Level</label>
                <select
                  id="select-grant-level"
                  value={permissionLevel}
                  onChange={(e) => setPermissionLevel(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    color: '#FFF',
                    fontSize: '13px'
                  }}
                >
                  <option value="read">Read Only (Download)</option>
                  <option value="edit">Can Edit (Update & Version)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Business Rationale (Audit Record)</label>
              <input
                id="input-grant-rationale"
                type="text"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="e.g. FY2026 Audit Working Paper Review"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  color: '#FFF',
                  fontSize: '13px'
                }}
              />
            </div>

            <button
              id="btn-confirm-grant"
              type="submit"
              disabled={!selectedUserId}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                background: selectedUserId ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)' : 'var(--bg-card-hover)',
                color: selectedUserId ? '#FFF' : 'var(--text-dim)',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Grant Access & Record in Audit Trail
            </button>
          </form>

          {/* Historical Revocations */}
          {revokedGrants.length > 0 && (
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Revocation History ({revokedGrants.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {revokedGrants.map(grant => (
                  <div
                    key={grant.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: 'var(--radius-md)',
                      opacity: 0.75
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#FFF' }}>{grant.user_name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>({grant.user_email})</span>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.1)', color: '#F43F5E' }}>
                          REVOKED
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        Revoked on {new Date(grant.revoked_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
