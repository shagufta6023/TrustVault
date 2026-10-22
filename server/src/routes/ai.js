import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { generateAccessSuggestion } from '../services/aiAdvisor.js';
import { checkDocumentPermission, PERMISSION_ACTIONS } from '../services/permission.js';

const router = express.Router();

/**
 * POST /api/ai/suggest-access
 * Generates least-privilege sharing suggestion for an owner.
 * Strictly requires human review before granting.
 */
router.post('/suggest-access', requireAuth, (req, res) => {
  const { documentId } = req.body;

  if (!documentId) {
    return res.status(400).json({ error: 'MISSING_DOCUMENT_ID' });
  }

  // Must be owner or have MANAGE_PERMISSIONS
  const auth = checkDocumentPermission({
    user: req.user,
    documentId,
    requiredAction: PERMISSION_ACTIONS.MANAGE_PERMISSIONS,
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  if (!auth.allowed) {
    return res.status(auth.status).json({
      error: 'ACCESS_DENIED',
      message: 'Only document owners can request AI access recommendations.'
    });
  }

  try {
    const suggestion = generateAccessSuggestion({
      documentId,
      requestingUser: req.user
    });

    return res.json({ suggestion });
  } catch (err) {
    return res.status(500).json({
      error: 'AI_ADVISOR_ERROR',
      message: err.message
    });
  }
});

export default router;
