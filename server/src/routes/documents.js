import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import {
  checkDocumentPermission,
  PERMISSION_ACTIONS
} from '../services/permission.js';
import {
  validateUploadFile,
  sanitizeFilename
} from '../services/fileValidator.js';
import {
  storeEncryptedFile,
  retrieveDecryptedFile
} from '../services/fileStorage.js';
import {
  recordAuditEvent,
  AUDIT_ACTIONS
} from '../services/audit.js';
import {
  createEphemeralTicket,
  consumeEphemeralTicket,
  authenticateToken
} from '../services/auth.js';

const router = express.Router();

// Configure multer in-memory storage (max 25MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 26214400 } // 25MB
});

/**
 * GET /api/documents
 * Lists documents accessible to the requesting user.
 * Strictly scopes visibility to:
 * - Documents owned by the user
 * - Documents where the user holds an ACTIVE permission grant
 * (For Admins: lists metadata for compliance inspection, with flag hasDirectReadAccess)
 */
router.get('/', requireAuth, (req, res) => {
  const { q, category, ownerId, dateFrom, dateTo, viewMode } = req.query;
  const user = req.user;

  let query = '';
  const params = [];

  if (user.role === 'admin' && viewMode === 'admin_all') {
    // Admin compliance inventory view
    query = `
      SELECT 
        d.id, d.title, d.description, d.category, d.classification,
        d.owner_id, d.file_name, d.mime_type, d.file_size, d.content_hash,
        d.version, d.created_at, d.updated_at,
        u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM permissions p WHERE p.document_id = d.id AND p.is_active = 1) as active_grants_count,
        CASE WHEN d.owner_id = ? THEN 'owner'
             WHEN EXISTS (SELECT 1 FROM permissions p WHERE p.document_id = d.id AND p.user_id = ? AND p.is_active = 1)
             THEN (SELECT permission_level FROM permissions p WHERE p.document_id = d.id AND p.user_id = ? AND p.is_active = 1)
             ELSE 'none' END as user_permission
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE d.is_deleted = 0
    `;
    params.push(user.id, user.id, user.id);
  } else {
    // Normal user view (Owner or Viewer):
    // MUST be owner OR hold active permission grant! Unpermitted docs are 100% invisible!
    query = `
      SELECT 
        d.id, d.title, d.description, d.category, d.classification,
        d.owner_id, d.file_name, d.mime_type, d.file_size, d.content_hash,
        d.version, d.created_at, d.updated_at,
        u.name as owner_name, u.email as owner_email,
        (SELECT COUNT(*) FROM permissions p WHERE p.document_id = d.id AND p.is_active = 1) as active_grants_count,
        CASE WHEN d.owner_id = ? THEN 'owner'
             ELSE (SELECT permission_level FROM permissions p WHERE p.document_id = d.id AND p.user_id = ? AND p.is_active = 1)
        END as user_permission
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      WHERE d.is_deleted = 0
        AND (
          d.owner_id = ? 
          OR EXISTS (
            SELECT 1 FROM permissions p 
            WHERE p.document_id = d.id AND p.user_id = ? AND p.is_active = 1
          )
        )
    `;
    params.push(user.id, user.id, user.id, user.id);
  }

  // Filters
  if (q && q.trim()) {
    query += ' AND (d.title LIKE ? OR d.description LIKE ?)';
    const searchTerm = `%${q.trim()}%`;
    params.push(searchTerm, searchTerm);
  }

  if (category) {
    query += ' AND d.category = ?';
    params.push(category);
  }

  if (ownerId) {
    query += ' AND d.owner_id = ?';
    params.push(ownerId);
  }

  if (dateFrom) {
    query += ' AND d.created_at >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    query += ' AND d.created_at <= ?';
    params.push(dateTo);
  }

  query += ' ORDER BY d.created_at DESC';

  const documents = db.prepare(query).all(...params);
  return res.json({ documents });
});

/**
 * POST /api/documents/upload
 * Upload a new confidential document with magic byte validation and AES-256-GCM encryption.
 */
router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  const user = req.user;

  // Viewers cannot upload new documents; only Document Owners or Admins can
  if (user.role === 'viewer') {
    return res.status(403).json({
      error: 'FORBIDDEN_ROLE',
      message: 'Viewers cannot create new documents. Only Document Owners can upload.'
    });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'FILE_REQUIRED', message: 'No file was uploaded.' });
  }

  const { title, description, category, classification } = req.body;
  if (!title || !category) {
    return res.status(400).json({ error: 'METADATA_REQUIRED', message: 'Title and category are required.' });
  }

  // Strict file validation: magic bytes, extensions, polyglots
  const validation = validateUploadFile({
    buffer: file.buffer,
    originalFilename: file.originalname,
    declaredMimeType: file.mimetype
  });

  if (!validation.isValid) {
    recordAuditEvent({
      actor: user,
      action: AUDIT_ACTIONS.SECURITY_FILE_VALIDATION_FAILED,
      status: 'DENIED',
      details: {
        originalFilename: file.originalname,
        declaredMimeType: file.mimetype,
        fileSize: file.size,
        rejectionReason: validation.reason
      },
      ip_address: req.clientIp,
      user_agent: req.clientUserAgent
    });

    return res.status(400).json({
      error: 'FILE_VALIDATION_FAILED',
      message: validation.reason
    });
  }

  // Encrypt with AES-256-GCM and store in isolated storage
  const stored = storeEncryptedFile(file.buffer);
  const docId = `doc_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO documents (
      id, title, description, category, classification, owner_id,
      file_name, mime_type, file_size, storage_path, content_hash,
      encryption_iv, encryption_tag, version, is_deleted, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, 1, 0, ?, ?
    )
  `).run(
    docId,
    title.trim(),
    description ? description.trim() : null,
    category,
    classification || 'confidential',
    user.id,
    validation.safeFilename,
    validation.detectedMimeType,
    stored.fileSize,
    stored.storagePath,
    stored.contentHash,
    stored.ivHex,
    stored.tagHex,
    now,
    now
  );

  // Log upload event
  recordAuditEvent({
    actor: user,
    action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
    document: { id: docId, title: title.trim() },
    status: 'SUCCESS',
    details: {
      fileName: validation.safeFilename,
      mimeType: validation.detectedMimeType,
      fileSize: stored.fileSize,
      contentHash: stored.contentHash,
      category,
      classification: classification || 'confidential',
      encryptionAlgorithm: 'AES-256-GCM'
    },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.status(201).json({
    success: true,
    document: {
      id: docId,
      title: title.trim(),
      category,
      classification: classification || 'confidential',
      fileName: validation.safeFilename,
      fileSize: stored.fileSize,
      contentHash: stored.contentHash,
      createdAt: now
    }
  });
});

/**
 * GET /api/documents/:id
 * Fetches document metadata (requires READ permission)
 */
router.get('/:id', requireAuth, (req, res) => {
  const docId = req.params.id;
  const breakGlassReason = req.headers['x-trustvault-breakglass'];

  const auth = checkDocumentPermission({
    user: req.user,
    documentId: docId,
    requiredAction: PERMISSION_ACTIONS.READ,
    breakGlassReason,
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  if (!auth.allowed) {
    return res.status(auth.status).json({
      error: 'ACCESS_DENIED',
      message: 'You do not have permission to view this document.'
    });
  }

  const doc = db.prepare(`
    SELECT 
      d.id, d.title, d.description, d.category, d.classification,
      d.owner_id, d.file_name, d.mime_type, d.file_size, d.content_hash,
      d.version, d.created_at, d.updated_at,
      u.name as owner_name, u.email as owner_email,
      (SELECT COUNT(*) FROM permissions p WHERE p.document_id = d.id AND p.is_active = 1) as active_grants_count
    FROM documents d
    JOIN users u ON d.owner_id = u.id
    WHERE d.id = ?
  `).get(docId);

  // Versions history
  const versions = db.prepare(`
    SELECT id, version_number, uploaded_by, file_name, file_size, content_hash, change_summary, created_at
    FROM document_versions
    WHERE document_id = ?
    ORDER BY version_number DESC
  `).all(docId);

  recordAuditEvent({
    actor: req.user,
    action: AUDIT_ACTIONS.DOCUMENT_READ_METADATA,
    document: auth.document,
    status: 'SUCCESS',
    details: { permissionRole: auth.role },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.json({
    document: {
      ...doc,
      userRole: auth.role,
      userPermissionLevel: auth.permissionLevel,
      versions
    }
  });
});

/**
 * POST /api/documents/:id/ticket
 * Issues an ephemeral 60-second single-use download ticket
 */
router.post('/:id/ticket', requireAuth, (req, res) => {
  const docId = req.params.id;
  const breakGlassReason = req.headers['x-trustvault-breakglass'];

  const auth = checkDocumentPermission({
    user: req.user,
    documentId: docId,
    requiredAction: PERMISSION_ACTIONS.DOWNLOAD,
    breakGlassReason,
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  if (!auth.allowed) {
    return res.status(auth.status).json({
      error: 'ACCESS_DENIED',
      message: 'Download permission denied.'
    });
  }

  const { ticket, expiresAt } = createEphemeralTicket({
    userId: req.user.id,
    documentId: docId,
    ipAddress: req.clientIp
  });

  return res.json({
    ticket,
    expiresAt,
    ttlSeconds: Math.round((expiresAt - Date.now()) / 1000)
  });
});

/**
 * GET /api/documents/:id/download
 * Downloads decrypted document stream after real-time authorization check
 */
router.get('/:id/download', async (req, res) => {
  const docId = req.params.id;
  const ticket = req.query.ticket;
  const breakGlassReason = req.headers['x-trustvault-breakglass'];

  let activeUser = null;

  // Case A: Ephemeral Download Ticket
  if (ticket) {
    const ticketCheck = consumeEphemeralTicket({ ticket, documentId: docId });
    if (!ticketCheck.valid) {
      recordAuditEvent({
        actor: null,
        action: AUDIT_ACTIONS.ACCESS_DENIED_UNAUTHORIZED,
        document: { id: docId, title: 'Unknown' },
        status: 'DENIED',
        details: { reason: `Invalid ephemeral ticket: ${ticketCheck.reason}`, ticket },
        ip_address: req.clientIp,
        user_agent: req.clientUserAgent
      });

      return res.status(403).json({
        error: 'INVALID_TICKET',
        message: `Download ticket is invalid or expired: ${ticketCheck.reason}`
      });
    }

    activeUser = db.prepare('SELECT id, email, name, role, department, is_active FROM users WHERE id = ?').get(ticketCheck.userId);
  } else {
    // Case B: Direct Bearer Token
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      activeUser = authenticateToken(token);
    }
  }

  if (!activeUser) {
    return res.status(401).json({
      error: 'UNAUTHENTICATED',
      message: 'Authentication required to download this document.'
    });
  }

  // Real-time permission check (server checks every single time!)
  const auth = checkDocumentPermission({
    user: activeUser,
    documentId: docId,
    requiredAction: PERMISSION_ACTIONS.DOWNLOAD,
    breakGlassReason,
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  if (!auth.allowed) {
    return res.status(auth.status).json({
      error: 'ACCESS_DENIED',
      message: 'Download access denied. You do not hold an active permission grant.'
    });
  }

  const doc = db.prepare(`
    SELECT storage_path, encryption_iv, encryption_tag, content_hash, file_name, mime_type, file_size
    FROM documents 
    WHERE id = ?
  `).get(docId);

  try {
    const decryptedBuffer = retrieveDecryptedFile({
      storagePath: doc.storage_path,
      ivHex: doc.encryption_iv,
      tagHex: doc.encryption_tag,
      expectedHash: doc.content_hash
    });

    // Record verified download in audit trail
    recordAuditEvent({
      actor: activeUser,
      action: AUDIT_ACTIONS.DOCUMENT_DOWNLOAD,
      document: auth.document,
      status: 'SUCCESS',
      details: {
        fileName: doc.file_name,
        fileSize: doc.file_size,
        contentHash: doc.content_hash,
        authMode: ticket ? 'EPHEMERAL_TICKET' : 'BEARER_TOKEN'
      },
      ip_address: req.clientIp,
      user_agent: req.clientUserAgent
    });

    // Strict Security Headers
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', decryptedBuffer.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    return res.send(decryptedBuffer);
  } catch (err) {
    return res.status(500).json({
      error: 'DECRYPTION_FAILED',
      message: 'Decryption or content integrity check failed.'
    });
  }
});

/**
 * PUT /api/documents/:id
 * Updates document metadata (requires EDIT permission)
 */
router.put('/:id', requireAuth, (req, res) => {
  const docId = req.params.id;
  const { title, description, category } = req.body;

  const auth = checkDocumentPermission({
    user: req.user,
    documentId: docId,
    requiredAction: PERMISSION_ACTIONS.EDIT,
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  if (!auth.allowed) {
    return res.status(auth.status).json({
      error: 'ACCESS_DENIED',
      message: 'You do not have permission to edit this document.'
    });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE documents 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        updated_at = ?
    WHERE id = ?
  `).run(title ? title.trim() : null, description !== undefined ? description.trim() : null, category || null, now, docId);

  recordAuditEvent({
    actor: req.user,
    action: AUDIT_ACTIONS.DOCUMENT_METADATA_UPDATE,
    document: auth.document,
    status: 'SUCCESS',
    details: { updatedFields: { title, category } },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.json({ success: true, message: 'Document updated successfully.' });
});

/**
 * POST /api/documents/:id/version
 * Upload a new version of the document (requires EDIT permission)
 */
router.post('/:id/version', requireAuth, upload.single('file'), (req, res) => {
  const docId = req.params.id;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'FILE_REQUIRED' });
  }

  const auth = checkDocumentPermission({
    user: req.user,
    documentId: docId,
    requiredAction: PERMISSION_ACTIONS.EDIT,
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  if (!auth.allowed) {
    return res.status(auth.status).json({
      error: 'ACCESS_DENIED',
      message: 'You do not have permission to upload new versions of this document.'
    });
  }

  const validation = validateUploadFile({
    buffer: file.buffer,
    originalFilename: file.originalname,
    declaredMimeType: file.mimetype
  });

  if (!validation.isValid) {
    return res.status(400).json({ error: 'FILE_VALIDATION_FAILED', message: validation.reason });
  }

  const currentDoc = db.prepare('SELECT version, storage_path, encryption_iv, encryption_tag, content_hash, file_name, mime_type, file_size FROM documents WHERE id = ?').get(docId);
  const nextVersion = currentDoc.version + 1;
  const changeSummary = req.body.changeSummary || `Version ${nextVersion} uploaded`;

  // 1. Archive current version to document_versions
  const versionId = `ver_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO document_versions (
      id, document_id, version_number, uploaded_by, file_name,
      mime_type, file_size, storage_path, content_hash,
      encryption_iv, encryption_tag, change_summary, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    versionId,
    docId,
    currentDoc.version,
    req.user.id,
    currentDoc.file_name,
    currentDoc.mime_type,
    currentDoc.file_size,
    currentDoc.storage_path,
    currentDoc.content_hash,
    currentDoc.encryption_iv,
    currentDoc.encryption_tag,
    changeSummary,
    now
  );

  // 2. Encrypt & store new version
  const stored = storeEncryptedFile(file.buffer);

  // 3. Update main document row
  db.prepare(`
    UPDATE documents 
    SET version = ?, file_name = ?, mime_type = ?, file_size = ?,
        storage_path = ?, content_hash = ?, encryption_iv = ?, encryption_tag = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    nextVersion,
    validation.safeFilename,
    validation.detectedMimeType,
    stored.fileSize,
    stored.storagePath,
    stored.contentHash,
    stored.ivHex,
    stored.tagHex,
    now,
    docId
  );

  recordAuditEvent({
    actor: req.user,
    action: AUDIT_ACTIONS.DOCUMENT_VERSION_UPLOAD,
    document: auth.document,
    status: 'SUCCESS',
    details: {
      newVersion: nextVersion,
      changeSummary,
      contentHash: stored.contentHash,
      fileSize: stored.fileSize
    },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.json({
    success: true,
    version: nextVersion,
    message: `Uploaded version ${nextVersion} successfully.`
  });
});

/**
 * DELETE /api/documents/:id
 * Soft deletes a document (Owner ONLY)
 */
router.delete('/:id', requireAuth, (req, res) => {
  const docId = req.params.id;

  const auth = checkDocumentPermission({
    user: req.user,
    documentId: docId,
    requiredAction: PERMISSION_ACTIONS.DELETE,
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  if (!auth.allowed) {
    return res.status(auth.status).json({
      error: 'ACCESS_DENIED',
      message: 'Only the document owner can delete this document.'
    });
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE documents SET is_deleted = 1, updated_at = ? WHERE id = ?').run(now, docId);

  // Invalidate any active grants
  db.prepare('UPDATE permissions SET is_active = 0, revoked_at = ?, revoked_by = ? WHERE document_id = ? AND is_active = 1').run(now, req.user.id, docId);

  recordAuditEvent({
    actor: req.user,
    action: AUDIT_ACTIONS.DOCUMENT_DELETE,
    document: auth.document,
    status: 'SUCCESS',
    details: { message: 'Document soft-deleted and all access grants revoked.' },
    ip_address: req.clientIp,
    user_agent: req.clientUserAgent
  });

  return res.json({ success: true, message: 'Document deleted successfully.' });
});

export default router;
