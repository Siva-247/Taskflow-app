# TaskFlow

A multi-department task-management system built around a real organizational hierarchy: **Admin → Manager → Team Lead → Employee/Intern/Developer**. Every account is created by the person directly above it, every task creation is checked before it goes live, and every permission is enforced on the server — not just hidden in the UI.

## 1. Overview

TaskFlow supports any number of departments (AI, Finance, Marketing, or anything an Admin creates) with the exact same code path. No department, team, or person is hardcoded — everything is driven by the database.

Core workflow: a task moves through **Draft → Pending Approval → To Do → In Progress → Submitted for Review → Completed**, with a due-date extension flow, grading, daily work updates, and a notification system layered on top.

## 2. Architecture

**Frontend** — React 18 + Vite, React Router (`HashRouter`), Context API for all shared state (no Redux/MobX). No CSS framework — inline styles.

**Backend** — Node.js + Express, Postgres via `pg` (raw SQL, no ORM), hosted on Supabase, `bcryptjs` for password hashing.

**Auth** — Email + password, bcrypt-hashed, HMAC-SHA256-signed session tokens (12-hour expiry, stateless — no session table). No third-party auth provider.

```
src/                      Frontend (React)
  pages/                  One file per route/screen
  components/             Shared UI (Layout, Sidebar, Header, ui.jsx primitives)
  context/AppContext.jsx  All shared state + every API call
  data/mockData.js        Frontend-side constants (ROLES, STATUS, PRIORITY) — not a data source
backend/
  routes/                 One file per resource (auth, users, teams, departments, tasks, ...)
  database/               schema.postgres.sql, db.js (Postgres pool + query shim), seed.js, migrate-*.mjs
  auth/                   passwords.js (bcrypt), tokens.js (HMAC sessions)
  middleware/auth.js      requireAuth / requireRole
  middleware/asyncRoute.js  Wraps every async handler so Express 4 catches rejected promises
  email/mailer.js         Optional SMTP for real password-reset emails
```

## 3. Frontend Setup

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173` by default.

## 4. Backend Setup

```bash
cd backend
npm install
node server.js
```

Runs on `http://localhost:4000` by default. Requires `DATABASE_URL` to be set (see §6) — the server refuses to start without it.

## 5. Database Setup

TaskFlow runs on Postgres (Supabase in production), not a local file — there's no "database appears automatically" step anymore. For a fresh Postgres database:

```bash
cd backend
npm run migrate:schema   # creates every table (safe to re-run, uses IF NOT EXISTS)
npm run seed              # populates the original AI-department demo data — only runs if the database is empty
```

`backend/database/migrate-data-to-postgres.mjs` is a one-time script used specifically to move this project's real historical data out of the old local SQLite file and into Postgres — not something a fresh setup needs. `migrate-*.mjs` files with SQLite-only logic are historical, already-applied one-off scripts kept as a record of schema evolution before this migration.

## 6. Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in real values as needed:

| Variable | Purpose | Required? |
|---|---|---|
| `PORT` | API port | No — defaults to 4000 |
| `TASKFLOW_SESSION_SECRET` | Signs session tokens | **Yes, for any real deployment** — the built-in fallback is a public, well-known dev value |
| `DATABASE_URL` | Postgres connection string (Supabase or any Postgres host) | **Yes — the server won't start without it.** Use Supabase's "Session pooler" string, not "Direct connection" (the direct host is IPv6-only and won't resolve on most networks) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Send real password-reset emails | No — without these, reset links show on-screen instead (clearly labeled "Dev mode") |
| `APP_URL` | Base URL used to build the reset-email link | No — defaults to `http://localhost:5173` |

Never commit `.env` or real credentials — `.env.example` holds placeholders only.

## 7. Running Locally

1. Start the backend (`cd backend && node server.js`).
2. Start the frontend (`npm run dev` from the project root).
3. Open `http://localhost:5173`.

## 8. Creating/Seeding Demo Accounts

The AI department is seeded automatically. Two more departments — **Finance** and **Marketing** — exist as permanent, fully-cascaded demo data (Manager → Team Lead → Employee → Intern each), created through the real application flow, not raw database inserts. See **[TESTING_GUIDE.md](TESTING_GUIDE.md)** for every login.

The one Admin account is deliberately **not** created through Sign Up — see the next section — and must be provisioned with:

```bash
cd backend
node database/setup-admin.mjs admin@yourcompany.com "a-strong-password"
```

This refuses to run a second time once an admin is already set up.

## 9. Authentication

- **Login**: email + password only. There is no role picker, no persona list — the account's real role/department/team come from the database and are re-verified on every request.
- **Sign Up**: TaskFlow is a closed roster. Signing up never creates a new person — it "claims" an existing, pre-seeded, unclaimed identity by matching **name + role + department**. Unknown names, wrong roles, and wrong departments are all rejected with a specific message telling the person what's actually on file. Admin is never a selectable role here, and a crafted API request with `role: "admin"` is rejected outright by the backend regardless of what the client sends.
- **Sessions**: a signed token (12-hour expiry) restores your session on refresh via `GET /api/auth/me`, which re-checks your live role/department/active status every time — a deactivated account or a role change takes effect immediately, without waiting for the token to expire.
- **Forced password change**: any account onboarded with a temporary password (or that just reset its password) must set a permanent one before reaching its dashboard — this can't be bypassed by typing a dashboard URL directly.
- **Forgot/reset password**: always returns the same generic response regardless of whether the email exists. A real SMTP config sends an actual email; without one, the reset link is shown on-screen, clearly labeled as a dev-mode stand-in.

## 10. Organization Hierarchy

```
Admin  (one account, provisioned out-of-band — never public signup)
  └─ creates → Manager        (assigned to one department)
       └─ creates → Team Lead  (+ a brand-new team for them to run, in the manager's own department)
            └─ creates → Employee / Intern / Developer  (on the team lead's own team)
```

Every creation step ignores any department/team ID the client tries to send and derives it from the authenticated creator instead — a Team Lead cannot plant someone on another team by editing a request, even deliberately.

New accounts get a randomly generated temporary password, shown exactly once to whoever created them (never emailed — hand it off directly), and must change it on first login.

## 11. Roles and Permissions

| | Admin | Manager | Team Lead | Employee |
|---|---|---|---|---|
| Sees | Everything | Own department | Own team | Own work only |
| Creates | Managers | Team Leads (+ team) | Employees/Interns | Their own tasks |
| Approves task creation | Yes, anywhere | Yes, own department | No — never their own creations | No |
| Reviews/approves submitted work | Yes, anywhere | Yes, own department | Yes, own team | No |
| Reassigns tasks | Yes, anywhere | Own department | Own team | No |
| Grades | Yes | Own department | Own team | No — never their own work |
| Activates/deactivates accounts | Anyone | Own department (not other managers/admins) | Own team (employees only) | No |

Every rule above is enforced in the backend, independent of what the frontend shows — see `backend/database/helpers.js` for the authorization functions (`scopeTasks`, `scopeUsers`, `scopeTeams`, `userCanReview`, `userCanApproveCreation`, `validateAssignee`).

## 12. Task Lifecycle

```
Draft → Pending Approval → To Do → In Progress → Submitted for Review → Completed
              ↑                                          │
              └──────────── sent back ───────────────────┘ (reviewer requests changes → In Progress instead)
```

- A **Manager**-created task skips straight to `To Do` — nobody above a Manager needs to check their own creation.
- A **Team Lead** or **Employee**-created task goes to `Pending Approval` first; only the department Manager (or Admin) can approve it into `To Do` or send it back to `Draft`.
- Once active, the assignee can request a **due-date extension** (must be later than the current date, requires a reason); the same reviewer who'd approve their work approves or declines it.
- A task can be **reassigned** by anyone who could review it (never the assignee themselves) — the previous assignee immediately loses control, the new one is notified.
- **Marks** (0–100) can only be given once work is `Submitted for Review` or `Completed`.

## 13. Notifications

Delivered via 20-second polling (`GET /api/notifications`) — not a live push channel, and the app doesn't claim otherwise. Every meaningful event notifies the right person, computed server-side: task assigned/reassigned/submitted/approved, changes requested, marked, comment added, extension requested/approved/rejected, and manager/team-lead appointment.

## 14. Reports

Scope-aware CSV export (Admin: company-wide, Manager: own department, Team Lead: own team) reflecting whatever filters are currently applied — status, team, and due-date range.

## 15. Deployment

```bash
npm install && npm run build   # frontend — outputs to dist/
cd backend && npm install      # backend has no build step, it's plain Node
```

Serve `dist/` as static files behind whatever web server you use, and run `node backend/server.js` as a long-lived process (with a real `.env` — see §6). Because the database is Postgres (Supabase), not a local file, runtime data survives every redeploy automatically — there's no persistent-disk requirement on the hosting side at all.

## 16. Complete Testing Workflow

See **[TESTING_GUIDE.md](TESTING_GUIDE.md)** for demo credentials and a full, ordered, click-by-click test script covering Admin → Manager → Team Lead → Employee across two independent departments.

## Troubleshooting

- **Backend exits immediately with `DATABASE_URL is not set`** — copy `.env.example` to `.env` and fill in a real Postgres connection string; see §6.
- **Connecting to Supabase fails with `ENOTFOUND db.xxxx.supabase.co`** — that's Supabase's "Direct connection" host, which is IPv6-only and won't resolve on most networks. Use the "Session pooler" connection string instead (Supabase dashboard → Connect → Direct tab → Session pooler).
- **"Could not reach the backend server"** in the UI — the backend isn't running, or `VITE_API_BASE_URL` (production) / the hardcoded `localhost:4000` fallback (dev) doesn't match where it's actually listening.
- **Forgot-password shows a token on screen instead of sending an email** — expected without SMTP configured; see §6.
