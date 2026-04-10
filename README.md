# SeSPHR: Secure Sharing of Personal Health Records in the Cloud

Implementation of the methodology described in:
> *"SeSPHR: A Methodology for Secure Sharing of Personal Health Records in the Cloud"*
> Mazhar Ali, Assad Abbas, Muhammad Usman Shahid Khan, Samee U. Khan — IEEE

---

## What This Project Does

A patient stores their health record on an **untrusted cloud server** — encrypted. A semi-trusted proxy called the **SRS (Setup and Re-encryption Server)** decides who can decrypt what, based on policies the patient defines. The patient controls access. The cloud never sees plaintext. Decryption happens entirely in the doctor's browser.

**Core security properties implemented:**
- Patient-centric access control — the patient sets policy, not the hospital
- PHR partitioning — different portions of a record can have different access policies
- Proxy re-encryption — SRS transforms the key for the authorised user without exposing plaintext
- Forward/backward access control — revoke and restore access without re-encrypting files
- Tamper-evident audit log — SHA-256 hash chain detects any modification to access records

---

## Architecture

```
Browser (Patient/Doctor) → nginx :5173
                               ├── /            React SPA
                               └── /api/...  → Flask Backend :5000
                                                   ├── Policy Engine
                                                   ├── SRS Re-encryption
                                                   ├── SQLite (users + attributes)
                                                   └── Cloud Storage (encrypted files)
```

See [`docs/architecture.md`](docs/architecture.md) for full Mermaid diagrams covering:
- System entities and data flow
- PHR upload sequence
- Access request and re-encryption sequence
- Granular portions access model
- Proxy re-encryption key transform
- Audit log hash chain

---

## Quick Start — Docker (Recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/). No Python or Node needed on the host.

```bash
docker compose up --build
```

Open **http://localhost:5173**

Demo accounts are created automatically on first boot:

| Email | Password | Role | Attributes |
|---|---|---|---|
| `patient1@demo.com` | `Demo@1234` | Patient | — |
| `dr_cardio@demo.com` | `Demo@1234` | Doctor | Dept: Cardiology |
| `dr_ortho@demo.com` | `Demo@1234` | Doctor | Dept: Orthopedics |
| `admin@demo.com` | `Demo@1234` | Admin | — |

Data persists across restarts. To fully reset:
```bash
docker compose down -v
docker compose up --build
```

---

## Manual Setup (Without Docker)

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate
# Mac / Linux
source venv/bin/activate

pip install -r requirements.txt
python seed_demo_users.py   # creates DB tables + demo accounts
python run.py               # starts Flask at http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                 # starts Vite at http://localhost:5173
```

---

## Features

### Patient
- Upload PHR files encrypted with AES-256-GCM directly in the browser
- Define a global access policy (e.g. `Role:Doctor AND Dept:Cardiology`)
- Split the record into named **portions**, each with its own policy and encryption key
- Revoke access for a specific user or the entire file
- Restore access at any time

### Doctor
- View available health records
- Request access — SRS evaluates policy against the doctor's attributes
- Animated SRS processing steps shown live during access request
- Decryption happens entirely in the browser — plaintext never sent over the network
- Cryptographic proof panel: shows original key blob vs re-encrypted key blob side by side

### Admin
- Manage users and assign attributes (`Role`, `Dept`, `Speciality`, etc.)
- View the tamper-evident audit log with hash chain integrity verification
- View performance benchmark charts (encryption, SRS re-encryption, decryption times)

---

## Policy Engine

Policies are boolean attribute expressions evaluated server-side by the SRS:

```
Role:Doctor AND Dept:Cardiology
(Role:Doctor AND Dept:Cardiology) OR Role:Admin
Role:Doctor OR Role:Pharmacist
Role:Admin
```

Attributes are assigned to users by the admin. The policy engine supports `AND`, `OR`, and parentheses.

---

## Project Structure

```
sesphr/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py          # Login, signup, session
│   │   │   ├── patient.py       # Upload, revoke, grant
│   │   │   ├── doctor.py        # Access request, download
│   │   │   └── admin.py         # Users, audit, benchmark
│   │   └── services/
│   │       ├── crypto/
│   │       │   ├── keys.py      # RSA key generation (SRS + users)
│   │       │   └── ops.py       # Proxy re-encryption (SRS core)
│   │       ├── policy/
│   │       │   └── parser.py    # Boolean attribute policy engine
│   │       ├── audit/
│   │       │   └── logger.py    # SHA-256 hash-chained audit log
│   │       └── storage/
│   │           ├── users.py     # SQLite user + attribute CRUD
│   │           └── phr.py       # Encrypted PHR file store
│   ├── seed_demo_users.py       # Creates demo accounts (safe to re-run)
│   └── tests/
│       └── benchmark_suite.py   # Performance benchmarks
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── pages/
│       │   ├── patient/         # Upload, manage, revoke
│       │   ├── doctor/          # Request access, view, download
│       │   └── admin/           # Users, audit, benchmark charts
│       └── utils/
│           ├── crypto.ts        # Web Crypto API wrappers (AES-GCM + RSA-OAEP)
│           └── policy.ts        # Client-side policy preview
├── cloud/                       # Simulated cloud storage (created at runtime)
│   ├── data/                    # .enc files (AES-GCM ciphertext)
│   ├── meta/                    # .json metadata (policy, key_blob, portions)
│   └── keys/                    # RSA key pairs (PEM)
└── docs/
    ├── architecture.md          # Mermaid architecture diagrams
    └── demo-guide.md            # Step-by-step demo script with panel Q&A
```

---

## Performance

Benchmarks measured across file sizes from 100 KB to 10 MB:

| File Size | Encryption (AES-GCM) | SRS Re-encryption | Decryption |
|---|---|---|---|
| 100 KB | 11.87 ms | 204.44 ms | 67.26 ms |
| 1 MB | 5.81 ms | 198.00 ms | 77.35 ms |
| 5 MB | 12.20 ms | 180.54 ms | 81.57 ms |
| 10 MB | 26.47 ms | 183.38 ms | 95.48 ms |

**Key result:** SRS re-encryption time is constant (~190 ms) regardless of file size — because the SRS only re-encrypts the 32-byte AES key, not the file itself.

Run benchmarks:
```bash
python backend/tests/benchmark_suite.py
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts |
| Crypto (browser) | Web Crypto API — AES-256-GCM + RSA-OAEP |
| Backend | Flask (Python 3.11) |
| Crypto (server) | PyCryptodome — RSA-OAEP |
| Auth | Argon2 password hashing, Flask sessions |
| Database | SQLite |
| Containerisation | Docker, nginx |
