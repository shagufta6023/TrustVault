import path from 'node:path';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'image/png',
  'image/jpeg',
  'text/plain',
  'text/csv',
  'application/json'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.xlsx', '.png', '.jpg', '.jpeg', '.txt', '.csv', '.json'
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.mjs', '.php',
  '.phtml', '.asp', '.aspx', '.jsp', '.cgi', '.dll', '.so', '.scr', '.jar'
]);

/**
 * Inspects buffer magic bytes (file signatures) to verify genuine file type
 */
export function detectMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // PDF: %PDF-
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return { mime: 'application/pdf', ext: '.pdf' };
  }

  // PNG: \x89PNG\r\n\x1a\n
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }

  // JPEG: \xFF\xD8\xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // ZIP / DOCX / XLSX: PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return { mime: 'application/zip', ext: '.zip', isZipContainer: true };
  }

  // Check for dangerous binary executables
  // Windows PE/DOS: MZ (0x4D 0x5A)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { mime: 'application/x-dosexec', ext: '.exe', dangerous: true };
  }

  // Linux ELF: \x7F ELF (0x7F 0x45 0x4C 0x46)
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { mime: 'application/x-elf', ext: '.bin', dangerous: true };
  }

  // Check for UTF-8 text / CSV / JSON (no null bytes in text files)
  let isText = true;
  const sampleLength = Math.min(buffer.length, 1024);
  for (let i = 0; i < sampleLength; i++) {
    const byte = buffer[i];
    if (byte === 0x00) {
      isText = false;
      break;
    }
  }

  if (isText) {
    const textSample = buffer.slice(0, sampleLength).toString('utf8');
    // Check for script injection headers
    if (/<script/i.test(textSample) || /<\?php/i.test(textSample) || /eval\s*\(/i.test(textSample)) {
      return { mime: 'text/html', ext: '.html', dangerous: true };
    }
    return { mime: 'text/plain', ext: '.txt' };
  }

  return null;
}

/**
 * Sanitizes incoming filename against path traversal and malicious characters
 */
export function sanitizeFilename(rawFilename) {
  if (!rawFilename || typeof rawFilename !== 'string') {
    return `document_${Date.now()}.bin`;
  }

  // Extract base filename, removing any directory traversal paths
  const base = path.basename(rawFilename);

  // Strip path traversal sequences, null bytes, and non-printable characters
  const cleaned = base
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[/\\]/g, '')
    .replace(/^\.+/, '') // remove leading dots
    .trim();

  return cleaned || `document_${Date.now()}.bin`;
}

/**
 * Comprehensive document upload validation
 */
export function validateUploadFile({ buffer, originalFilename, declaredMimeType, maxSizeBytes = 26214400 }) {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, reason: 'File buffer is empty (0 bytes).' };
  }

  if (buffer.length > maxSizeBytes) {
    return {
      isValid: false,
      reason: `File size exceeds allowed maximum of ${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB.`
    };
  }

  const safeFilename = sanitizeFilename(originalFilename);
  const ext = path.extname(safeFilename).toLowerCase();

  // 1. Reject dangerous extensions immediately
  if (DANGEROUS_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      reason: `Dangerous file extension '${ext}' is strictly prohibited.`
    };
  }

  // 2. Double extension check (e.g., file.pdf.exe)
  const dotCount = (safeFilename.match(/\./g) || []).length;
  if (dotCount > 1) {
    const parts = safeFilename.split('.');
    for (let i = 1; i < parts.length; i++) {
      if (DANGEROUS_EXTENSIONS.has(`.${parts[i].toLowerCase()}`)) {
        return {
          isValid: false,
          reason: 'Double extension attack detected: embedded executable extension.'
        };
      }
    }
  }

  // 3. Inspect magic bytes
  const magic = detectMagicBytes(buffer);

  if (!magic) {
    return {
      isValid: false,
      reason: 'Unknown or unreadable binary file format. File rejected.'
    };
  }

  if (magic.dangerous) {
    return {
      isValid: false,
      reason: `Malicious or prohibited file signature detected (${magic.mime}).`
    };
  }

  // 4. Validate extension vs magic bytes
  if (magic.mime === 'application/pdf' && ext !== '.pdf') {
    return {
      isValid: false,
      reason: `File signature mismatch: File is a PDF but extension is '${ext}'.`
    };
  }

  if (magic.mime === 'application/zip') {
    // DOCX / XLSX are zip-packaged OOXML
    if (ext !== '.docx' && ext !== '.xlsx' && ext !== '.zip') {
      return {
        isValid: false,
        reason: `Mismatched zip container format for extension '${ext}'.`
      };
    }
  }

  return {
    isValid: true,
    safeFilename,
    detectedMimeType: magic.mime,
    fileSize: buffer.length
  };
}
