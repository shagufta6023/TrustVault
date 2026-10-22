import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './database.js';
import { storeEncryptedFile } from '../services/fileStorage.js';
import { recordAuditEvent, AUDIT_ACTIONS } from '../services/audit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function seedDatabase(customDb = null) {
  const database = customDb || db;
  console.log('[Seed] Initializing TrustVault database...');

  // Clear existing tables in correct order
  database.exec(`
    DELETE FROM ephemeral_download_tickets;
    DELETE FROM permissions;
    DELETE FROM document_versions;
    DELETE FROM documents;
    DELETE FROM audit_logs;
    DELETE FROM users;
  `);

  const passwordHash = await bcrypt.hash('TrustVault2026!', 10);
  const now = new Date().toISOString();

  // 1. Seed Users (5 Standard Members)
  const users = [
    {
      id: 'usr_admin_elena',
      email: 'admin@trustvault.internal',
      hash: passwordHash,
      name: 'Elena Vance',
      role: 'admin',
      department: 'Security & Compliance'
    },
    {
      id: 'usr_owner_marcus',
      email: 'marcus.cole@trustvault.internal',
      hash: passwordHash,
      name: 'Marcus Cole',
      role: 'owner',
      department: 'Finance'
    },
    {
      id: 'usr_owner_sarah',
      email: 'sarah.jenkins@trustvault.internal',
      hash: passwordHash,
      name: 'Sarah Jenkins',
      role: 'owner',
      department: 'Legal'
    },
    {
      id: 'usr_viewer_david',
      email: 'david.kim@external-audit.com',
      hash: passwordHash,
      name: 'David Kim',
      role: 'viewer',
      department: 'External Audit'
    },
    {
      id: 'usr_viewer_chloe',
      email: 'chloe.bennett@contractor.io',
      hash: passwordHash,
      name: 'Chloe Bennett',
      role: 'viewer',
      department: 'Engineering Contractor'
    }
  ];

  const insertUser = database.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, department, is_active, token_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)
  `);

  for (const u of users) {
    insertUser.run(u.id, u.email, u.hash || passwordHash, u.name, u.role, u.department, now);
  }

  // 2. Seed Genesis Audit Log
  const adminUser = users[0];
  recordAuditEvent({
    actor: adminUser,
    action: 'SYSTEM_GENESIS',
    status: 'SUCCESS',
    details: {
      message: 'TrustVault cryptographic system initialized. Genesis block sealed.',
      systemVersion: '1.0.0',
      activeUsers: users.length
    },
    ip_address: '127.0.0.1',
    customDb: database
  });

  // 3. Create Sample Documents & Physical Encrypted Files
  const sampleDocuments = [
    {
      id: 'doc_salary_2026',
      title: 'Executive & Engineering Compensation Matrix 2026',
      description: 'Strictly confidential salary bands, equity grants, and executive retention bonuses.',
      category: 'human_resources',
      classification: 'strictly_restricted',
      owner_id: 'usr_owner_marcus',
      fileName: 'compensation_matrix_2026.pdf',
      mimeType: 'application/pdf',
      textContent: `%PDF-1.4
% TrustVault Encrypted Document
1 0 obj << /Title (Compensation Matrix 2026) /Author (Marcus Cole) >> endobj
2 0 obj << /Length 72 >> stream
STRICTLY RESTRICTED: Executive and Staff Salary Bands for FY2026.
Marcus Cole: $280,000 base + 35% bonus
Sarah Jenkins: $275,000 base + 30% bonus
endstream endobj
xref
trailer << /Root 1 0 R >>
%%EOF`
    },
    {
      id: 'doc_mna_apex_2026',
      title: 'Project Apex — M&A Confidential Purchase',
      description: 'Definitive acquisition term sheet and bilateral non-disclosure agreement.',
      category: 'legal',
      classification: 'strictly_restricted',
      owner_id: 'usr_owner_sarah',
      fileName: 'project_apex_purchase_agreement.pdf',
      mimeType: 'application/pdf',
      textContent: `%PDF-1.4
% Project Apex Term Sheet
1 0 obj << /Title (Project Apex Term Sheet) /Author (Sarah Jenkins) >> endobj
2 0 obj << /Length 80 >> stream
CONFIDENTIAL: Acquisition of Target Corp for $42,500,000 in cash and stock.
Mutual covenants and indemnification obligations detailed herein.
endstream endobj
trailer << /Root 1 0 R >>
%%EOF`
    },
    {
      id: 'doc_q3_financial',
      title: 'Q3 Financial Performance Report',
      description: 'Revenue, expenses, and profit margin analysis for Q3 2026.',
      category: 'financial',
      classification: 'confidential',
      owner_id: 'usr_owner_marcus',
      fileName: 'q3_financial_performance_report.pdf',
      mimeType: 'application/pdf',
      textContent: `%PDF-1.4
% Q3 Financial Performance Report
1 0 obj << /Title (Q3 Financial Report) /Author (Marcus Cole) >> endobj
2 0 obj << /Length 75 >> stream
CONFIDENTIAL: Q3 Financial Performance Report - Revenue $18.4M (+24% YoY).
Gross margin 78.5%, Net income $4.2M.
endstream endobj
xref
trailer << /Root 1 0 R >>
%%EOF`
    },
    {
      id: 'doc_employee_records',
      title: 'Employee Records & Payroll',
      description: 'Employee details, salary structure and benefits information.',
      category: 'human_resources',
      classification: 'internal',
      owner_id: 'usr_owner_marcus',
      fileName: 'employee_records_payroll_2026.pdf',
      mimeType: 'application/pdf',
      textContent: `%PDF-1.4
% Employee Records & Payroll
1 0 obj << /Title (Employee Records) /Author (Marcus Cole) >> endobj
2 0 obj << /Length 65 >> stream
INTERNAL USE ONLY: Employee Directory & Payroll Disbursals.
Total headcount: 142. Next pay cycle: Nov 1, 2026.
endstream endobj
xref
trailer << /Root 1 0 R >>
%%EOF`
    },
    {
      id: 'doc_audit_soc2_q3',
      title: 'Q3 Statutory Compliance & SOC-2 Audit Evidence Log',
      description: 'External auditor working papers, access control review, and key rotation records.',
      category: 'audit_compliance',
      classification: 'confidential',
      owner_id: 'usr_owner_marcus',
      fileName: 'q3_soc2_audit_working_papers.csv',
      mimeType: 'text/csv',
      textContent: `Control_ID,Control_Name,Status,Assessor,Timestamp
AC-01,Least Privilege Verification,COMPLIANT,David Kim,2026-09-30T10:00:00Z
AC-02,Real-time Revocation Validation,COMPLIANT,David Kim,2026-09-30T11:30:00Z
AU-01,Tamper-Evident Hash Chain Audit,COMPLIANT,David Kim,2026-09-30T14:15:00Z`
    },
    {
      id: 'doc_contractor_sow_q4',
      title: 'Frontend Infrastructure & UI Statement of Work — Q4',
      description: 'Scope of deliverables, acceptance criteria, and milestones for contracted engineers.',
      category: 'engineering',
      classification: 'internal',
      owner_id: 'usr_owner_sarah',
      fileName: 'frontend_infra_sow_q4.txt',
      mimeType: 'text/plain',
      textContent: `STATEMENT OF WORK — FRONTEND INFRASTRUCTURE
Contractor: Chloe Bennett
Deliverables:
1. Responsive Cryptographic Vault UI
2. Real-time Audit Chain Integrity Inspector
3. Role-based persona switcher for compliance demonstration`
    }
  ];

  const insertDoc = database.prepare(`
    INSERT INTO documents (
      id, title, description, category, classification, owner_id,
      file_name, mime_type, file_size, storage_path, content_hash,
      encryption_iv, encryption_tag, version, is_deleted, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, 1, 0, ?, ?
    )
  `);

  for (const doc of sampleDocuments) {
    const rawBuffer = Buffer.from(doc.textContent, 'utf8');
    const stored = storeEncryptedFile(rawBuffer);

    insertDoc.run(
      doc.id,
      doc.title,
      doc.description,
      doc.category,
      doc.classification,
      doc.owner_id,
      doc.fileName,
      doc.mimeType,
      stored.fileSize,
      stored.storagePath,
      stored.contentHash,
      stored.ivHex,
      stored.tagHex,
      now,
      now
    );

    const ownerUser = users.find(u => u.id === doc.owner_id);
    recordAuditEvent({
      actor: ownerUser,
      action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
      document: { id: doc.id, title: doc.title },
      status: 'SUCCESS',
      details: {
        fileName: doc.fileName,
        fileSize: stored.fileSize,
        category: doc.category,
        classification: doc.classification,
        contentHash: stored.contentHash,
        encryptionAlgorithm: 'AES-256-GCM'
      },
      ip_address: '127.0.0.1',
      customDb: database
    });
  }

  // 4. Seed Initial Permissions
  const permissions = [
    // Sarah has 'read' on Marcus's Salary Matrix
    {
      id: 'perm_seed_01',
      documentId: 'doc_salary_2026',
      userId: 'usr_owner_sarah',
      level: 'read',
      grantedBy: 'usr_owner_marcus',
      aiSuggested: false,
      rationale: 'Legal oversight of executive contracts.'
    },
    // Marcus has 'edit' on Sarah's M&A Agreement
    {
      id: 'perm_seed_02',
      documentId: 'doc_mna_apex_2026',
      userId: 'usr_owner_marcus',
      level: 'edit',
      grantedBy: 'usr_owner_sarah',
      aiSuggested: false,
      rationale: 'Co-lead on M&A valuation and deal structuring.'
    },
    // David Kim (Auditor) has 'read' on M&A Agreement
    {
      id: 'perm_seed_03',
      documentId: 'doc_mna_apex_2026',
      userId: 'usr_viewer_david',
      level: 'read',
      grantedBy: 'usr_owner_sarah',
      aiSuggested: true,
      rationale: 'External audit diligence verification.'
    },
    // David Kim has 'read' on SOC2 Working Papers
    {
      id: 'perm_seed_04',
      documentId: 'doc_audit_soc2_q3',
      userId: 'usr_viewer_david',
      level: 'read',
      grantedBy: 'usr_owner_marcus',
      aiSuggested: true,
      rationale: 'Independent auditor working paper access.'
    },
    // Chloe Bennett (Contractor) has 'read' on Statement of Work
    {
      id: 'perm_seed_05',
      documentId: 'doc_contractor_sow_q4',
      userId: 'usr_viewer_chloe',
      level: 'read',
      grantedBy: 'usr_owner_sarah',
      aiSuggested: false,
      rationale: 'Contractor SOW review and milestone tracking.'
    }
  ];

  const insertPerm = database.prepare(`
    INSERT INTO permissions (
      id, document_id, user_id, permission_level,
      granted_by, granted_at, is_active, ai_suggested, ai_rationale
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  for (const p of permissions) {
    insertPerm.run(p.id, p.documentId, p.userId, p.level, p.grantedBy, now, p.aiSuggested ? 1 : 0, p.rationale);

    const grantor = users.find(u => u.id === p.grantedBy);
    const target = users.find(u => u.id === p.userId);
    const doc = sampleDocuments.find(d => d.id === p.documentId);

    recordAuditEvent({
      actor: grantor,
      action: AUDIT_ACTIONS.PERMISSION_GRANT,
      document: { id: doc.id, title: doc.title },
      status: 'SUCCESS',
      details: {
        targetUserId: target.id,
        targetEmail: target.email,
        permissionLevel: p.level,
        aiSuggested: p.aiSuggested,
        rationale: p.rationale
      },
      ip_address: '127.0.0.1',
      customDb: database
    });
  }

  console.log(`[Seed] Seeded ${users.length} users, ${sampleDocuments.length} documents, ${permissions.length} permissions.`);
  console.log('[Seed] Tamper-evident audit chain initialized and sealed.');
}

// Allow direct CLI execution: node server/src/db/seed.js
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}
