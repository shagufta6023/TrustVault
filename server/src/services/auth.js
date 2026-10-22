import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { db as defaultDb } from '../db/database.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'trustvault_dev_jwt_secret_9f83b271d4a840e6c51b9e28fa710432';
const EPHEMERAL_TTL_MS = (parseInt(process.env.EPHEMERAL_TICKET_TTL_SECONDS, 10) || 60) * 1000;

/**
 * Hash plaintext password using bcrypt with cost factor 10
 */
export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Compare plain password against hash
 */
export async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

/**
 * Issue a signed JWT token containing user identity and token_version
 */
export function issueUserToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.token_version || 1
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/**
 * Validates a JWT token AND strictly verifies real-time user status in DB
 */
export function authenticateToken(token, customDb = null) {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const database = customDb || defaultDb;

    // Strict real-time database verification:
    // If user was deactivated, or their token version bumped, reject immediately!
    const user = database
      .prepare('SELECT id, email, name, role, department, is_active, token_version FROM users WHERE id = ?')
      .get(decoded.sub);

    if (!user || !user.is_active) {
      return null;
    }

    if (user.token_version !== decoded.tokenVersion) {
      return null; // Session revoked via token version bump
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Invalidates all active sessions for a user by bumping their token_version
 */
export function revokeAllUserSessions(userId, customDb = null) {
  const database = customDb || defaultDb;
  return database
    .prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?')
    .run(userId);
}

/**
 * Generates an ephemeral single-use download ticket (60s validity)
 */
export function createEphemeralTicket({ userId, documentId, ipAddress = '127.0.0.1', customDb = null }) {
  const database = customDb || defaultDb;
  const ticket = `tkt_${uuidv4().replace(/-/g, '')}`;
  const now = Date.now();
  const expiresAt = now + EPHEMERAL_TTL_MS;

  database.prepare(`
    INSERT INTO ephemeral_download_tickets (
      ticket, user_id, document_id, expires_at, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    ticket,
    userId,
    documentId,
    expiresAt,
    ipAddress,
    new Date(now).toISOString()
  );

  return { ticket, expiresAt };
}

/**
 * Consumes and invalidates an ephemeral ticket.
 * Returns { valid: boolean, userId, documentId }
 */
export function consumeEphemeralTicket({ ticket, documentId, customDb = null }) {
  const database = customDb || defaultDb;
  const now = Date.now();

  const record = database.prepare(`
    SELECT ticket, user_id, document_id, expires_at, used_at 
    FROM ephemeral_download_tickets 
    WHERE ticket = ? AND document_id = ?
  `).get(ticket, documentId);

  if (!record) {
    return { valid: false, reason: 'TICKET_NOT_FOUND' };
  }

  if (record.used_at) {
    return { valid: false, reason: 'TICKET_ALREADY_USED' };
  }

  if (record.expires_at < now) {
    return { valid: false, reason: 'TICKET_EXPIRED' };
  }

  // Mark ticket consumed
  database.prepare(`
    UPDATE ephemeral_download_tickets 
    SET used_at = ? 
    WHERE ticket = ?
  `).run(new Date(now).toISOString(), ticket);

  return {
    valid: true,
    userId: record.user_id,
    documentId: record.document_id
  };
}
