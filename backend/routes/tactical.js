import { Router } from 'express';
import { prepare } from '../database/db.js';
import { TODAY } from '../database/constants.js';
import { canManage } from '../database/hierarchy.js';
import { scopedRoster } from './dailyUpdates.js';
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
// honest "Unclassified" bucket rather than silently dropped or guessed at.
function normalizeMilestone(raw) {
  const v = (raw || '').trim().toLowerCase();
  if (!v) return 'Unclassified';
  const hit = MILESTONE_CANON.find((m) => m.match.some((token) => v === token || v.includes(token)));
  return hit ? hit.canon : (raw.trim() || 'Unclassified');
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
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

// "Last 7 Days -> daily, Last 30 Days -> weekly, longer -> monthly" — derived
// from the actual resolved span rather than hard-coded to a period key, so a
// Custom Range gets the same sensible treatment automatically.
function pickGranularity(from, to) {
  if (!from || !to) return 'monthly';
  const span = daysBetween(from, to) + 1;
  if (span <= 9) return 'daily';
  if (span <= 60) return 'weekly';
  return 'monthly';
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
  const { from, to, teamId, departmentId, memberIds, titleGroup, granularity: granularityOverride } = query;
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

  // ---- Activity trend — Total Entries vs Completed per bucket, at a
  // granularity picked from the actual resolved date span (or explicitly
  // overridden by the Daily/Weekly/Monthly toggle).
  const g = granularityOverride && ['daily', 'weekly', 'monthly'].includes(granularityOverride)
    ? granularityOverride
    : pickGranularity(from, to);
  const bucketOf = g === 'daily' ? (d) => d : g === 'weekly' ? (d) => isoWeekStart(d) : (d) => d.slice(0, 7);
  const labelOf = g === 'daily'
    ? (d) => shortLabel(d)
    : g === 'weekly'
      ? (weekStart) => weekRangeLabel(weekStart, addDaysISO(weekStart, 6))
      : (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const buckets = new Map();
  for (const r of rows) {
    const key = bucketOf(r.date);
    if (!buckets.has(key)) buckets.set(key, { total: 0, completed: 0 });
    const b = buckets.get(key);
    b.total += 1;
    if (normalizeStatusKey(r.status) === 'completed') b.completed += 1;
  }
  const activityTrend = {
    granularity: g,
    buckets: [...buckets.keys()].sort().map((key) => ({ key, label: labelOf(key), ...buckets.get(key) })),
  };

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
  const milestoneGroups = buildFreeTextGroups(rows, (r) => r.milestone, 'Unclassified');
  const totalForActivityType = rows.length || 1;
  const activityTypeDistribution = milestoneGroups
    .map((gr) => ({ label: gr.label, count: gr.count, pct: Math.round((gr.count / totalForActivityType) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);

  // ---- Team's Current Projects — same project grouping as Work
  // Distribution above (case/whitespace-normalized, majority-vote display),
  // but surfaced per-project rather than aggregated: who's contributing,
  // what the most recent entry says. "Current" means the project has
  // activity within the selected filters, same as Work Distribution — NOT
  // gated by the latest entry's status, because on this schema `status` on
  // a Daily Update row means "today's logged task is done", not "the whole
  // project is finished"; every project's most recent entry is routinely
  // Completed while the project itself is still very much ongoing.
  const userById = new Map(roster.map((u) => [u.id, u]));
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
  const currentProjects = [...projectEntryGroups.values()]
    .map((g) => {
      const label = [...g.displayVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const sorted = [...g.entries].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.seq - a.seq));
      const latest = sorted[0];
      const contributors = [...new Map(g.entries.map((e) => [e.userId, userById.get(e.userId)?.name || 'Unknown'])).entries()]
        .map(([id, name]) => ({ id, name }));
      return {
        project: label, contributors, updateCount: g.entries.length,
        latestStatus: latest.status, latestDate: latest.date, latestMilestone: latest.milestone,
      };
    })
    .sort((a, b) => (a.latestDate < b.latestDate ? 1 : a.latestDate > b.latestDate ? -1 : 0));

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
    activityTrend,
    projectDistribution, activityTypeDistribution,
    currentProjects,
  };
}

router.get('/team', asyncRoute(async (req, res) => {
  res.json(await getTeamTacticalAnalytics(req.user, req.query));
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
  const projectDistribution = distributionOf(rows, (r) => r.project, 'Unknown / Other');
  const activityTypeDistribution = distributionOf(rows, (r) => normalizeMilestone(r.milestone), 'Unclassified');

  // ---- Recent deliveries — most recent first, capped short: this is a
  // "what's fresh" glance, not the full history (Daily Update History
  // already covers that).
  const recentDeliveries = [...rows].reverse().slice(0, 4).map((r) => ({
    id: r.id, displayId: r.displayId, project: r.project || 'Unknown / Other',
    task: r.taskCompleted, deliverable: r.deliverables, milestone: normalizeMilestone(r.milestone),
    status: r.status, dueDate: r.dueDate, taskId: r.taskId,
  }));

  const currentProjects = [...new Set(rows.slice(-5).map((r) => r.project).filter((p) => p && p.trim() && p.trim() !== '-'))];

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
