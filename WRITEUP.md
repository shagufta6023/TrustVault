# TrustVault Architecture, Security Decisions & Critical Retrospective (WRITEUP.md)

## Executive Summary
TrustVault is a zero-trust confidential document platform engineered from first principles to solve the dual failure modes of corporate document sharing:
1. **Permissions Failure**: Over-permissioned users, lingering tokens after departure, and cross-tenant leakage.
2. **Attribution Failure**: Inability to prove definitively who accessed or attempted to access a document after an incident.

The platform enforces three non-negotiable guarantees:
- **Server-Authoritative Isolation**: The server validates user credentials, active grants, and document state on every request. Client checks are purely cosmetic.
- **Tamper-Evident Cryptographic Audit Trail**: Every access, download, modification, grant, revocation, and denial is sealed into a SHA-256 hash chain with server-side HMAC signatures. Silent alteration or deletion of database rows is mathematically provable and immediately detected.
- **Instantaneous Revocation**: Revoking access deactivates permissions and invalidates in-flight ephemeral download tickets synchronously.

---

## The Permission Model in Our Own Words

TrustVault implements a **Stateful, Real-Time Discretionary Access Control (DAC) Model with Separation of Duties**:

### 1. Document Ownership
- Every document has an immutable `owner_id`.
- The Document Owner possesses complete authority over that object: `READ`, `DOWNLOAD`, `EDIT`, `DELETE`, and `MANAGE_PERMISSIONS`.
- Ownership cannot be silently usurped or transferred without an audited database transaction.

### 2. Granular Per-Document Named Grants
- An Owner can grant access to named individuals with two explicit privilege tiers:
  - **`READ`**: Authorizes viewing metadata and streaming decrypted ciphertext. Does *not* authorize updating metadata, uploading new versions, deleting the file, or sharing with others.
  - **`EDIT`**: Authorizes viewing, downloading, updating metadata, and uploading new file versions. Does *not* authorize deleting the document or granting access to third parties.

### 3. Real-Time Revocation Lifecycle
- Permissions are stored in SQLite with an `is_active` flag, `granted_at`, `revoked_at`, and `revoked_by`.
- When an owner clicks "Revoke", an atomic transaction executes:
  ```sql
  UPDATE permissions SET is_active = 0, revoked_at = datetime() 
  WHERE document_id = ? AND user_id = ? AND is_active = 1;
  DELETE FROM ephemeral_download_tickets WHERE document_id = ? AND user_id = ?;
  ```
- **Why this beats JWT claims**: In stateless architectures, tokens survive until expiration. In TrustVault, permissions are never embedded in JWTs; every request evaluates `is_active = 1` in the database at the exact millisecond of the call.

### 4. Administrative Separation of Duties & Break-Glass
- A frequent design flaw in enterprise applications is giving administrators unrestricted "god-mode" read access to all private files. In TrustVault:
  - Administrators govern users, monitor security telemetry, and verify audit integrity, but **cannot read restricted documents** by default.
  - If a regulatory subpoena requires access, the Administrator must explicitly declare `X-TrustVault-BreakGlass: <justification>`. This immediately generates a **SEV-1 ANOMALY audit event** (`ADMIN_BREAK_GLASS_OVERRIDE`) in the tamper-evident hash chain, making covert snooping impossible.

---

## File Storage & Encryption at Rest

Files are never exposed to static web server routing or stored as unencrypted disk files:
1. **Decoupled Random Storage Keys**: Stored in `./server/storage/encrypted/vault_<uuid>.enc` with no file extension and no correlation to document titles.
2. **Authenticated Symmetric Encryption**: Each file is encrypted with **AES-256-GCM** using unique 12-byte initialization vectors (`IV`) and 16-byte authentication tags.
3. **Stream Authorization & Content Hash**: Download endpoints verify permission, stream-decrypt on the fly, verify the plaintext SHA-256 checksum, and apply strict browser download headers (`nosniff`, `sandbox`, `attachment`).

---

## How AI Was Used & Where It Was Wrong

AI tools were leveraged extensively to accelerate scaffolding, UI development, and test authoring. However, AI consistently proposed **superficially elegant but security-deficient designs**:

1. **Stateless JWT Permission Caching**:
   - *AI Proposal*: Embed user document permissions in JWT payloads to avoid DB round-trips.
   - *Security Failure*: Directly broke the non-negotiable requirement for immediate revocation. Stale tokens remained valid for hours after revocation.
   - *Human Remediation*: Rejected token caching in favor of synchronous database verification and single-use ephemeral tickets.
2. **Naive JSON Hashing**:
   - *AI Proposal*: Hash audit records using `JSON.stringify(record)`.
   - *Security Failure*: In JavaScript V8, un-ordered key serialization caused hash mismatches across database reloads, causing false-positive verification errors.
   - *Human Remediation*: Built a recursive alphabetical `canonicalizeJson` routine and deterministic pipe-delimited hashing schema.
3. **Extension-Only File Validation**:
   - *AI Proposal*: Validate files by checking `path.extname()`.
   - *Security Failure*: Left the system wide open to extension spoofing (`trojan.exe` renamed to `invoice.pdf`).
   - *Human Remediation*: Implemented deep magic byte inspection detecting Windows PE (`MZ`) and Linux ELF headers.

Full details and diffs are preserved in [PROMPTS.md](file:///c:/Users/shaik/Music/TrustVault/PROMPTS.md).

---

## What We Deliberately Chose Not to Build (And Why)

1. **Complex Hierarchical Folder Inheritance**:
   - *Rationale*: Folder inheritance is the #1 source of permission leaks in enterprise software ("Someone is given access to a folder so they can see one file, and they can now see forty"). TrustVault deliberately implements direct per-document grants.
2. **Client-Side Digital Rights Management (DRM)**:
   - *Rationale*: Obfuscating DOM elements or disabling right-click does not stop a dedicated adversary from taking a screenshot or capturing video. We rejected security through obscurity.
3. **Public / Unauthenticated Share Links**:
   - *Rationale*: Public links leak via browser history, Slack, and email forwards. TrustVault requires strict authentication for all viewers.

---

## What Is Unfinished / Next Steps for Enterprise Scale

1. **Hardware Security Module (HSM) Integration**:
   - The master encryption key is currently loaded from environment configuration. An enterprise production deployment would bind key generation and envelope encryption to AWS KMS, HashiCorp Vault, or Google Cloud KMS.
2. **Distributed Redis Rate Limiting**:
   - Rate limiting is currently handled in-memory per node. Clustered deployments would require Redis backed token-bucket rate limiting.
3. **Asynchronous Antivirus Sandboxing (ClamAV / VirusTotal API)**:
   - File signatures and magic bytes are verified in-process. Integrating a background ClamAV scanning daemon would add an extra layer of defense against sophisticated polyglots.
