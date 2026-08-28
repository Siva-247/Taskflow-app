# TaskFlow

A multi-department task-management system built around a real organizational hierarchy: **Admin → Manager → Team Lead → Employee/Intern/Developer**. Every account is created by the person directly above it, every task creation is checked before it goes live, and every permission is enforced on the server — not just hidden in the UI.

## 1. Overview

TaskFlow supports any number of departments (AI, Finance, Marketing, or anything an Admin creates) with the exact same code path. No department, team, or person is hardcoded — everything is driven by the database.

Core workflow: a task moves through **Draft → Pending Approval → To Do → In Progress → Submitted for Review → Completed**, with a due-date extension flow, grading, daily work updates, and a notification system layered on top.

## 2. Architecture

**Frontend** — React 18 + Vite, React Router (`HashRouter`), Context API for all shared state (no Redux/MobX). No CSS framework — inline styles.

**Backend** — Node.js + Express, SQLite via `better-sqlite3` (raw SQL, no ORM), `bcryptjs` for password hashing.

**Auth** — Email + password, bcrypt-hashed, HMAC-SHA256-signed session tokens (12-hour expiry, stateless — no session table). No third-party auth provider.

```
src/                      Frontend (React)
  pages/                  One file per route/screen
  components/             Shared UI (Layout, Sidebar, Header, ui.jsx primitives)
  context/AppContext.jsx  All shared state + every API call
  data/mockData.js        Frontend-side constants (ROLES, STATUS, PRIORITY) — not a data source
backend/
  routes/                 One file per resource (auth, users, teams, departments, tasks, ...)
  database/               schema.sql, db.js (connection + statement cache), seed.js, migrate-*.mjs, setup-admin.mjs
  auth/                   passwords.js (bcrypt), tokens.js (HMAC sessions)
  middleware/auth.js      requireAuth / requireRole
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

Runs on `http://localhost:4000` by default. **Use `node server.js` directly rather than `npm start`** — on this project's Windows/Node/better-sqlite3 combination, the extra `npm`→`cmd.exe` process layer occasionally trips a native cleanup crash on exit; running `node` directly avoids it. If a start attempt ever crashes immediately on launch, just retry it once — the crash is a shutdown-timing race, not a code defect, and a fresh attempt reliably starts clean.

## 5. Database Setup

The SQLite file is created automatically on first run (`backend/database/taskflow.db`), with the schema in `schema.sql` and the AI department seeded via `seed.js`. No manual migration step is needed for a fresh install — `migrate-*.mjs` files under `backend/database/` are historical, one-off scripts already applied to this database and are kept only as a record of schema evolution.

## 6. Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in real values as needed:

| Variable | Purpose | Required? |
|---|---|---|
| `PORT` | API port | No — defaults to 4000 |
| `TASKFLOW_SESSION_SECRET` | Signs session tokens | **Yes, for any real deployment** — the built-in fallback is a public, well-known dev value |
| `DATABASE_PATH` | Where the SQLite file lives | No — defaults next to the source |
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

Serve `dist/` as static files behind whatever web server you use, and run `node backend/server.js` as a long-lived process (with a real `.env` — see §6). Set `DATABASE_PATH` to a persistent volume if your hosting environment doesn't keep the filesystem between deploys.

## 16. Complete Testing Workflow

See **[TESTING_GUIDE.md](TESTING_GUIDE.md)** for demo credentials and a full, ordered, click-by-click test script covering Admin → Manager → Team Lead → Employee across two independent departments.

## Troubleshooting

- **Backend crashes immediately on startup** with a native `Statement::\`scalar deleting destructor'` error — this is a known Windows/Node/better-sqlite3 shutdown-timing race unrelated to any code change. Just run `node server.js` again.
- **"Could not reach the backend server"** in the UI — the backend isn't running, or is running on a different port than the frontend expects (`http://localhost:4000`, hardcoded in `src/context/AppContext.jsx`).
- **Forgot-password shows a token on screen instead of sending an email** — expected without SMTP configured; see §6.
