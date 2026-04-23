# Future Scope — SeSPHR

Things deliberately left out of the POC that would need to be completed before this becomes a real system.

---

## 1. Section-level Access (PHR Partitioning)

**What the paper says:** A single PHR file can be split into named logical sections (Lab Results, X-Rays, Prescriptions), each with its own AES key and access policy. A cardiologist gets the key for Lab Results but not X-Rays. An orthopedic doctor gets X-Rays but not Lab Results — all from the same file.

**Current state:** The backend fully supports it — `portions` are stored in metadata, each with a separate `key_blob` and `policy`. The doctor access endpoint already evaluates and re-encrypts per-portion keys. It was removed from the patient upload UI to keep the demo clean.

**What needs to be done:**
- Re-add the section editor in the patient upload form
- Update the doctor file viewer to display each unlocked section separately in the browser
- Show locked sections as redacted (greyed out) with a reason

---

## 2. SRS as a Separate Service

**What the paper says:** The SRS (Setup and Re-encryption Server) is a semi-trusted third party — separate from both the cloud storage server and the application server. It holds the master private key and performs re-encryption. Neither the cloud nor the SRS can independently decrypt a file.

**Current state:** The SRS logic lives inside the Flask app (`app/services/crypto/`). It shares a process with the rest of the API. Functionally correct, but architecturally not separated.

**What needs to be done:**
- Extract the SRS into its own microservice (separate Flask app or FastAPI)
- SRS exposes a single internal endpoint: `POST /reencrypt` — takes `key_blob` + `user_id`, returns re-encrypted key
- Main app calls SRS over an internal network — never directly touches the SRS private key
- SRS private key lives only in the SRS container, inaccessible to the main app
- Can be deployed as a separate Docker service in `docker-compose.yml`

---

## 3. HTTPS / TLS

**Current state:** Plain HTTP. Acceptable for localhost demo, not for any real deployment.

**What needs to be done:**
- Add TLS termination at the nginx layer (Let's Encrypt cert via Certbot, or a self-signed cert for internal deployment)
- Set `SESSION_COOKIE_SECURE = True` and `SESSION_COOKIE_SAMESITE = "Strict"` in Flask config
- Enforce HTTPS redirect in nginx

---

## 4. Production Database

**Current state:** SQLite with a single file. Works fine for a single-server POC, breaks under concurrent writes.

**What needs to be done:**
- Migrate to PostgreSQL (already supported by SQLAlchemy with a config change)
- Add proper connection pooling
- Run migrations with Alembic instead of raw `IF NOT EXISTS` DDL
- Separate the DB volume from the application container

---

## 5. Real Cloud Storage

**Current state:** "Cloud storage" is a local folder (`cloud/data/`, `cloud/meta/`) on the same machine as the app server. This simulates the untrusted cloud server but is not actually separate.

**What needs to be done:**
- Store encrypted files in a real object store — AWS S3, Google Cloud Storage, or Azure Blob
- Metadata (policy, key_blob, IV) stays in the app database — never in the object store
- The object store holds only ciphertext — it cannot decrypt anything even if fully compromised
- Download endpoint streams directly from the object store to the doctor's browser

---

## 6. Key Management

**Current state:** RSA key pairs are generated on signup and stored as PEM files in `cloud/keys/`. The SRS master key pair is stored at a fixed path. No rotation, no backup.

**What needs to be done:**
- Move all private keys into a secrets manager (HashiCorp Vault, AWS Secrets Manager, or at minimum environment-injected secrets)
- Implement key rotation — allow a user's RSA key pair to be regenerated without losing access to old files (re-wrap stored key blobs with the new public key)
- SRS master key should never touch disk in production — loaded from a secrets manager at startup

---

## 7. Full Audit Log UI

**Current state:** Admin sees all audit entries in a flat table. Integrity check is all-or-nothing.

**What needs to be done:**
- Per-file audit history — click a file, see every access event for that file
- Per-user audit history — click a user, see their full access history
- Filter by date range, action type, status
- Export audit log as signed PDF for compliance reporting
- If the hash chain is broken, highlight exactly which entry is tampered (currently just flags "tampered")

---

## 8. Doctor-side File Viewer

**Current state:** After access is granted, the doctor downloads the raw decrypted file (browser saves it). There is no in-browser viewer.

**What needs to be done:**
- For PDFs: render inline using PDF.js
- For images: display directly
- For structured data (JSON/CSV health records): render as a formatted table
- Never write decrypted content to disk — keep it only in memory / object URLs, revoke the URL after the tab closes

---

## 9. Multi-factor Authentication

**Current state:** Username + password only (Argon2 hashed).

**What needs to be done:**
- TOTP-based 2FA (Google Authenticator compatible) for doctor and admin accounts
- Optional: hardware key support (WebAuthn/FIDO2) — browser already has the Web Crypto API available

---

## 10. Patient Consent Workflow

**What the paper describes:** Patients should be able to grant time-limited or purpose-limited access — not just permanent policy-based access.

**What needs to be done:**
- Consent requests: a doctor requests access, the patient receives a notification and approves/denies
- Time-limited access: access automatically expires after N days
- Purpose field: doctor states reason for access, logged in the audit trail
- Notification system (email or in-app) when a doctor accesses a record

---

## Summary

| Item | Effort | Impact |
|---|---|---|
| Section-level access UI | Low — backend already done | Completes the paper's core feature |
| SRS as separate service | Medium | Correct architecture per the paper |
| HTTPS | Low | Required for any real deployment |
| Production DB (PostgreSQL) | Low | Required for concurrent users |
| Real cloud storage (S3) | Medium | True untrusted cloud simulation |
| Key management (Vault) | High | Production security requirement |
| Full audit log UI | Medium | Compliance and usability |
| Doctor file viewer | Medium | Better UX, no plaintext on disk |
| MFA | Medium | Standard healthcare security requirement |
| Patient consent workflow | High | Completes the paper's access control model |
