import { db as defaultDb } from '../db/database.js';
import { recordAuditEvent, AUDIT_ACTIONS } from './audit.js';

export const PERMISSION_ACTIONS = {
  READ: 'READ',
  DOWNLOAD: 'DOWNLOAD',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
  MANAGE_PERMISSIONS: 'MANAGE_PERMISSIONS',
};

/**
 * Checks if a user has permission to perform a specific action on a document.
 * 
 * Enforces:
 * 1. Document existence & soft-deletion check.
 * 2. Document Owner has full rights (READ, DOWNLOAD, EDIT, DELETE, MANAGE_PERMISSIONS).
 * 3. Active granted permissions:
 *    - 'edit' grant allows READ, DOWNLOAD, EDIT.
 *    - 'read' grant allows READ, DOWNLOAD.
 * 4. Revocation is strictly real-time: queries is_active = 1 directly from database.
 * 5. Admin Separation of Duties: Admins cannot silently read document contents without
 *    either an explicit grant OR an explicitly declared, auditable Break-Glass override.
 * 6. Logs all ACCESS_DENIED attempts to the tamper-evident audit trail!
 */
export function checkDocumentPermission({
  user,
  documentId,
  requiredAction,
  breakGlassReason = null,
  ip_address = '127.0.0.1',
  user_agent = 'unknown',
  logDenial = true,
  customDb = null
}) {
  const database = customDb || defaultDb;

  if (!user || !user.id) {
    return {
      allowed: false,
      reason: 'UNAUTHENTICATED',
      status: 401
    };
  }

  // 1. Fetch document
  const doc = database
    .prepare('SELECT id, title, owner_id, is_deleted, classification FROM documents WHERE id = ?')
    .get(documentId);

  if (!doc) {
    return {
      allowed: false,
      reason: 'DOCUMENT_NOT_FOUND',
      status: 404
    };
  }

  if (doc.is_deleted) {
    return {
      allowed: false,
      reason: 'DOCUMENT_DELETED',
      status: 410
    };
  }

  // 2. Document Owner has full access
  if (doc.owner_id === user.id) {
    return {
      allowed: true,
      role: 'OWNER',
      permissionLevel: 'owner',
      document: doc
    };
  }

  // 3. Admin Break-Glass Override Check
  if (user.role === 'admin' && breakGlassReason) {
    // Admin is exercising an audited emergency break-glass override
    recordAuditEvent({
      actor: user,
      action: AUDIT_ACTIONS.ADMIN_BREAK_GLASS_OVERRIDE,
      document: doc,
      status: 'ANOMALY',
      details: {
        reason: breakGlassReason,
        requiredAction,
        message: 'Administrator exercised break-glass emergency override on restricted document.'
      },
      ip_address,
      user_agent,
      customDb: database
    });

    return {
      allowed: true,
      role: 'ADMIN_BREAK_GLASS',
      permissionLevel: 'admin_override',
      document: doc
    };
  }

  // 4. Query active permissions table for this user & document
  const activeGrant = database
    .prepare(`
      SELECT permission_level, granted_at, ai_suggested 
      FROM permissions 
      WHERE document_id = ? AND user_id = ? AND is_active = 1
    `)
    .get(documentId, user.id);

  if (activeGrant) {
    const level = activeGrant.permission_level;

    if (requiredAction === PERMISSION_ACTIONS.READ || requiredAction === PERMISSION_ACTIONS.DOWNLOAD) {
      return {
        allowed: true,
        role: 'GRANTEE',
        permissionLevel: level,
        document: doc
      };
    }

    if (requiredAction === PERMISSION_ACTIONS.EDIT) {
      if (level === 'edit') {
        return {
          allowed: true,
          role: 'GRANTEE_EDITOR',
          permissionLevel: level,
          document: doc
        };
      } else {
        // Has read, but tried to edit
        if (logDenial) {
          recordAuditEvent({
            actor: user,
            action: AUDIT_ACTIONS.ACCESS_DENIED_UNAUTHORIZED,
            document: doc,
            status: 'DENIED',
            details: {
              attemptedAction: requiredAction,
              currentGrant: level,
              reason: 'User holds read-only permission; edit access denied.'
            },
            ip_address,
            user_agent,
            customDb: database
          });
        }
        return {
          allowed: false,
          reason: 'READ_ONLY_GRANT',
          status: 403
        };
      }
    }

    // Attempting DELETE or MANAGE_PERMISSIONS without being owner
    if (requiredAction === PERMISSION_ACTIONS.DELETE || requiredAction === PERMISSION_ACTIONS.MANAGE_PERMISSIONS) {
      if (logDenial) {
        recordAuditEvent({
          actor: user,
          action: AUDIT_ACTIONS.ACCESS_DENIED_WRONG_ROLE,
          document: doc,
          status: 'DENIED',
          details: {
            attemptedAction: requiredAction,
            currentGrant: level,
            reason: 'Only the document owner can delete or manage document permissions.'
          },
          ip_address,
          user_agent,
          customDb: database
        });
      }
      return {
        allowed: false,
        reason: 'OWNER_ONLY_ACTION',
        status: 403
      };
    }
  }

  // 5. No active grant found. Check if the user previously had access that was revoked!
  const revokedGrant = database
    .prepare(`
      SELECT revoked_at, revoked_by 
      FROM permissions 
      WHERE document_id = ? AND user_id = ? AND is_active = 0 
      ORDER BY revoked_at DESC LIMIT 1
    `)
    .get(documentId, user.id);

  const denialAction = revokedGrant
    ? AUDIT_ACTIONS.ACCESS_DENIED_REVOKED
    : AUDIT_ACTIONS.ACCESS_DENIED_UNAUTHORIZED;

  const denialReason = revokedGrant
    ? 'Access previously revoked by owner'
    : 'No permission granted for this document';

  if (logDenial) {
    recordAuditEvent({
      actor: user,
      action: denialAction,
      document: doc,
      status: 'DENIED',
      details: {
        attemptedAction: requiredAction,
        revokedAt: revokedGrant ? revokedGrant.revoked_at : null,
        reason: denialReason
      },
      ip_address,
      user_agent,
      customDb: database
    });
  }

  return {
    allowed: false,
    reason: revokedGrant ? 'REVOKED_ACCESS' : 'UNAUTHORIZED',
    status: 403
  };
}

/**
 * Grants permission on a document to a named user
 */
export function grantDocumentPermission({
  documentId,
  targetUserId,
  permissionLevel,
  grantedByUser,
  aiSuggested = false,
  aiRationale = null,
  ip_address = '127.0.0.1',
  user_agent = 'unknown',
  customDb = null
}) {
  const database = customDb || defaultDb;

  // Verify grantor has MANAGE_PERMISSIONS on this document
  const authCheck = checkDocumentPermission({
    user: grantedByUser,
    documentId,
    requiredAction: PERMISSION_ACTIONS.MANAGE_PERMISSIONS,
    ip_address,
    user_agent,
    customDb: database
  });

  if (!authCheck.allowed) {
    return { success: false, status: authCheck.status, reason: authCheck.reason };
  }

  // Target user check
  const targetUser = database.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(targetUserId);
  if (!targetUser) {
    return { success: false, status: 404, reason: 'TARGET_USER_NOT_FOUND' };
  }

  // Execute in transaction: deactivate any old grant and insert new active grant
  const executeGrant = database.transaction(() => {
    const now = new Date().toISOString();
    
    // Revoke any existing active grant first
    database.prepare(`
      UPDATE permissions 
      SET is_active = 0, revoked_at = ?, revoked_by = ? 
      WHERE document_id = ? AND user_id = ? AND is_active = 1
    `).run(now, grantedByUser.id, documentId, targetUserId);

    const grantId = `perm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    database.prepare(`
      INSERT INTO permissions (
        id, document_id, user_id, permission_level,
        granted_by, granted_at, is_active, ai_suggested, ai_rationale
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      grantId,
      documentId,
      targetUserId,
      permissionLevel,
      grantedByUser.id,
      now,
      aiSuggested ? 1 : 0,
      aiRationale
    );

    // Record audit event
    recordAuditEvent({
      actor: grantedByUser,
      action: AUDIT_ACTIONS.PERMISSION_GRANT,
      document: authCheck.document,
      status: 'SUCCESS',
      details: {
        targetUserId,
        targetEmail: targetUser.email,
        permissionLevel,
        aiSuggested,
        aiRationale
      },
      ip_address,
      user_agent,
      customDb: database
    });

    return {
      success: true,
      permissionId: grantId,
      documentId,
      targetUser,
      permissionLevel,
      grantedAt: now
    };
  });

  return executeGrant();
}

/**
 * Revokes permission on a document immediately.
 * Invalidates active grants and any outstanding ephemeral download tickets!
 */
export function revokeDocumentPermission({
  documentId,
  targetUserId,
  revokedByUser,
  ip_address = '127.0.0.1',
  user_agent = 'unknown',
  customDb = null
}) {
  const database = customDb || defaultDb;

  // Verify revoker has MANAGE_PERMISSIONS
  const authCheck = checkDocumentPermission({
    user: revokedByUser,
    documentId,
    requiredAction: PERMISSION_ACTIONS.MANAGE_PERMISSIONS,
    ip_address,
    user_agent,
    customDb: database
  });

  if (!authCheck.allowed) {
    return { success: false, status: authCheck.status, reason: authCheck.reason };
  }

  const targetUser = database.prepare('SELECT id, email, name FROM users WHERE id = ?').get(targetUserId);

  const executeRevocation = database.transaction(() => {
    const now = new Date().toISOString();

    // 1. Mark grant inactive
    const updateResult = database.prepare(`
      UPDATE permissions 
      SET is_active = 0, revoked_at = ?, revoked_by = ? 
      WHERE document_id = ? AND user_id = ? AND is_active = 1
    `).run(now, revokedByUser.id, documentId, targetUserId);

    // 2. Invalidate any pending ephemeral download tickets
    database.prepare(`
      DELETE FROM ephemeral_download_tickets 
      WHERE document_id = ? AND user_id = ?
    `).run(documentId, targetUserId);

    // 3. Log audit event
    recordAuditEvent({
      actor: revokedByUser,
      action: AUDIT_ACTIONS.PERMISSION_REVOKE,
      document: authCheck.document,
      status: 'SUCCESS',
      details: {
        targetUserId,
        targetEmail: targetUser?.email || 'unknown',
        revokedRows: updateResult.changes,
        message: 'Access immediately revoked. Ephemeral tickets invalidated.'
      },
      ip_address,
      user_agent,
      customDb: database
    });

    return {
      success: true,
      revokedCount: updateResult.changes,
      revokedAt: now
    };
  });

  return executeRevocation();
}

/**
 * Fetches all permission grants (active and past) for a document
 */
export function getDocumentPermissions(documentId, requestingUser, customDb = null) {
  const database = customDb || defaultDb;

  // Must have at least read permission to inspect permissions
  const auth = checkDocumentPermission({
    user: requestingUser,
    documentId,
    requiredAction: PERMISSION_ACTIONS.READ,
    customDb: database
  });

  if (!auth.allowed) {
    return { success: false, status: auth.status, reason: auth.reason };
  }

  const grants = database.prepare(`
    SELECT 
      p.id, p.document_id, p.user_id, p.permission_level,
      p.granted_at, p.revoked_at, p.is_active, p.ai_suggested, p.ai_rationale,
      u.email as user_email, u.name as user_name, u.role as user_role, u.department as user_department,
      gb.email as granted_by_email, gb.name as granted_by_name
    FROM permissions p
    JOIN users u ON p.user_id = u.id
    JOIN users gb ON p.granted_by = gb.id
    WHERE p.document_id = ?
    ORDER BY p.is_active DESC, p.granted_at DESC
  `).all(documentId);

  return {
    success: true,
    documentId,
    grants
  };
}
