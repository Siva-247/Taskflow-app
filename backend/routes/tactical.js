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

// A fixed, known vocabulary — only ever surfaces a term actually found in
// this person's own deliverable/task text, never invents or infers a skill
// they weren't shown to have touched.
const SKILL_VOCAB = [
  'React', 'Node.js', 'Express', 'PostgreSQL', 'MongoDB', 'MySQL', 'SQL', 'Redis',
  'Python', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Tailwind',
  'REST', 'GraphQL', 'API Integration', 'WebSocket', 'RBAC', 'JWT', 'OAuth', 'Authentication',
  'Docker', 'AWS', 'CI/CD', 'Git', 'GitHub',
  'Redux', 'Vite', 'Webpack', 'Jest', 'Testing', 'Figma',
  'Machine Learning', 'NLP', 'LLM', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch',
];
function extractSkills(rows) {
  const text = rows.map((r) => `${r.deliverables || ''} ${r.taskCompleted || ''} ${r.resources || ''}`).join(' ').toLowerCase();
  return SKILL_VOCAB.filter((skill) => text.includes(skill.toLowerCase()));
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

  // ---- Recent deliveries — most recent first.
  const recentDeliveries = [...rows].reverse().slice(0, 12).map((r) => ({
    id: r.id, displayId: r.displayId, project: r.project || 'Unknown / Other',
    task: r.taskCompleted, deliverable: r.deliverables, milestone: normalizeMilestone(r.milestone),
    status: r.status, dueDate: r.dueDate, taskId: r.taskId,
  }));

  // ---- Delivery reliability — only rows with BOTH a due date and an actual
  // close date are counted; everything else is "insufficient data", never
  // guessed at or silently excluded from the total.
  let onTime = 0; let oneToTwo = 0; let threePlus = 0; let insufficientCount = 0;
  const plannedVsActual = [];
  for (const r of [...rows].reverse().slice(0, 15)) {
    let status = 'Insufficient data';
    if (r.dueDate && r.actualCloseDate) {
      const lateDays = daysBetween(r.dueDate, r.actualCloseDate);
      status = lateDays <= 0 ? 'On Time' : lateDays <= 2 ? '1–2 Days Late' : '3+ Days Late';
    } else if (r.status !== 'Completed') {
      status = r.status;
    }
    plannedVsActual.push({ displayId: r.displayId, dueDate: r.dueDate, actualCloseDate: r.actualCloseDate, status });
  }
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

  // ---- Task health — Blocked only ever from a real open-blocker join
  // result; At Risk is the one other condition backed by real data (overdue
  // and not completed); everything else with enough data to judge is
  // Healthy; no linked task at all is its own honest "unavailable" bucket.
  let healthy = 0; let atRisk = 0; let blockedCount = 0; let unavailable = 0;
  for (const r of rows) {
    const bState = blockerStateOf(r.taskId);
    if (bState === 'blocked') { blockedCount += 1; continue; }
    if (bState === 'unavailable' && !r.dueDate) { unavailable += 1; continue; }
    const overdue = r.status !== 'Completed' && r.dueDate && r.dueDate < TODAY;
    if (overdue) atRisk += 1; else healthy += 1;
  }
  const taskHealth = { healthy, atRisk, blocked: blockedCount, unavailable, total: rows.length };

  const developmentJourney = extractSkills(rows);

  // ---- Tactical discussion — generated from the same conditions the rest
  // of this bundle already computed, not a fixed script.
  const discussionPrompts = [];
  if (pendingRows.length > 0) discussionPrompts.push(`What is blocking ${pendingRows[0].displayId}?`);
  if (blockedRows.length > 0) discussionPrompts.push(`What's needed to unblock ${blockedRows[0].displayId}?`);
  if (missingReview.length > 0) discussionPrompts.push('Which completed task needs review?');
  const topProject = projectDistribution[0];
  if (topProject && topProject.pct >= 60 && projectDistribution.length > 1) {
    discussionPrompts.push('Should the next task diversify project exposure?');
  }
  discussionPrompts.push(`What should ${target.name.split(' ')[0]} own next week?`);

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
    plannedVsActual,
    taskHealth,
    developmentJourney,
    discussionPrompts,
  });
}));

export default router;
