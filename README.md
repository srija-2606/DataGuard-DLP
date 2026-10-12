# DataGuard — Smart Data Leakage Prevention

A full-stack educational DLP prototype built with React, Tailwind CSS, FastAPI, SQLite, JWT authentication, and rule-based sensitive-data detection.

## Features
- Register and log in using JWT authentication
- Scan pasted text and supported uploaded files (`.txt`, `.csv`, `.json`, `.md`)
- Detect common sensitive patterns: email addresses, phone-like numbers, Aadhaar-like numbers, API-key-like tokens, and password assignments
- Mask detected values in results
- Risk scoring and configurable policy decision (`ALLOW`, `WARN`, `BLOCK`)
- Audit log records metadata and finding categories, not original submitted content
- Dashboard overview and recent events

> This is a prototype, not a complete enterprise DLP agent. It only scans content submitted to this application. It does not monitor other apps, USB drives, email clients, or network traffic. Detection rules can produce false positives and negatives. Use synthetic data for demos.

## Requirements
- Python 3.10+
- Node.js 18+
- npm

## 1. Start the backend
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```
On macOS/Linux use `cp .env.example .env` instead of `copy`.
API docs: http://127.0.0.1:8000/docs

## 2. Start the frontend
Open another terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

## Demo flow
1. Register an account.
2. Paste synthetic text such as `Contact: demo.user@example.com, phone: 9876543210`.
3. Scan and inspect findings, masked output, risk score, and policy action.
4. Open Audit Log to review event metadata.

## Security notes before real deployment
- Replace `SECRET_KEY` with a long random secret and keep it out of source control.
- Use HTTPS, rate limiting, account verification, and secure cookie/token storage.
- Add file size limits, malware scanning, and robust parsers before accepting office/PDF files.
- Review the detector rules and risk thresholds for your policy.
- Do not log raw content or real secrets. Avoid using production personal data in demos.
