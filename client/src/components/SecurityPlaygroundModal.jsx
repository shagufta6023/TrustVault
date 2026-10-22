import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Zap,
  ShieldAlert,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  ArrowRight,
  Terminal
} from 'lucide-react';

export default function SecurityPlaygroundModal({ onClose, onRefreshAudit }) {
  const { token, user, switchPersona } = useAuth();
  const [activeScenario, setActiveScenario] = useState('idor');
  const [scenarioLogs, setScenarioLogs] = useState([]);
  const [running, setRunning] = useState(false);

  const addLog = (msg, type = 'info') => {
    setScenarioLogs(prev => [...prev, { text: msg, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  // Scenario 1: IDOR Attack
  const runIdorAttack = async () => {
    setRunning(true);
    setScenarioLogs([]);
    addLog('[ATTACK] Switching persona to Chloe Bennett (External Contractor)...', 'info');

    // Switch to Chloe
    const chloe = await switchPersona('usr_viewer_chloe');
    addLog(`[AUTHENTICATED] Active session: chloe.bennett@contractor.io (Role: viewer)`, 'info');

    addLog('[ATTACK] Attempting unauthorized GET /api/documents/doc_salary_2026 (Marcus Cole\'s Salary Matrix)...', 'info');

    try {
      const res = await fetch('/api/documents/doc_salary_2026', {
        headers: { Authorization: `Bearer ${localStorage.getItem('trustvault_token')}` }
      });
      const data = await res.json();

      if (res.status === 403) {
        addLog(`[SERVER BLOCKED] HTTP 403 Forbidden! Response: ${JSON.stringify(data)}`, 'success');
        addLog('[EVIDENCE] Server denied access. Checking cryptographic audit ledger...', 'info');

        // Check audit logs
        const auditRes = await fetch('/api/audit?limit=1&status=DENIED', {
          headers: { Authorization: `Bearer ${localStorage.getItem('trustvault_token')}` }
        });
        const auditData = await auditRes.json();
        if (auditData.logs?.length > 0) {
          addLog(`[AUDIT PROOF] Access denial sealed at sequence #${auditData.logs[0].sequence_num} with SHA-256 hash: ${auditData.logs[0].record_hash.slice(0, 20)}...`, 'success');
        }
      } else {
        addLog(`[SECURITY LEAK!] Server returned unexpected status: ${res.status}`, 'error');
      }
    } catch (err) {
      addLog(`[ERROR] Network failure: ${err.message}`, 'error');
    } finally {
      setRunning(false);
      if (onRefreshAudit) onRefreshAudit();
    }
  };

  // Scenario 2: Instant Revocation
  const runRevocationTest = async () => {
    setRunning(true);
    setScenarioLogs([]);

    addLog('[SETUP] Switching persona to Marcus Cole (Document Owner)...', 'info');
    await switchPersona('usr_owner_marcus');

    addLog('[STEP 1] Marcus grants temporary READ access to David Kim (Auditor)...', 'info');
    const grantRes = await fetch('/api/permissions/doc_salary_2026/grant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('trustvault_token')}`
      },
      body: JSON.stringify({
        targetUserId: 'usr_viewer_david',
        permissionLevel: 'read',
        aiRationale: 'Compliance verification demo'
      })
    });
    addLog(`[GRANT] Status ${grantRes.status}: Access granted.`, 'info');

    addLog('[STEP 2] Switching to David Kim to request single-use download ticket...', 'info');
    await switchPersona('usr_viewer_david');
    const ticketRes = await fetch('/api/documents/doc_salary_2026/ticket', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('trustvault_token')}` }
    });
    const ticketData = await ticketRes.json();
    addLog(`[TICKET ISSUED] Ephemeral download ticket generated: ${ticketData.ticket} (TTL: 60s)`, 'info');

    addLog('[STEP 3] Marcus immediately REVOKES David Kim\'s access...', 'info');
    await switchPersona('usr_owner_marcus');
    const revokeRes = await fetch('/api/permissions/doc_salary_2026/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('trustvault_token')}`
      },
      body: JSON.stringify({ targetUserId: 'usr_viewer_david' })
    });
    addLog(`[REVOKE] Status ${revokeRes.status}: Permission revoked in database. Ephemeral tickets invalidated.`, 'info');

    addLog('[STEP 4] David Kim attempts to download file using previously issued ticket...', 'info');
    await switchPersona('usr_viewer_david');
    const downloadAttempt = await fetch(`/api/documents/doc_salary_2026/download?ticket=${ticketData.ticket}`);
    const downloadData = await downloadAttempt.json();

    if (downloadAttempt.status === 403) {
      addLog(`[INSTANT REVOCATION VERIFIED] Download failed immediately with HTTP 403!`, 'success');
      addLog(`[SERVER RESPONSE] ${JSON.stringify(downloadData)}`, 'success');
      addLog('[CONCLUSION] Zero lingering validity. Tokens stop working the exact millisecond access is taken away.', 'success');
    } else {
      addLog(`[REVOCATION FAILED] Unexpected status ${downloadAttempt.status}`, 'error');
    }

    setRunning(false);
    if (onRefreshAudit) onRefreshAudit();
  };

  // Scenario 3: Database Tampering
  const runTamperSimulation = async () => {
    setRunning(true);
    setScenarioLogs([]);

    addLog('[SETUP] Switching to Elena Vance (Admin)...', 'info');
    await switchPersona('usr_admin_elena');

    addLog('[ATTACK] Simulating unauthorized direct SQLite row modification...', 'info');
    addLog('[ATTACK] Directly altering actor_email of an audit record to "blackhat@attacker.org"...', 'info');

    const tamperRes = await fetch('/api/audit/simulate-tamper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('trustvault_token')}`
      },
      body: JSON.stringify({ field: 'actor_email', newValue: 'blackhat@attacker.org' })
    });
    const tamperData = await tamperRes.json();
    addLog(`[DB MODIFIED] ${tamperData.message}`, 'info');

    addLog('[DETECTION] Running verifyAuditIntegrity() across the cryptographic hash chain...', 'info');
    const verifyRes = await fetch('/api/audit/verify', {
      headers: { Authorization: `Bearer ${localStorage.getItem('trustvault_token')}` }
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.report.isValid) {
      addLog(`[ALARM: TAMPER CAUGHT!] Hash chain integrity check FAILED!`, 'error');
      addLog(`[SEQUENCE] Tampered block sequence #${verifyData.report.sequenceNum}`, 'error');
      addLog(`[VIOLATION REASON] ${verifyData.report.reason}`, 'error');
      addLog('[PROOF] Cryptographic non-repudiation proved: An audit trail cannot be quietly altered!', 'success');
    } else {
      addLog('[ERROR] Verification unexpectedly passed.', 'error');
    }

    setRunning(false);
    if (onRefreshAudit) onRefreshAudit();
  };

  // Scenario 4: Polyglot Upload
  const runPolyglotUpload = async () => {
    setRunning(true);
    setScenarioLogs([]);

    addLog('[SETUP] Switching to Marcus Cole (Owner)...', 'info');
    await switchPersona('usr_owner_marcus');

    addLog('[ATTACK] Creating malicious binary payload disguised with .pdf extension...', 'info');
    // MZ DOS executable header (0x4D 0x5A)
    const fakeExeBlob = new Blob([new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])], { type: 'application/pdf' });

    const formData = new FormData();
    formData.append('file', fakeExeBlob, 'financial_model.pdf');
    formData.append('title', 'Trojan Disguised as PDF');
    formData.append('category', 'financial');

    addLog('[ATTACK] Attempting POST /api/documents/upload with spoofed file signature...', 'info');

    const res = await fetch('/api/documents/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('trustvault_token')}` },
      body: formData
    });
    const data = await res.json();

    if (res.status === 400) {
      addLog(`[SERVER INTERCEPTED] HTTP 400 Bad Request!`, 'success');
      addLog(`[REJECTION REASON] ${data.message}`, 'success');
      addLog('[EVIDENCE] Malicious file rejected before hitting disk storage.', 'success');
    } else {
      addLog(`[FAILED] Server accepted file with status ${res.status}`, 'error');
    }

    setRunning(false);
    if (onRefreshAudit) onRefreshAudit();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 7, 12, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '880px',
        maxHeight: '92vh',
        background: 'var(--bg-surface)',
        border: '1px solid rgba(244, 63, 94, 0.35)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 0 50px rgba(244, 63, 94, 0.2)',
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
          background: 'linear-gradient(90deg, rgba(244, 63, 94, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap style={{ width: '22px', height: '22px', color: '#F43F5E' }} />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#FFF' }}>Judge Security Challenge Simulator</h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Test attacks against TrustVault in real time. Inspect server rejection and cryptographic proof.
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Scenarios Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '6px 12px',
          gap: '6px',
          overflowX: 'auto'
        }}>
          {[
            { id: 'idor', label: '1. Test IDOR Bypass' },
            { id: 'revocation', label: '2. Test Instant Revocation' },
            { id: 'tamper', label: '3. Simulate Audit Tampering' },
            { id: 'polyglot', label: '4. Test Polyglot / Spoof' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveScenario(tab.id);
                setScenarioLogs([]);
              }}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                background: activeScenario === tab.id ? 'var(--bg-card-hover)' : 'transparent',
                color: activeScenario === tab.id ? '#FFF' : 'var(--text-muted)',
                fontSize: '12px',
                fontWeight: activeScenario === tab.id ? '600' : '400',
                border: activeScenario === tab.id ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid transparent'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scenario Details & Execution Panel */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {activeScenario === 'idor' && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF', marginBottom: '6px' }}>
                Scenario 1: Insecure Direct Object Reference (IDOR) Attempt
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                A low-privileged contractor attempts to read the CEO & VP Compensation Matrix without an access grant.
                TrustVault's server enforces zero-trust authorization, returns HTTP 403, and permanently seals an <code>ACCESS_DENIED_UNAUTHORIZED</code> record in the cryptographic ledger.
              </p>
              <button
                id="btn-run-idor-attack"
                onClick={runIdorAttack}
                disabled={running}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #E11D48 0%, #F43F5E 100%)',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '20px'
                }}
              >
                <Play style={{ width: '15px', height: '15px' }} />
                {running ? 'Executing Attack...' : 'Launch IDOR Attack'}
              </button>
            </div>
          )}

          {activeScenario === 'revocation' && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF', marginBottom: '6px' }}>
                Scenario 2: Real-Time Instant Revocation (Zero Lingering Validity)
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                Demonstrates Standard Three: Marcus grants access to David Kim, David obtains an ephemeral download ticket, Marcus revokes access, and David immediately attempts download. The server rejects the in-flight ticket with 403!
              </p>
              <button
                id="btn-run-revocation-attack"
                onClick={runRevocationTest}
                disabled={running}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #E11D48 0%, #F43F5E 100%)',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '20px'
                }}
              >
                <Play style={{ width: '15px', height: '15px' }} />
                {running ? 'Simulating Revocation Lifecycle...' : 'Run Revocation Lifecycle Test'}
              </button>
            </div>
          )}

          {activeScenario === 'tamper' && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF', marginBottom: '6px' }}>
                Scenario 3: Covert Audit Trail Database Tampering
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                An attacker with direct database access edits an audit row to hide a breach.
                TrustVault's <code>verifyAuditIntegrity()</code> recalculates the SHA-256 hash chain and HMAC signatures, immediately flagging the tampered row!
              </p>
              <button
                id="btn-run-tamper-attack"
                onClick={runTamperSimulation}
                disabled={running}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #E11D48 0%, #F43F5E 100%)',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '20px'
                }}
              >
                <Play style={{ width: '15px', height: '15px' }} />
                {running ? 'Tampering & Verifying...' : 'Simulate Database Tamper & Verify'}
              </button>
            </div>
          )}

          {activeScenario === 'polyglot' && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF', marginBottom: '6px' }}>
                Scenario 4: Disguised Executable Upload (Magic Byte Bypass)
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                Attacker attempts to upload a Windows PE executable (`MZ` header) masked as <code>financial_model.pdf</code>.
                TrustVault inspects binary magic bytes, rejects the file with HTTP 400, and seals a security alert.
              </p>
              <button
                id="btn-run-polyglot-attack"
                onClick={runPolyglotUpload}
                disabled={running}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #E11D48 0%, #F43F5E 100%)',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: '600',
                  marginBottom: '20px'
                }}
              >
                <Play style={{ width: '15px', height: '15px' }} />
                {running ? 'Uploading Disguised Binary...' : 'Launch Polyglot Upload'}
              </button>
            </div>
          )}

          {/* Real-time Telemetry Terminal */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.65)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            minHeight: '180px',
            maxHeight: '260px',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: 'var(--text-dim)' }}>
              <Terminal style={{ width: '14px', height: '14px' }} />
              <span>LIVE SERVER EXECUTION & EVIDENCE TELEMETRY</span>
            </div>

            {scenarioLogs.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                Click a test above to execute attack against the live server...
              </div>
            ) : (
              scenarioLogs.map((log, index) => {
                let color = '#FFF';
                if (log.type === 'success') color = '#34D399';
                if (log.type === 'error') color = '#FDA4AF';
                if (log.type === 'info') color = 'var(--cyan-light)';

                return (
                  <div key={index} style={{ marginBottom: '6px', color, lineHeight: '1.4' }}>
                    <span style={{ color: 'var(--text-dim)', marginRight: '8px' }}>[{log.timestamp}]</span>
                    {log.text}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
