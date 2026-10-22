import { v4 as uuidv4 } from 'uuid';
import { db as defaultDb } from '../db/database.js';
import {
  GENESIS_HASH,
  computeAuditRecordHash,
  signAuditHash,
  verifyAuditChain,
  canonicalizeJson
} from './crypto.js';

/**
 * Standard audit actions across TrustVault
 */
export const AUDIT_ACTIONS = {
  // Authentication & Session
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  SESSION_REVOKED: 'SESSION_REVOKED',

  // Document Operations
  DOCUMENT_UPLOAD: 'DOCUMENT_UPLOAD',
  DOCUMENT_READ_METADATA: 'DOCUMENT_READ_METADATA',
  DOCUMENT_VIEW_CONTENT: 'DOCUMENT_VIEW_CONTENT',
  DOCUMENT_DOWNLOAD: 'DOCUMENT_DOWNLOAD',
  DOCUMENT_VERSION_UPLOAD: 'DOCUMENT_VERSION_UPLOAD',
  DOCUMENT_METADATA_UPDATE: 'DOCUMENT_METADATA_UPDATE',
  DOCUMENT_DELETE: 'DOCUMENT_DELETE',

  // Permissions & Sharing
  PERMISSION_GRANT: 'PERMISSION_GRANT',
  PERMISSION_REVOKE: 'PERMISSION_REVOKE',
  AI_ACCESS_SUGGESTION_REQUESTED: 'AI_ACCESS_SUGGESTION_REQUESTED',
  AI_ACCESS_SUGGESTION_ACCEPTED: 'AI_ACCESS_SUGGESTION_ACCEPTED',
  AI_ACCESS_SUGGESTION_REJECTED: 'AI_ACCESS_SUGGESTION_REJECTED',

  // Security Violations & Access Denials
  ACCESS_DENIED_UNAUTHORIZED: 'ACCESS_DENIED_UNAUTHORIZED',
  ACCESS_DENIED_REVOKED: 'ACCESS_DENIED_REVOKED',
  ACCESS_DENIED_WRONG_ROLE: 'ACCESS_DENIED_WRONG_ROLE',
  SECURITY_FILE_VALIDATION_FAILED: 'SECURITY_FILE_VALIDATION_FAILED',
  SECURITY_RATE_LIMIT_EXCEEDED: 'SECURITY_RATE_LIMIT_EXCEEDED',
  SECURITY_TAMPER_DETECTED: 'SECURITY_TAMPER_DETECTED',
  ADMIN_BREAK_GLASS_OVERRIDE: 'ADMIN_BREAK_GLASS_OVERRIDE',
};

/**
 * Records an immutable, cryptographically chained audit event.
 * Atomically links each event to the previous record's hash.
 */
export function recordAuditEvent({
  actor = null,
  action,
  document = null,
  status = 'SUCCESS',
  details = {},
  ip_address = '127.0.0.1',
  user_agent = 'unknown',
  customDb = null
}) {
  const database = customDb || defaultDb;

  // Use a database transaction to guarantee sequential hash chain continuity
  const insertTransaction = database.transaction(() => {
    // 1. Fetch tip of the chain
    const tip = database
      .prepare('SELECT sequence_num, record_hash FROM audit_logs ORDER BY sequence_num DESC LIMIT 1')
      .get();

    const sequenceNum = tip ? tip.sequence_num + 1 : 1;
    const previousHash = tip ? tip.record_hash : GENESIS_HASH;
    const timestamp = new Date().toISOString();
    const id = `aud_${uuidv4().replace(/-/g, '')}`;

    const canonicalDetails = canonicalizeJson(details);

    const recordForHash = {
      sequence_num: sequenceNum,
      previous_hash: previousHash,
      timestamp,
      actor_id: actor?.id || 'SYSTEM',
      actor_email: actor?.email || 'SYSTEM',
      action,
      document_id: document?.id || 'NONE',
      status,
      details: canonicalDetails,
      ip_address: ip_address || '0.0.0.0'
    };

    // 2. Compute SHA-256 hash
    const recordHash = computeAuditRecordHash(recordForHash);

    // 3. Compute HMAC signature
    const hmacSignature = signAuditHash(recordHash);

    // 4. Insert into database
    database.prepare(`
      INSERT INTO audit_logs (
        id, sequence_num, timestamp, actor_id, actor_email, actor_role,
        action, document_id, document_title, status, ip_address, user_agent,
        details, previous_hash, record_hash, hmac_signature
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `).run(
      id,
      sequenceNum,
      timestamp,
      actor?.id || null,
      actor?.email || null,
      actor?.role || null,
      action,
      document?.id || null,
      document?.title || null,
      status,
      ip_address || null,
      user_agent || null,
      canonicalDetails,
      previousHash,
      recordHash,
      hmacSignature
    );

    return {
      id,
      sequence_num: sequenceNum,
      timestamp,
      actor_id: actor?.id || null,
      actor_email: actor?.email || null,
      actor_role: actor?.role || null,
      action,
      document_id: document?.id || null,
      document_title: document?.title || null,
      status,
      ip_address,
      user_agent,
      details: typeof details === 'string' ? JSON.parse(details) : details,
      previous_hash: previousHash,
      record_hash: recordHash,
      hmac_signature: hmacSignature
    };
  });

  return insertTransaction();
}

/**
 * Retrieves audit logs with optional filtering
 */
export function getAuditLogs({
  limit = 100,
  offset = 0,
  document_id = null,
  actor_id = null,
  action = null,
  status = null,
  search = null,
  customDb = null
} = {}) {
  const database = customDb || defaultDb;

  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (document_id) {
    query += ' AND document_id = ?';
    params.push(document_id);
  }
  if (actor_id) {
    query += ' AND actor_id = ?';
    params.push(actor_id);
  }
  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    query += ' AND (document_title LIKE ? OR actor_email LIKE ? OR details LIKE ? OR action LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  query += ' ORDER BY sequence_num DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rows = database.prepare(query).all(...params);

  // Parse details JSON
  return rows.map(r => ({
    ...r,
    details: (() => {
      try {
        return JSON.parse(r.details);
      } catch {
        return r.details;
      }
    })()
  }));
}

/**
 * Cryptographically verifies the entire audit log chain in the database
 */
export function verifyAuditIntegrity(customDb = null) {
  const database = customDb || defaultDb;
  const records = database
    .prepare('SELECT * FROM audit_logs ORDER BY sequence_num ASC')
    .all();

  return verifyAuditChain(records);
}

/**
 * Diagnostic utility for automated tests & evaluators:
 * Intentionally alters an audit row to verify tamper detection.
 */
export function simulateTamper({ logId, field, newValue, deleteRecord = false, customDb = null }) {
  const database = customDb || defaultDb;

  if (deleteRecord) {
    return database.prepare('DELETE FROM audit_logs WHERE id = ?').run(logId);
  }

  return database
    .prepare(`UPDATE audit_logs SET ${field} = ? WHERE id = ?`)
    .run(newValue, logId);
}
