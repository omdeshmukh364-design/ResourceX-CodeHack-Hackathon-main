# ResourceX audit and repair report

Date: 29 October 2026. Scope: uploaded Next.js/FastAPI source, configuration metadata, rules, models, service operations, dashboards, and tests. No production Firebase accounts or data were accessed or changed. Original uploaded files remain in the scratch upload directory; the deliverable excludes credentials, local environment files, dependencies and generated output.

## Confirmed root causes and priority

| Priority | Confirmed defect | Repair / implication |
|---|---|---|
| Critical | Frontend sign-in ignored passwords and generated privileged demo tokens based on email substrings. | Firebase email/password sign-in; selected role checked against backend profile. |
| Critical | Backend accepted fabricated demo/test tokens even after failed live verification in development. | Removed application fake-token support; Admin SDK verifies tokens with revocation/disabled-user checks. Test verifiers exist only in pytest fixtures. |
| Critical | Firestore users could write their own profile, including role, and directly edit booking state, locks and audits. | Browser Firestore access denied; existing app uses authorized FastAPI operations. Deploy the supplied rules. Existing unauthorized mutations, if any, require review. |
| Critical | Bootstrap had a public known default secret, could repeatedly promote an existing profile, and ignored passwords. | Disabled by default, explicit opt-in and at least 32-character secret, permanent create-only bootstrap marker, refuse existing admin or existing account, create Auth identity and profile. |
| High | Frontend .env.local points at resourcex-5987c while backend expects resourcex-hackathon. Bundled service-account project also differs from the backend target. | Frontend checks backend project policy; backend rejects mismatched credential projects. Obtain one consistent config for the intended project. No secrets overwritten. |
| High | Missing/invalid credentials silently selected a separate in-memory database, while auth checks returned false or pretended account creation succeeded. Startup seeded users there. | In-memory storage limited to ENVIRONMENT=test; development/production fail closed and never auto-seed. |
| High | Existing Firestore profiles caused duplicate responses before matching Firebase Auth was established. Demo profiles could exist in memory but be absent from both Console views. | Separate orphan-profile conflict from normal duplicates; preserve all records and require reconciliation. Auth-only duplicates direct users to sign-in/recovery. |
| High | Generic token authentication auto-created missing profiles and assigned default or token roles. Missing role defaulted to student. | Missing/invalid profile or identity mismatch denied; no default role. Dedicated authenticated recovery requires server-owned registration marker and can only create student profiles. |
| High | Auth account creation and Firestore profile writes were not recoverable together. | Create-only profile writes, server-owned Auth recovery marker, explicit 503 for partial failure, idempotent authenticated student recovery. Never automatically delete Auth users or profiles. |
| High | Privileged provisioning wrote only Firestore, leaving teachers/admins without password Auth identities. | Authorized admin provisioning creates both, uses the same UID and logs privileged creation. Partial privileged failures require manual reconciliation. |
| High | Public seed endpoint could force-overwrite shared data in any environment. | Endpoint removed; automatic sample seeding is restricted to tests. |
| High | Any authenticated user could retrieve another user's full profile; teachers could see unrelated return records. | Profile reads restricted to self/admin; teacher return history restricted by booking ownership. |
| High | Booking approval used unstarted SDK transaction reads and a nontransactional overlap query. Other state changes could race or leave partial return records. | Real Firestore transactional callback and transactional query; rejection, cancellation, checkout and return now transactional with reads before writes. Offline tests serialize transactions. Live retry/concurrency behavior still requires emulator validation. |
| Medium | Cached browser profile selected dashboards without backend session restoration. Tokens were stored without refresh. | Await Firebase persistence, obtain current ID tokens for API calls and fetch authoritative profile; remove application token/profile caches. |
| Medium | Forgot-password flow reported success without sending mail; demo credentials publicly prefilled. | Real Firebase reset and verification messages, blank initial credentials, loading guards. |
| Medium | Next.js page exported Logo, which Next.js forbids; build ignored TypeScript errors. | Shared Logo component across dashboards, remove unsupported export and build-error suppression. There were duplicated Logo implementations, not cross-page imports. |
| Medium | Booking date arithmetic could produce hours above 23 and labeled local input as UTC. | Date arithmetic handles midnight and converts local time to ISO UTC. |
| Medium | Resource updates accepted null and impossible capacity; deleting active resources broke booking references. | Reject invalid updates and prevent deletion with active bookings. |
| Medium | Invalid return condition silently became Good. | Validate Good/Damaged values. |
| Medium | Landing used static sample resources on backend failure and never cleared an empty real list; preferences claimed to save without persistence. | Remove sample resource fallback, respect empty API list, show notification configuration limitation instead of a fake save. |
| Medium | Wildcard CORS with credentials; missing backend dependency manifest. | Configured explicit origins; add backend/requirements.txt. |

The project mismatch, silent database fallback, demo seeding and duplicate-check order are confirmed in the uploaded source/configuration. The exact historical request that produced the reported duplicate message cannot be reconstructed from source alone: no request trace or live database snapshot was provided. It would be inaccurate to claim a specific real email was duplicated or successfully persisted. No SQLite/PostgreSQL registration path was found; registration uses users in Firestore (or formerly its in-memory substitute) plus Firebase Auth.

## Final authentication behavior

- Student Login, Teacher Login and Admin Login are visibly selectable. Selection only controls the attempted flow; /api/auth/me?expected_role=... checks actual server profile role.
- Student Register is the only public registration option, shown under Student Login. Public registration always assigns student, and exact configured college domain is checked on the server.
- Registration creates Firebase Auth identity, marks it for student recovery, and creates users/{uid}. It sends email verification through the client after successful registration. Sign-in resends verification to an unverified user; protected student access is denied until verification and a refreshed token.
- If the Auth account exists but profile creation failed, sign in through Student Login. The server checks the durable Auth student-registration marker and creates only a missing student profile. Existing roles/status are never overwritten. If creation failed before that marker was saved, an administrator must reconcile it manually.
- Teacher/admin registration has no public UI. Authorized admins use POST /api/users/privileged with a teacher/admin request; Firebase Auth and Firestore share the same UID. Passwords are not logged. Teacher/Admin Login routes to the existing respective dashboard component only after server verification.
- Canonical roles are student, teacher, admin. Legacy faculty profile values deserialize as teacher, preserving legitimate existing accounts and UIDs without database migration.
- Invalid, expired, disabled or revoked credentials return 401; missing/invalid/deactivated profiles, role mismatch and insufficient permissions return 403; missing resources return 404; conflicts return 409. Registration duplicates retain the compatible 400 response with a clear message. Profile creation partial failure returns 503. HTTP exceptions include detail and code; validation errors retain FastAPI's structured 422 detail list.
- Firebase SDK manages session persistence and token refresh. Dashboard restoration fetches /me, never local-storage role data. Logout signs out Firebase and clears legacy application caches. There are no separate URL dashboard routes in this project: the existing single-page workspace structure is preserved.

## Windows setup — PowerShell

Unzip the repaired project. Replace the example path below with the actual extracted project root. Use Python 3.11+ and Node.js 20.9+ (Node 24 was used here).

```powershell
cd "C:\Projects\ResourceX-CodeHack-Hackathon-main"
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env.local
```

Configure the copied files before starting. Do not run Copy-Item over an existing working environment file: merge the required settings instead. The package contains example files only.

Backend backend/.env:
- FIREBASE_PROJECT_ID=resourcex-hackathon
- FIREBASE_CREDENTIALS_PATH=credentials/service_account.json (resolved relative to backend)
- ENVIRONMENT=development (never use test for an exposed app)
- COLLEGE_EMAIL_DOMAINS=pcu.edu.in
- REQUIRE_EMAIL_VERIFICATION=true
- CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
- ENABLE_ADMIN_BOOTSTRAP=false and ADMIN_BOOTSTRAP_KEY empty unless bootstrapping.

Put a service-account JSON for resourcex-hackathon at backend/credentials/service_account.json using your local secure workflow. Alternatively clear FIREBASE_CREDENTIALS_PATH and configure Application Default Credentials. Never put that file into frontend/public, Git or a shared ZIP. The original uploaded archive contained a private service-account key: rotate that key in Google Cloud IAM and remove it from any repositories/shared copies where it was included.

Copy the complete Web app configuration for resourcex-hackathon into frontend/.env.local. Set NEXT_PUBLIC_API_URL=http://localhost:8000 and NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN=pcu.edu.in. Obtain apiKey, authDomain, projectId, appId and optional sender/storage fields from the same Firebase app, not mixed projects. These web configuration values are public app identifiers; the Admin private key must never be NEXT_PUBLIC.

Terminal 1, from the project root:
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2:
```powershell
cd "C:\Projects\ResourceX-CodeHack-Hackathon-main\frontend"
npm ci
npm run dev -- --port 3000
```

Open http://localhost:3000 and API docs http://localhost:8000/docs. For a frontend production build use npm run build, then npm run start -- --port 3000. Use one package manager and its lockfile; npm/package-lock.json was validated here. The original pnpm files remain for continuity.

## Firebase Console and secure provisioning

1. Select project resourcex-hackathon. Enable Authentication > Sign-in method > Email/Password. Under Authentication settings, authorize localhost for local development and the deployed host for hosting. Configure verification/reset email templates and inspect spam folders when testing.
2. Create the default Cloud Firestore database in the chosen development project if absent. Ensure the Firebase Auth and Firestore services are enabled. Grant the backend service account only the required Auth management and Firestore data permissions.
3. Deploy firestore.rules through the Console Rules editor (publish the supplied rules). If using an existing Firebase CLI setup, select resourcex-hackathon before deploying. The application reads/writes through FastAPI, so no browser Firestore write allowance is required. Existing single-field indexes cover the simple equality queries inspected; validate supplied firestore.indexes.json for any deployment-specific queries.
4. Create the initial admin using a fresh random bootstrap secret of at least 32 characters. Set ENABLE_ADMIN_BOOTSTRAP=true and ADMIN_BOOTSTRAP_KEY in backend/.env locally. Generate a secret locally, for example with Python secrets.token_urlsafe(48); do not share the result. Run from the project root:

```powershell
.\.venv\Scripts\python.exe -m backend.bootstrap_admin --email "admin@pcu.edu.in" --name "Campus Administrator"
```

The utility prompts privately for the initial password and creates the Auth identity and profile. Immediately restore ENABLE_ADMIN_BOOTSTRAP=false, clear the bootstrap secret and restart the backend. A second bootstrap is refused when any admin exists or system/admin_bootstrap was already claimed. No arbitrary existing account is promoted.
5. Sign in using Admin Login. To create a teacher, use an authenticated POST /api/users/privileged (for example through /docs Authorize with the admin's current Firebase ID token) with a body shaped as below. Use a temporary strong password chosen securely; never paste actual credentials into reports. The current admin dashboard does not add a privileged-provisioning form; the authorized API is the supported workflow.

```json
{"name":"Teacher Name","email":"teacher@pcu.edu.in","password":"<temporary-strong-password>","role":"teacher","department":"CSE"}
```

Use role admin only to create another authorized admin. Ordinary users cannot call this endpoint. Request a password reset through the login form for the newly provisioned account.
6. Partial privileged/bootstrap provisioning intentionally requires administrator reconciliation: inspect the Auth account and users/{auth_uid}; ensure identity, role approval and status are correct before writing the missing profile with a trusted Admin SDK/Console workflow. Do not delete existing accounts or blindly rerun bootstrap. A claimed bootstrap marker may represent a partial failure, not a completed administrator. Before manually resolving it, check all profiles and Auth identities and obtain organizational authorization for the intended admin.
7. For pre-existing orphan profiles, verify the person's identity and intended role first. Create or reconnect the legitimate Auth identity and use its actual UID as profile document ID. Do not re-enable the previous automatic role inference or delete stale records to bypass duplicate checks.

## Validation and evidence limits

Automated checks run:
- python -m pytest backend/tests -q: 48 passed, one third-party Starlette/httpx deprecation warning. Tests explicitly select test environment and mock verified identities/Auth user management. All original 27 tests were retained/adapted for fail-closed profiles, teacher naming and one-time bootstrap; 21 additional parametrized security checks were added.
- Backend compile/import and TestClient lifespan startup: passed in isolated test mode.
- npm run typecheck: passed.
- npm run build: passed using default Turbopack; webpack build also passed after fixing the invalid page export.
- No lint command/configuration exists in the original package, so no lint pass is claimed.

| Required scenario | Evidence / remaining manual step |
|---|---|
| Approved-domain student registration | API tests pass with mocked Auth/in-memory profile. Live Firebase test pending. |
| Auth identity plus Firestore persistence | Auth creation invocation and profile writes tested; actual Console persistence NOT verified. |
| Duplicate registration | Duplicate profile/Auth cases tested; normal duplicates preserved. |
| Student login/dashboard | Server role check tested; real Firebase browser journey pending. |
| Student denied teacher/admin | Backend role-flow and protected-endpoint tests pass; browser URL/storage manipulation test pending. |
| Authorized teacher login | Server teacher role check passes; browser journey pending. |
| Wrong-role teacher login denied | Expected-role checks pass; UI journey pending. |
| Admin login/dashboard | Server role check passes; first-admin creation tested with mock Auth. Live provisioning pending. |
| No public privileged registration | Source inspection: only Student Register; privileged endpoint requires admin. |
| Invalid/expired tokens | Invalid verification mocked; actual SDK call with check_revoked=True asserted. Real token expiry/revocation test pending. |
| Missing profile | Denied without creation; recovery requires trusted server marker; repeat recovery preserves identity. |
| Protected APIs | Ownership, IDOR, role, deactivation and invalid-profile checks pass. |
| Logout/login | SDK signOut and SDK restoration implemented; full browser test pending. |
| Existing features | Resource CRUD, booking overlap/transitions, checkout and returns test suite passes; live concurrent Firestore/emulator and full UI regression pending. |

No live Firebase connection was attempted with the mismatched uploaded service account. Passing mock tests is not proof of Firebase persistence, deployed rules or real email delivery. Run the above matrix in a separate Firebase development project/account set after configuration; do not use real production student accounts for testing.

## Remaining risks and follow-up

- High: Deploy the repaired backend and rules together. Until deployed, the old rules/token bypass remain exploitable. Review existing role records and audit histories for unauthorized edits; repair only with verified account ownership and role approval.
- High: Live Firestore transactional retries, concurrency, rules enforcement and multi-document lifecycle must still be exercised against the emulator/development Firebase. Unit tests do not simulate network failures or SDK retry conflicts.
- Medium: Public signup/bootstrap/recovery require deployment-level rate limits and abuse monitoring. App Check/captcha and password-policy hardening are optional deployment protections, not implemented here.
- Medium: Resources use exclusive scheduling even when quantity > 1. Capacity-aware scheduling and simultaneous inventory counts need a separately defined product policy; this repair does not redesign them.
- Medium: Profile preferences/notification delivery are not implemented; UI now states this. AI recommendations, push/email booking notifications and per-role URL routes were not present as complete supported flows and were not invented during this repair.
- Medium: Full browser visual/responsive regression and real verification/reset emails remain manual. No screenshot or browser pass is claimed.
- Low: Dependency ranges need continuing vulnerability monitoring. The single test deprecation warning is external to application behavior.

References used for SDK behavior: https://firebase.google.com/docs/auth/admin/verify-id-tokens and https://firebase.google.com/docs/auth/admin/manage-sessions .

## Changed files

- `backend/.env.example`
- `backend/app/config.py`
- `backend/app/core/dependencies.py`
- `backend/app/firebase.py`
- `backend/app/main.py`
- `backend/app/models/booking.py`
- `backend/app/models/user.py`
- `backend/app/routers/auth_router.py`
- `backend/app/routers/resources_router.py`
- `backend/app/routers/users_router.py`
- `backend/app/services/booking_service.py`
- `backend/app/services/resource_service.py`
- `backend/app/services/user_service.py`
- `backend/bootstrap_admin.py`
- `backend/requirements.txt`
- `backend/tests/conftest.py`
- `backend/tests/test_auth.py`
- `backend/tests/test_security_repair.py`
- `firestore.rules`
- `frontend/app/page.tsx`
- `frontend/components/AdminDashboard.tsx`
- `frontend/components/FacultyDashboard.tsx`
- `frontend/components/Logo.tsx`
- `frontend/components/StudentDashboard.tsx`
- `frontend/lib/api.ts`
- `frontend/lib/firebase.ts`
- `frontend/next.config.mjs`
- `frontend/package-lock.json`
- `frontend/package.json`

Auth/config/router/model/service changes implement the fixes above. Frontend changes replace mock login, restore Firebase sessions, add the three role choices and correct build/date/empty-state defects. Tests inject mock identities only inside pytest and add security regressions. Example environments explain safe setup. Dependency manifests make local installation reproducible.
- `README.md`: replace obsolete demo/unsafe setup instructions.
- `AUDIT_AND_SETUP.md`: complete audit, repair and validation record.
