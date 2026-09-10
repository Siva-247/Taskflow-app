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

// A fixed, known vocabulary — only ever surfaces a term actually found in
// someone's own deliverable/task text, never invents or infers a skill they
// weren't shown to have touched. Team View's own Development Journey needs
// this (aggregated across everyone in scope); the Individual View doesn't
// use it any more, by request.
const SKILL_VOCAB = [
  'React', 'Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'MySQL', 'SQL', 'Redis',
  'Python', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Tailwind',
  'REST', 'GraphQL', 'API Integration', 'WebSocket', 'RBAC', 'JWT', 'OAuth', 'Authentication',
  'Docker', 'AWS', 'CI/CD', 'Git', 'GitHub',
  'Redux', 'Vite', 'Webpack', 'Jest', 'Testing', 'Figma',
  'Machine Learning', 'NLP', 'LLM', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch',
];
function textOf(row) {
  return `${row.deliverables || ''} ${row.taskCompleted || ''} ${row.resources || ''}`.toLowerCase();
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

router.get('/team', asyncRoute(async (req, res) => {
  const { from, to, teamId, departmentId, project } = req.query;
  const { scope, users: roster, availableDepartments, availableTeams } = await teamViewScope(req.user, { teamId, departmentId });

  let rows = [];
  if (roster.length > 0) {
    const placeholders = roster.map(() => '?').join(', ');
    const dateClause = (from && to) ? 'AND date >= ? AND date <= ?' : '';
    const dateParams = (from && to) ? [from, to] : [];
    const rowsRaw = await prepare(
      `SELECT id, user_id as "userId", task_id as "taskId", custom_task_id as "customTaskId", seq, date, status, task_completed as "taskCompleted",
        milestone, project, deliverables, resources, priority, due_date as "dueDate", actual_close_date as "actualCloseDate",
        bdm_remarks as "bdmRemarks", bdm_remarks_by as "bdmRemarksBy"
       FROM daily_updates WHERE user_id IN (${placeholders}) ${dateClause} ORDER BY date ASC, seq ASC`,
    ).all(...roster.map((u) => u.id), ...dateParams);
    rows = rowsRaw.map((r) => ({ ...r, displayId: r.customTaskId || `DU-${String(r.seq).padStart(4, '0')}` }));
    if (project) rows = rows.filter((r) => (r.project || '').trim() === project);
  }
  const userById = new Map(roster.map((u) => [u.id, u]));

  const linkedTaskIds = [...new Set(rows.map((r) => r.taskId).filter(Boolean))];
  const blockerByTask = new Map();
  if (linkedTaskIds.length > 0) {
    const placeholders = linkedTaskIds.map(() => '?').join(', ');
    const blockerRows = await prepare(
      `SELECT linked_task_id as "taskId", status FROM blockers WHERE linked_task_id IN (${placeholders})`,
    ).all(...linkedTaskIds);
    for (const b of blockerRows) {
      const cur = blockerByTask.get(b.taskId);
      const isOpen = b.status !== 'Resolved' && b.status !== 'Closed';
      if (!cur || (isOpen && !cur.open)) blockerByTask.set(b.taskId, { open: isOpen });
    }
  }
  const isBlocked = (taskId) => Boolean(taskId && blockerByTask.get(taskId)?.open);

  const totalUpdates = rows.length;
  const completed = rows.filter((r) => r.status === 'Completed').length;
  const pending = totalUpdates - completed;
  const completionRate = totalUpdates > 0 ? Math.round((completed / totalUpdates) * 1000) / 10 : 0;
  const blockedRows = rows.filter((r) => isBlocked(r.taskId));

  // ---- Member performance — one row per roster member (even at 0/0, same
  // "the whole roster, not just who happened to log something" reasoning
  // used everywhere else), each with an attention level grounded in their
  // own rows, never a fabricated score.
  const rowsByUser = new Map();
  for (const r of rows) {
    if (!rowsByUser.has(r.userId)) rowsByUser.set(r.userId, []);
    rowsByUser.get(r.userId).push(r);
  }
  const memberPerformance = roster.map((u) => {
    const uRows = rowsByUser.get(u.id) || [];
    const uCompleted = uRows.filter((r) => r.status === 'Completed').length;
    const uPending = uRows.length - uCompleted;
    const uBlocked = uRows.filter((r) => isBlocked(r.taskId)).length;
    let attentionLevel = 'healthy';
    let attentionReason = 'No open issues in this range';
    if (uBlocked > 0) {
      attentionLevel = 'critical';
      attentionReason = `${uBlocked} open blocker${uBlocked === 1 ? '' : 's'}`;
    } else if (uPending > 0) {
      attentionLevel = 'attention';
      attentionReason = `${uPending} pending task${uPending === 1 ? '' : 's'}`;
    } else if (uRows.length === 0) {
      attentionLevel = 'attention';
      attentionReason = 'Nothing logged in this range';
    }
    return {
      id: u.id, name: u.name, title: u.title, departmentName: u.departmentName, teamName: u.teamName,
      total: uRows.length, completed: uCompleted, pending: uPending,
      completionRate: uRows.length > 0 ? Math.round((uCompleted / uRows.length) * 1000) / 10 : 0,
      attentionLevel, attentionReason,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // ---- Manager attention — same three data-honesty rules as Individual
  // View (blank Priority/Reviewed-By/Blocker mean "not recorded", never a
  // positive or negative judgement), aggregated across the whole roster.
  const missingPriority = rows.filter((r) => !r.priority || !r.priority.trim());
  const missingReview = rows.filter((r) => (!r.bdmRemarks || !r.bdmRemarks.trim()) && !r.bdmRemarksBy);
  const managerAttention = [
    pending > 0 && { id: 'pending', title: `${pending} Pending Task${pending === 1 ? '' : 's'}`, detail: 'Tasks not yet completed', severity: 'high', count: pending },
    missingPriority.length > 0 && { id: 'priority', title: `${missingPriority.length} Record${missingPriority.length === 1 ? '' : 's'} Missing Priority`, detail: 'Priority not recorded', severity: 'medium', count: missingPriority.length },
    missingReview.length > 0 && { id: 'review', title: `${missingReview.length} Record${missingReview.length === 1 ? '' : 's'} Missing Review Information`, detail: 'BDM remarks / reviewer not recorded', severity: 'medium', count: missingReview.length },
    totalUpdates > 0 && { id: 'effort', title: `${totalUpdates} Task${totalUpdates === 1 ? '' : 's'} Without Effort Information`, detail: 'No effort field exists in the Daily Update record', severity: 'low', count: totalUpdates },
    blockedRows.length > 0 && { id: 'blockers', title: `${blockedRows.length} Explicit Blocker${blockedRows.length === 1 ? '' : 's'}`, detail: 'Open blocker linked to a task', severity: 'high', count: blockedRows.length },
  ].filter(Boolean);

  // ---- Activity trend — weekly/monthly, Total vs Completed per bucket.
  function buildTrend(bucketOf, labelOf) {
    if (rows.length === 0) return [];
    const buckets = new Map();
    for (const r of rows) {
      const key = bucketOf(r.date);
      if (!buckets.has(key)) buckets.set(key, { total: 0, completed: 0 });
      const b = buckets.get(key);
      b.total += 1;
      if (r.status === 'Completed') b.completed += 1;
    }
    return [...buckets.keys()].sort().map((key) => ({ key, label: labelOf(key), ...buckets.get(key) }));
  }
  const activityTrend = {
    weekly: buildTrend((d) => isoWeekStart(d), (weekStart) => `${shortLabel(weekStart)}–${shortLabel(addDaysISO(weekStart, 6))}`),
    monthly: buildTrend((d) => d.slice(0, 7), (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })),
  };

  // ---- Distributions — same honest-bucketing rule as Individual View.
  function distributionOf(keyFn, fallback) {
    const counts = new Map();
    for (const r of rows) {
      const raw = keyFn(r);
      const key = raw && raw.trim() && raw.trim() !== '-' ? raw.trim() : fallback;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const total = rows.length || 1;
    return [...counts.entries()].map(([key, count]) => ({ label: key, count, pct: Math.round((count / total) * 1000) / 10 })).sort((a, b) => b.count - a.count);
  }
  const projectDistribution = distributionOf((r) => r.project, 'Unknown / Other');
  const activityTypeDistribution = distributionOf((r) => normalizeMilestone(r.milestone), 'Unclassified');

  // ---- Delivery reliability — identical rule to Individual View: only
  // rows with both dates are counted; a still-open row is "Pending", not
  // silently folded into "late".
  let onTime = 0; let oneToTwo = 0; let threePlus = 0; let insufficientCount = 0;
  for (const r of rows) {
    if (r.status !== 'Completed') { continue; }
    if (!r.dueDate || !r.actualCloseDate) { insufficientCount += 1; continue; }
    const lateDays = daysBetween(r.dueDate, r.actualCloseDate);
    if (lateDays <= 0) onTime += 1; else if (lateDays <= 2) oneToTwo += 1; else threePlus += 1;
  }
  const reliabilityKnown = onTime + oneToTwo + threePlus;
  const deliveryReliability = {
    onTime, oneToTwoDaysLate: oneToTwo, threePlusDaysLate: threePlus, insufficientData: insufficientCount,
    onTimePct: reliabilityKnown > 0 ? Math.round((onTime / reliabilityKnown) * 1000) / 10 : null,
  };

  // ---- Task health — the same four data-grounded buckets as Individual
  // View used before it was trimmed from that page: Blocked only from a
  // real open-blocker join, Pending from status, Attention only for a
  // completed-but-unreviewed row (a real condition, not a guess), Healthy
  // otherwise.
  let healthy = 0; let attention = 0; let blockedCount = 0; let pendingHealth = 0;
  for (const r of rows) {
    if (isBlocked(r.taskId)) { blockedCount += 1; continue; }
    if (r.status !== 'Completed') { pendingHealth += 1; continue; }
    const reviewed = (r.bdmRemarks && r.bdmRemarks.trim()) || r.bdmRemarksBy;
    if (!reviewed) { attention += 1; continue; }
    healthy += 1;
  }
  const taskHealth = { healthy, attention, blocked: blockedCount, pending: pendingHealth, total: rows.length };

  // ---- Recent team deliveries — newest first, short glance list.
  const recentDeliveries = [...rows].reverse().slice(0, 8).map((r) => ({
    id: r.id, displayId: r.displayId, project: r.project || 'Unknown / Other',
    task: r.taskCompleted, deliverable: r.deliverables, milestone: normalizeMilestone(r.milestone),
    status: r.status, dueDate: r.dueDate, taskId: r.taskId,
    memberName: userById.get(r.userId)?.name || 'Unknown',
  }));

  // ---- Team development journey — same fixed vocabulary as before, now
  // counting how many people's own entries mention each skill (not just
  // whether it appears once anywhere), so it reads as team capability
  // breadth rather than one person's list.
  const skillMemberCount = new Map();
  for (const [userId, uRows] of rowsByUser) {
    const combined = uRows.map(textOf).join(' ');
    for (const skill of SKILL_VOCAB) {
      if (combined.includes(skill.toLowerCase())) skillMemberCount.set(skill, (skillMemberCount.get(skill) || 0) + 1);
    }
  }
  const developmentJourney = [...skillMemberCount.entries()]
    .map(([skill, memberCount]) => ({ skill, memberCount }))
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 10);

  // ---- Heatmap — last 7 calendar days ending TODAY (independent of the
  // period filter, which can span much longer) x roster member, one of
  // three states per cell: logged (green), nothing logged (neutral — never
  // "blocked" merely for being empty), or logged-and-linked-to-an-open-
  // blocker (red). Built from ALL of that member's rows in the last 7 days,
  // not the (possibly narrower) filtered `rows` above, so switching Period
  // doesn't make the heatmap lie about recent activity.
  const heatmapDays = [...Array(7)].map((_, i) => addDaysISO(TODAY, -(6 - i)));
  let heatmap = [];
  if (roster.length > 0) {
    const placeholders = roster.map(() => '?').join(', ');
    const recentRows = await prepare(
      `SELECT user_id as "userId", task_id as "taskId", date FROM daily_updates WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ?`,
    ).all(...roster.map((u) => u.id), heatmapDays[0], heatmapDays[6]);
    const byUserDay = new Map();
    for (const r of recentRows) byUserDay.set(`${r.userId}::${r.date}`, r.taskId);
    heatmap = roster.map((u) => ({
      memberId: u.id, memberName: u.name,
      days: heatmapDays.map((d) => {
        const key = `${u.id}::${d}`;
        if (!byUserDay.has(key)) return { date: d, state: 'none' };
        return { date: d, state: isBlocked(byUserDay.get(key)) ? 'blocked' : 'logged' };
      }),
    }));
  }

  // ---- Tactical discussion — generated from this bundle's own conditions.
  const discussionPrompts = [];
  if (pending > 0) discussionPrompts.push('Which pending tasks need immediate attention?');
  if (blockedRows.length > 0) discussionPrompts.push('Are there any blockers requiring manager support?');
  const mostPending = [...memberPerformance].sort((a, b) => b.pending - a.pending)[0];
  if (mostPending && mostPending.pending >= 2) discussionPrompts.push(`Does ${mostPending.name.split(' ')[0]} need support with the pending work?`);
  if (missingReview.length > 0) discussionPrompts.push('Which recent deliveries should be reviewed?');
  const topProject = projectDistribution[0];
  if (topProject && topProject.pct >= 60 && projectDistribution.length > 1) {
    discussionPrompts.push(`Is the current concentration on ${topProject.label} aligned with this week's priorities?`);
  }
  discussionPrompts.push('What should the team focus on next week?');

  res.json({
    scope, totalMembers: roster.length,
    availableDepartments: availableDepartments.map((d) => ({ id: d.id, name: d.name })),
    availableTeams: availableTeams.map((t) => ({ id: t.id, name: t.name })),
    totalUpdates, completed, pending, completionRate,
    memberPerformance, managerAttention,
    activityTrend, projectDistribution, activityTypeDistribution,
    deliveryReliability, taskHealth, recentDeliveries, developmentJourney, heatmap,
    discussionPrompts,
  });
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

  // Blocker status per linked real Task — a real join result, not a guess
  // off a blank field (this table has no "blocker" column of its own; see
  // schema.postgres.sql). No linked task at all means the question genuinely
  // doesn't apply, not "assumed fine" — kept as its own 'unavailable' state.
  const linkedTaskIds = [...new Set(rows.map((r) => r.taskId).filter(Boolean))];
  const blockerByTask = new Map();
  if (linkedTaskIds.length > 0) {
    const placeholders = linkedTaskIds.map(() => '?').join(', ');
    const blockerRows = await prepare(
      `SELECT linked_task_id as "taskId", status FROM blockers WHERE linked_task_id IN (${placeholders})`,
    ).all(...linkedTaskIds);
    for (const b of blockerRows) {
      const cur = blockerByTask.get(b.taskId);
      const isOpen = b.status !== 'Resolved' && b.status !== 'Closed';
      if (!cur || (isOpen && !cur.open)) blockerByTask.set(b.taskId, { open: isOpen, any: true });
    }
  }
  const blockerStateOf = (taskId) => {
    if (!taskId) return 'unavailable';
    const b = blockerByTask.get(taskId);
    if (!b) return 'none';
    return b.open ? 'blocked' : 'resolved';
  };

  const totalUpdates = rows.length;
  const completed = rows.filter((r) => r.status === 'Completed').length;
  const pending = rows.filter((r) => r.status !== 'Completed').length;
  const completionRate = totalUpdates > 0 ? Math.round((completed / totalUpdates) * 1000) / 10 : 0;

  // ---- Attention items — every one grounded in an explicit condition in
  // the data, never an inference from missing data (see route-level docs
  // for the three cases this deliberately gets right: blank Priority,
  // blank Blocker/no-linked-task, blank Reviewed By all mean "not
  // recorded", never "low/none/unblocked").
  const attentionItems = [];
  const pendingRows = rows.filter((r) => r.status !== 'Completed');
  for (const r of pendingRows.slice(0, 5)) {
    attentionItems.push({
      id: `pending-${r.id}`, type: 'pending', severity: 'high',
      title: `${r.displayId} is Pending`, detail: r.taskCompleted?.slice(0, 80) || r.project || 'No description',
      dailyUpdateId: r.id, taskId: r.taskId || null,
    });
  }
  const missingPriority = rows.filter((r) => !r.priority || !r.priority.trim());
  if (missingPriority.length > 0) {
    attentionItems.push({
      id: 'priority-missing', type: 'priority', severity: 'medium',
      title: 'Priority data not recorded', detail: `${missingPriority.length} of ${totalUpdates} entries have no priority on file`,
    });
  }
  const missingReview = rows.filter((r) => (!r.bdmRemarks || !r.bdmRemarks.trim()) && !r.bdmRemarksBy);
  if (missingReview.length > 0) {
    attentionItems.push({
      id: 'review-missing', type: 'review', severity: 'medium',
      title: 'Review information not recorded', detail: `${missingReview.length} of ${totalUpdates} entries have no BDM remarks or reviewer on file`,
    });
  }
  if (totalUpdates > 0) {
    attentionItems.push({
      id: 'effort-missing', type: 'effort', severity: 'low',
      title: 'Effort not tracked', detail: 'No estimated/actual effort field exists in the Daily Update record',
    });
  }
  const blockedRows = rows.filter((r) => blockerStateOf(r.taskId) === 'blocked');
  for (const r of blockedRows) {
    attentionItems.push({
      id: `blocked-${r.id}`, type: 'blocker', severity: 'high',
      title: `${r.displayId} has an open blocker`, detail: r.taskCompleted?.slice(0, 80) || '',
      dailyUpdateId: r.id, taskId: r.taskId,
    });
  }

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
      (weekStart) => `${shortLabel(weekStart)}–${shortLabel(addDaysISO(weekStart, 6))}`,
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

  // ---- Delivery reliability — only rows with BOTH a due date and an actual
  // close date are counted; everything else is "insufficient data", never
  // guessed at or silently excluded from the total.
  let onTime = 0; let oneToTwo = 0; let threePlus = 0; let insufficientCount = 0;
  for (const r of rows) {
    if (!r.dueDate || !r.actualCloseDate) { insufficientCount += 1; continue; }
    const lateDays = daysBetween(r.dueDate, r.actualCloseDate);
    if (lateDays <= 0) onTime += 1; else if (lateDays <= 2) oneToTwo += 1; else threePlus += 1;
  }
  const reliabilityKnown = onTime + oneToTwo + threePlus;
  const deliveryReliability = {
    onTime, oneToTwoDaysLate: oneToTwo, threePlusDaysLate: threePlus, insufficientData: insufficientCount,
    onTimePct: reliabilityKnown > 0 ? Math.round((onTime / reliabilityKnown) * 1000) / 10 : null,
  };

  const currentProjects = [...new Set(rows.slice(-5).map((r) => r.project).filter((p) => p && p.trim() && p.trim() !== '-'))];

  res.json({
    profile: {
      id: target.id, name: target.name, title: target.title, role: target.role,
      department: department ? { id: department.id, name: department.name } : null,
      team: team ? { id: team.id, name: team.name } : null,
      currentProjects, completionRate, totalUpdates,
    },
    totalUpdates, completed, pending, completionRate,
    attentionItems,
    activityTrend,
    projectDistribution,
    activityTypeDistribution,
    recentDeliveries,
    deliveryReliability,
  });
}));

export default router;
