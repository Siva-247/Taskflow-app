import { prepare } from './db.js';
import { STATUS } from './constants.js';

// Fixed id for the one Super Admin row — never created twice, never
// resolved by email lookup at auth time (see routes/auth.js), only ever
// referenced by this constant so every call site stays in sync.
export const SUPER_ADMIN_ID = 'super-admin';

// Cascading rank order, most senior first. This is the single source of
// truth for "who outranks whom" — every authorization decision in the app
// should route through rankIndex()/canManage()/etc. below rather than
// re-deriving a role comparison inline.
export const RANKS = ['super_admin', 'admin', 'manager', 'assistant_manager', 'team_lead', 'employee'];

// An unrecognized role resolves to one rank BELOW the lowest real one —
// strictly lower authority than even 'employee' — so every comparison built
// on this (rank > X, rank < X) is deny-by-default for anything that isn't a
// known role. A bare `RANKS.indexOf(role)` would return -1 for an unknown
// role, which sorts as MORE senior than everyone (a privilege-escalation
// bug), not less — this function exists specifically to close that off.
export function rankIndex(role) {
  const i = RANKS.indexOf(role);
  return i === -1 ? RANKS.length : i;
}

async function departmentIdOfTeam(teamId) {
  const team = await prepare('SELECT department_id FROM teams WHERE id = ?').get(teamId);
  return team?.department_id || null;
}

// Broad, cascading "who may manage whom" — every rank manages everyone
// strictly below it in the chain, scoped to their own team
// (assistant_manager/team_lead) or department (manager), unrestricted for
// admin/super_admin. This is the single source of truth for credential
// edits and anywhere else "can actor manage target" needs an answer.
export function canManage(actor, target) {
  if (!actor || !target) return false;
  if (actor.id === target.id) return false;
  if (target.role === 'super_admin') return false;
  if (actor.role === 'super_admin') return true;
  if (actor.role === 'admin') return target.role !== 'admin';
  if (actor.role === 'manager') {
    return rankIndex(target.role) > rankIndex(actor.role) && target.department_id === actor.department_id;
  }
  if (actor.role === 'assistant_manager' || actor.role === 'team_lead') {
    return rankIndex(target.role) > rankIndex(actor.role) && target.team_id === actor.team_id;
  }
  return false;
}

// Whether `user` may view/comment on `task` — same scope shape as
// canManage, applied to a task's team instead of a person.
export async function canAccessTask(user, task) {
  if (user.role === 'super_admin' || user.role === 'admin') return true;
  if (user.role === 'manager') {
    const deptId = await departmentIdOfTeam(task.team_id);
    return Boolean(deptId && deptId === user.department_id);
  }
  if (user.role === 'assistant_manager' || user.role === 'team_lead') return task.team_id === user.team_id;
  if (user.role === 'employee') return task.assignee_id === user.id;
  return false;
}

// Whether `actor` may edit or delete a PUBLISHED task directly (not via the
// dedicated status-transition endpoints, which are ownership-only and
// unaffected by any of this). A draft stays owner-only, same as today —
// nobody else, not even admin, edits someone else's draft. Published tasks
// add: the creator, admin/super_admin, or a manager/assistant_manager whose
// scope covers the task's team. Team leads and employees can review/work a
// task but never directly edit/delete it, same distinction as today.
export async function canManageTask(actor, task) {
  const isOwner = actor.id === task.created_by;
  if (task.status === STATUS.DRAFT) return isOwner;
  if (isOwner) return true;
  if (actor.role === 'super_admin' || actor.role === 'admin') return true;
  if (actor.role === 'manager') {
    const deptId = await departmentIdOfTeam(task.team_id);
    return Boolean(deptId && deptId === actor.department_id);
  }
  if (actor.role === 'assistant_manager') return task.team_id === actor.team_id;
  return false;
}

// Whether `reviewer` may approve/request-changes/reassign/grade `task` —
// admin/super_admin always; manager if the task's team is in their
// department; assistant_manager/team_lead if it's their own team.
export async function canReviewTask(reviewer, task) {
  if (reviewer.role === 'super_admin' || reviewer.role === 'admin') return true;
  if (reviewer.role === 'manager') {
    const deptId = await departmentIdOfTeam(task.team_id);
    return Boolean(deptId && deptId === reviewer.department_id);
  }
  if (reviewer.role === 'assistant_manager' || reviewer.role === 'team_lead') return task.team_id === reviewer.team_id;
  return false;
}

// Whether `approver` may approve/reject a task that's waiting on
// creation-approval sign-off. Same authority as canReviewTask, minus ever
// rubber-stamping your own creation (generalized from today's team-lead-only
// self-check — harmless for admin/manager since their own creations never
// enter Pending Approval in the first place, per needsCreationApproval).
export async function canApproveCreationTask(approver, task) {
  if (task.created_by === approver.id) return false;
  return canReviewTask(approver, task);
}

// Narrow, notification-only: walks the team's REAL staffing to find the
// single nearest present reviewer above the submitter, falling back up the
// chain (team_lead -> assistant_manager -> department manager -> any admin
// -> the Super Admin) whenever a rung is vacant. Deliberately separate from
// canManage/canReviewTask above — those decide who's ALLOWED to act (broad,
// cascading, "anyone senior enough"); this decides who gets notified/named
// as the primary reviewer (narrow, "the one nearest person"), so a 6-tier
// chain doesn't spam every present rung on every action. `submitterRank` is
// a rankIndex() number, not a role string.
export async function resolveReviewer(teamId, submitterRank) {
  const team = await prepare('SELECT department_id, lead_id, assistant_manager_id FROM teams WHERE id = ?').get(teamId);
  if (!team) return SUPER_ADMIN_ID;

  if (submitterRank > rankIndex('team_lead') && team.lead_id) return team.lead_id;
  if (submitterRank > rankIndex('assistant_manager') && team.assistant_manager_id) return team.assistant_manager_id;
  if (submitterRank > rankIndex('manager')) {
    const manager = await prepare("SELECT id FROM users WHERE role = 'manager' AND department_id = ?").get(team.department_id);
    if (manager?.id) return manager.id;
  }
  const admin = await prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (admin?.id) return admin.id;
  return SUPER_ADMIN_ID;
}

// Mirrors the frontend's scopedTasks exactly, applied server-side so a
// role's visibility rules hold for direct API calls too, not just what the
// UI chooses to render.
export async function scopeTasks(user, allTasks) {
  if (user.role === 'super_admin' || user.role === 'admin') return allTasks;
  if (user.role === 'manager') {
    const teamRows = await prepare('SELECT id FROM teams WHERE department_id = ?').all(user.department_id);
    const teamIds = teamRows.map((t) => t.id);
    return allTasks.filter((t) => teamIds.includes(t.teamId));
  }
  if (user.role === 'assistant_manager' || user.role === 'team_lead') return allTasks.filter((t) => t.teamId === user.team_id);
  if (user.role === 'employee') return allTasks.filter((t) => t.assigneeId === user.id);
  return [];
}

// The company directory is scoped to one's own department — directory
// visibility, not hierarchy authority, so this stays "admin/super_admin see
// everyone, everyone else sees their own department" rather than following
// the narrower team-scoping canManage uses for assistant_manager/team_lead.
export function scopeUsers(user, allUsers) {
  if (user.role === 'super_admin' || user.role === 'admin') return allUsers;
  return allUsers.filter((u) => u.departmentId === user.department_id);
}

export function scopeTeams(user, allTeams) {
  if (user.role === 'super_admin' || user.role === 'admin') return allTeams;
  return allTeams.filter((t) => t.departmentId === user.department_id);
}

export async function scopeDailyUpdates(user, allUpdates) {
  if (user.role === 'super_admin' || user.role === 'admin') return allUpdates;
  if (user.role === 'employee') return allUpdates.filter((u) => u.userId === user.id);

  const userIds = [...new Set(allUpdates.map((u) => u.userId))];
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => '?').join(', ');
  const rows = await prepare(`SELECT id, team_id, department_id FROM users WHERE id IN (${placeholders})`).all(...userIds);
  const infoById = new Map(rows.map((r) => [r.id, r]));

  if (user.role === 'manager') return allUpdates.filter((u) => infoById.get(u.userId)?.department_id === user.department_id);
  if (user.role === 'assistant_manager' || user.role === 'team_lead') return allUpdates.filter((u) => infoById.get(u.userId)?.team_id === user.team_id);
  return [];
}

// Confirms `creator` may assign a task to `assigneeId`, and returns the
// team the task belongs to. An assignee must be strictly lower rank than
// the creator (an employee may only ever assign to themselves — same rank,
// handled as an explicit special case, not the general rule) and within the
// creator's scope. Deny-by-default: any creator role not explicitly known
// here is rejected rather than falling through to an unconditional allow.
export async function validateAssignee(creator, assigneeId) {
  const assignee = await prepare('SELECT * FROM users WHERE id = ?').get(assigneeId);
  if (!assignee) return { ok: false, error: 'Invalid assignee' };
  if (!assignee.is_active) return { ok: false, error: "This person's account has been deactivated" };
  if (assignee.role === 'super_admin') return { ok: false, error: 'Invalid assignee' };

  if (creator.role === 'employee') {
    return assigneeId === creator.id
      ? { ok: true, teamId: assignee.team_id }
      : { ok: false, error: 'You can only create tasks for yourself' };
  }

  if (!['super_admin', 'admin', 'manager', 'assistant_manager', 'team_lead'].includes(creator.role)) {
    return { ok: false, error: 'You do not have permission to assign tasks' };
  }
  if (!(rankIndex(assignee.role) > rankIndex(creator.role))) {
    return { ok: false, error: 'You can only assign tasks to someone below you in the hierarchy' };
  }
  if ((creator.role === 'assistant_manager' || creator.role === 'team_lead') && assignee.team_id !== creator.team_id) {
    return { ok: false, error: 'You can only assign tasks to your own team' };
  }
  if (creator.role === 'manager' && assignee.department_id !== creator.department_id) {
    return { ok: false, error: 'You can only assign tasks within your department' };
  }

  const teamId = (creator.role === 'assistant_manager' || creator.role === 'team_lead') ? creator.team_id : assignee.team_id;
  return { ok: true, teamId };
}
