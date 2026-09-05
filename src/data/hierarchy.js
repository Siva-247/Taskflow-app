// Client-side mirror of backend/database/hierarchy.js — UI decisions only,
// never authoritative (the backend enforces every one of these again on its
// own). Kept as a deliberate, explicit port (same pattern this app already
// used for userCanAccessTask's old frontend mirror) rather than importing
// across the frontend/backend boundary, which isn't possible.
import { ROLES } from './mockData.js';

export const RANKS = [
  ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.ASSISTANT_MANAGER, ROLES.TEAM_LEAD, ROLES.EMPLOYEE,
];

// An unrecognized role resolves to one past the lowest real rank — strictly
// lower than even Employee — so every comparison built on this is
// deny-by-default, same reasoning as the backend version.
export function rankIndex(role) {
  const i = RANKS.indexOf(role);
  return i === -1 ? RANKS.length : i;
}

// Broad, cascading "who may manage whom" — mirrors hierarchy.canManage
// exactly. `team`/`departmentId` here are the frontend's own field names
// (teamId/departmentId), not the backend's snake_case columns.
export function canManage(actor, target) {
  if (!actor || !target) return false;
  if (actor.id === target.id) return false;
  if (target.role === ROLES.SUPER_ADMIN) return false;
  if (actor.role === ROLES.SUPER_ADMIN) return true;
  if (actor.role === ROLES.ADMIN) return target.role !== ROLES.ADMIN;
  if (actor.role === ROLES.MANAGER) {
    return rankIndex(target.role) > rankIndex(actor.role) && target.departmentId === actor.departmentId;
  }
  if (actor.role === ROLES.ASSISTANT_MANAGER || actor.role === ROLES.TEAM_LEAD) {
    return rankIndex(target.role) > rankIndex(actor.role) && target.teamId === actor.teamId;
  }
  return false;
}

// Whether `user` may view/manage/review a task belonging to `team`/`departmentId`
// (a team object from teamById(), or an equivalent {teamId, departmentId} shape) —
// mirrors the backend's canAccessTask/canReviewTask scope shape (same rank+scope
// check works for both view and review authority on the frontend, since the UI
// only needs "can this person act at all", not the finer view-vs-review split
// the backend keeps separate for its own endpoint-level gating).
export function canAccessTeamScope(user, team) {
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) return true;
  if (user.role === ROLES.MANAGER) return Boolean(team) && team.departmentId === user.departmentId;
  if (user.role === ROLES.ASSISTANT_MANAGER || user.role === ROLES.TEAM_LEAD) return Boolean(team) && team.id === user.teamId;
  return false;
}

// Anyone strictly lower rank than `actor`, within their team/department
// scope — the pool of people `actor` may assign a task to or reassign a
// task to. Mirrors the backend's reworked validateAssignee exactly (the
// broadened rule: Team Leads and Assistant Managers are valid targets too,
// not just Employees). An employee's "assignable" set is just themselves,
// handled as a special case by callers rather than here, matching how the
// backend treats it as a distinct branch too.
export function assignableTargets(actor, users) {
  return users.filter((u) => {
    if (u.id === actor.id) return false;
    if (u.role === ROLES.SUPER_ADMIN) return false;
    if (rankIndex(u.role) <= rankIndex(actor.role)) return false;
    if (actor.role === ROLES.MANAGER) return u.departmentId === actor.departmentId;
    if (actor.role === ROLES.ASSISTANT_MANAGER || actor.role === ROLES.TEAM_LEAD) return u.teamId === actor.teamId;
    if (actor.role === ROLES.ADMIN || actor.role === ROLES.SUPER_ADMIN) return true;
    return false;
  });
}
