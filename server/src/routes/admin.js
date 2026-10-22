import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { db } from '../db/database.js';
import { recordAuditEvent } from '../services/audit.js';

const router = express.Router();

// All routes require Admin role
router.use(requireAuth, requireRole('admin'));

/**
 * GET /api/admin/metrics
 * System-wide cryptographic and security telemetry
 */
router.get('/metrics', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
  const totalDocs = db.prepare('SELECT COUNT(*) as count FROM documents WHERE is_deleted = 0').get().count;
  const activeGrants = db.prepare('SELECT COUNT(*) as count FROM permissions WHERE is_active = 1').get().count;
  const revokedGrants = db.prepare('SELECT COUNT(*) as count FROM permissions WHERE is_active = 0').get().count;
  const totalAuditEvents = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;
  const accessDenials = db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE status = 'DENIED'").get().count;
  const anomalies = db.prepare("SELECT COUNT(*) as count FROM audit_logs WHERE status = 'ANOMALY'").get().count;

  // Breakdown by category
  const categories = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM documents 
    WHERE is_deleted = 0 
    GROUP BY category
  `).all();

  // Breakdown by action
  const recentActionCounts = db.prepare(`
    SELECT action, COUNT(*) as count 
    FROM audit_logs 
    GROUP BY action 
    ORDER BY count DESC 
    LIMIT 8
  `).all();

  return res.json({
    metrics: {
      totalUsers,
      totalDocs,
      activeGrants,
      revokedGrants,
      totalAuditEvents,
      accessDenials,
      anomalies,
      categories,
      recentActionCounts
    }
  });
});

/**
 * GET /api/admin/anomalies
 * High-priority security events (Access denials, break-glass, validation errors)
 */
router.get('/anomalies', (req, res) => {
  const securityEvents = db.prepare(`
    SELECT * FROM audit_logs 
    WHERE status IN ('DENIED', 'ANOMALY')
    ORDER BY sequence_num DESC 
    LIMIT 50
  `).all();

  return res.json({
    anomalies: securityEvents.map(e => ({
      ...e,
      details: (() => {
        try { return JSON.parse(e.details); } catch { return e.details; }
      })()
    }))
  });
});

/**
 * POST /api/admin/users/:id/toggle
 * Activate / deactivate a user account (triggers instant session revocation)
 */
router.post('/users/:id/toggle', (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT id, email, name, is_active FROM users WHERE id = ?').get(id);

  if (!user) {
    return res.status(404).json({ error: 'USER_NOT_FOUND' });
  }

  const newStatus = user.is_active ? 0 : 1;

  // Bump token version on deactivation to immediately invalidate all sessions
  db.prepare(`
    UPDATE users 
    SET is_active = ?, token_version = token_version + 1 
    WHERE id = ?
  `).run(newStatus, id);

  recordAuditEvent({
    actor: req.user,
    action: newStatus === 0 ? 'USER_ACCOUNT_DEACTIVATED' : 'USER_ACCOUNT_ACTIVATED',
    status: 'SUCCESS',
    details: {
      targetUserId: user.id,
      targetEmail: user.email,
      newActiveStatus: newStatus,
      message: newStatus === 0 ? 'User deactivated. All sessions immediately revoked.' : 'User re-activated.'
    },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      isActive: Boolean(newStatus)
    }
  });
});

export default router;
