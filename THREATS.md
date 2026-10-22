# TrustVault Security Threat Model & Defense Architecture (THREATS.md)

TrustVault is built on three non-negotiable principles:
1. **A document is reachable only by someone who was explicitly granted access** — enforced authoritatively by the server on every request.
2. **Every access event and denied attempt is cryptographically provable and tamper-evident** — protected by an immutable hash chain and HMAC signatures.
3. **Revocation is instantaneous** — taking access away invalidates all active sessions, tokens, and ephemeral download tickets in real time.

This document details 26 attack vectors evaluated during system design, the controls implemented to defeat them, their verification in automated tests, and the engineering trade-offs knowingly accepted.

---

## Threat Matrix Overview

| ID | Threat Category | Attack Vector | Mitigation Status | Automated Test Coverage |
|---|---|---|---|---|
| **T-01** | BOLA / IDOR | Direct Document ID Enumeration | CLOSED | `authorization.test.js: Suite 5` |
| **T-02** | Storage Bypass | Direct File System Access via Static Web Route | CLOSED | `authorization.test.js: Suite 1` |
| **T-03** | Data Lifecycle | Accessing Soft-Deleted / Purged Documents | CLOSED | `authorization.test.js: Suite 3` |
| **T-04** | Separation of Duties | Administrator Silently Reading Restricted Files | CLOSED | `authorization.test.js: Suite 6` |
| **T-05** | Token Lifecycle | Replaying Stateless JWT Post-Revocation | CLOSED | `authorization.test.js: Suite 2` |
| **T-06** | Ephemeral Replay | Replaying Stolen Download Ticket | CLOSED | `authorization.test.js: Suite 2` |
| **T-07** | Race Conditions | TOCTOU Revocation Race During Stream Download | CLOSED | `authorization.test.js: Suite 2` |
| **T-08** | Dangling Grants | Retaining Access After User Deactivation | CLOSED | `authorization.test.js: Suite 2` |
| **T-09** | Audit Integrity | Silent Row Modification in Database | CLOSED | `crypto.test.js: Test 4`, `authorization.test.js: Suite 7` |
| **T-10** | Audit Integrity | Silent Row Deletion to Erase Footprints | CLOSED | `crypto.test.js: Test 5`, `authorization.test.js: Suite 7` |
| **T-11** | Audit Integrity | Log Injection / CRLF / Malformed JSON Payloads | CLOSED | `crypto.test.js: canonicalizeJson` |
| **T-12** | Non-Repudiation | Recomputing Entire Hash Chain After Tampering | CLOSED | `crypto.test.js: signAuditHash` |
| **T-13** | Denial of Service | Audit Table Exhaustion via Request Flooding | MITIGATED | Rate Limiter Middleware |
| **T-14** | Side-Channel Leak | Document Metadata Leakage via Global Search | CLOSED | `authorization.test.js: Suite 4` |
| **T-15** | Info Disclosure | Stack Trace / Schema Leakage in Error Responses | CLOSED | Global Sanitized Error Handler |
| **T-16** | Timing Attack | Timing Discrepancies in Permissions / Passwords | CLOSED | Bcrypt constant-time compare |
| **T-17** | Caching | Browser History / Proxy Caching Plaintext | CLOSED | `Cache-Control: no-store` headers |
| **T-18** | File Validation | Disguised Executable with Spoofed Extension | CLOSED | `authorization.test.js: Suite 8` |
| **T-19** | File Validation | Double Extension Attack (`contract.pdf.exe`) | CLOSED | `fileValidator.test.js`, `authorization.test.js` |
| **T-20** | Stored XSS | Polyglot SVG/HTML Script Execution in Browser | CLOSED | CSP Sandbox + nosniff + attachment |
| **T-21** | Denial of Service | Zip Bomb / Decompression Memory Exhaustion | CLOSED | Strict 25MB buffer ceiling |
| **T-22** | Path Traversal | Arbitrary File Overwrite via `../../evil.pdf` | CLOSED | `sanitizeFilename` + UUID Decoupling |
| **T-23** | Storage Security | Unencrypted Plaintext Files Stored on Server Disk | CLOSED | `crypto.test.js: Test 1` (AES-256-GCM) |
| **T-24** | Storage Integrity | Silent Disk Bit-Rot or Ciphertext Modification | CLOSED | `crypto.test.js: Test 2` (GCM Auth Tag) |
| **T-25** | Privilege Escalation| Viewer Attempting Edit, Delete, or Grant | CLOSED | `authorization.test.js: Suite 3` |
| **T-26** | AI Risk | Prompt Injection Widening Access Autonomously | CLOSED | Strict Human-in-the-Loop Architecture |

---

## Deep Dive: Threat Vectors & Defenses

### 1. Direct Object References & Authorization Bypasses (BOLA / IDOR)

#### Threat T-01: Sequential Document ID Guessing (IDOR)
- **Vector**: Attacker logs in as a low-privileged viewer and iterates over document IDs (`/api/documents/doc_1`, `/api/documents/doc_2`, etc.) or guesses known identifiers.
- **Impact**: Unauthorized access to confidential agreements, executive compensation, or regulatory audits.
- **TrustVault Defense**:
  - The server executes `checkDocumentPermission` on **every single request**.
  - Document IDs are cryptographically generated UUIDs (`doc_b2f901a...`).
  - The SQL query enforces ownership and active permissions:
    ```sql
    SELECT 1 FROM permissions WHERE document_id = ? AND user_id = ? AND is_active = 1
    ```
  - Any unauthorized request is immediately aborted with HTTP 403, and an `ACCESS_DENIED_UNAUTHORIZED` entry is permanently written to the cryptographic audit trail recording the actor's identity, IP address, and timestamp.
- **Test**: `server/tests/authorization.test.js` -> Suite 5.

#### Threat T-02: Direct File Storage Traversal (Bypassing API Layer)
- **Vector**: Attacker discovers physical storage paths or attempts to access files directly through a web server static handler (e.g. `GET /storage/encrypted/file.pdf`).
- **Impact**: Bypasses the application's permission engine entirely.
- **TrustVault Defense**:
  - Physical file storage is located strictly **outside the web-accessible root**.
  - No static route serves the storage folder.
  - Physical files are saved under randomized UUID names (`vault_8df9a2c...enc`) with **no extension** and encrypted with AES-256-GCM. Even if an attacker reads the raw file system, they obtain only high-entropy ciphertext.
- **Test**: `server/tests/authorization.test.js` -> Suite 1.

#### Threat T-03: Soft-Deleted Document Exfiltration
- **Vector**: Attacker requests a document that was deleted by its owner using its previous ID.
- **Impact**: Reading documents that were legally or operationally revoked.
- **TrustVault Defense**:
  - `checkDocumentPermission` checks `if (doc.is_deleted)` before checking user permissions.
  - When an owner deletes a document, all active permissions are set to `is_active = 0`.
- **Test**: `server/tests/authorization.test.js` -> Suite 3.

#### Threat T-04: Separation of Duties & Administrative Snooping
- **Vector**: A malicious or curious system administrator queries executive salaries or private legal disclosures.
- **Impact**: Violation of regulatory separation of duties and employee privacy.
- **TrustVault Defense**:
  - In TrustVault, Administrators **do not have god-mode read access** to confidential documents.
  - An Administrator attempting `GET /api/documents/:id` without an explicit grant receives HTTP 403.
  - In an emergency (e.g. court subpoena), the Admin can invoke a "Break-Glass" override by supplying the `X-TrustVault-BreakGlass: <justification>` header. This immediately logs a **SEV-1 ANOMALY audit event** (`ADMIN_BREAK_GLASS_OVERRIDE`) in the tamper-evident hash chain, making silent snooping impossible.
- **Test**: `server/tests/authorization.test.js` -> Suite 6.

---

### 2. Session, Revocation & Token Lifecycle

#### Threat T-05: Lingering Session / Stateless JWT Replay Post-Revocation
- **Vector**: Attacker uses a valid JWT issued before access was revoked or before an employee was terminated.
- **Impact**: In pure stateless JWT architectures, tokens remain valid until expiration (hours or days), creating a dangerous window of exposure.
- **TrustVault Defense**:
  - Document access permissions are **never baked into JWT claims**.
  - Every authorization check validates active permissions synchronously in the SQLite database (`is_active = 1`).
  - Users have a `token_version` in the database. Deactivating a user or calling session invalidation immediately increments `token_version`, instantly invalidating all existing JWTs.
- **Test**: `server/tests/authorization.test.js` -> Suite 2.

#### Threat T-06: Ephemeral Download Ticket Sniffing & Replay
- **Vector**: A download link or presigned ticket is intercepted from browser history, shoulder surfing, or proxy logs and reused.
- **Impact**: Unauthorized subsequent download.
- **TrustVault Defense**:
  - Download tickets (`tkt_...`) are single-use and expire within 60 seconds.
  - Upon download, `consumeEphemeralTicket` atomically sets `used_at = datetime()`. Any reuse attempt immediately fails.
  - When an owner revokes a user's access, the database transaction deletes all pending ephemeral tickets for that `(document_id, user_id)` pair.
- **Test**: `server/tests/authorization.test.js` -> Suite 2.

#### Threat T-07: Time-of-Check to Time-of-Use (TOCTOU) Race Conditions
- **Vector**: An attacker starts a slow file download stream at the exact millisecond the owner clicks "Revoke Access".
- **Impact**: Incomplete revocation enforcement.
- **TrustVault Defense**:
  - Authorization is verified at the moment the file decryption begins.
  - Revocation is atomic inside a SQLite transaction:
    ```sql
    UPDATE permissions SET is_active = 0, revoked_at = ? WHERE document_id = ? AND user_id = ? AND is_active = 1;
    DELETE FROM ephemeral_download_tickets WHERE document_id = ? AND user_id = ?;
    ```
- **Test**: `server/tests/authorization.test.js` -> Suite 2.

---

### 3. Audit Trail Integrity & Non-Repudiation

#### Threat T-09 & T-10: Silent Database Row Modification or Deletion
- **Vector**: A rogue database administrator or attacker with SQL access alters an audit record (e.g. changing `actor_email` or deleting a record of an unauthorized download).
- **Impact**: The audit trail can no longer serve as legal or compliance evidence.
- **TrustVault Defense**:
  - **Cryptographic Hash Chain**: Each audit record contains:
    $$\text{record\_hash} = \text{SHA-256}(\text{sequence\_num} \parallel \text{previous\_hash} \parallel \text{timestamp} \parallel \text{actor} \parallel \text{action} \parallel \text{doc} \parallel \text{details} \parallel \text{ip})$$
  - The Genesis block has `previous_hash = 0000...0000`.
  - Modifying *any field* invalidates that row's `record_hash` and breaks the `previous_hash` link of the subsequent record.
  - Deleting a row breaks the chain link between the preceding and succeeding blocks.
  - The `verifyAuditIntegrity()` engine recalculates the entire chain from Genesis to tip and points to the exact tampered sequence number.
- **Test**: `server/tests/crypto.test.js` -> Tests 4 & 5; `server/tests/authorization.test.js` -> Suite 7.

#### Threat T-12: Full Chain Re-computation / Forgery
- **Vector**: An attacker with direct database access alters a record and recomputes all subsequent SHA-256 hashes to fix the chain.
- **Impact**: Evading simple hash chain verification.
- **TrustVault Defense**:
  - Every block is signed with an HMAC secret (`AUDIT_HMAC_SECRET`) stored outside the database:
    $$\text{hmac\_signature} = \text{HMAC-SHA256}(\text{record\_hash}, \text{AUDIT\_HMAC\_SECRET})$$
  - Without the server's private HMAC key, an attacker cannot forge valid signatures.
- **Test**: `server/tests/crypto.test.js` -> Test 3.

---

### 4. Information Disclosure & Side Channels

#### Threat T-14: Metadata Leakage via Global Search Queries
- **Vector**: A viewer searches for keywords like "Acquisition", "Layoffs", or "Salary". Even if file download is blocked, returning the document title or snippet reveals confidential business intelligence.
- **Impact**: Critical information leak.
- **TrustVault Defense**:
  - The search query joins the `permissions` table with `WHERE p.is_active = 1 AND p.user_id = ?`.
  - Documents where the user has no grant are **100% excluded from SQL results**.
  - Searching for a secret word returns 0 results for unauthorized viewers.
- **Test**: `server/tests/authorization.test.js` -> Suite 4.

#### Threat T-15: Stack Trace / Error Message Leaks
- **Vector**: Triggering errors to discover table schemas, internal paths, or database versions.
- **Impact**: Assists vulnerability scanning.
- **TrustVault Defense**:
  - Global error handler intercepts all unhandled errors and returns standardized JSON `{ error: 'INTERNAL_ERROR', message: 'An internal error occurred.' }`.
  - Detailed errors are logged only to secure server stdout/syslog.
- **Test**: Express global error handler.

---

### 5. Malicious Content & Upload Exploitation

#### Threat T-18 & T-19: Disguised Executables & Double Extension Spoofing
- **Vector**: An attacker renames `payload.exe` to `invoice.pdf` or `contract.pdf.exe`.
- **Impact**: Execution of malware when another user downloads and opens the file.
- **TrustVault Defense**:
  - TrustVault does not rely on client-supplied `Content-Type` headers.
  - `fileValidator.js` inspects **file magic bytes**:
    - Rejects Windows PE executables (`MZ` / `0x4D 0x5A`).
    - Rejects Linux ELF binaries (`0x7F 0x45 0x4C 0x46`).
    - Rejects files containing `<script>` or `<?php` tags.
    - Validates PDF header `%PDF-` and image signatures.
  - Rejects any file containing executable extensions anywhere in its name (`.exe`, `.bat`, `.sh`, `.php`, etc.).
- **Test**: `server/tests/authorization.test.js` -> Suite 8.

#### Threat T-20: Stored XSS via Polyglot Uploads
- **Vector**: Uploading a file containing HTML/SVG scripts that execute in the victim's browser upon download.
- **Impact**: Session hijacking / CSRF.
- **TrustVault Defense**:
  - Strict response headers on download:
    - `Content-Disposition: attachment; filename="..."` (forces download rather than in-browser execution)
    - `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
    - `Content-Security-Policy: default-src 'none'; sandbox` (disables all script execution)
- **Test**: `server/src/routes/documents.js` download headers.

---

### 6. Integrity & Confidentiality at Rest

#### Threat T-23 & T-24: Disk Snooping & Bit-Rot / Covert Ciphertext Modification
- **Vector**: Attacker gains access to physical disk / backup or covertly modifies ciphertext bytes.
- **Impact**: Confidentiality loss or undetected corruption.
- **TrustVault Defense**:
  - All files are encrypted using **AES-256-GCM** before writing to disk.
  - GCM is an **authenticated encryption** mode: the 16-byte authentication tag detects any single-bit modification of the ciphertext or IV.
  - A SHA-256 checksum of the plaintext is recorded and verified upon decryption.
- **Test**: `server/tests/crypto.test.js` -> Tests 1 & 2.

---

### 7. AI Risks & Human-in-the-Loop

#### Threat T-26: AI Prompt Injection / Autonomous Permission Widening
- **Vector**: An attacker crafts document text or descriptions designed to deceive an LLM into granting broad access.
- **Impact**: Excessive permissions granted without human awareness.
- **TrustVault Defense**:
  - **Core Architectural Invariant**: The AI is purely an advisor. It possesses **zero capability** to alter the permissions table directly.
  - All suggestions require explicit review and confirmation by the human document owner.
  - The audit log explicitly records both `AI_ACCESS_SUGGESTION_REQUESTED` and `PERMISSION_GRANT` with `{ aiSuggested: true, confirmedByUserId: ownerId }`.
- **Test**: `server/src/services/aiAdvisor.js`, `server/src/routes/ai.js`.

---

## Knowingly Accepted Trade-offs & Residual Risks

Honesty about security boundaries is essential. The following risks are explicitly recognized and accepted:

1. **Client-Side Screen Capture / Analog Hole**:
   - Once a permitted user downloads or views a decrypted document on their workstation, no software can prevent them from taking a physical photo of the monitor or taking an OS-level screenshot. This is an unavoidable physical reality. Mitigation: Watermarking and legal NDAs.
2. **Master Key Management in Local Environment**:
   - In this self-contained deployment, `VAULT_MASTER_KEY` and `AUDIT_HMAC_SECRET` are managed via environment variables (`.env`). In an enterprise production deployment, these would be bound to a hardware security module (AWS KMS / HashiCorp Vault / Cloud HSM) with envelope encryption.
3. **Local In-Memory Rate Limiting**:
   - The rate limiter is currently in-memory. If scaled across multiple clustered instances, a distributed cache like Redis would be required to synchronize IP rate limits across worker nodes.
