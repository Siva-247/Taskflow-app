import { randomUUID } from 'node:crypto';
import { prepare } from './db.js';
import { TODAY } from './constants.js';

export async function getTask(taskId) {
  const task = await prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  const subtasks = (await prepare('SELECT id, title, done FROM task_subtasks WHERE task_id = ? ORDER BY seq ASC')
    .all(taskId)).map((s) => ({ ...s, done: !!s.done }));
  const comments = await prepare('SELECT id, author_id as "authorId", text, created_at as "createdAt" FROM comments WHERE task_id = ? ORDER BY seq ASC').all(taskId);
  const activityLog = await prepare('SELECT id, text, at FROM activity_logs WHERE task_id = ? ORDER BY seq ASC').all(taskId);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    instructions: task.instructions,
    teamId: task.team_id,
    assigneeId: task.assignee_id,
    priority: task.priority,
    status: task.status,
    progress: task.progress,
    startDate: task.start_date,
    dueDate: task.due_date,
    estimatedEffort: task.estimated_effort,
    category: task.category,
    createdBy: task.created_by,
    marks: task.marks,
    requestedDueDate: task.requested_due_date,
    extensionReason: task.extension_reason,
    subtasks,
    comments,
    activityLog,
  };
}

export async function getGlobalActivity() {
  return prepare('SELECT id, type, text, team_id as "teamId", at FROM activity_logs WHERE type IS NOT NULL ORDER BY seq DESC LIMIT 30').all();
}

export async function insertTaskEvent(taskId, text) {
  await prepare('INSERT INTO activity_logs (id, task_id, type, text, team_id, at) VALUES (?, ?, NULL, ?, NULL, ?)')
    .run(`ev-${randomUUID()}`, taskId, text, TODAY);
}

export async function insertGlobalActivity(type, text, teamId) {
  await prepare('INSERT INTO activity_logs (id, task_id, type, text, team_id, at) VALUES (?, NULL, ?, ?, ?, ?)')
    .run(`act-${randomUUID()}`, type, text, teamId || null, String(Date.now()));
}

export async function userName(userId) {
  const row = await prepare('SELECT name FROM users WHERE id = ?').get(userId);
  return row?.name || 'Someone';
}

// Never notifies someone about their own action — e.g. a lead who is also
// the assignee shouldn't get a "you were assigned" notification for their own task.
export async function insertNotification(userId, actorId, type, text, taskId) {
  if (!userId || userId === actorId) return;
  await prepare('INSERT INTO notifications (id, user_id, type, text, task_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
    .run(`note-${randomUUID()}`, userId, type, text, taskId, TODAY);
}

export async function teamLeadId(teamId) {
  const row = await prepare('SELECT lead_id FROM teams WHERE id = ?').get(teamId);
  return row?.lead_id || null;
}

export async function managerIdForDepartment(teamId) {
  const team = await prepare('SELECT department_id FROM teams WHERE id = ?').get(teamId);
  if (!team) return null;
  const manager = await prepare("SELECT id FROM users WHERE role = 'manager' AND department_id = ?").get(team.department_id);
  return manager?.id || null;
}

export function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}

export function initialsOf(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export async function uniqueUserId(name) {
  const base = slugify(name) || 'member';
  let id = base;
  let n = 1;
  while (await prepare('SELECT 1 FROM users WHERE id = ?').get(id)) {
    n += 1;
    id = `${base}-${n}`;
  }
  return id;
}

export async function uniqueTeamId(name) {
  const base = slugify(name) || 'team';
  let id = base;
  let n = 1;
  while (await prepare('SELECT 1 FROM teams WHERE id = ?').get(id)) {
    n += 1;
    id = `${base}-${n}`;
  }
  return id;
}

// Mirrors the frontend's scopedTasks/scopedDailyUpdates exactly, but applied
// server-side so a role's visibility rules hold even for direct API calls,
// not just what the UI chooses to render.
export async function scopeTasks(user, allTasks) {
  if (user.role === 'admin') return allTasks;
  if (user.role === 'manager') {
    const teamRows = await prepare('SELECT id FROM teams WHERE department_id = ?').all(user.department_id);
    const teamIds = teamRows.map((t) => t.id);
    return allTasks.filter((t) => teamIds.includes(t.teamId));
  }
  if (user.role === 'team_lead') return allTasks.filter((t) => t.teamId === user.team_id);
  if (user.role === 'employee') return allTasks.filter((t) => t.assigneeId === user.id);
  return [];
}

// The company directory (GET /api/users) is scoped to one's own department —
// needed so a manager/team lead/employee can still resolve names for their
// own manager, team lead, and department colleagues, while another
// department's roster (and admin, who isn't tied to a department) never
// appears in the response at all.
export function scopeUsers(user, allUsers) {
  if (user.role === 'admin') return allUsers;
  return allUsers.filter((u) => u.departmentId === user.department_id);
}

// Same department-only rule as scopeUsers — a team's name/lead is
// department-internal directory info, not something another department's
// manager should see just by calling the API directly.
export function scopeTeams(user, allTeams) {
  if (user.role === 'admin') return allTeams;
  return allTeams.filter((t) => t.departmentId === user.department_id);
}

export async function scopeDailyUpdates(user, allUpdates) {
  if (user.role === 'admin') return allUpdates;
  if (user.role === 'employee') return allUpdates.filter((u) => u.userId === user.id);

  const userIds = [...new Set(allUpdates.map((u) => u.userId))];
  if (userIds.length === 0) return [];
  const placeholders = userIds.map((_, i) => `?`).join(', ');
  const rows = await prepare(`SELECT id, team_id, department_id FROM users WHERE id IN (${placeholders})`).all(...userIds);
  const infoById = new Map(rows.map((r) => [r.id, r]));

  if (user.role === 'manager') return allUpdates.filter((u) => infoById.get(u.userId)?.department_id === user.department_id);
  if (user.role === 'team_lead') return allUpdates.filter((u) => infoById.get(u.userId)?.team_id === user.team_id);
  return [];
}

// Whether `user` (a DB row) is allowed to view/comment on `task` (a raw
// tasks-table row) — the same rule scopeTasks applies to a list, applied to one row.
export async function userCanAccessTask(user, task) {
  if (user.role === 'admin') return true;
  if (user.role === 'manager') {
    const team = await prepare('SELECT department_id FROM teams WHERE id = ?').get(task.team_id);
    return Boolean(team && team.department_id === user.department_id);
  }
  if (user.role === 'team_lead') return task.team_id === user.team_id;
  if (user.role === 'employee') return task.assignee_id === user.id;
  return false;
}

// Whether `reviewer` (a DB row) may approve/request-changes on `task` (a raw
// tasks-table row) — admin, the task's own team lead, or the department manager.
export async function userCanReview(reviewer, task) {
  if (reviewer.role === 'admin') return true;
  if (reviewer.role === 'team_lead') return task.team_id === reviewer.team_id;
  if (reviewer.role === 'manager') {
    const team = await prepare('SELECT department_id FROM teams WHERE id = ?').get(task.team_id);
    return Boolean(team && team.department_id === reviewer.department_id);
  }
  return false;
}

// Whether `approver` may approve/reject a newly-created task that's waiting
// on manager sign-off (Pending Approval) — the department manager, or admin.
// Deliberately NOT the team lead: a team lead's own task creations are
// exactly what this gate checks, so they can't be the one clearing it.
export async function userCanApproveCreation(approver, task) {
  if (approver.role === 'admin') return true;
  if (approver.role === 'manager') {
    const team = await prepare('SELECT department_id FROM teams WHERE id = ?').get(task.team_id);
    return Boolean(team && team.department_id === approver.department_id);
  }
  return false;
}

// Confirms `creator` (team_lead or manager) may assign a task to `assigneeId`,
// and returns the team the task belongs to. Used by both task creation and
// draft edits so the rule can't be bypassed by editing a draft's assignee.
export async function validateAssignee(creator, assigneeId) {
  const assignee = await prepare('SELECT * FROM users WHERE id = ?').get(assigneeId);
  if (!assignee || assignee.role !== 'employee') return { ok: false, error: 'Invalid assignee' };
  if (!assignee.is_active) return { ok: false, error: 'This person\'s account has been deactivated' };
  // An employee can only ever create a task for themselves — never assign
  // work to a teammate, which stays a team lead/manager privilege.
  if (creator.role === 'employee' && assigneeId !== creator.id) {
    return { ok: false, error: 'You can only create tasks for yourself' };
  }
  if (creator.role === 'team_lead' && assignee.team_id !== creator.team_id) {
    return { ok: false, error: 'You can only assign tasks to your own team' };
  }
  if (creator.role === 'manager' && assignee.department_id !== creator.department_id) {
    return { ok: false, error: 'You can only assign tasks within your department' };
  }
  const teamId = creator.role === 'team_lead' ? creator.team_id : assignee.team_id;
  return { ok: true, teamId };
}
