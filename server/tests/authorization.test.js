import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/index.js';
import { db } from '../src/db/database.js';
import { seedDatabase } from '../src/db/seed.js';
import { issueUserToken } from '../src/services/auth.js';
import { verifyAuditIntegrity, simulateTamper } from '../src/services/audit.js';

describe('TrustVault Security & Authorization Test Suite', () => {
  let adminToken, marcusOwnerToken, sarahOwnerToken, davidViewerToken, chloeViewerToken;
  let adminUser, marcusUser, sarahUser, davidUser, chloeUser;

  beforeAll(async () => {
    await seedDatabase();

    adminUser = db.prepare("SELECT * FROM users WHERE email = 'admin@trustvault.internal'").get();
    marcusUser = db.prepare("SELECT * FROM users WHERE email = 'marcus.cole@trustvault.internal'").get();
    sarahUser = db.prepare("SELECT * FROM users WHERE email = 'sarah.jenkins@trustvault.internal'").get();
    davidUser = db.prepare("SELECT * FROM users WHERE email = 'david.kim@external-audit.com'").get();
    chloeUser = db.prepare("SELECT * FROM users WHERE email = 'chloe.bennett@contractor.io'").get();

    adminToken = issueUserToken(adminUser);
    marcusOwnerToken = issueUserToken(marcusUser);
    sarahOwnerToken = issueUserToken(sarahUser);
    davidViewerToken = issueUserToken(davidUser);
    chloeViewerToken = issueUserToken(chloeUser);
  });

  beforeEach(async () => {
    // Re-seed before each test to guarantee fresh, isolated state
    await seedDatabase();
  });

  describe('1. Document Isolation & Negative Authorization', () => {
    it('PREVENTS unauthorized viewer from reading owner confidential document', async () => {
      // David Kim (Viewer) tries to view Marcus Cole's Salary Matrix (no grant exists)
      const res = await request(app)
        .get('/api/documents/doc_salary_2026')
        .set('Authorization', `Bearer ${davidViewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ACCESS_DENIED');

      // Verify that access denial was recorded in the tamper-evident audit trail!
      const denialLog = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE document_id = 'doc_salary_2026' 
          AND actor_id = ? 
          AND status = 'DENIED'
        ORDER BY sequence_num DESC LIMIT 1
      `).get(davidUser.id);

      expect(denialLog).toBeDefined();
      expect(denialLog.action).toBe('ACCESS_DENIED_UNAUTHORIZED');
    });

    it('PREVENTS unauthorized viewer from downloading file stream', async () => {
      const res = await request(app)
        .get('/api/documents/doc_salary_2026/download')
        .set('Authorization', `Bearer ${chloeViewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ACCESS_DENIED');
    });

    it('ALLOWS document owner to read and download their own document', async () => {
      const resMeta = await request(app)
        .get('/api/documents/doc_salary_2026')
        .set('Authorization', `Bearer ${marcusOwnerToken}`);

      expect(resMeta.status).toBe(200);
      expect(resMeta.body.document.title).toBe('Executive & Engineering Compensation Matrix 2026');

      const resDownload = await request(app)
        .get('/api/documents/doc_salary_2026/download')
        .set('Authorization', `Bearer ${marcusOwnerToken}`);

      expect(resDownload.status).toBe(200);
      expect(resDownload.headers['content-type']).toBe('application/pdf');
      const downloadedText = resDownload.text || resDownload.body.toString('utf8');
      expect(downloadedText).toContain('STRICTLY RESTRICTED: Executive and Staff Salary Bands');
    });
  });

  describe('2. Real-Time Immediate Revocation', () => {
    it('ENFORCES instantaneous revocation: access stops immediately with zero lingering validity', async () => {
      // Step A: Marcus grants David Kim 'read' access to doc_salary_2026
      const grantRes = await request(app)
        .post('/api/permissions/doc_salary_2026/grant')
        .set('Authorization', `Bearer ${marcusOwnerToken}`)
        .send({
          targetUserId: davidUser.id,
          permissionLevel: 'read',
          aiRationale: 'Temporary audit check'
        });

      expect(grantRes.status).toBe(201);
      expect(grantRes.body.success).toBe(true);

      // Step B: David can now view metadata
      const accessRes = await request(app)
        .get('/api/documents/doc_salary_2026')
        .set('Authorization', `Bearer ${davidViewerToken}`);

      expect(accessRes.status).toBe(200);

      // Step C: David requests an ephemeral download ticket
      const ticketRes = await request(app)
        .post('/api/documents/doc_salary_2026/ticket')
        .set('Authorization', `Bearer ${davidViewerToken}`);

      expect(ticketRes.status).toBe(200);
      const ticket = ticketRes.body.ticket;
      expect(ticket).toBeDefined();

      // Step D: Marcus REVOKES David's access immediately!
      const revokeRes = await request(app)
        .post('/api/permissions/doc_salary_2026/revoke')
        .set('Authorization', `Bearer ${marcusOwnerToken}`)
        .send({ targetUserId: davidUser.id });

      expect(revokeRes.status).toBe(200);
      expect(revokeRes.body.success).toBe(true);

      // Step E: Immediate subsequent call with David's Bearer token MUST FAIL!
      const immediateBearerAttempt = await request(app)
        .get('/api/documents/doc_salary_2026')
        .set('Authorization', `Bearer ${davidViewerToken}`);

      expect(immediateBearerAttempt.status).toBe(403);
      expect(immediateBearerAttempt.body.error).toBe('ACCESS_DENIED');

      // Step F: Immediate attempt to use previously issued ephemeral ticket MUST FAIL!
      const immediateTicketAttempt = await request(app)
        .get(`/api/documents/doc_salary_2026/download?ticket=${ticket}`);

      expect(immediateTicketAttempt.status).toBe(403);

      // Step G: Check audit log records revocation followed by ACCESS_DENIED_REVOKED
      const auditRevokeDenied = db.prepare(`
        SELECT action, status, details FROM audit_logs 
        WHERE document_id = 'doc_salary_2026' 
          AND actor_id = ? 
        ORDER BY sequence_num DESC LIMIT 1
      `).get(davidUser.id);

      expect(auditRevokeDenied).toBeDefined();
      expect(auditRevokeDenied.action).toBe('ACCESS_DENIED_REVOKED');
      expect(auditRevokeDenied.status).toBe('DENIED');
    });
  });

  describe('3. Granular Permission Enforcement (Read vs Edit vs Delete vs Grant)', () => {
    it('PREVENTS user with read-only grant from editing document metadata', async () => {
      // Sarah has 'read' grant on doc_salary_2026
      const editRes = await request(app)
        .put('/api/documents/doc_salary_2026')
        .set('Authorization', `Bearer ${sarahOwnerToken}`)
        .send({ title: 'Tampered Title by Sarah' });

      expect(editRes.status).toBe(403);
      expect(editRes.body.error).toBe('ACCESS_DENIED');
    });

    it('PREVENTS user with read-only grant from uploading new document version', async () => {
      const versionRes = await request(app)
        .post('/api/documents/doc_salary_2026/version')
        .set('Authorization', `Bearer ${sarahOwnerToken}`)
        .attach('file', Buffer.from('%PDF-1.4\nfake update\n%%EOF'), 'update.pdf');

      expect(versionRes.status).toBe(403);
    });

    it('PREVENTS non-owner from deleting a document even if they have edit rights', async () => {
      // Marcus has 'edit' grant on Sarah's doc_mna_apex_2026
      const deleteRes = await request(app)
        .delete('/api/documents/doc_mna_apex_2026')
        .set('Authorization', `Bearer ${marcusOwnerToken}`);

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.message).toContain('Only the document owner');
    });

    it('PREVENTS non-owner from granting permissions to other users', async () => {
      // Marcus tries to grant Chloe access to Sarah's doc_mna_apex_2026
      const grantRes = await request(app)
        .post('/api/permissions/doc_mna_apex_2026/grant')
        .set('Authorization', `Bearer ${marcusOwnerToken}`)
        .send({ targetUserId: chloeUser.id, permissionLevel: 'read' });

      expect(grantRes.status).toBe(403);
    });

    it('ALLOWS user with edit grant to update document metadata', async () => {
      // Marcus has 'edit' grant on Sarah's doc_mna_apex_2026
      const editRes = await request(app)
        .put('/api/documents/doc_mna_apex_2026')
        .set('Authorization', `Bearer ${marcusOwnerToken}`)
        .send({ description: 'Updated deal notes by Finance VP' });

      expect(editRes.status).toBe(200);
      expect(editRes.body.success).toBe(true);
    });
  });

  describe('4. Search Isolation & Zero Metadata Leakage', () => {
    it('ENSURES unpermitted documents are 100% invisible in search results', async () => {
      // David Kim searches for "Compensation" or "Salary"
      const res = await request(app)
        .get('/api/documents?q=Compensation')
        .set('Authorization', `Bearer ${davidViewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toHaveLength(0); // MUST NOT return Marcus's salary doc!

      // Searching for term present in shared document
      const resShared = await request(app)
        .get('/api/documents?q=SOC-2')
        .set('Authorization', `Bearer ${davidViewerToken}`);

      expect(resShared.status).toBe(200);
      expect(resShared.body.documents).toHaveLength(1);
      expect(resShared.body.documents[0].id).toBe('doc_audit_soc2_q3');
    });
  });

  describe('5. Insecure Direct Object References (IDOR)', () => {
    it('REJECTS IDOR enumeration across arbitrary document IDs', async () => {
      const forgedIds = ['doc_salary_2026', 'doc_9999', '../../../etc/passwd', 'admin_doc'];

      for (const id of forgedIds) {
        const res = await request(app)
          .get(`/api/documents/${id}`)
          .set('Authorization', `Bearer ${chloeViewerToken}`);

        expect([403, 404]).toContain(res.status);
      }
    });
  });

  describe('6. Admin Separation of Duties & Audited Break-Glass', () => {
    it('BLOCKS Admin from silent read of restricted document without grant', async () => {
      // Admin Elena Vance tries to view salary doc without break-glass
      const res = await request(app)
        .get('/api/documents/doc_salary_2026')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('PERMITS Admin break-glass override ONLY with explicit justification and records SEV-1 audit alert', async () => {
      const breakGlassJustification = 'Regulatory Subpoena SEC-2026-8491 Investigation';

      const res = await request(app)
        .get('/api/documents/doc_salary_2026')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-TrustVault-BreakGlass', breakGlassJustification);

      expect(res.status).toBe(200);

      // Verify that SEV-1 Break Glass event was committed to cryptographic audit trail
      const auditEntry = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE action = 'ADMIN_BREAK_GLASS_OVERRIDE' 
          AND actor_id = ?
        ORDER BY sequence_num DESC LIMIT 1
      `).get(adminUser.id);

      expect(auditEntry).toBeDefined();
      expect(auditEntry.status).toBe('ANOMALY');
      expect(auditEntry.details).toContain(breakGlassJustification);
    });
  });

  describe('7. Tamper-Evident Audit Trail Integrity & Verification', () => {
    it('VERIFIES entire cryptographic hash chain on unaltered audit trail', async () => {
      const res = await request(app)
        .get('/api/audit/verify')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.report.isValid).toBe(true);
      expect(res.body.report.totalVerified).toBeGreaterThan(0);
      expect(res.body.report.tipHash).toHaveLength(64);
    });

    it('DETECTS tampering when a database row is covertly modified', async () => {
      // Pick an audit record and modify its details in SQLite
      const targetRecord = db.prepare('SELECT id, actor_email FROM audit_logs WHERE sequence_num = 2').get();
      expect(targetRecord).toBeDefined();

      simulateTamper({
        logId: targetRecord.id,
        field: 'actor_email',
        newValue: 'covert_hacker@blackhat.org'
      });

      // Verification MUST catch this immediately!
      const report = verifyAuditIntegrity();
      expect(report.isValid).toBe(false);
      expect(report.sequenceNum).toBe(2);
      expect(report.reason).toContain('tampering detected');
    });

    it('DETECTS tampering when a database row is covertly deleted', async () => {
      const targetRecord = db.prepare('SELECT id FROM audit_logs WHERE sequence_num = 3').get();
      simulateTamper({
        logId: targetRecord.id,
        deleteRecord: true
      });

      const report = verifyAuditIntegrity();
      expect(report.isValid).toBe(false);
      expect(report.reason).toContain('Chain broken');
    });
  });

  describe('8. File Upload & Polyglot Validation', () => {
    it('REJECTS disguised executable binary disguised with .pdf extension', async () => {
      // DOS / Windows PE Header: MZ (0x4D 0x5A)
      const fakePdfBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${marcusOwnerToken}`)
        .field('title', 'Trojan Invoice')
        .field('category', 'financial')
        .attach('file', fakePdfBuffer, 'trojan.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('FILE_VALIDATION_FAILED');
      expect(res.body.message).toContain('Malicious or prohibited file signature');

      // Check security violation log in audit trail
      const auditLog = db.prepare(`
        SELECT * FROM audit_logs 
        WHERE action = 'SECURITY_FILE_VALIDATION_FAILED' 
        ORDER BY sequence_num DESC LIMIT 1
      `).get();

      expect(auditLog).toBeDefined();
      expect(auditLog.status).toBe('DENIED');
    });

    it('REJECTS files with dangerous executable extensions', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${marcusOwnerToken}`)
        .field('title', 'Shell Script')
        .field('category', 'engineering')
        .attach('file', Buffer.from('#!/bin/bash\necho pwned'), 'exploit.sh');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Dangerous file extension');
    });
  });
});
