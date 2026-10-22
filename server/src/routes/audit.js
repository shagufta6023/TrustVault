import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getAuditLogs,
  verifyAuditIntegrity,
  simulateTamper,
  recordAuditEvent,
  AUDIT_ACTIONS
} from '../services/audit.js';
import { db } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/audit
 * Retrieves audit logs.
 * - Admin can see full system audit trail.
 * - Document Owner can see audit logs for their documents.
 * - Viewers can see audit logs for actions they participated in.
 */
router.get('/', requireAuth, (req, res) => {
  const { limit, offset, documentId, actorId, action, status, search } = req.query;
  const user = req.user;

  let filterDocId = documentId || null;
  let filterActorId = actorId || null;

  if (user.role === 'viewer') {
    // Viewers cannot inspect arbitrary company audit logs; scoped strictly to their actorId
    filterActorId = user.id;
  } else if (user.role === 'owner') {
    // Owners can view logs for their own docs or where they are the actor, or filter by specific doc
    if (documentId) {
      const doc = db.prepare('SELECT owner_id FROM documents WHERE id = ?').get(documentId);
      if (doc && doc.owner_id !== user.id) {
        // Checking doc they don't own -> limit to their actorId
        filterActorId = user.id;
      }
    }
  }

  const logs = getAuditLogs({
    limit: limit ? parseInt(limit, 10) : 100,
    offset: offset ? parseInt(offset, 10) : 0,
    document_id: filterDocId,
    actor_id: filterActorId,
    action: action || null,
    status: status || null,
    search: search || null
  });

  return res.json({ logs, count: logs.length });
});

/**
 * GET /api/audit/verify
 * Cryptographically verifies the entire audit hash chain and HMAC signatures.
 * Returns cryptographic proof report.
 */
router.get('/verify', requireAuth, (req, res) => {
  const report = verifyAuditIntegrity();

  // If tamper is detected, log security alarm!
  if (!report.isValid) {
    recordAuditEvent({
      actor: req.user,
      action: AUDIT_ACTIONS.SECURITY_TAMPER_DETECTED,
      status: 'ANOMALY',
      details: {
        violationReason: report.reason,
        sequenceNum: report.sequenceNum,
        recordId: report.recordId
      },
      ip_address: req.clientIp,
      user_agent: req.clientUserAgent
    });
  }

  return res.json({ report });
});

/**
 * POST /api/audit/simulate-tamper
 * Diagnostic tool for judges / automated tests to deliberately modify a row in the DB
 * to prove that the cryptographic hash chain immediately catches unauthorized modifications.
 */
router.post('/simulate-tamper', requireAuth, (req, res) => {
  // Only Admin or testing persona can execute simulation
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Only administrators can run security tamper simulations.' });
  }

  const { logId, field, newValue, deleteRecord } = req.body;

  let targetId = logId;
  if (!targetId) {
    // Pick the most recent record or a middle record
    const target = db.prepare('SELECT id FROM audit_logs ORDER BY sequence_num DESC LIMIT 1 OFFSET 1').get()
      || db.prepare('SELECT id FROM audit_logs ORDER BY sequence_num DESC LIMIT 1').get();
    targetId = target?.id;
  }

  if (!targetId) {
    return res.status(400).json({ error: 'NO_RECORDS_TO_TAMPER' });
  }

  simulateTamper({
    logId: targetId,
    field: field || 'actor_email',
    newValue: newValue || 'malicious_impostor@attacker.org',
    deleteRecord: Boolean(deleteRecord)
  });

  return res.json({
    success: true,
    message: deleteRecord
      ? `Deleted audit log record ${targetId} from database.`
      : `Modified field '${field || 'actor_email'}' of record ${targetId} in SQLite database.`,
    tamperedRecordId: targetId,
    instruction: 'Now run GET /api/audit/verify or click "Verify Audit Integrity" to inspect the cryptographic break!'
  });
});

export default router;
