import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prepare } from '../database/db.js';
import { TODAY } from '../database/constants.js';
import { canManage } from '../database/hierarchy.js';
import { scopedRoster } from './dailyUpdates.js';
import { CLOSED_STATUSES } from './blockers.js';
import { KPI_ROSTER, kpiRosterEntry } from '../database/kpiRoster.js';
import { kpiMatrixFor } from '../database/kpiMatrix.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = Router();
router.use(requireAuth);

// Every "tactical" endpoint below reads one specific person's data — this is
// the one authorization check every one of them shares: viewing your own
// row is always allowed, viewing anyone else's requires canManage's same
// cascading rank+scope authority used everywhere else in this app. An
// intern changing the :internId in the URL/API call gets a 403 here
// regardless of what the frontend would have shown them, same principle as
// every other per-person endpoint in this codebase.
async function resolveAuthorizedTarget(req, res) {
  const targetId = req.params.internId === 'me' ? req.user.id : req.params.internId;
  if (targetId === req.user.id) return req.user;
  const target = await prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target || !canManage(req.user, target)) {
    res.status(403).json({ error: 'You do not have permission to view this person\'s tactical data' });
    return null;
  }
  return target;
}

// Who the viewer is allowed to pull up in the Intern/Developer selector —
// identical roster the dashboards already use to show "everyone in scope,
// even people with nothing logged" (see scopedRoster's own comment), which
// is exactly what a manager picking who to review needs too. An employee's
// own roster is deliberately empty — the frontend hides the selector
// entirely for that role rather than rendering a picker with nothing in it.
router.get('/roster', asyncRoute(async (req, res) => {
  const { scope, users } = await scopedRoster(req.user);
  res.json({ scope, users });
}));

const MILESTONE_CANON = [
  { canon: 'Develop', match: ['develop', 'development', 'dev'] },
  { canon: 'Testing', match: ['test', 'testing', 'qa'] },
  { canon: 'Learning', match: ['learn', 'learning', 'training', 'videos'] },
  { canon: 'Research', match: ['research'] },
  { canon: 'Documentation', match: ['doc', 'documentation'] },
  { canon: 'Design', match: ['design', 'ui', 'ux'] },
];
// Case/spelling variants collapse into one bucket (per-entry, never
// invented) — anything not recognized, or genuinely blank, is its own
// honest "Other" bucket rather than silently dropped or guessed at.
function normalizeMilestone(raw) {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return 'Other';
  const hit = MILESTONE_CANON.find((m) => m.match.some((token) => v === token || v.includes(token)));
  return hit ? hit.canon : (raw.trim() || 'Other');
}

function isoWeekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysISO(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shortLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// "Aug 10-16" when a week stays inside one month, "Aug 31-Sep 6" only when it
// genuinely crosses a month boundary — the repeated month name in every
// bucket's label was what made the trend chart's x-axis crowd/overlap.
function weekRangeLabel(weekStart, weekEnd) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekEnd}T00:00:00`);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  return sameMonth ? `${shortLabel(weekStart)}–${end.getDate()}` : `${shortLabel(weekStart)}–${shortLabel(weekEnd)}`;
}

// ---- Team View's free-text grouping ---------------------------------------
// Team View (unlike Individual View's MILESTONE_CANON above) is required to
// never bucket a raw field into a fixed enum — a brand new Milestone or
// Project value entered tomorrow must show up as its own category with zero
// code changes. The only normalization allowed is collapsing whitespace and
// case: "Develop"/"develop"/"DEVELOP" are the same entry, but "development"
// is a genuinely different word and stays its own group. Each group displays
// under whichever exact original spelling occurred most often in it.
function collapseText(raw) {
  const collapsed = (raw || '').replace(/\s+/g, ' ').trim();
  return !collapsed || collapsed === '-' ? null : collapsed;
}
// One pass over `rows` builds every group's entry count AND its count of
// distinct dates at once — cheap to compute both, since which one a caller
// actually displays (Activity Type wants entry count, Work Distribution
// wants distinct-day count) varies by chart.
function buildFreeTextGroups(rows, valueOf, blankLabel) {
  const groups = new Map(); // normKey -> { displayVotes: Map<string, number>, dates: Set<string>, count: number }
  for (const r of rows) {
    const collapsed = collapseText(valueOf(r));
    const key = collapsed ? collapsed.toLowerCase() : '__blank__';
    const display = collapsed || blankLabel;
    if (!groups.has(key)) groups.set(key, { displayVotes: new Map(), dates: new Set(), count: 0 });
    const g = groups.get(key);
    g.displayVotes.set(display, (g.displayVotes.get(display) || 0) + 1);
    g.dates.add(r.date);
    g.count += 1;
  }
  return [...groups.values()].map((g) => ({
    label: [...g.displayVotes.entries()].sort((a, b) => b[1] - a[1])[0][0],
    count: g.count,
    activeDays: g.dates.size,
  }));
}

// Status is read as-is from the data, not assumed to be only
// Completed/Pending — normalized the same case/whitespace-only way so
// "completed"/"Completed"/"COMPLETED" count together without silently
// folding a genuinely different status (e.g. "on-track") into either bucket.
function normalizeStatusKey(raw) {
  const collapsed = collapseText(raw);
  return collapsed ? collapsed.toLowerCase() : 'not recorded';
}

// Team View's roster is scoped by TEAM MEMBERSHIP, not management authority
// — unlike scopedRoster (built for "who do I manage", empty for an
// employee), everyone should be able to see their own team's tactical
// meeting. Also unlike scopedRoster, the viewer is included, not excluded:
// this is "my team together", not "who do I supervise". A `teamId`/
// `departmentId` query value only ever NARROWS an already-authorized scope
// (checked against the viewer's own role/department/team below) — it can
// never widen it, so a team_lead can't request another team's id and get
// it back.
async function teamViewScope(user, query) {
  let scope;
  let departmentId = null;
  let teamId = null;

  if (user.role === 'super_admin' || user.role === 'admin') {
    scope = 'all';
    departmentId = query.departmentId || null;
    teamId = query.teamId || null;
  } else if (user.role === 'manager' || user.role === 'assistant_manager') {
    scope = 'department';
    departmentId = user.department_id;
    teamId = query.teamId || null;
  } else {
    scope = 'team';
    teamId = user.team_id;
  }

  const conditions = ["role NOT IN ('admin', 'super_admin')", 'is_active = 1'];
  const params = [];
  if (departmentId) { conditions.push('department_id = ?'); params.push(departmentId); }
  if (teamId) { conditions.push('team_id = ?'); params.push(teamId); }

  const users = await prepare(
    `SELECT id, name, title, role, team_id as "teamId", department_id as "departmentId" FROM users WHERE ${conditions.join(' AND ')}`,
  ).all(...params);
  const [departmentRows, teamRows] = await Promise.all([
    prepare('SELECT id, name FROM departments').all(),
    prepare('SELECT id, name, department_id as "departmentId" FROM teams').all(),
  ]);
  const deptNameById = new Map(departmentRows.map((d) => [d.id, d.name]));
  const teamNameById = new Map(teamRows.map((t) => [t.id, t.name]));

  // Filter dropdown options are scoped the same way the roster itself is —
  // an admin sees every department/team, a manager only their own
  // department's teams, everyone else has nothing to pick from (their team
  // is fixed).
  const availableDepartments = scope === 'all' ? departmentRows : (user.department_id ? [{ id: user.department_id, name: deptNameById.get(user.department_id) }] : []);
  const availableTeams = scope === 'all'
    ? teamRows.filter((t) => !departmentId || t.departmentId === departmentId)
    : scope === 'department' ? teamRows.filter((t) => t.departmentId === user.department_id) : [];

  return {
    scope,
    users: users.map((u) => ({ ...u, departmentName: deptNameById.get(u.departmentId) || null, teamName: teamNameById.get(u.teamId) || null })),
    availableDepartments, availableTeams,
  };
}

// Team View's single reusable analytics function — every number the page
// shows comes out of this one bundle, built from exactly one filtered
// row-set, so no chart can ever disagree with another about what's "in
// scope" (the KPI row, the table, and every chart below all read from the
// same `rows`). No mock data anywhere in here: every label, category and
// count is derived from the live Employees/Daily-Update rows fetched above.
async function getTeamTacticalAnalytics(user, query) {
  const { from, to, teamId, departmentId, memberIds, titleGroup } = query;
  const { scope, users: fullRoster, availableDepartments, availableTeams } = await teamViewScope(user, { teamId, departmentId });

  // The Intern/Developer filter's "Interns"/"Developers" one-click groups
  // are resolved here from each person's real `title` (case/whitespace
  // normalized, never a fixed role enum) rather than the frontend guessing
  // from a roster snapshot it already has — that would go stale the moment
  // Department/Team narrows to a different roster. "Individual" mode still
  // narrows by an explicit id list. Both only ever narrow the
  // already-authorized roster, never widen it, same rule as teamId/
  // departmentId above.
  let roster = fullRoster;
  if (memberIds) {
    const selectedMemberIds = new Set(String(memberIds).split(',').map((s) => s.trim()).filter(Boolean));
    roster = roster.filter((u) => selectedMemberIds.has(u.id));
  } else if (titleGroup) {
    const key = String(titleGroup).trim().toLowerCase();
    roster = roster.filter((u) => (u.title || '').trim().toLowerCase() === key);
  }

  let rows = [];
  if (roster.length > 0) {
    const placeholders = roster.map(() => '?').join(', ');
    const dateClause = (from && to) ? 'AND date >= ? AND date <= ?' : '';
    const dateParams = (from && to) ? [from, to] : [];
    const rowsRaw = await prepare(
      `SELECT id, user_id as "userId", task_id as "taskId", custom_task_id as "customTaskId", seq, date, status, task_completed as "taskCompleted",
        milestone, project, deliverables, resources, priority, due_date as "dueDate", actual_close_date as "actualCloseDate"
       FROM daily_updates WHERE user_id IN (${placeholders}) ${dateClause} ORDER BY date ASC, seq ASC`,
    ).all(...roster.map((u) => u.id), ...dateParams);
    rows = rowsRaw.map((r) => ({ ...r, displayId: r.customTaskId || `DU-${String(r.seq).padStart(4, '0')}` }));
  }

  // ---- KPIs — Total Entries is every row after every filter; Completed and
  // Pending only ever count an exact normalized-status match, so a genuinely
  // different status (e.g. "on-track") is never silently folded into either.
  const totalEntries = rows.length;
  const completedEntries = rows.filter((r) => normalizeStatusKey(r.status) === 'completed').length;
  const pendingEntries = rows.filter((r) => normalizeStatusKey(r.status) === 'pending').length;
  const completionRate = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 1000) / 10 : 0;

  // ---- Member performance — one row per roster member, even at 0/0 (an
  // employee with nothing logged still exists and still belongs here), no
  // fabricated attention/risk score of any kind.
  const rowsByUser = new Map();
  for (const r of rows) {
    if (!rowsByUser.has(r.userId)) rowsByUser.set(r.userId, []);
    rowsByUser.get(r.userId).push(r);
  }
  const memberPerformance = roster.map((u) => {
    const uRows = rowsByUser.get(u.id) || [];
    const uCompleted = uRows.filter((r) => normalizeStatusKey(r.status) === 'completed').length;
    const uPending = uRows.filter((r) => normalizeStatusKey(r.status) === 'pending').length;
    return {
      id: u.id, name: u.name, title: u.title, departmentName: u.departmentName, teamName: u.teamName,
      totalEntries: uRows.length, completed: uCompleted, pending: uPending,
      completionRate: uRows.length > 0 ? Math.round((uCompleted / uRows.length) * 1000) / 10 : 0,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // ---- Work Distribution by Project — "how many days did the team actually
  // record work against each project", not "how many rows exist": counts
  // DISTINCT dates per project (so two members logging the same project on
  // the same day count as one active day, and two entries from one member
  // on one day don't double it either), never a fixed project list.
  const projectGroups = buildFreeTextGroups(rows, (r) => r.project, 'Project Not Recorded');
  const totalActiveDays = projectGroups.reduce((sum, gr) => sum + gr.activeDays, 0) || 1;
  const projectDistribution = projectGroups
    .map((gr) => ({ label: gr.label, activeDays: gr.activeDays, pct: Math.round((gr.activeDays / totalActiveDays) * 1000) / 10 }))
    .sort((a, b) => b.activeDays - a.activeDays);

  // ---- Activity Type — categories read straight off the raw Milestone
  // values (case/whitespace normalized only, see buildFreeTextGroups) —
  // a brand new milestone entered tomorrow appears automatically, no enum
  // to update.
  const milestoneGroups = buildFreeTextGroups(rows, (r) => r.milestone, 'Other');
  const totalForActivityType = rows.length || 1;
  const activityTypeDistribution = milestoneGroups
    .map((gr) => ({ label: gr.label, count: gr.count, pct: Math.round((gr.count / totalForActivityType) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);

  // ---- Team's Current Projects — same project grouping as Work
  // Distribution above (case/whitespace-normalized, majority-vote display)
  // — day-by-day entries per roster member, feeding the calendar/gantt
  // presentation of Team's Current Projects. Uses the SAME majority-vote
  // canonical label per project key as projectDistribution above (not each
  // row's own raw spelling) — the calendar merges consecutive same-project
  // days into one bar, and two rows that are the same real project but
  // differently cased ("Develop" one day, "develop" the next) would
  // otherwise fragment into two bars.
  const projectEntryGroups = new Map(); // normKey -> { displayVotes, entries: [] }
  for (const r of rows) {
    const collapsed = collapseText(r.project);
    const key = collapsed ? collapsed.toLowerCase() : '__blank__';
    const display = collapsed || 'Project Not Recorded';
    if (!projectEntryGroups.has(key)) projectEntryGroups.set(key, { displayVotes: new Map(), entries: [] });
    const g = projectEntryGroups.get(key);
    g.displayVotes.set(display, (g.displayVotes.get(display) || 0) + 1);
    g.entries.push(r);
  }
  const projectLabelByKey = new Map();
  for (const [key, g] of projectEntryGroups) {
    projectLabelByKey.set(key, [...g.displayVotes.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  const timeline = roster.map((u) => ({
    id: u.id, name: u.name, title: u.title, departmentName: u.departmentName,
    entries: (rowsByUser.get(u.id) || [])
      .map((r) => {
        const collapsed = collapseText(r.project);
        const key = collapsed ? collapsed.toLowerCase() : '__blank__';
        return { date: r.date, project: projectLabelByKey.get(key), status: r.status };
      })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
  }));

  return {
    scope,
    totalInterns: roster.length,
    totalEntries, completedEntries, pendingEntries, completionRate,
    availableDepartments: availableDepartments.map((d) => ({ id: d.id, name: d.name })),
    availableTeams: availableTeams.map((t) => ({ id: t.id, name: t.name })),
    // `title` lets the frontend offer "Interns"/"Developers" as one-click
    // bulk picks (matched exactly, case/whitespace-normalized) before
    // falling back to the "Individual" checkbox list for anyone else
    // (team leads, managers, or a custom title) — same free-text-normalize
    // rule as everywhere else in this file, no fixed role enum involved.
    availableMembers: fullRoster.map((u) => ({ id: u.id, name: u.name, title: u.title })).sort((a, b) => a.name.localeCompare(b.name)),
    memberPerformance,
    projectDistribution, activityTypeDistribution,
    timeline,
  };
}

router.get('/team', asyncRoute(async (req, res) => {
  res.json(await getTeamTacticalAnalytics(req.user, req.query));
}));

// ---- AI department KPI scorecards -----------------------------------------
// Ported from the AI department manager's spreadsheet (`KPI TARGETS` sheet):
// a role-based, weighted formula per person, scored over a chosen date
// range. Deliberately scoped to the exact 8 people in KPI_ROSTER (see that
// file's own comment for why), not "everyone in the AI department" — a 9th
// person joining the app doesn't silently get a scorecard, and someone
// leaving the roster config doesn't need a schema change either.
//
// Auto metrics are computed from data this app already collects — daily
// updates (the same Task/Project/Due Date/Actual Close Date/Status shape the
// spreadsheet's own per-person sheets track) for completion/on-time
// formulas, and `blockers` for closure/escalation formulas — never from the
// separate `tasks` workflow table, which models TaskFlow's own
// assign/review pipeline, a different concept from "planned deliverables in
// this period". Manual metrics (Code Review, Testing, Docs, Prod Response,
// etc.) have no such proxy and are typed in by a reviewer, stored in
// kpi_manual_entries — see POST /kpi-scorecard/manual-entry below. Metrics
// marked 'unavailable' in kpiMatrix.js (Resource Utilization, SOP
// Compliance, Mentoring, ...) have no data source or entry field at all and
// are always returned as `actual: null` — never guessed, never zero.

async function dailyUpdateCompletionStats(userIds, from, to) {
  if (userIds.length === 0) return { total: 0, completed: 0, onTimeEligible: 0, onTime: 0 };
  const placeholders = userIds.map(() => '?').join(', ');
  const rows = await prepare(
    `SELECT status, due_date as "dueDate", actual_close_date as "actualCloseDate"
     FROM daily_updates WHERE user_id IN (${placeholders}) AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?`,
  ).all(...userIds, from, to);
  const total = rows.length;
  const completedRows = rows.filter((r) => normalizeStatusKey(r.status) === 'completed');
  // "On-time" can only be judged for completed rows that actually recorded a
  // close date — a completed row with no actual_close_date logged is neither
  // counted as on-time nor as late, it's simply excluded from this rate's
  // denominator (never silently treated as either).
  const closedRows = completedRows.filter((r) => r.actualCloseDate);
  const onTime = closedRows.filter((r) => r.actualCloseDate <= r.dueDate).length;
  return { total, completed: completedRows.length, onTimeEligible: closedRows.length, onTime };
}

async function blockerResolutionStats(userIds, from, to) {
  if (userIds.length === 0) return { total: 0, resolvedOnTime: 0 };
  const placeholders = userIds.map(() => '?').join(', ');
  const rows = await prepare(
    `SELECT status, target_resolution as "targetResolution", closed_date as "closedDate"
     FROM blockers WHERE raised_by IN (${placeholders}) AND target_resolution IS NOT NULL AND target_resolution >= ? AND target_resolution <= ?`,
  ).all(...userIds, from, to);
  const total = rows.length;
  const resolvedOnTime = rows.filter((r) => CLOSED_STATUSES.includes(r.status) && r.closedDate && r.closedDate <= r.targetResolution).length;
  return { total, resolvedOnTime };
}

// Every 'auto' metric key across all four KPI roles reduces to one of these
// three underlying rates — the app's data model doesn't distinguish
// "project milestone" from "team milestone" from "task" the way the
// spreadsheet's own vocabulary does (see kpiRoster.js/kpiMatrix.js comments),
// so several distinct metric keys deliberately share the same computed
// actual, scored against that metric's own EPI/MPI/LPI bands.
function actualForMetric(metricKey, dayStats, blockerStats) {
  switch (metricKey) {
    case 'project_milestone_achievement':
    case 'team_milestone_achievement':
    case 'team_task_completion':
    case 'assigned_deliverable_completion':
    case 'assigned_task_deliverable_completion':
      return dayStats.total > 0 ? Math.round((dayStats.completed / dayStats.total) * 1000) / 10 : null;
    case 'on_time_delivery':
    case 'team_on_time_delivery':
    case 'estimation_planning_accuracy':
    case 'task_planning_accuracy':
      return dayStats.onTimeEligible > 0 ? Math.round((dayStats.onTime / dayStats.onTimeEligible) * 1000) / 10 : null;
    case 'risk_blocker_closure':
    case 'blocker_resolution':
    case 'blocker_resolution_escalation':
    case 'blocker_escalation':
      return blockerStats.total > 0 ? Math.round((blockerStats.resolvedOnTime / blockerStats.total) * 1000) / 10 : null;
    default:
      return null; // manual/unavailable metrics are never computed here
  }
}

function parseNumbers(str) {
  if (typeof str !== 'string') return [];
  return (str.match(/[\d.]+/g) || []).map(Number);
}

// The one metric in the whole matrix where a LOWER number is better (Bug /
// Rework Control, target "≤5%") — everything else is "higher percentage is
// better", inferred from its own EPI target string rather than hardcoded per
// metric key, so a future lower-is-better metric added to kpiMatrix.js is
// handled automatically.
function metricDirection(metric) {
  return typeof metric.epiTarget === 'string' && metric.epiTarget.trim().startsWith('≤') ? 'down' : 'up';
}

function bandFor(metric, actual) {
  if (!Number.isFinite(actual)) return null;
  const epiNums = parseNumbers(metric.epiTarget);
  if (epiNums.length === 0) return null;
  const epi = epiNums[0];
  const mpiNums = parseNumbers(metric.mpiRange);
  if (metricDirection(metric) === 'down') {
    if (actual <= epi) return 'EPI';
    const mpiCeiling = mpiNums.length ? Math.max(...mpiNums) : epi;
    return actual <= mpiCeiling ? 'MPI' : 'LPI';
  }
  if (actual >= epi) return 'EPI';
  const mpiFloor = mpiNums.length ? Math.min(...mpiNums) : epi;
  return actual >= mpiFloor ? 'MPI' : 'LPI';
}

// Normalizes a metric's raw `actual` into a 0-100 "how good" score so the
// weighted average below is always summing in the same direction — a 3%
// bug/rework rate (great) must contribute a HIGH score, not drag the
// composite down the way averaging the raw 3% would.
function scorePctFor(metric, actual) {
  if (!Number.isFinite(actual)) return null;
  const raw = metricDirection(metric) === 'down' ? 100 - actual : actual;
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

router.get('/kpi-scorecard', asyncRoute(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to query parameters are required (YYYY-MM-DD)' });

  const rosterIds = KPI_ROSTER.map((r) => r.userId);
  const rosterPlaceholders = rosterIds.map(() => '?').join(', ');
  const userRows = await prepare(`SELECT id, name FROM users WHERE id IN (${rosterPlaceholders}) AND is_active = 1`).all(...rosterIds);
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const manualRows = await prepare(
    `SELECT user_id as "userId", metric_key as "metricKey", value FROM kpi_manual_entries
     WHERE period_from = ? AND period_to = ? AND user_id IN (${rosterPlaceholders})`,
  ).all(from, to, ...rosterIds);
  const manualByKey = new Map(manualRows.map((m) => [`${m.userId}:${m.metricKey}`, Number(m.value)]));

  const scorecards = [];
  for (const entry of KPI_ROSTER) {
    const person = userById.get(entry.userId);
    if (!person) continue; // deactivated/removed since the roster was configured — never fabricate a card for them

    const matrix = kpiMatrixFor(entry.kpiRole);
    // A Manager/Team Lead is scored on their reports' work; an individual
    // contributor is scored on their own — same "reports.length ? reports :
    // self" shape resolveReviewer already uses elsewhere in this app.
    const scopeIds = entry.reports.length > 0 ? entry.reports : [entry.userId];
    const [dayStats, blockerStats] = await Promise.all([
      dailyUpdateCompletionStats(scopeIds, from, to),
      blockerResolutionStats(scopeIds, from, to),
    ]);

    let weightedSum = 0;
    let weightMeasured = 0;
    const metrics = matrix.map((metric) => {
      let actual = null;
      if (metric.compute === 'auto') {
        actual = actualForMetric(metric.key, dayStats, blockerStats);
      } else if (metric.compute === 'manual') {
        const stored = manualByKey.get(`${entry.userId}:${metric.key}`);
        actual = Number.isFinite(stored) ? stored : null;
      }
      const scorePct = metric.compute === 'unavailable' ? null : scorePctFor(metric, actual);
      const band = metric.compute === 'unavailable' ? null : bandFor(metric, actual);
      if (scorePct !== null) {
        weightedSum += metric.weight * scorePct;
        weightMeasured += metric.weight;
      }
      return {
        key: metric.key, label: metric.label, type: metric.type, weight: metric.weight,
        epiTarget: metric.epiTarget, mpiRange: metric.mpiRange, lpiRange: metric.lpiRange,
        formula: metric.formula, compute: metric.compute,
        actual, scorePct, band,
      };
    });

    scorecards.push({
      userId: entry.userId,
      name: person.name,
      kpiRole: entry.kpiRole,
      metrics,
      weightedScore: weightMeasured > 0 ? Math.round((weightedSum / weightMeasured) * 10) / 10 : null,
      weightMeasuredPct: Math.round(weightMeasured * 1000) / 10,
    });
  }

  res.json({ from, to, scorecards });
}));

router.post('/kpi-scorecard/manual-entry', asyncRoute(async (req, res) => {
  const { userId, periodFrom, periodTo, metricKey, value } = req.body;
  if (!userId || !periodFrom || !periodTo || !metricKey || value === undefined || value === null || value === '') {
    return res.status(400).json({ error: 'userId, periodFrom, periodTo, metricKey and value are required' });
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return res.status(400).json({ error: 'value must be a number' });

  const rosterEntry = kpiRosterEntry(userId);
  if (!rosterEntry) return res.status(404).json({ error: 'That person is not on the KPI scorecard roster' });

  const target = await prepare('SELECT * FROM users WHERE id = ?').get(userId);
  // canManage already refuses actor.id === target.id, so this also rules out
  // someone entering their own score — this is a reviewer-typed value by
  // design, mirroring the spreadsheet's own _KPI Entries tab.
  if (!target || !canManage(req.user, target)) {
    return res.status(403).json({ error: 'You do not have permission to enter a KPI score for this person' });
  }

  const metric = kpiMatrixFor(rosterEntry.kpiRole).find((m) => m.key === metricKey);
  if (!metric) return res.status(400).json({ error: 'Unknown metric for this person\'s KPI role' });
  if (metric.compute !== 'manual') return res.status(400).json({ error: 'This metric is not manually entered' });

  await prepare(
    `INSERT INTO kpi_manual_entries (id, user_id, period_from, period_to, metric_key, value, entered_by, entered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, period_from, period_to, metric_key)
     DO UPDATE SET value = EXCLUDED.value, entered_by = EXCLUDED.entered_by, entered_at = EXCLUDED.entered_at`,
  ).run(`kpi-${randomUUID()}`, userId, periodFrom, periodTo, metricKey, numericValue, req.user.id, new Date().toISOString());

  res.json({ ok: true });
}));

router.get('/:internId', asyncRoute(async (req, res) => {
  const target = await resolveAuthorizedTarget(req, res);
  if (!target) return;

  const { from, to } = req.query;

  const [team, department] = await Promise.all([
    target.team_id ? prepare('SELECT id, name FROM teams WHERE id = ?').get(target.team_id) : null,
    target.department_id ? prepare('SELECT id, name FROM departments WHERE id = ?').get(target.department_id) : null,
  ]);

  const rowsRaw = (from && to)
    ? await prepare(
      `SELECT id, task_id as "taskId", custom_task_id as "customTaskId", seq, date, status, task_completed as "taskCompleted",
        milestone, project, deliverables, resources, priority, due_date as "dueDate", actual_close_date as "actualCloseDate",
        bdm_remarks as "bdmRemarks", bdm_remarks_by as "bdmRemarksBy"
       FROM daily_updates WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC, seq ASC`,
    ).all(target.id, from, to)
    : await prepare(
      `SELECT id, task_id as "taskId", custom_task_id as "customTaskId", seq, date, status, task_completed as "taskCompleted",
        milestone, project, deliverables, resources, priority, due_date as "dueDate", actual_close_date as "actualCloseDate",
        bdm_remarks as "bdmRemarks", bdm_remarks_by as "bdmRemarksBy"
       FROM daily_updates WHERE user_id = ? ORDER BY date ASC, seq ASC`,
    ).all(target.id);

  const rows = rowsRaw.map((r) => ({ ...r, displayId: r.customTaskId || `DU-${String(r.seq).padStart(4, '0')}` }));

  const totalUpdates = rows.length;
  const completed = rows.filter((r) => r.status === 'Completed').length;
  const pending = rows.filter((r) => r.status !== 'Completed').length;
  const completionRate = totalUpdates > 0 ? Math.round((completed / totalUpdates) * 1000) / 10 : 0;

  // ---- Activity trend — weekly (Monday-start) and monthly buckets over the
  // fetched range, both returned so the frontend's Weekly/Monthly toggle
  // doesn't need a refetch.
  function buildTrend(bucketOf, labelOf) {
    if (rows.length === 0) return [];
    const buckets = new Map();
    for (const r of rows) {
      const key = bucketOf(r.date);
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return [...buckets.keys()].sort().map((key) => ({ key, label: labelOf(key), count: buckets.get(key) }));
  }
  const activityTrend = {
    weekly: buildTrend(
      (d) => isoWeekStart(d),
      (weekStart) => weekRangeLabel(weekStart, addDaysISO(weekStart, 6)),
    ),
    monthly: buildTrend(
      (d) => d.slice(0, 7),
      (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    ),
  };

  // ---- Work distribution by project — blank/placeholder project values are
  // surfaced honestly as their own bucket, never silently dropped.
  function distributionOf(rowsIn, keyFn, fallback) {
    const counts = new Map();
    for (const r of rowsIn) {
      const raw = keyFn(r);
      const key = raw && raw.trim() && raw.trim() !== '-' ? raw.trim() : fallback;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const total = rowsIn.length || 1;
    return [...counts.entries()]
      .map(([key, count]) => ({ label: key, count, pct: Math.round((count / total) * 1000) / 10 }))
      .sort((a, b) => b.count - a.count);
  }
  // Case/whitespace-insensitive grouping, same rule (and helper) as Team
  // View's own project distribution — "Task Management System" and "Task
  // Management system" are the same project, not two, and each group
  // displays under whichever exact spelling occurred most often in it.
  const projectGroups = buildFreeTextGroups(rows, (r) => r.project, 'Other');
  const totalForProject = rows.length || 1;
  const projectDistribution = projectGroups
    .map((gr) => ({ label: gr.label, count: gr.count, pct: Math.round((gr.count / totalForProject) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);
  const activityTypeDistribution = distributionOf(rows, (r) => normalizeMilestone(r.milestone), 'Other');

  // ---- Recent deliveries — most recent first, capped short: this is a
  // "what's fresh" glance, not the full history (Daily Update History
  // already covers that).
  const recentDeliveries = [...rows].reverse().slice(0, 4).map((r) => ({
    id: r.id, displayId: r.displayId, project: r.project || 'Other',
    task: r.taskCompleted, deliverable: r.deliverables, milestone: normalizeMilestone(r.milestone),
    status: r.status, dueDate: r.dueDate, taskId: r.taskId,
  }));

  // Same case-insensitive dedup as the grouping above — otherwise this list
  // could show "Task Management System" and "Task Management system" as two
  // separate "current" projects for the exact same real project.
  const seenProjectKeys = new Set();
  const currentProjects = rows.slice(-5).map((r) => r.project).filter((p) => p && p.trim() && p.trim() !== '-')
    .filter((p) => {
      const key = p.trim().toLowerCase();
      if (seenProjectKeys.has(key)) return false;
      seenProjectKeys.add(key);
      return true;
    });

  res.json({
    profile: {
      id: target.id, name: target.name, title: target.title, role: target.role,
      department: department ? { id: department.id, name: department.name } : null,
      team: team ? { id: team.id, name: team.name } : null,
      currentProjects, completionRate, totalUpdates,
    },
    totalUpdates, completed, pending, completionRate,
    activityTrend,
    projectDistribution,
    activityTypeDistribution,
    recentDeliveries,
  });
}));

export default router;
