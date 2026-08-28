# TaskFlow — Testing Guide

No developer knowledge required. Every account below already exists in the database — just sign in with the email and password shown, at `http://localhost:5173`.

## Login Credentials

| Account | Email | Password | Role | Department | Team |
|---|---|---|---|---|---|
| Admin | `admin@taskflow.com` | `AdminPass123` | Admin | — | — |
| Finance Manager | `finance.manager@taskflow-demo.com` | `Demo@1234` | Manager | Finance | — |
| Finance Team Lead | `finance.lead@taskflow-demo.com` | `Demo@1234` | Team Lead | Finance | Finance Team |
| Finance Employee 1 | `finance.employee1@taskflow-demo.com` | `Demo@1234` | Employee (Developer) | Finance | Finance Team |
| Finance Intern 1 | `finance.intern1@taskflow-demo.com` | `Demo@1234` | Employee (Intern) | Finance | Finance Team |
| Marketing Manager | `marketing.manager@taskflow-demo.com` | `Demo@1234` | Manager | Marketing | — |
| Marketing Team Lead | `marketing.lead@taskflow-demo.com` | `Demo@1234` | Team Lead | Marketing | Marketing Team |
| Marketing Employee 1 | `marketing.employee1@taskflow-demo.com` | `Demo@1234` | Employee (Developer) | Marketing | Marketing Team |
| Marketing Intern 1 | `marketing.intern1@taskflow-demo.com` | `Demo@1234` | Employee (Intern) | Marketing | Marketing Team |

The **AI department** (Thamilarasu → Santhosh/Hari → their developers and interns) is TaskFlow's original seeded organization. Those accounts exist in the database but haven't been claimed with a password — to sign in as one of them, use **Sign Up** on the login page with their exact name, correct role, and "AI Department," then set your own password. This is intentional: it's the same claim flow a real new hire would go through.

---

## Test Sequence

Each numbered step names which account to use. Steps 1–9 build a new department end-to-end (**Sales**, so it's obviously separate from the pre-built Finance/Marketing demo data); steps 10–22 walk one task through its entire life.

### Part A — Build a department from scratch (proves the system isn't AI-specific)

1. **Login as Admin.** Confirm the dashboard shows company-wide numbers (all departments, all employees, all tasks) and there is no role picker anywhere.
2. Go to **Departments** → **Add department** → name it `Sales`. It appears immediately, no restart needed.
3. On the new Sales card, click **+ Add manager** → name `Sales Manager`, any email. A temporary password is shown **once** — copy it.
4. **Logout.** **Login** with that email + temporary password. You're forced to **Change Password** before anything else loads.
5. After setting a new password, confirm you land on a **Manager dashboard** showing only Sales (0 teams, 0 employees, 0 tasks) — not AI, not Finance, not Marketing.
6. Go to **Teams** → **Add team lead** → name a team (e.g. `Sales Development Team`) and a person (e.g. `Sales Team Lead`), any email. Another one-time temporary password appears.
7. **Logout. Login** as the new Team Lead with that temp password → forced password change → lands on a **Team Lead dashboard** for that one new team.
8. Go to **My Team** → **Add team member** → create one Developer and one Intern. Temporary passwords shown once each.
9. **Logout. Login** as the new Employee (temp password → forced change) → confirm the **Employee dashboard** shows zero tasks and no management options at all (no Create Team, no Reports, no Approvals).

### Part B — A task's complete life (use the pre-built Finance accounts)

10. **Login as Finance Team Lead.** Go to **Create Task**, assign it to **Finance Employee 1**, save it. Confirm the task lands in **Pending Approval** — the employee cannot act on it yet.
11. **Logout. Login as Finance Manager.** Go to **Approvals** — the new task is listed. Open it and click **Approve**. Status becomes **To Do**.
12. **Logout. Login as Finance Employee 1.** Open the task from **My Tasks** — it's now workable. Move the progress slider, click **Save progress**, then **Submit for review**.
13. **Logout. Login as Finance Team Lead.** Open the task (or use **Reviews** in the sidebar) → **Approve**, or **Request changes** to send it back.
14. On the same task, give it **Marks** (0–100) — only possible now that it's been submitted.
15. **Verify notifications**: log back in as Finance Employee 1 — the notification bell should show the approval and the marks.
16. **Verify dashboard updates**: the Employee dashboard's completed/average-marks numbers reflect the change immediately (no manual refresh trick needed).
17. **Login as Finance Manager** → **Reports** → filter by status/team/date, confirm the numbers match, then export CSV and confirm the file contains real rows for real people, not placeholders.
18. **Verify access restrictions**: while still logged in as Finance Manager, confirm Marketing's department, teams, employees, and tasks are **nowhere** visible — not in Employees, not in Teams, not in Reports.
19. **Logout**, then try navigating directly to `#/reports` or `#/employees` in the address bar — you should land back on the Sign In page, not a blank screen.
20. **Login again** as any account from step 10–17 — the session should restore correctly with the right dashboard, not a flash of the wrong one.
21. **Refresh the browser** on any authenticated page — you should stay logged in, on the same page, not bounced to Sign In.
22. Try a direct URL for a page outside your role (e.g. an Employee typing `#/departments`) — you should be redirected, never shown the page's real content.

### Part C — Cross-department isolation (the critical test)

23. **Login as Finance Manager** — confirm you see Finance only.
24. **Login as Marketing Manager** — confirm you see Marketing only, and specifically that Finance is invisible.
25. **Login as Finance Team Lead** — confirm only the Finance Team is visible, not Marketing's team.
26. **Login as Marketing Employee 1** — confirm only their own tasks are visible; attempting to open another employee's task URL directly (copy a task ID from Finance and paste it into the address bar) returns "Task not found," not the task's real content.

---

## What "done" looks like

- No step above ever shows a blank page or an unhandled error.
- Every "Logout" genuinely ends the session — the back button never reveals a protected page afterward.
- Every number on every dashboard reflects real, current database state — refreshing never resets or loses anything.
- Finance and Marketing never see each other's data, in the UI or by guessing a URL/ID.
