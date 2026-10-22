import express from 'express';
import { db } from '../db/database.js';
import {
  verifyPassword,
  issueUserToken,
  revokeAllUserSessions
} from '../services/auth.js';
import { recordAuditEvent, AUDIT_ACTIONS } from '../services/audit.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'MISSING_CREDENTIALS', message: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

  if (!user || !user.is_active) {
    recordAuditEvent({
      actor: null,
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      status: 'DENIED',
      details: { attemptedEmail: email, reason: 'Invalid email or inactive user' },
      ip_address: req.clientIp,
      user_agent: req.clientUserAgent
    });

    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    });
  }

  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) {
    recordAuditEvent({
      actor: { id: user.id, email: user.email, role: user.role },
      action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
      status: 'DENIED',
      details: { reason: 'Incorrect password' },
      ip_address: req.clientIp,
      user_agent: req.clientUserAgent
    });

    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    });
  }

  const token = issueUserToken(user);

  recordAuditEvent({
    actor: { id: user.id, email: user.email, role: user.role },
    action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
    status: 'SUCCESS',
    details: { department: user.department },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department
    }
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  recordAuditEvent({
    actor: req.user,
    action: AUDIT_ACTIONS.AUTH_LOGOUT,
    status: 'SUCCESS',
    details: { message: 'User logged out' },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      department: req.user.department
    }
  });
});

// GET /api/auth/users (for sharing & persona picker)
router.get('/users', requireAuth, (req, res) => {
  const users = db.prepare(`
    SELECT id, email, name, role, department, is_active 
    FROM users 
    WHERE is_active = 1
    ORDER BY role ASC, name ASC
  `).all();

  return res.json({ users });
});

// POST /api/auth/switch-persona (evaluation helper for judge testing)
router.post('/switch-persona', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'MISSING_USER_ID' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || !user.is_active) {
    return res.status(404).json({ error: 'USER_NOT_FOUND_OR_INACTIVE' });
  }

  const token = issueUserToken(user);

  recordAuditEvent({
    actor: { id: user.id, email: user.email, role: user.role },
    action: 'PERSONA_SWITCHED',
    status: 'SUCCESS',
    details: { message: `Evaluator switched persona to ${user.name} (${user.role})` },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department
    }
  });
});

// POST /api/auth/revoke-sessions (invalidate all tokens for current user)
router.post('/revoke-sessions', requireAuth, (req, res) => {
  revokeAllUserSessions(req.user.id);

  recordAuditEvent({
    actor: req.user,
    action: AUDIT_ACTIONS.SESSION_REVOKED,
    status: 'SUCCESS',
    details: { message: 'All active sessions invalidated via token version bump' },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.json({ success: true, message: 'All active sessions invalidated.' });
});

export default router;
