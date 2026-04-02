# SeSPHR: Secure Sharing of Personal Health Records in the Cloud

SeSPHR is a methodology for the secure sharing of Personal Health Records (PHRs) in a cloud environment. This project implements a robust framework utilizing **Hybrid Encryption**, **Proxy Re-Encryption (PRE)**, and **Granular Access Control** to ensure data confidentiality, integrity, and fine-grained authorization.

This implementation is part of an MTech Final Year Project, designed to address the security challenges in cloud-based health record management.

## Core Features

-   **Hybrid Encryption (AES-GCM + RSA-OAEP)**: Combines the efficiency of symmetric encryption for large health data with the security of asymmetric encryption for key transport.
-   **Proxy Re-Encryption (SRS)**: Utilizes a Setup and Re-encryption Server (SRS) as a semi-trusted proxy. It transforms encrypted keys for specific users without ever accessing the plaintext data.
-   **Granular Access Control (Portions)**: Allows patients to define different access policies for specific sections of a single PHR (e.g., sharing Lab Results with a Specialist but keeping Personal Notes private).
-   **Advanced Policy Engine**: Supports complex boolean attribute-based policies (e.g., `(Role:Doctor AND Dept:Cardiology) OR Role:Admin`).
-   **Secure Revocation**: Supports both user-level and file-level access revocation.
-   **Audit Logging**: Comprehensive logging of all access requests, grants, and denials for accountability.

## Architecture

The system consists of three main entities:
1.  **PHR Owner (Patient)**: Encrypts and uploads data.
2.  **Data User (Doctor/Admin)**: Requests access to authorized portions of the data.
3.  **SRS (Proxy)**: Handles key transformation and policy evaluation.

A detailed sequence diagram and architectural breakdown can be found in the [architecture.md](architecture/architecture.md) file.

## Project Structure

*   **`backend/`**: Flask-based REST API
    *   `app/services/crypto/`: Implementation of Hybrid Encryption and Proxy Re-Encryption.
    *   `app/services/policy/`: Advanced Boolean Policy Parser and Evaluator.
    *   `app/api/`: Role-based endpoints (Patient, Doctor, Admin).
*   **`frontend/`**: React + Vite application
    *   `src/pages/patient/`: Granular PHR upload and management.
    *   `src/pages/doctor/`: Secure decryption and viewing of authorized portions.
*   **`architecture/`**: System design documentation and Mermaid scripts.

## Getting Started

### Prerequisites
*   Python 3.10+
*   Node.js 18+

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
python run.py
```
*   Server runs at `http://localhost:5000`.

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*   App runs at `http://localhost:5173`.

## Performance Benchmarking

The system includes a benchmarking suite to evaluate encryption, SRS re-encryption, and decryption times across various file sizes (100KB to 10MB).
```bash
python backend/tests/benchmark_suite.py
```
Results are saved to `benchmark_results.csv` for use in research papers and project reports.

## Research Reference
This project is based on the methodology described in the paper:
*"SeSPHR: A Methodology for Secure Sharing of Personal Health Records in the Cloud"*
