import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  grantDocumentPermission,
  revokeDocumentPermission,
  getDocumentPermissions
} from '../services/permission.js';

const router = express.Router();

/**
 * GET /api/permissions/:documentId
 * List all active and revoked grants for a document (requires READ permission)
 */
router.get('/:documentId', requireAuth, (req, res) => {
  const { documentId } = req.params;
  const result = getDocumentPermissions(documentId, req.user);

  if (!result.success) {
    return res.status(result.status || 403).json({
      error: 'ACCESS_DENIED',
      message: 'You do not have permission to view permission grants for this document.'
    });
  }

  return res.json({
    documentId: result.documentId,
    grants: result.grants
  });
});

/**
 * POST /api/permissions/:documentId/grant
 * Grant access to a named user (requires Document Owner)
 */
router.post('/:documentId/grant', requireAuth, (req, res) => {
  const { documentId } = req.params;
  const { targetUserId, permissionLevel, aiSuggested, aiRationale } = req.body;

  if (!targetUserId || !permissionLevel) {
    return res.status(400).json({
      error: 'MISSING_FIELDS',
      message: 'targetUserId and permissionLevel are required.'
    });
  }

  if (permissionLevel !== 'read' && permissionLevel !== 'edit') {
    return res.status(400).json({
      error: 'INVALID_LEVEL',
      message: "permissionLevel must be either 'read' or 'edit'."
    });
  }

  const result = grantDocumentPermission({
    documentId,
    targetUserId,
    permissionLevel,
    grantedByUser: req.user,
    aiSuggested: Boolean(aiSuggested),
    aiRationale: aiRationale || null,
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  if (!result.success) {
    return res.status(result.status || 403).json({
      error: 'GRANT_FAILED',
      message: result.reason || 'Could not grant permission.'
    });
  }

  return res.status(201).json({
    success: true,
    message: `Granted ${permissionLevel} access to ${result.targetUser.email}`,
    grant: result
  });
});

/**
 * POST /api/permissions/:documentId/revoke
 * Immediately revokes access from a named user (requires Document Owner)
 */
router.post('/:documentId/revoke', requireAuth, (req, res) => {
  const { documentId } = req.params;
  const { targetUserId } = req.body;

  if (!targetUserId) {
    return res.status(400).json({ error: 'MISSING_TARGET_USER_ID' });
  }

  const result = revokeDocumentPermission({
    documentId,
    targetUserId,
    revokedByUser: req.user,
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  if (!result.success) {
    return res.status(result.status || 403).json({
      error: 'REVOCATION_FAILED',
      message: result.reason || 'Could not revoke permission.'
    });
  }

  return res.json({
    success: true,
    message: 'Access immediately revoked. Ephemeral tickets invalidated.',
    revokedCount: result.revokedCount,
    revokedAt: result.revokedAt
  });
});

export default router;
