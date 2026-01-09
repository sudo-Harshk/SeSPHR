# SeSPHR

This project is a Secure Personal Health Record (SeSPHR) system consisting of a Flask backend and a React frontend.

## Technology Stack

- **Backend:** Python, Flask, SQLite
- **Frontend:** React, TypeScript, Vite, TailwindCSS
- **Cryptography:** Argon2 for password hashing, AES for file encryption

## Prerequisites

Ensure you have the following installed:
- Python 3.8 or higher
- Node.js 16 or higher
- npm (Node Package Manager)

## Installation

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd sesphr-backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd sesphr-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Project

### Starting the Backend

1. Make sure your virtual environment is activated.
2. Navigate to the backend directory.
3. Run the Flask application:
   ```bash
   python web/app.py
   ```
   The backend will start at `http://localhost:5000`.

### Starting the Frontend

1. Navigate to the frontend directory.
2. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will be accessible at the URL provided in the terminal (usually `http://localhost:5173`).
