# SeSPHR: Secure PHR System with Hybrid Encryption

## Project Structure
This project is organized into two main components:

*   **`backend/`**: A Flask-based REST API that handles:
    *   Secure Storage (Hybrid RSA+AES)
    *   Key Management (Simulated Key Broker/SRS)
    *   Policy Verification
    *   Audit Logging
*   **`frontend/`**: A React + Vite application that serves the Patient, Doctor, and Admin dashboards.

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

## Architecture Notes
*   **App Factory**: The backend uses the Flask Application Factory pattern (`app/__init__.py`).
*   **Modular Services**: Core logic resides in `backend/app/services/` (Crypto, Storage, Policy).
*   **Blueprints**: API routes are split into modules in `backend/app/api/`.
