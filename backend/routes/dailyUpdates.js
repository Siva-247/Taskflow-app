import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prepare } from '../database/db.js';
import { TODAY } from '../database/constants.js';
import { getGlobalActivity, insertGlobalActivity, userName } from '../database/helpers.js';
import { scopeDailyUpdates, canManage } from '../database/hierarchy.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = Router();
router.use(requireAuth);

const SELECT_COLUMNS = `id, seq, user_id as "userId", task_id as "taskId", task_title as "taskTitle", date, status,
  task_completed as "taskCompleted", concepts_covered as "conceptsCovered", practical_task as "practicalTask",
  videos_completed as "videosCompleted", video_link as "videoLink",
  milestone, project, deliverables, self_assessment as "selfAssessment", resources,
  department_id as "departmentId", priority, due_date as "dueDate", actual_close_date as "actualCloseDate",
  task_start_date as "taskStartDate",
  bdm_remarks as "bdmRemarks", bdm_remarks_by as "bdmRemarksBy", bdm_remarks_at as "bdmRemarksAt",
  custom_task_id as "customTaskId"`;

// Priority and "start date" are never taken from the client — like
// taskTitle, they're a snapshot of whatever the linked task says at the
// moment this row is written. No linked task means both stay null; the form
// never offers a manual fallback for either any more.
async function linkedTaskSnapshot(taskId) {
  if (!taskId) return { priority: null, taskStartDate: null };
  const task = await prepare('SELECT priority, start_date FROM tasks WHERE id = ?').get(taskId);
  return { priority: task?.priority || null, taskStartDate: task?.start_date || null };
}

router.get('/', asyncRoute(async (req, res) => {
  const all = await prepare(`SELECT ${SELECT_COLUMNS} FROM daily_updates ORDER BY seq ASC`).all();
  res.json(await scopeDailyUpdates(req.user, all));
}));

// Every teammate in scope, regardless of whether they've logged anything —
// unlike scopeRowsForDashboard above (which only ever surfaces whoever
// already has a daily_update row), this IS the roster: /member-stats and
// /timeline both build from this so someone who hasn't submitted anything
// still shows up as an empty row instead of silently not existing — a Team
// Lead should be able to see who on their team hasn't logged, not just who
// has. Same scope shape as scopeRowsForDashboard (team/department/all), but
// read straight off the users table.
export async function scopedRoster(user) {
  const columns = `id, name, title, team_id as "teamId", department_id as "departmentId"`;
  let scope;
  let users;
  if (user.role === 'super_admin' || user.role === 'admin') {
    scope = 'all';
    users = await prepare(`SELECT ${columns} FROM users WHERE role NOT IN ('admin', 'super_admin') AND is_active = 1`).all();
  } else if (user.role === 'manager' || user.role === 'assistant_manager') {
    scope = 'department';
    users = await prepare(`SELECT ${columns} FROM users WHERE department_id = ? AND role NOT IN ('admin', 'super_admin') AND is_active = 1`).all(user.department_id);
  } else if (user.role === 'team_lead') {
    scope = 'team';
    users = await prepare(`SELECT ${columns} FROM users WHERE team_id = ? AND role NOT IN ('admin', 'super_admin') AND is_active = 1`).all(user.team_id);
  } else {
    scope = 'self';
    users = [];
  }
  const departmentRows = await prepare('SELECT id, name FROM departments').all();
  const deptNameById = new Map(departmentRows.map((d) => [d.id, d.name]));
  return {
    scope,
    // The viewer's own row never appears in their team's roster — same
    // self-exclusion canManage applies everywhere else.
    users: users.filter((u) => u.id !== user.id).map((u) => ({ ...u, departmentName: deptNameById.get(u.departmentId) || null })),
  };
}

// Per-person "how many daily entries, how many of those Completed" —
// replaces the Team Lead/Assistant Manager dashboards' old Team Members
// table (that roster now lives only on My Team) with a completion chart
// instead. Every daily_update entry counts as one unit regardless of its
// linked task, per the same "one entry, one day" rule the form itself
// enforces — this is a count of entries, not of Task rows. Built from the
// full roster (scopedRoster), so someone who hasn't logged anything still
// shows up at 0/0 instead of not existing. Optional ?from=&to= (inclusive,
// YYYY-MM-DD) restricts which entries count — the chart's date-range filter
// needs this server-side since the aggregate itself changes per range, not
// just which pre-computed rows are shown.
router.get('/member-stats', asyncRoute(async (req, res) => {
  const user = req.user;
  const { from, to } = req.query;
  const { scope, users: roster } = await scopedRoster(user);

  const counts = new Map();
  if (roster.length > 0) {
    const placeholders = roster.map(() => '?').join(', ');
    const rows = (from && to)
      ? await prepare(`SELECT user_id as "userId", status FROM daily_updates WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ?`).all(...roster.map((u) => u.id), from, to)
      : await prepare(`SELECT user_id as "userId", status FROM daily_updates WHERE user_id IN (${placeholders})`).all(...roster.map((u) => u.id));
    for (const r of rows) {
      if (!counts.has(r.userId)) counts.set(r.userId, { total: 0, completed: 0 });
      const c = counts.get(r.userId);
      c.total += 1;
      if (r.status === 'Completed') c.completed += 1;
    }
  }

  const members = roster
    .map((u) => {
      const c = counts.get(u.id) || { total: 0, completed: 0 };
      return { id: u.id, name: u.name, title: u.title, departmentId: u.departmentId, departmentName: u.departmentName, total: c.total, completed: c.completed };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ scope, members });
}));

// Per-person, per-day project timeline for the Gantt-style "current
// projects" board — one row per teammate, one raw {date, project, status}
// entry per day they logged (no aggregation: the frontend merges consecutive
// same-project days into a single bar itself, so a gap or a project switch
// is visible exactly where it actually happened). Same full-roster shape as
// member-stats — someone with nothing logged still gets a row, just an
// empty one. Same optional ?from=&to= as member-stats; omitting both
// returns every dated entry ever logged. `departmentId` only ever NARROWS
// the roster scopedRoster already authorized (matters for admin/super_admin,
// whose scope is company-wide) — every other role already sees at most their
// own department/team, so this is a no-op filter for them, never a widening.
router.get('/timeline', asyncRoute(async (req, res) => {
  const user = req.user;
  const { from, to, departmentId } = req.query;
  const { scope, users: fullRoster } = await scopedRoster(user);
  const roster = departmentId ? fullRoster.filter((u) => u.departmentId === departmentId) : fullRoster;

  const byUser = new Map();
  if (roster.length > 0) {
    const placeholders = roster.map(() => '?').join(', ');
    const rows = (from && to)
      ? await prepare(
        `SELECT user_id as "userId", date, project, status FROM daily_updates
         WHERE user_id IN (${placeholders}) AND date >= ? AND date <= ? AND project IS NOT NULL AND TRIM(project) NOT IN ('', '-')`,
      ).all(...roster.map((u) => u.id), from, to)
      : await prepare(
        `SELECT user_id as "userId", date, project, status FROM daily_updates
         WHERE user_id IN (${placeholders}) AND project IS NOT NULL AND TRIM(project) NOT IN ('', '-')`,
      ).all(...roster.map((u) => u.id));
    for (const r of rows) {
      if (!byUser.has(r.userId)) byUser.set(r.userId, []);
      byUser.get(r.userId).push({ date: r.date, project: r.project.trim(), status: r.status });
    }
  }

  const members = roster
    .map((u) => ({
      id: u.id, name: u.name, title: u.title, departmentId: u.departmentId, departmentName: u.departmentName,
      entries: (byUser.get(u.id) || []).sort((a, b) => (a.date < b.date ? -1 : 1)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ scope, members });
}));

router.post('/', asyncRoute(async (req, res) => {
  const b = req.body;
  const id = `du-${randomUUID()}`;

  // One update per person per day — the unique index backs this up at the
  // database level too, but checking here first gives a clear error instead
  // of a raw constraint-violation.
  const existing = await prepare('SELECT id FROM daily_updates WHERE user_id = ? AND date = ?').get(req.user.id, b.date);
  if (existing) return res.status(409).json({ error: "You already have an update for this date — edit it instead of creating a new one." });

  const { priority, taskStartDate } = await linkedTaskSnapshot(b.taskId);

  // Every new entry gets a real TK### id, not just the ones backfilled from
  // the spreadsheet — nextval() on a dedicated sequence is atomic under
  // concurrent submissions in a way a MAX(...)+1 query never is.
  const { n: taskIdSeq } = await prepare("SELECT nextval('daily_update_task_id_seq') as n").get();
  const customTaskId = `TK${String(taskIdSeq).padStart(3, '0')}`;

  // userId and departmentId always come from the verified session, never the
  // request body — otherwise anyone could log a daily update as someone else,
  // or under a department they don't belong to. Priority/taskStartDate come
  // from the linked task, never the client, same reasoning. actualCloseDate
  // is likewise never client-supplied: it's stamped the moment status is
  // Completed, mirroring exactly how the Blocker Register auto-stamps
  // closedDate. The older concepts_covered/practical_task/videos_completed/
  // video_link columns are NOT NULL — a new-format submission just fills
  // them with their defaults rather than dropping them from the table.
  await prepare(`INSERT INTO daily_updates (id, user_id, task_id, task_title, date, status, task_completed, concepts_covered, practical_task, videos_completed, video_link,
    milestone, project, deliverables, self_assessment, resources, department_id, priority, due_date, actual_close_date, task_start_date, custom_task_id)
    VALUES (@id, @userId, @taskId, @taskTitle, @date, @status, @taskCompleted, @conceptsCovered, @practicalTask, @videosCompleted, @videoLink,
    @milestone, @project, @deliverables, @selfAssessment, @resources, @departmentId, @priority, @dueDate, @actualCloseDate, @taskStartDate, @customTaskId)`).run({
    id,
    customTaskId,
    userId: req.user.id,
    taskId: b.taskId || null,
    taskTitle: b.taskTitle || '',
    date: b.date,
    status: b.status,
    taskCompleted: b.taskCompleted,
    conceptsCovered: b.conceptsCovered || '',
    practicalTask: b.practicalTask || '',
    videosCompleted: b.videosCompleted || 0,
    videoLink: b.videoLink || '',
    milestone: b.milestone || null,
    project: b.project || null,
    deliverables: b.deliverables || null,
    selfAssessment: b.selfAssessment || null,
    resources: b.resources || null,
    departmentId: req.user.department_id || null,
    priority,
    dueDate: b.dueDate || null,
    actualCloseDate: b.status === 'Completed' ? TODAY : null,
    taskStartDate,
  });

  await insertGlobalActivity('update', `${req.user.name} logged a daily update`, req.user.team_id);

  const dailyUpdate = await prepare(`SELECT ${SELECT_COLUMNS} FROM daily_updates WHERE id = ?`).get(id);
  res.status(201).json({ dailyUpdate, activity: await getGlobalActivity() });
}));

router.patch('/:id', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM daily_updates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Daily update not found' });
  if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own daily updates' });
  if (existing.date !== TODAY) return res.status(403).json({ error: 'You can only edit a daily update from today' });

  const b = req.body;
  // Same reopen/close-date rule as the Blocker Register: actual_close_date
  // only ever moves because status crossed the Completed boundary, never
  // from a client-supplied value.
  const nextStatus = b.status ?? existing.status;
  const closingNow = nextStatus === 'Completed' && existing.status !== 'Completed';
  const reopening = nextStatus !== 'Completed' && existing.status === 'Completed';
  const actualCloseDate = closingNow ? TODAY : (reopening ? null : existing.actual_close_date);

  // Re-snapshot priority/taskStartDate whenever the effective linked task
  // could have changed — cheap (one lookup) and keeps them correct even if
  // taskId itself wasn't part of this particular edit.
  const effectiveTaskId = b.taskId ?? existing.task_id;
  const { priority, taskStartDate } = await linkedTaskSnapshot(effectiveTaskId);

  await prepare(`UPDATE daily_updates SET task_id=@taskId, task_title=@taskTitle, status=@status, task_completed=@taskCompleted,
    concepts_covered=@conceptsCovered, practical_task=@practicalTask, videos_completed=@videosCompleted, video_link=@videoLink,
    milestone=@milestone, project=@project, deliverables=@deliverables, self_assessment=@selfAssessment, resources=@resources,
    priority=@priority, due_date=@dueDate, actual_close_date=@actualCloseDate, task_start_date=@taskStartDate
    WHERE id=@id`).run({
    id: req.params.id,
    taskId: effectiveTaskId,
    taskTitle: b.taskTitle ?? existing.task_title,
    status: nextStatus,
    taskCompleted: b.taskCompleted ?? existing.task_completed,
    conceptsCovered: b.conceptsCovered ?? existing.concepts_covered,
    practicalTask: b.practicalTask ?? existing.practical_task,
    videosCompleted: b.videosCompleted ?? existing.videos_completed,
    videoLink: b.videoLink ?? existing.video_link,
    milestone: b.milestone ?? existing.milestone,
    project: b.project ?? existing.project,
    deliverables: b.deliverables ?? existing.deliverables,
    selfAssessment: b.selfAssessment ?? existing.self_assessment,
    resources: b.resources ?? existing.resources,
    priority,
    dueDate: b.dueDate ?? existing.due_date,
    actualCloseDate,
    taskStartDate,
  });

  const dailyUpdate = await prepare(`SELECT ${SELECT_COLUMNS} FROM daily_updates WHERE id = ?`).get(req.params.id);
  res.json({ dailyUpdate });
}));

// A reviewer's remarks on someone else's already-submitted entry — separate
// endpoint, separate authority, from the author-only PATCH above. Mirrors
// Task Details' reviewer actions being distinct from the assignee's own:
// canManage already encodes "outranks them, in scope" exactly the way this
// needs (same cascading rank+scope authority used for credential edits and
// blocker management), so no new authorization logic is needed here.
router.patch('/:id/review', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM daily_updates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Daily update not found' });
  const author = await prepare('SELECT * FROM users WHERE id = ?').get(existing.user_id);
  if (!author || !canManage(req.user, author)) {
    return res.status(403).json({ error: 'You do not have permission to review this update' });
  }
  const remarks = (req.body.bdmRemarks || '').trim();
  if (!remarks) return res.status(400).json({ error: 'Remarks are required' });

  await prepare(`UPDATE daily_updates SET bdm_remarks=@remarks, bdm_remarks_by=@reviewerId, bdm_remarks_at=@at WHERE id=@id`).run({
    id: req.params.id,
    remarks,
    reviewerId: req.user.id,
    at: TODAY,
  });

  const dailyUpdate = await prepare(`SELECT ${SELECT_COLUMNS} FROM daily_updates WHERE id = ?`).get(req.params.id);
  res.json({ dailyUpdate });
}));

// Daily updates can never be deleted by their own author — only edited
// (and only today's). Admin retains delete for legitimate data correction.
// Same rule as PATCH: today's own entry is the only one anyone but admin can
// touch at all — once the day rolls over it becomes a fixed historical
// record, edit or delete both blocked. Admin keeps a standing override for
// legitimate corrections to older rows.
router.delete('/:id', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM daily_updates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Daily update not found' });
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own daily updates' });
    if (existing.date !== TODAY) return res.status(403).json({ error: 'You can only delete a daily update from today' });
  }

  await prepare('DELETE FROM daily_updates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

export default router;
