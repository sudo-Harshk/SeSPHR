# SeSPHR - browser-encrypted PHR sharing with policy-gated key release

## Overview

SeSPHR is a prototype system for sharing Personal Health Records (PHRs) through an untrusted cloud without uploading plaintext.  
Patients encrypt files in the browser and upload only ciphertext.  
Doctors request access; the server enforces policy and releases only the decryption key material needed for authorized users.

## Problem

- Cloud storage providers can see plaintext unless encryption happens before upload
- Sharing often requires duplicating or re-uploading data per recipient
- Access control and revocation are hard to manage once data leaves the patient

## Solution

- Encrypt in the browser; store only ciphertext in the cloud
- Gate access at the server by transforming/releasing keys (not moving data)
- Record access and admin actions with a tamper-evident audit trail

## Key Features

- Browser-side file encryption/decryption
- Policy-based access checks for key release
- Key transformation flow for authorized recipients
- Admin audit logs with integrity verification
- Admin benchmark endpoint + UI for measuring crypto costs
- Pytest backend tests and Playwright E2E tests

## Architecture

* Browser (trusted)
* Cloud (untrusted)
* SRS (semi-trusted)

- [architecture.md](architecture/architecture.md)

## How It Works


1. Patient uploads a file (encrypted in the browser)
2. Ciphertext + minimal metadata are stored in the cloud
3. Doctor requests access; server enforces policy and releases/transforms key material
4. Doctor decrypts the file locally in the browser

## Performance

The admin benchmark measures end-to-end crypto costs.  
File encryption scales with file size, while the key-release step is designed to be independent of file size.

## Limitations

- Semi-trusted server sees key material during transformation/release
- No production hardening (e.g., TLS, HSM, rotation) in this repo
- Some components are simplified/simulated for a prototype
- Revocation can’t “undo” data already downloaded and decrypted

## Setup

### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python seed_demo_users.py
$env:FLASK_ENV="development"
python run.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Run Tests

```bash
# Make
make test

# PowerShell
pwsh ./scripts/test_all.ps1

# Bash
bash ./scripts/test_all.sh
```

## Demo Credentials

- Admin: `admin@demo.com` / `Demo@1234`
- Patient: `patient1@demo.com` / `Demo@1234`
- Doctor: `dr_cardio@demo.com` / `Demo@1234`

## Conclusion

SeSPHR demonstrates a practical pattern for cloud-hosted record sharing: encrypt client-side, store ciphertext, and control access via server-gated key release.  
It’s intended for demos and evaluation rather than production deployment.
