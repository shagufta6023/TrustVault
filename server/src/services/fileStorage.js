import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { encryptBuffer, decryptBuffer, calculateSha256 } from './crypto.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storageDir = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(__dirname, '../../storage/encrypted');

// Ensure encrypted storage directory exists
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

/**
 * Encrypts and writes a file buffer to the isolated storage vault.
 * Plaintext NEVER hits the disk unencrypted.
 */
export function storeEncryptedFile(buffer) {
  const { ciphertext, ivHex, tagHex, contentHash } = encryptBuffer(buffer);
  
  // Storage filename is a decoupled UUID with no leak of original name
  const storageFilename = `vault_${uuidv4().replace(/-/g, '')}.enc`;
  const fullPath = path.join(storageDir, storageFilename);

  fs.writeFileSync(fullPath, ciphertext);

  return {
    storagePath: storageFilename,
    contentHash,
    ivHex,
    tagHex,
    fileSize: buffer.length
  };
}

/**
 * Reads and decrypts an encrypted file from the vault.
 * Verifies authenticated tag and SHA-256 hash.
 */
export function retrieveDecryptedFile({ storagePath, ivHex, tagHex, expectedHash }) {
  // Prevent any path traversal in storagePath
  const safeFilename = path.basename(storagePath);
  const fullPath = path.join(storageDir, safeFilename);

  if (!fs.existsSync(fullPath)) {
    throw new Error('Encrypted file not found in storage vault.');
  }

  const ciphertext = fs.readFileSync(fullPath);
  const plaintext = decryptBuffer(ciphertext, ivHex, tagHex);

  if (expectedHash) {
    const actualHash = calculateSha256(plaintext);
    if (actualHash !== expectedHash) {
      throw new Error(`Data integrity violation! Expected hash ${expectedHash}, computed ${actualHash}`);
    }
  }

  return plaintext;
}

/**
 * Deletes encrypted file from disk upon permanent purge
 */
export function deleteStoredFile(storagePath) {
  const safeFilename = path.basename(storagePath);
  const fullPath = path.join(storageDir, safeFilename);

  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
    return true;
  }
  return false;
}
