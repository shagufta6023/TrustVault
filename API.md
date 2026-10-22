# TrustVault API Specification & Authorization Matrix (API.md)

This document specifies all TrustVault HTTP API endpoints, parameter requirements, and the exact authorization matrix governing each operation.

---

## Authorization Matrix

| Endpoint | Method | Allowed Callers | Permissions Required | Audit Event Logged |
|---|---|---|---|---|
| `/api/auth/login` | `POST` | Public | None | `AUTH_LOGIN_SUCCESS` / `AUTH_LOGIN_FAILURE` |
| `/api/auth/logout` | `POST` | Authenticated | Valid Token | `AUTH_LOGOUT` |
| `/api/auth/me` | `GET` | Authenticated | Valid Token | None |
| `/api/auth/users` | `GET` | Authenticated | Valid Token | None |
| `/api/auth/switch-persona` | `POST` | Public / Tester | None (Evaluation tool) | `PERSONA_SWITCHED` |
| `/api/auth/revoke-sessions` | `POST` | Authenticated | Valid Token | `SESSION_REVOKED` |
| `/api/documents` | `GET` | Authenticated | Scoped to Owned + Permitted | None (Read queries) |
| `/api/documents/upload` | `POST` | `owner`, `admin` | Cannot be `viewer` | `DOCUMENT_UPLOAD` / `SECURITY_FILE_VALIDATION_FAILED` |
| `/api/documents/:id` | `GET` | `owner`, Grantee | `READ` permission on doc | `DOCUMENT_READ_METADATA` / `ACCESS_DENIED` |
| `/api/documents/:id/ticket` | `POST` | `owner`, Grantee | `DOWNLOAD` permission on doc | None |
| `/api/documents/:id/download` | `GET` | `owner`, Grantee | `DOWNLOAD` permission on doc | `DOCUMENT_DOWNLOAD` / `ACCESS_DENIED` |
| `/api/documents/:id` | `PUT` | `owner`, Grantee | `EDIT` permission on doc | `DOCUMENT_METADATA_UPDATE` / `ACCESS_DENIED` |
| `/api/documents/:id/version` | `POST` | `owner`, Grantee | `EDIT` permission on doc | `DOCUMENT_VERSION_UPLOAD` / `ACCESS_DENIED` |
| `/api/documents/:id` | `DELETE` | `owner` ONLY | Document Ownership | `DOCUMENT_DELETE` / `ACCESS_DENIED` |
| `/api/permissions/:documentId` | `GET` | `owner`, Grantee | `READ` permission on doc | None |
| `/api/permissions/:documentId/grant` | `POST` | `owner` ONLY | Document Ownership | `PERMISSION_GRANT` / `ACCESS_DENIED` |
| `/api/permissions/:documentId/revoke` | `POST` | `owner` ONLY | Document Ownership | `PERMISSION_REVOKE` / `ACCESS_DENIED` |
| `/api/audit` | `GET` | `admin` (all), `owner` (own docs) | Role-scoped visibility | None |
| `/api/audit/verify` | `GET` | Authenticated | Valid Token | `SECURITY_TAMPER_DETECTED` (if broken) |
| `/api/audit/simulate-tamper` | `POST` | `admin` ONLY | Administrator Role | None |
| `/api/ai/suggest-access` | `POST` | `owner` ONLY | Document Ownership | `AI_ACCESS_SUGGESTION_REQUESTED` |
| `/api/admin/metrics` | `GET` | `admin` ONLY | Administrator Role | None |
| `/api/admin/anomalies` | `GET` | `admin` ONLY | Administrator Role | None |
| `/api/admin/users/:id/toggle` | `POST` | `admin` ONLY | Administrator Role | `USER_ACCOUNT_DEACTIVATED` |

---

## Detailed Endpoint Documentation

### 1. Authentication

#### `POST /api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Body**:
  ```json
  { "email": "marcus.cole@trustvault.internal", "password": "TrustVault2026!" }
  ```
- **Response `200 OK`**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5...",
    "user": { "id": "usr_owner_marcus", "email": "marcus.cole@trustvault.internal", "name": "Marcus Cole", "role": "owner", "department": "Finance" }
  }
  ```

---

### 2. Document Operations

#### `GET /api/documents`
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**:
  - `q` (string): Title/description search keyword (unpermitted documents return 0 results)
  - `category` (string): Filter by category (`financial`, `legal`, `human_resources`, `engineering`, `audit_compliance`)
  - `viewMode`: `admin_all` (Admin only: view organization inventory metadata)
- **Response `200 OK`**:
  ```json
  {
    "documents": [
      {
        "id": "doc_salary_2026",
        "title": "Executive & Engineering Compensation Matrix 2026",
        "category": "human_resources",
        "classification": "strictly_restricted",
        "owner_name": "Marcus Cole",
        "user_permission": "owner",
        "active_grants_count": 1
      }
    ]
  }
  ```

#### `POST /api/documents/upload`
- **Headers**: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- **Form Data**:
  - `file`: Binary file (PDF, DOCX, XLSX, TXT, CSV, PNG, JPG)
  - `title`: String
  - `description`: String
  - `category`: Category string
  - `classification`: `internal` | `confidential` | `strictly_restricted`
- **Validation**: Magic bytes checked. Executable headers (`MZ`, `ELF`) rejected with 400.
- **Storage**: Plaintext is encrypted with AES-256-GCM before writing to vault storage.

#### `GET /api/documents/:id/download`
- **Headers**: `Authorization: Bearer <token>` OR `?ticket=<ephemeral_ticket>`
- **Behavior**:
  - Server verifies caller has active `READ` or `DOWNLOAD` grant in SQLite.
  - Decrypts cipher buffer and verifies SHA-256 content hash.
  - Streams plaintext attachment with hardened headers:
    - `Content-Disposition: attachment; filename="..."`
    - `X-Content-Type-Options: nosniff`
    - `Content-Security-Policy: default-src 'none'; sandbox`
  - Records `DOCUMENT_DOWNLOAD` in audit trail.
- **Denial**: Returns 403 Forbidden and records `ACCESS_DENIED_UNAUTHORIZED` or `ACCESS_DENIED_REVOKED` in audit trail.

---

### 3. Permissions Management

#### `POST /api/permissions/:documentId/grant`
- **Headers**: `Authorization: Bearer <token>` (Document Owner only)
- **Body**:
  ```json
  {
    "targetUserId": "usr_viewer_david",
    "permissionLevel": "read",
    "aiSuggested": false,
    "aiRationale": "External auditor working paper review"
  }
  ```
- **Response `201 Created`**:
  ```json
  { "success": true, "message": "Granted read access to david.kim@external-audit.com" }
  ```

#### `POST /api/permissions/:documentId/revoke`
- **Headers**: `Authorization: Bearer <token>` (Document Owner only)
- **Body**:
  ```json
  { "targetUserId": "usr_viewer_david" }
  ```
- **Response `200 OK`**:
  ```json
  { "success": true, "message": "Access immediately revoked. Ephemeral tickets invalidated." }
  ```
- **Instant Revocation Effect**: Subsequent requests by `targetUserId` to view metadata or download immediately return 403.

---

### 4. Cryptographic Audit Trail & Verification

#### `GET /api/audit/verify`
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
  ```json
  {
    "report": {
      "isValid": true,
      "totalVerified": 14,
      "tipHash": "2d3c6928b906d4f63852bcf771b8c7fce6a624ab8fcc4a8d7c611ede392cfcde",
      "genesisHash": "0000000000000000000000000000000000000000000000000000000000000000",
      "details": "All 14 records verified successfully. Cryptographic hash chain and HMAC signatures intact."
    }
  }
  ```

#### `POST /api/audit/simulate-tamper` (Diagnostic Evaluator Tool)
- **Headers**: `Authorization: Bearer <token>` (Admin only)
- **Body**:
  ```json
  { "field": "actor_email", "newValue": "tampered_actor@evil.com" }
  ```
- **Behavior**: Deliberately mutates a row in SQLite without updating cryptographic hashes, allowing evaluators to verify that `/api/audit/verify` immediately flags the tampered row.

---

### 5. AI Access Advisor

#### `POST /api/ai/suggest-access`
- **Headers**: `Authorization: Bearer <token>` (Document Owner only)
- **Body**: `{ "documentId": "doc_salary_2026" }`
- **Behavior**:
  - Analyzes document classification, category, and organization roles.
  - Produces least-privilege recommendations with rationale and risk scores.
  - **Does NOT apply permissions automatically**.
  - Logs `AI_ACCESS_SUGGESTION_REQUESTED` to tamper-evident audit trail.
