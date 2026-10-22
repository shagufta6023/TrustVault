import { db as defaultDb } from '../db/database.js';
import { recordAuditEvent, AUDIT_ACTIONS } from './audit.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * AI Access Advisor Engine
 * 
 * Enforces the core rule:
 * "The machine must never widen access on its own. A person confirms,
 * and both the suggestion and the decision go into the audit."
 */
export function generateAccessSuggestion({ documentId, requestingUser, customDb = null }) {
  const database = customDb || defaultDb;

  const doc = database
    .prepare('SELECT id, title, description, category, classification, owner_id FROM documents WHERE id = ?')
    .get(documentId);

  if (!doc) {
    throw new Error('Document not found');
  }

  // Fetch candidate users excluding the owner
  const candidateUsers = database
    .prepare('SELECT id, email, name, role, department FROM users WHERE id != ? AND is_active = 1')
    .all(doc.owner_id);

  // Fetch currently active grants
  const activeGrants = new Set(
    database
      .prepare('SELECT user_id FROM permissions WHERE document_id = ? AND is_active = 1')
      .all(documentId)
      .map(g => g.user_id)
  );

  const recommendations = [];
  let policyGuidance = '';
  let riskLevel = 'LOW';

  const docTitle = doc.title.toLowerCase();
  const docDesc = (doc.description || '').toLowerCase();

  // Policy rules based on classification and category
  if (doc.category === 'human_resources' || docTitle.includes('salary') || docTitle.includes('compensation')) {
    riskLevel = 'CRITICAL';
    policyGuidance = 'STRICT LEAST PRIVILEGE: Personnel compensation records must only be shared with the individual named employee and designated HR review officer. Never grant edit access.';

    for (const u of candidateUsers) {
      if (activeGrants.has(u.id)) continue;

      if (u.department === 'Legal' || u.department === 'Executive') {
        recommendations.push({
          userId: u.id,
          userEmail: u.email,
          userName: u.name,
          userDepartment: u.department,
          recommendedLevel: 'read',
          confidence: 0.88,
          rationale: `Authorized executive oversight for ${doc.category}. Read-only access recommended to protect payroll privacy.`,
          riskAssessment: 'LOW_RISK'
        });
      } else if (u.role === 'viewer' && u.department === 'Finance') {
        recommendations.push({
          userId: u.id,
          userEmail: u.email,
          userName: u.name,
          userDepartment: u.department,
          recommendedLevel: 'read',
          confidence: 0.75,
          rationale: 'Payroll accounting reconciliation. Read-only access.',
          riskAssessment: 'MEDIUM_RISK'
        });
      }
    }
  } else if (doc.category === 'audit_compliance' || docTitle.includes('audit')) {
    riskLevel = 'HIGH';
    policyGuidance = 'STATUTORY AUDIT RETENTION: External auditors require verifiable read-only evidence access. Modification rights must remain strictly disabled.';

    for (const u of candidateUsers) {
      if (activeGrants.has(u.id)) continue;

      if (u.email.includes('audit') || u.department === 'Compliance' || u.role === 'viewer') {
        recommendations.push({
          userId: u.id,
          userEmail: u.email,
          userName: u.name,
          userDepartment: u.department,
          recommendedLevel: 'read',
          confidence: 0.95,
          rationale: 'Designated external compliance reviewer. Granting read-only verification rights.',
          riskAssessment: 'LOW_RISK'
        });
      }
    }
  } else if (doc.category === 'legal' || doc.category === 'contracts') {
    riskLevel = 'HIGH';
    policyGuidance = 'CONTRACTUAL CONFIDENTIALITY: Legal counsel requires bilateral access; external parties must receive read-only copy unless executing negotiated revisions.';

    for (const u of candidateUsers) {
      if (activeGrants.has(u.id)) continue;

      if (u.department === 'Legal') {
        recommendations.push({
          userId: u.id,
          userEmail: u.email,
          userName: u.name,
          userDepartment: u.department,
          recommendedLevel: 'edit',
          confidence: 0.92,
          rationale: 'Corporate Legal Counsel requires collaborative edit rights for contract clauses.',
          riskAssessment: 'LOW_RISK'
        });
      } else if (u.role === 'viewer') {
        recommendations.push({
          userId: u.id,
          userEmail: u.email,
          userName: u.name,
          userDepartment: u.department,
          recommendedLevel: 'read',
          confidence: 0.80,
          rationale: 'External counterparty / review attendee. Read-only distribution.',
          riskAssessment: 'LOW_RISK'
        });
      }
    }
  } else {
    policyGuidance = 'STANDARD GOVERNANCE: Grant access only to explicit collaborators.';
    for (const u of candidateUsers) {
      if (activeGrants.has(u.id)) continue;
      if (u.department === doc.category) {
        recommendations.push({
          userId: u.id,
          userEmail: u.email,
          userName: u.name,
          userDepartment: u.department,
          recommendedLevel: 'read',
          confidence: 0.70,
          rationale: `Department colleague in ${u.department}.`,
          riskAssessment: 'LOW_RISK'
        });
      }
    }
  }

  const suggestionId = `ai_sug_${uuidv4().replace(/-/g, '')}`;

  // Log AI recommendation request to tamper-evident audit trail
  recordAuditEvent({
    actor: requestingUser,
    action: AUDIT_ACTIONS.AI_ACCESS_SUGGESTION_REQUESTED,
    document: doc,
    status: 'SUCCESS',
    details: {
      suggestionId,
      recommendationCount: recommendations.length,
      riskLevel,
      policyGuidance,
      mandatoryNotice: 'Machine recommendation cannot apply access. Human confirmation required.'
    },
    customDb: database
  });

  return {
    suggestionId,
    documentId,
    documentTitle: doc.title,
    classification: doc.classification,
    riskLevel,
    policyGuidance,
    warning: 'Human Review Mandatory: AI suggestions never grant access autonomously. Review each recipient before confirming.',
    recommendations
  };
}
