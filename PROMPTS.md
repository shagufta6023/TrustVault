# TrustVault AI Usage & Critical Oversight Record (PROMPTS.md)

This log records interactions with AI tools during the development of TrustVault. It documents instances where AI generated flawed, insecure, or naive patterns, the specific analysis used to catch the flaws, and the verified security remediations implemented.

---

## Log Entry 1: Stateless JWT-Based Permission Caching vs. Instant Revocation
- **Date**: 2026-10-18
- **Domain**: Authorization & Access Control (Requirement Standard Three)
- **Prompt**:
  > *"Write an authentication and authorization middleware for our document vault. To minimize database overhead, cache the user's role and list of permitted document IDs inside the JWT payload so each document route can check permissions without querying SQLite on every request."*
- **What the AI Produced**:
  ```javascript
  // AI-generated naive permission check
  const token = jwt.sign({ sub: user.id, allowedDocs: ['doc_1', 'doc_2'] }, SECRET, { expiresIn: '8h' });
  
  function checkPermission(req, res, next) {
    if (req.user.allowedDocs.includes(req.params.id)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  }
  ```
- **What Was Wrong With It (Specific Security Flaw)**:
  This violates the core non-negotiable requirement: *"Taking access away works immediately. Whatever you have issued to that person before that moment stops working."*
  Because the JWT is stateless and valid for 8 hours, if an owner revokes a user's access at 10:05 AM, the user can continue reading and downloading confidential documents until 6:00 PM using their existing JWT.
- **What We Did Instead**:
  1. Never bake document permissions into JWT claims.
  2. Implement real-time database checks on **every single request**:
     ```sql
     SELECT permission_level FROM permissions 
     WHERE document_id = ? AND user_id = ? AND is_active = 1
     ```
  3. Added server-side session revocation: bumping `token_version` in the database immediately invalidates existing JWT sessions.
  4. Added `ephemeral_download_tickets` table: revoking access deletes any pending download tickets immediately.
- **Reference**: `server/src/services/permission.js`, `server/tests/authorization.test.js: Suite 2`.

---

## Log Entry 2: Audit Hash Chain Key-Ordering Drift & Verification Fragility
- **Date**: 2026-10-19
- **Domain**: Audit Trail Integrity & Cryptographic Non-Repudiation (Requirement Standard Two)
- **Prompt**:
  > *"Create an audit logger that links each log entry to the previous entry's SHA-256 hash. Hash the entire JSON record to guarantee that no record can be tampered with."*
- **What the AI Produced**:
  ```javascript
  function hashRecord(record) {
    const jsonString = JSON.stringify(record);
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }
  ```
- **What Was Wrong With It (Specific Security Flaw)**:
  In JavaScript (V8 engine), `JSON.stringify` does not guarantee deterministic key serialization ordering across runtime environments, database reloads, or round-trip parsing. If an audit record with keys `{ action: 'A', details: { b: 1, a: 2 } }` is serialized, deserialized from SQLite, and re-serialized, key order differences produce a different SHA-256 hash.
  This caused false-positive verification failures on unaltered logs and would allow a malicious actor to claim the chain was "flawed by design" rather than tampered.
- **What We Did Instead**:
  1. Implemented a deterministic `canonicalizeJson(obj)` that recursively sorts all object keys alphabetically.
  2. Defined an immutable, pipe-delimited canonical payload string for every block:
     `${sequence_num}|${previous_hash}|${timestamp}|${actor_id}|${actor_email}|${action}|${document_id}|${status}|${canonicalDetails}|${ip_address}`
  3. Added HMAC-SHA256 signing (`signAuditHash`) using a secret key so attackers cannot tamper with the DB and re-hash the chain.
- **Reference**: `server/src/services/crypto.js` (`canonicalizeJson`, `computeAuditRecordHash`), `server/tests/crypto.test.js`.

---

## Log Entry 3: Naive File Extension Checking vs. Magic Byte Executable Spoofing
- **Date**: 2026-10-20
- **Domain**: Upload Validation & Malicious Content Prevention
- **Prompt**:
  > *"Write a validation function for document uploads. Validate that the uploaded file is a PDF, DOCX, or text file and check its extension before saving."*
- **What the AI Produced**:
  ```javascript
  function validateFile(file) {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      throw new Error('Invalid file extension');
    }
    return true;
  }
  ```
- **What Was Wrong With It (Specific Security Flaw)**:
  Checking only the client-supplied filename extension is a classic web security vulnerability. An attacker can rename an executable payload (`trojan.exe` or `shell.elf`) to `invoice.pdf`. If another user downloads it, the file could execute or bypass internal perimeter filters. Furthermore, it did not check for double extensions (`contract.pdf.exe`) or directory traversal filenames (`../../evil.pdf`).
- **What We Did Instead**:
  1. Implemented file magic byte sniffing in `fileValidator.js`:
     - Inspects first 4-8 bytes (`%PDF-`, `PK\x03\x04`, `\x89PNG`, `\xFF\xD8\xFF`).
     - Actively rejects Windows PE executables (`MZ` / `0x4D 0x5A`) and Linux ELF binaries (`0x7F 0x45 0x4C 0x46`).
     - Actively scans text files for malicious script indicators (`<script`, `<?php`, `eval(`).
  2. Implemented `sanitizeFilename` to strip path traversal (`../`, `..\`) and null bytes.
  3. Added double extension detection that checks all dotted suffixes.
- **Reference**: `server/src/services/fileValidator.js`, `server/tests/authorization.test.js: Suite 8`.

---

## Log Entry 4: Global Search Metadata Leakage Across Permission Boundaries
- **Date**: 2026-10-21
- **Domain**: Search Isolation & Confidential Metadata Privacy
- **Prompt**:
  > *"Implement a search query in Express and SQLite for documents so users can search by keywords across document titles and descriptions."*
- **What the AI Produced**:
  ```javascript
  router.get('/search', requireAuth, (req, res) => {
    const q = req.query.q;
    const docs = db.prepare('SELECT * FROM documents WHERE title LIKE ? OR description LIKE ?')
      .all(`%${q}%`, `%${q}%`);
    res.json({ docs });
  });
  ```
- **What Was Wrong With It (Specific Security Flaw)**:
  This leaked confidential metadata globally across all company tenants! A contractor or external auditor searching for "Salary", "Acquisition", or "Layoffs" would immediately see the titles and descriptions of confidential files owned by the Finance VP and Legal Counsel, even if they were not permitted to download the file.
- **What We Did Instead**:
  1. Rewrote the search endpoint to enforce mandatory scoping:
     ```sql
     WHERE d.is_deleted = 0
       AND (
         d.owner_id = ? 
         OR EXISTS (
           SELECT 1 FROM permissions p 
           WHERE p.document_id = d.id AND p.user_id = ? AND p.is_active = 1
         )
       )
     ```
  2. Unpermitted documents return 0 results and remain 100% invisible.
- **Reference**: `server/src/routes/documents.js`, `server/tests/authorization.test.js: Suite 4`.

---

## Log Entry 5: Inline Browser Rendering & Stored XSS via Download Streams
- **Date**: 2026-10-21
- **Domain**: Document Download Security & Cross-Site Scripting (XSS)
- **Prompt**:
  > *"Write the Express route to stream the decrypted document to the user with the appropriate Content-Type header so they can preview it in the browser."*
- **What the AI Produced**:
  ```javascript
  router.get('/:id/download', requireAuth, (req, res) => {
    const doc = getDoc(req.params.id);
    const decrypted = decrypt(doc);
    res.setHeader('Content-Type', doc.mime_type);
    res.send(decrypted);
  });
  ```
- **What Was Wrong With It (Specific Security Flaw)**:
  Allowing browser inline rendering with client-controlled MIME types enables Stored XSS. If an attacker uploads an SVG or HTML file with embedded `<script>` tags, the browser executes the script within TrustVault's origin, stealing JWT session tokens or performing unauthorized actions on behalf of the victim.
- **What We Did Instead**:
  1. Enforced strict download headers:
     ```javascript
     res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.file_name)}"`);
     res.setHeader('X-Content-Type-Options', 'nosniff');
     res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
     res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
     ```
  2. Forces browser file download rather than DOM execution, and disables all script execution via CSP sandbox.
- **Reference**: `server/src/routes/documents.js` (`GET /:id/download`).

---

## Reused Prompts, Instructions & Context Templates

Across the engineering process, the following core system instruction was supplied to guide all AI generation:

```markdown
### TRUSTVAULT SECURITY PRINCIPLES:
1. Server Authoritative: Client checks are cosmetic. The database and API must verify user ID, active permissions, and role on EVERY transaction.
2. Zero Leaks in Negative Cases: Unpermitted documents must not leak titles, existences, or hashes in search results.
3. Tamper-Evident Ledger: Every event and denied attempt must link to the previous record's SHA-256 hash and carry an HMAC signature.
4. Instant Revocation: Ephemeral tickets and active session tokens must fail immediately when permission is revoked.
```
