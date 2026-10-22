import { describe, it, expect } from 'vitest';
import {
  encryptBuffer,
  decryptBuffer,
  calculateSha256,
  computeAuditRecordHash,
  signAuditHash,
  verifyAuditChain,
  GENESIS_HASH
} from '../src/services/crypto.js';

describe('Cryptographic Core Service', () => {
  it('encrypts and decrypts buffer using AES-256-GCM authenticated encryption', () => {
    const originalText = 'Highly confidential salary breakdown: $250,000 base';
    const originalBuffer = Buffer.from(originalText, 'utf8');

    const encrypted = encryptBuffer(originalBuffer);
    expect(encrypted.ciphertext).toBeInstanceOf(Buffer);
    expect(encrypted.ivHex).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.tagHex).toHaveLength(32); // 16 bytes = 32 hex chars
    expect(encrypted.contentHash).toBe(calculateSha256(originalBuffer));

    // Ensure ciphertext does NOT contain plaintext
    expect(encrypted.ciphertext.toString('utf8')).not.toContain('confidential');

    // Decrypt
    const decrypted = decryptBuffer(encrypted.ciphertext, encrypted.ivHex, encrypted.tagHex);
    expect(decrypted.toString('utf8')).toBe(originalText);
  });

  it('detects tampering on disk when ciphertext or tag is modified', () => {
    const originalBuffer = Buffer.from('Audit report payload', 'utf8');
    const encrypted = encryptBuffer(originalBuffer);

    // Tamper with ciphertext by flipping a bit
    const tamperedCiphertext = Buffer.from(encrypted.ciphertext);
    tamperedCiphertext[0] ^= 0x01;

    expect(() => {
      decryptBuffer(tamperedCiphertext, encrypted.ivHex, encrypted.tagHex);
    }).toThrow(); // AES-GCM must throw an authentication failure error
  });

  it('builds and verifies a valid cryptographic audit hash chain', () => {
    const records = [];
    const hmacSecret = 'test_secret_key_123';

    // Block 1 (Genesis)
    const rec1 = {
      id: 'log-1',
      sequence_num: 1,
      previous_hash: GENESIS_HASH,
      timestamp: '2026-10-22T10:00:00.000Z',
      actor_id: 'user-admin',
      actor_email: 'admin@trustvault.internal',
      action: 'SYSTEM_GENESIS',
      document_id: 'NONE',
      status: 'SUCCESS',
      details: { message: 'Vault initialized' },
      ip_address: '127.0.0.1'
    };
    rec1.record_hash = computeAuditRecordHash(rec1);
    rec1.hmac_signature = signAuditHash(rec1.record_hash, hmacSecret);
    records.push(rec1);

    // Block 2
    const rec2 = {
      id: 'log-2',
      sequence_num: 2,
      previous_hash: rec1.record_hash,
      timestamp: '2026-10-22T10:05:00.000Z',
      actor_id: 'user-owner',
      actor_email: 'marcus@trustvault.internal',
      action: 'DOCUMENT_UPLOAD',
      document_id: 'doc-101',
      status: 'SUCCESS',
      details: { title: 'Q3 Financials.pdf', size: 1048576 },
      ip_address: '192.168.1.50'
    };
    rec2.record_hash = computeAuditRecordHash(rec2);
    rec2.hmac_signature = signAuditHash(rec2.record_hash, hmacSecret);
    records.push(rec2);

    // Block 3 (Access Denied Event)
    const rec3 = {
      id: 'log-3',
      sequence_num: 3,
      previous_hash: rec2.record_hash,
      timestamp: '2026-10-22T10:10:00.000Z',
      actor_id: 'user-viewer',
      actor_email: 'attacker@outside.com',
      action: 'ACCESS_DENIED',
      document_id: 'doc-101',
      status: 'DENIED',
      details: { reason: 'UNAUTHORIZED_ACCESS_ATTEMPT' },
      ip_address: '45.33.32.156'
    };
    rec3.record_hash = computeAuditRecordHash(rec3);
    rec3.hmac_signature = signAuditHash(rec3.record_hash, hmacSecret);
    records.push(rec3);

    // Verification must pass
    const verification = verifyAuditChain(records, hmacSecret);
    expect(verification.isValid).toBe(true);
    expect(verification.totalVerified).toBe(3);
    expect(verification.tipHash).toBe(rec3.record_hash);
  });

  it('detects tampering when an attacker edits an audit log record in database', () => {
    const hmacSecret = 'test_secret_key_123';
    const rec1 = {
      id: 'log-1',
      sequence_num: 1,
      previous_hash: GENESIS_HASH,
      timestamp: '2026-10-22T10:00:00.000Z',
      actor_id: 'user-admin',
      actor_email: 'admin@trustvault.internal',
      action: 'SYSTEM_GENESIS',
      document_id: 'NONE',
      status: 'SUCCESS',
      details: { message: 'Vault initialized' },
      ip_address: '127.0.0.1'
    };
    rec1.record_hash = computeAuditRecordHash(rec1);
    rec1.hmac_signature = signAuditHash(rec1.record_hash, hmacSecret);

    const rec2 = {
      id: 'log-2',
      sequence_num: 2,
      previous_hash: rec1.record_hash,
      timestamp: '2026-10-22T10:05:00.000Z',
      actor_id: 'user-owner',
      actor_email: 'marcus@trustvault.internal',
      action: 'DOCUMENT_UPLOAD',
      document_id: 'doc-101',
      status: 'SUCCESS',
      details: { title: 'Q3 Financials.pdf' },
      ip_address: '192.168.1.50'
    };
    rec2.record_hash = computeAuditRecordHash(rec2);
    rec2.hmac_signature = signAuditHash(rec2.record_hash, hmacSecret);

    const records = [rec1, rec2];

    // Attacker alters rec1 action or actor in database without updating hashes
    const tamperedRecords = JSON.parse(JSON.stringify(records));
    tamperedRecords[0].actor_email = 'someone_else@evil.com';

    const verification = verifyAuditChain(tamperedRecords, hmacSecret);
    expect(verification.isValid).toBe(false);
    expect(verification.failedIndex).toBe(0);
    expect(verification.reason).toContain('tampering detected');
  });

  it('detects tampering when an attacker attempts to delete an audit log row', () => {
    const hmacSecret = 'test_secret_key_123';
    // Three records
    const r1 = { sequence_num: 1, previous_hash: GENESIS_HASH, timestamp: 'T1', actor_id: 'u1', action: 'A', status: 'SUCCESS', details: {}, ip_address: '1.1.1.1' };
    r1.record_hash = computeAuditRecordHash(r1);
    r1.hmac_signature = signAuditHash(r1.record_hash, hmacSecret);

    const r2 = { sequence_num: 2, previous_hash: r1.record_hash, timestamp: 'T2', actor_id: 'u2', action: 'B', status: 'SUCCESS', details: {}, ip_address: '1.1.1.1' };
    r2.record_hash = computeAuditRecordHash(r2);
    r2.hmac_signature = signAuditHash(r2.record_hash, hmacSecret);

    const r3 = { sequence_num: 3, previous_hash: r2.record_hash, timestamp: 'T3', actor_id: 'u3', action: 'C', status: 'SUCCESS', details: {}, ip_address: '1.1.1.1' };
    r3.record_hash = computeAuditRecordHash(r3);
    r3.hmac_signature = signAuditHash(r3.record_hash, hmacSecret);

    // Attacker deletes r2 to hide the event! Now r3 follows r1.
    const deletedMiddleRecords = [r1, r3];
    const verification = verifyAuditChain(deletedMiddleRecords, hmacSecret);
    expect(verification.isValid).toBe(false);
    expect(verification.reason).toContain('Chain broken');
  });
});
