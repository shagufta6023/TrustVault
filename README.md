# TrustVault 🛡️
> Secure Document Sharing with a Cryptographically Verifiable Audit Trail

TrustVault solves the two most expensive vulnerabilities in corporate document management:
1. **Permission Leaks**: Ensuring the wrong person can never access, search, or download confidential files through any vector.
2. **Attribution & Tampering**: Cryptographically proving who accessed or attempted to access documents, backed by a tamper-evident SHA-256 hash chain and HMAC signatures.

---

## Live Public URL

**Direct Live URL**: [https://9ff2171e784099.lhr.life](https://9ff2171e784099.lhr.life)

*(Opens directly in any browser with zero passwords or verification screens).*

---

## Default Evaluation Credentials

All demo accounts use the standard password: `TrustVault2026!`

| Role | Persona | Email | Primary Responsibilities |
|---|---|---|---|
| **Administrator** | Elena Vance | `admin@trustvault.internal` | CISO, security telemetry, audit integrity verification, user governance |
| **Document Owner** | Marcus Cole | `marcus.cole@trustvault.internal` | VP Finance, owns Compensation Matrix & SOC-2 Audit Papers |
| **Document Owner** | Sarah Jenkins | `sarah.jenkins@trustvault.internal` | General Counsel, owns Project Apex M&A Purchase Agreement & SOW |
| **Viewer** | David Kim | `david.kim@external-audit.com` | Senior Auditor (EY), holds read-only grants on SOC-2 and M&A |
| **Viewer** | Chloe Bennett | `chloe.bennett@contractor.io` | Engineering Contractor, holds read-only grant on Frontend SOW |

> **Evaluator Tip**: You do not need to repeatedly log out to switch personas. The top navigation bar includes an instant **1-Click Persona Switcher** designed specifically for evaluation.

---

## Quick Start (Clean Setup & Launch)

### Prerequisites
- Node.js v18+ (tested on Node v20 & v22)
- npm v9+

### 1. Install Dependencies
```bash
npm install
npm --prefix client install
```

### 2. Seed Database & Generate Encryption Keys
Initializes SQLite in WAL mode, generates initial documents, encrypts storage with AES-256-GCM, and seals the Genesis block:
```bash
npm run seed
```

### 3. Run Automated Security Test Suite
Executes 23 automated tests covering negative authorization, IDOR, instantaneous revocation, and database tamper detection:
```bash
npm test
```

### 4. Build & Launch Server
Builds the frontend production bundle and starts the secure Express server on port 5000:
```bash
npm run build
npm start
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

---

## Core Security Standards Enforced

### 1. Server-Authoritative Zero-Trust Isolation
- Client-side checks are purely cosmetic. Every single API request executes `checkDocumentPermission(userId, docId, requiredAction)` in the database before streaming bytes.
- Direct file access is impossible: physical files are stored encrypted with **AES-256-GCM** in decoupled random paths (`./server/storage/encrypted/vault_<uuid>.enc`) outside the web root.
- **Search Isolation**: Searching for keywords returns 0 results for unpermitted documents. Titles and existence are completely invisible.

### 2. Tamper-Evident Cryptographic Audit Trail
- Each audit log entry is linked to the previous record's SHA-256 hash, forming an immutable hash chain:
  $$\text{record\_hash} = \text{SHA-256}(\text{sequence} \parallel \text{prev\_hash} \parallel \text{timestamp} \parallel \text{actor} \parallel \text{action} \parallel \text{doc} \parallel \text{details} \parallel \text{ip})$$
- Every block is sealed with an HMAC signature (`signAuditHash`).
- If an attacker covertly alters or deletes a row in SQLite, `verifyAuditIntegrity()` immediately detects the corruption and highlights the exact sequence number.
- Evaluators can test this live using the **"Judge Attack Simulator"** or calling `POST /api/audit/simulate-tamper`.

### 3. Instantaneous Revocation (No Lingering Access)
- Permissions are evaluated at read time (`WHERE is_active = 1`).
- Revoking a user's access invalidates their permissions and deletes any active single-use ephemeral download tickets in the same database transaction.
- Subsequent calls by that user fail immediately with HTTP 403.

---

## Repository Documentation Index

- **[THREATS.md](file:///c:/Users/shaik/Music/TrustVault/THREATS.md)**: Exhaustive threat model covering 26 distinct attack vectors, mitigations, test mapping, and knowingly accepted trade-offs.
- **[PROMPTS.md](file:///c:/Users/shaik/Music/TrustVault/PROMPTS.md)**: Dated entries documenting AI oversight, specific security flaws caught (JWT permission caching, audit serialization drift, extension spoofing), and diff references.
- **[API.md](file:///c:/Users/shaik/Music/TrustVault/API.md)**: Full API documentation and endpoint authorization matrix.
- **[WRITEUP.md](file:///c:/Users/shaik/Music/TrustVault/WRITEUP.md)**: Architectural narrative, DAC permission model, AI error analysis, and deliberate omissions.

---

## Testing Security via CLI

### Test 1: IDOR Attack (Viewer Attempting to Read Secret Salary Doc)
```bash
# David Kim attempts to fetch Marcus's compensation file
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <david_token>" http://localhost:5000/api/documents/doc_salary_2026
# Expected output: 403
```

### Test 2: Verify Cryptographic Chain Integrity
```bash
curl -s http://localhost:5000/api/audit/verify -H "Authorization: Bearer <admin_token>"
# Expected output: { "report": { "isValid": true, "totalVerified": ..., "tipHash": "..." } }
```

### Test 3: Disguised Binary Upload Check
```bash
# Renamed Windows PE (.exe) file disguised as a PDF
curl -X POST http://localhost:5000/api/documents/upload \
  -H "Authorization: Bearer <marcus_token>" \
  -F "file=@trojan.pdf" -F "title=Disguised Trojan" -F "category=financial"
# Expected output: 400 Bad Request ("Malicious or prohibited file signature detected")
```
