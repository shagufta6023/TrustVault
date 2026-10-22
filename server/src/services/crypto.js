import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const MASTER_KEY_HEX = process.env.VAULT_MASTER_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || 'audit_hmac_tamper_evident_secret_key_8492048201847192';
export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function getMasterKeyBuffer() {
  return Buffer.from(MASTER_KEY_HEX, 'hex');
}

/**
 * Deterministically canonicalize JSON object to avoid key ordering discrepancies
 */
export function canonicalizeJson(obj) {
  if (obj === null || obj === undefined) return '{}';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalizeJson(item)).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalizeJson(obj[k])).join(',') + '}';
}

/**
 * Computes SHA-256 hash of buffer or string
 */
export function calculateSha256(data) {
  const hash = crypto.createHash('sha256');
  hash.update(typeof data === 'string' ? Buffer.from(data, 'utf8') : data);
  return hash.digest('hex');
}

/**
 * Encrypts a plaintext buffer with AES-256-GCM
 * Generates fresh 12-byte IV for every encryption call.
 */
export function encryptBuffer(buffer, keyBuffer = getMasterKeyBuffer()) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const contentHash = calculateSha256(buffer);

  return {
    ciphertext,
    ivHex: iv.toString('hex'),
    tagHex: authTag.toString('hex'),
    contentHash,
  };
}

/**
 * Decrypts AES-256-GCM ciphertext buffer.
 * Throws error if ciphertext, IV, or Auth Tag was altered (authenticated encryption).
 */
export function decryptBuffer(ciphertextBuffer, ivHex, tagHex, keyBuffer = getMasterKeyBuffer()) {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertextBuffer), decipher.final()]);
  return plaintext;
}

/**
 * Computes SHA-256 hash for an audit log record
 */
export function computeAuditRecordHash(record) {
  const detailsStr = typeof record.details === 'string'
    ? record.details
    : canonicalizeJson(record.details);

  const payload = [
    record.sequence_num,
    record.previous_hash,
    record.timestamp,
    record.actor_id || 'SYSTEM',
    record.actor_email || 'SYSTEM',
    record.action,
    record.document_id || 'NONE',
    record.status || 'SUCCESS',
    detailsStr,
    record.ip_address || '0.0.0.0'
  ].join('|');

  return calculateSha256(payload);
}

/**
 * Signs the audit record hash with an HMAC secret key
 */
export function signAuditHash(recordHash, hmacSecret = AUDIT_HMAC_SECRET) {
  return crypto
    .createHmac('sha256', hmacSecret)
    .update(recordHash)
    .digest('hex');
}

/**
 * Verifies the integrity of the audit log hash chain.
 * Checks:
 * 1. Genesis block previous_hash matches GENESIS_HASH
 * 2. Hash chaining: record[i].previous_hash === record[i-1].record_hash
 * 3. Record integrity: record[i].record_hash matches recomputed hash from payload
 * 4. HMAC signature validity: record[i].hmac_signature matches HMAC(record_hash)
 */
export function verifyAuditChain(records, hmacSecret = AUDIT_HMAC_SECRET) {
  if (!records || records.length === 0) {
    return {
      isValid: true,
      totalVerified: 0,
      tipHash: GENESIS_HASH,
      details: 'Audit trail is empty (Genesis state)'
    };
  }

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Check 1: Chain continuity
    if (i === 0) {
      if (record.previous_hash !== GENESIS_HASH) {
        return {
          isValid: false,
          failedIndex: i,
          sequenceNum: record.sequence_num,
          recordId: record.id,
          reason: `Genesis record previous_hash must match 0000...0000. Found: ${record.previous_hash}`,
        };
      }
    } else {
      const prevRecord = records[i - 1];
      if (record.previous_hash !== prevRecord.record_hash) {
        return {
          isValid: false,
          failedIndex: i,
          sequenceNum: record.sequence_num,
          recordId: record.id,
          reason: `Chain broken at sequence ${record.sequence_num}. previous_hash does not match previous record_hash.`,
          expectedPrevHash: prevRecord.record_hash,
          actualPrevHash: record.previous_hash
        };
      }
    }

    // Check 2: Content integrity
    const recomputedHash = computeAuditRecordHash(record);
    if (record.record_hash !== recomputedHash) {
      return {
        isValid: false,
        failedIndex: i,
        sequenceNum: record.sequence_num,
        recordId: record.id,
        reason: `Record content tampering detected at sequence ${record.sequence_num}! Expected hash: ${recomputedHash}, Recorded: ${record.record_hash}`,
        recomputedHash,
        recordedHash: record.record_hash
      };
    }

    // Check 3: HMAC Signature validity
    const expectedSignature = signAuditHash(record.record_hash, hmacSecret);
    if (record.hmac_signature !== expectedSignature) {
      return {
        isValid: false,
        failedIndex: i,
        sequenceNum: record.sequence_num,
        recordId: record.id,
        reason: `Cryptographic signature forgery detected at sequence ${record.sequence_num}! HMAC signature is invalid.`,
      };
    }
  }

  return {
    isValid: true,
    totalVerified: records.length,
    tipHash: records[records.length - 1].record_hash,
    genesisHash: GENESIS_HASH,
    details: `All ${records.length} records verified successfully. Cryptographic hash chain and HMAC signatures intact.`
  };
}
