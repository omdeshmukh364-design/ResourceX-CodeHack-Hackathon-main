# ResourceX

Campus resource sharing application: Next.js 16 / React / TypeScript, FastAPI, Firebase Authentication and Cloud Firestore.

Read **[AUDIT_AND_SETUP.md](AUDIT_AND_SETUP.md)** before starting. It contains the full repair report, Windows commands, Firebase configuration, secure admin/teacher provisioning and test limitations.

The deliverable contains source and example configuration only. Obtain matching Firebase configuration for `resourcex-hackathon` and keep the service-account private key on the backend. No demo tokens, public teacher/admin signup, automatic live seeding or offline auth bypass are supported.

```powershell
# Project root, after configuring backend/.env:
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --port 8000
```

```powershell
# A separate terminal, after configuring frontend/.env.local:
cd frontend
npm ci
npm run dev -- --port 3000
```

Tests: `python -m pytest backend/tests -q` from the root. Frontend checks: `npm run typecheck` and `npm run build` from frontend. Tests use isolated in-memory data and mocked Firebase identities; live Firebase behavior remains to be validated in a safe development project.
