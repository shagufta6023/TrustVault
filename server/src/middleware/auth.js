import { authenticateToken } from '../services/auth.js';

export function extractClientInfo(req, res, next) {
  const forwarded = req.headers['x-forwarded-for'];
  req.clientIp = (forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress) || '127.0.0.1';
  req.clientUserAgent = req.headers['user-agent'] || 'unknown';
  next();
}

export function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Authentication token missing. Please log in.'
    });
  }

  const user = authenticateToken(token);
  if (!user) {
    return res.status(401).json({
      error: 'INVALID_OR_REVOKED_TOKEN',
      message: 'Session has expired or was revoked. Please log in again.'
    });
  }

  req.user = user;
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN_ROLE',
        message: `Role '${req.user.role}' is not authorized for this action. Required: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}
