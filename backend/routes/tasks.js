import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prepare } from '../database/db.js';
import { STATUS, TODAY } from '../database/constants.js';
import {
  getTask, getGlobalActivity, insertTaskEvent, insertGlobalActivity, userName,
  scopeTasks, userCanAccessTask, userCanReview, userCanApproveCreation, validateAssignee, insertNotification, teamLeadId, managerIdForDepartment,
} from '../database/helpers.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = Router();
router.use(requireAuth);

// A team lead's or an employee's own task creation needs their manager's
// sign-off before the assignee can act on it — a manager creating a task
// directly is already senior enough that nothing above them needs to check it.
function needsCreationApproval(role) {
  return role === 'team_lead' || role === 'employee';
}

router.get('/', asyncRoute(async (req, res) => {
  const ids = (await prepare('SELECT id FROM tasks ORDER BY seq ASC').all()).map((r) => r.id);
  const allTasks = await Promise.all(ids.map((id) => getTask(id)));
  res.json(await scopeTasks(req.user, allTasks));
}));

router.post('/', requireRole('manager', 'team_lead', 'employee'), asyncRoute(async (req, res) => {
  const b = req.body;
  const validation = await validateAssignee(req.user, b.assigneeId);
  if (!validation.ok) return res.status(403).json({ error: validation.error });
  // Drafts can be saved incomplete (dates may not make sense yet), but a task
  // being assigned right away must have a sane date range.
  if (!b.isDraft && b.startDate && b.startDate < TODAY) {
    return res.status(400).json({ error: "Start date can't be in the past" });
  }
  if (!b.isDraft && b.startDate && b.dueDate && b.dueDate < b.startDate) {
    return res.status(400).json({ error: "Due date can't be before the start date" });
  }

  const id = `task-${randomUUID()}`;
  const pendingApproval = !b.isDraft && needsCreationApproval(req.user.role);
  const status = b.isDraft ? STATUS.DRAFT : (pendingApproval ? STATUS.PENDING_APPROVAL : STATUS.TODO);

  await prepare(`INSERT INTO tasks (id, title, description, instructions, team_id, assignee_id, priority, status, progress, start_date, due_date, estimated_effort, category, created_by, created_at)
    VALUES (@id, @title, @description, @instructions, @teamId, @assigneeId, @priority, @status, 0, @startDate, @dueDate, @estimatedEffort, @category, @createdBy, @createdAt)`).run({
    id,
    title: b.title,
    description: b.description || '',
    instructions: b.instructions || '',
    teamId: validation.teamId,
    assigneeId: b.assigneeId,
    priority: b.priority,
    status,
    startDate: b.startDate || null,
    dueDate: b.dueDate || null,
    estimatedEffort: b.estimatedEffort || '',
    category: b.category || 'Development',
    createdBy: req.user.id,
    createdAt: TODAY,
  });

  const insSubtask = prepare('INSERT INTO task_subtasks (id, task_id, title, done) VALUES (?, ?, ?, ?)');
  for (const s of (b.subtasks || [])) {
    await insSubtask.run(s.id || `st-${randomUUID()}`, id, s.title, s.done ? 1 : 0);
  }

  const assigneeName = await userName(b.assigneeId);
  let activity = null;

  if (b.isDraft) {
    await insertTaskEvent(id, `Task created and assigned to ${assigneeName}`);
  } else if (pendingApproval) {
    await insertTaskEvent(id, `${await userName(req.user.id)} created "${b.title}" for ${assigneeName} — awaiting manager approval`);
    await insertNotification(await managerIdForDepartment(validation.teamId), req.user.id, 'creation_pending', `${await userName(req.user.id)} needs your approval on "${b.title}"`, id);
    // The team lead isn't the approver, but they should still know their own
    // report is waiting on sign-off — insertNotification already no-ops when
    // the creator IS the team lead, so this is safe to call unconditionally.
    await insertNotification(await teamLeadId(validation.teamId), req.user.id, 'creation_pending', `${await userName(req.user.id)} requested approval on "${b.title}"`, id);
  } else {
    await insertTaskEvent(id, `Task created and assigned to ${assigneeName}`);
    await insertGlobalActivity('created', `${await userName(req.user.id)} assigned "${b.title}" to ${assigneeName}`, validation.teamId);
    activity = await getGlobalActivity();
    await insertNotification(b.assigneeId, req.user.id, 'assigned', `${await userName(req.user.id)} assigned you "${b.title}"`, id);
  }

  res.status(201).json({ task: await getTask(id), activity });
}));

router.patch('/:id', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  // A draft can only be edited by the person who started it. A published task
  // can also be edited by whoever created it, or by an admin — but never by
  // just anyone with view access, and reassigning to a different employee only
  // happens through a fresh draft, not by editing one that's already live.
  const isOwner = existing.created_by === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (existing.status === STATUS.DRAFT ? !isOwner : !isOwner && !isAdmin) {
    return res.status(403).json({ error: 'You do not have permission to edit this task' });
  }
  const b = req.body;

  let teamId = existing.team_id;
  if (existing.status === STATUS.DRAFT && b.assigneeId) {
    const validation = await validateAssignee(req.user, b.assigneeId);
    if (!validation.ok) return res.status(403).json({ error: validation.error });
    teamId = validation.teamId;
  }

  // Editing a draft and assigning it in the same save (CreateTask's "Assign
  // task" button while in edit mode) routes through the same approval gate
  // as a fresh creation — the requester's role decides, not just "isn't a draft anymore".
  const publishing = existing.status === STATUS.DRAFT && b.status === STATUS.TODO;
  const pendingApproval = publishing && needsCreationApproval(req.user.role);

  const merged = {
    id: req.params.id,
    title: b.title ?? existing.title,
    description: b.description ?? existing.description,
    instructions: b.instructions ?? existing.instructions,
    teamId,
    assigneeId: existing.status === STATUS.DRAFT ? (b.assigneeId ?? existing.assignee_id) : existing.assignee_id,
    priority: b.priority ?? existing.priority,
    // Status only moves here for the draft->To Do publish-on-save flow; a
    // published task's status changes only through the dedicated action
    // endpoints below (/progress, /status, /submit, /approve, /request-changes).
    status: existing.status === STATUS.DRAFT ? (pendingApproval ? STATUS.PENDING_APPROVAL : (b.status ?? existing.status)) : existing.status,
    startDate: b.startDate ?? existing.start_date,
    dueDate: b.dueDate ?? existing.due_date,
    estimatedEffort: b.estimatedEffort ?? existing.estimated_effort,
    category: b.category ?? existing.category,
  };

  // Same rule as creation: a draft can still be saved with an incomplete/odd
  // date range, but anything that isn't staying a draft must make sense.
  if (merged.status !== STATUS.DRAFT && merged.startDate && merged.startDate < TODAY) {
    return res.status(400).json({ error: "Start date can't be in the past" });
  }
  if (merged.status !== STATUS.DRAFT && merged.startDate && merged.dueDate && merged.dueDate < merged.startDate) {
    return res.status(400).json({ error: "Due date can't be before the start date" });
  }

  await prepare(`UPDATE tasks SET title=@title, description=@description, instructions=@instructions, team_id=@teamId,
    assignee_id=@assigneeId, priority=@priority, status=@status, start_date=@startDate, due_date=@dueDate,
    estimated_effort=@estimatedEffort, category=@category WHERE id=@id`).run(merged);

  if (b.subtasks) {
    await prepare('DELETE FROM task_subtasks WHERE task_id = ?').run(req.params.id);
    const insSubtask = prepare('INSERT INTO task_subtasks (id, task_id, title, done) VALUES (?, ?, ?, ?)');
    for (const s of b.subtasks) {
      await insSubtask.run(s.id || `st-${randomUUID()}`, req.params.id, s.title, s.done ? 1 : 0);
    }
  }

  let activity = null;
  if (publishing && pendingApproval) {
    const assigneeName = await userName(merged.assigneeId);
    await insertTaskEvent(req.params.id, `${await userName(req.user.id)} created "${merged.title}" for ${assigneeName} — awaiting manager approval`);
    await insertNotification(await managerIdForDepartment(merged.teamId), req.user.id, 'creation_pending', `${await userName(req.user.id)} needs your approval on "${merged.title}"`, req.params.id);
    await insertNotification(await teamLeadId(merged.teamId), req.user.id, 'creation_pending', `${await userName(req.user.id)} requested approval on "${merged.title}"`, req.params.id);
  } else if (publishing) {
    const assigneeName = await userName(merged.assigneeId);
    await insertTaskEvent(req.params.id, `Assigned to ${assigneeName}`);
    await insertGlobalActivity('created', `${await userName(existing.created_by)} assigned "${merged.title}" to ${assigneeName}`, merged.teamId);
    activity = await getGlobalActivity();
    await insertNotification(merged.assigneeId, req.user.id, 'assigned', `${await userName(req.user.id)} assigned you "${merged.title}"`, req.params.id);
  }

  res.json({ task: await getTask(req.params.id), activity });
}));

router.delete('/:id', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT status, created_by FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  const isOwner = existing.created_by === req.user.id;
  const isAdmin = req.user.role === 'admin';
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'You do not have permission to delete this task' });
  await prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

router.post('/:id/publish', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing || existing.status !== STATUS.DRAFT || existing.created_by !== req.user.id) {
    return res.status(404).json({ error: 'Draft not found' });
  }
  if (existing.start_date && existing.start_date < TODAY) {
    return res.status(400).json({ error: "Start date can't be in the past" });
  }
  if (existing.start_date && existing.due_date && existing.due_date < existing.start_date) {
    return res.status(400).json({ error: "Due date can't be before the start date" });
  }

  const assigneeName = await userName(existing.assignee_id);
  if (needsCreationApproval(req.user.role)) {
    await prepare('UPDATE tasks SET status = ? WHERE id = ?').run(STATUS.PENDING_APPROVAL, req.params.id);
    await insertTaskEvent(req.params.id, `${await userName(req.user.id)} created "${existing.title}" for ${assigneeName} — awaiting manager approval`);
    await insertNotification(await managerIdForDepartment(existing.team_id), req.user.id, 'creation_pending', `${await userName(req.user.id)} needs your approval on "${existing.title}"`, req.params.id);
    await insertNotification(await teamLeadId(existing.team_id), req.user.id, 'creation_pending', `${await userName(req.user.id)} requested approval on "${existing.title}"`, req.params.id);
    return res.json({ task: await getTask(req.params.id), activity: null });
  }

  await prepare('UPDATE tasks SET status = ? WHERE id = ?').run(STATUS.TODO, req.params.id);
  await insertTaskEvent(req.params.id, `Assigned to ${assigneeName}`);
  await insertGlobalActivity('created', `${await userName(existing.created_by)} assigned "${existing.title}" to ${assigneeName}`, existing.team_id);
  await insertNotification(existing.assignee_id, req.user.id, 'assigned', `${await userName(req.user.id)} assigned you "${existing.title}"`, req.params.id);

  res.json({ task: await getTask(req.params.id), activity: await getGlobalActivity() });
}));

router.post('/:id/approve-creation', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!(await userCanApproveCreation(req.user, existing))) return res.status(403).json({ error: 'You are not authorized to approve this task' });
  if (existing.status !== STATUS.PENDING_APPROVAL) return res.status(400).json({ error: 'This task is not waiting on approval' });

  await prepare('UPDATE tasks SET status = ? WHERE id = ?').run(STATUS.TODO, req.params.id);
  const assigneeName = await userName(existing.assignee_id);
  await insertTaskEvent(req.params.id, `${await userName(req.user.id)} approved this task — now assigned to ${assigneeName}`);
  await insertGlobalActivity('created', `${await userName(req.user.id)} approved "${existing.title}" for ${assigneeName}`, existing.team_id);
  await insertNotification(existing.assignee_id, req.user.id, 'assigned', `${await userName(req.user.id)} approved and assigned you "${existing.title}"`, req.params.id);
  await insertNotification(existing.created_by, req.user.id, 'creation_approved', `${await userName(req.user.id)} approved "${existing.title}"`, req.params.id);

  res.json({ task: await getTask(req.params.id), activity: await getGlobalActivity() });
}));

router.post('/:id/reject-creation', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!(await userCanApproveCreation(req.user, existing))) return res.status(403).json({ error: 'You are not authorized to reject this task' });
  if (existing.status !== STATUS.PENDING_APPROVAL) return res.status(400).json({ error: 'This task is not waiting on approval' });

  const reason = (req.body.reason || '').trim();
  await prepare('UPDATE tasks SET status = ? WHERE id = ?').run(STATUS.DRAFT, req.params.id);
  await insertTaskEvent(req.params.id, reason ? `${await userName(req.user.id)} sent this back for changes: ${reason}` : `${await userName(req.user.id)} sent this back for changes`);
  await insertNotification(existing.created_by, req.user.id, 'creation_rejected', reason ? `${await userName(req.user.id)} sent "${existing.title}" back: ${reason}` : `${await userName(req.user.id)} sent "${existing.title}" back for changes`, req.params.id);

  res.json({ task: await getTask(req.params.id), activity: null });
}));

// Reassigning a live task to a different employee — same authority as
// reviewing it (admin, the task's team lead, or the department manager), so
// an employee can never trigger this even with a crafted request.
router.post('/:id/reassign', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!(await userCanReview(req.user, existing))) return res.status(403).json({ error: 'You are not authorized to reassign this task' });
  if (existing.status === STATUS.DRAFT || existing.status === STATUS.COMPLETED) {
    return res.status(400).json({ error: 'This task cannot be reassigned in its current state' });
  }

  const { assigneeId } = req.body;
  if (!assigneeId) return res.status(400).json({ error: 'A new assignee is required' });
  if (assigneeId === existing.assignee_id) return res.status(400).json({ error: 'That person is already assigned to this task' });

  const validation = await validateAssignee(req.user, assigneeId);
  if (!validation.ok) return res.status(403).json({ error: validation.error });

  const previousAssigneeName = await userName(existing.assignee_id);
  const newAssigneeName = await userName(assigneeId);
  await prepare('UPDATE tasks SET assignee_id = ?, team_id = ? WHERE id = ?').run(assigneeId, validation.teamId, req.params.id);
  await insertTaskEvent(req.params.id, `${await userName(req.user.id)} reassigned this task from ${previousAssigneeName} to ${newAssigneeName}`);
  await insertNotification(assigneeId, req.user.id, 'reassigned', `${await userName(req.user.id)} reassigned "${existing.title}" to you`, req.params.id);

  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.patch('/:id/progress', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (existing.assignee_id !== req.user.id) return res.status(403).json({ error: 'Only the assignee can update progress' });
  if (existing.status === STATUS.PENDING_APPROVAL) return res.status(400).json({ error: 'This task is still waiting on manager approval' });

  const progress = Number(req.body.progress);
  let status = existing.status;
  if (progress > 0 && status === STATUS.TODO) status = STATUS.IN_PROGRESS;
  if (progress >= 100 && status !== STATUS.IN_REVIEW && status !== STATUS.COMPLETED) status = STATUS.IN_PROGRESS;

  await prepare('UPDATE tasks SET progress = ?, status = ? WHERE id = ?').run(progress, status, req.params.id);
  await insertTaskEvent(req.params.id, `Progress updated to ${progress}%`);
  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.patch('/:id/status', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (existing.assignee_id !== req.user.id) return res.status(403).json({ error: 'Only the assignee can update status' });
  if (existing.status === STATUS.PENDING_APPROVAL) return res.status(400).json({ error: 'This task is still waiting on manager approval' });

  const { status } = req.body;
  await prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.id);
  await insertTaskEvent(req.params.id, `Status changed to "${status}"`);
  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.post('/:id/request-changes', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!(await userCanReview(req.user, existing))) return res.status(403).json({ error: 'You are not a reviewer for this task' });

  await prepare('UPDATE tasks SET status = ? WHERE id = ?').run(STATUS.IN_PROGRESS, req.params.id);
  await insertTaskEvent(req.params.id, 'Reviewer requested changes — back to In Progress');
  await insertNotification(existing.assignee_id, req.user.id, 'changes_requested', `${await userName(req.user.id)} requested changes on "${existing.title}"`, req.params.id);
  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.post('/:id/submit', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (existing.assignee_id !== req.user.id) return res.status(403).json({ error: 'Only the assignee can submit this task' });
  if (existing.status === STATUS.PENDING_APPROVAL) return res.status(400).json({ error: 'This task is still waiting on manager approval' });

  // A short note from the assignee — what they did, a deployed link, anything
  // the reviewer should know — shown alongside the task once submitted.
  // Optional: an empty note just clears whatever was there from a prior
  // submit-request changes-resubmit cycle.
  const note = typeof req.body.note === 'string' ? req.body.note.trim() : (existing.submission_note || '');
  await prepare('UPDATE tasks SET status = ?, progress = 100, submission_note = ? WHERE id = ?').run(STATUS.IN_REVIEW, note, req.params.id);
  await insertTaskEvent(req.params.id, 'Submitted for review');
  await insertGlobalActivity('submitted', `${await userName(existing.assignee_id)} submitted "${existing.title}" for review`, existing.team_id);
  await insertNotification(await teamLeadId(existing.team_id), req.user.id, 'submitted', `${await userName(req.user.id)} submitted "${existing.title}" for review`, req.params.id);

  res.json({ task: await getTask(req.params.id), activity: await getGlobalActivity() });
}));

router.post('/:id/approve', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!(await userCanReview(req.user, existing))) return res.status(403).json({ error: 'You are not a reviewer for this task' });

  await prepare('UPDATE tasks SET status = ?, progress = 100 WHERE id = ?').run(STATUS.COMPLETED, req.params.id);
  await insertTaskEvent(req.params.id, 'Approved — task completed');
  await insertGlobalActivity('completed', `${await userName(existing.assignee_id)}'s "${existing.title}" was approved`, existing.team_id);
  await insertNotification(existing.assignee_id, req.user.id, 'approved', `${await userName(req.user.id)} approved "${existing.title}"`, req.params.id);

  res.json({ task: await getTask(req.params.id), activity: await getGlobalActivity() });
}));

router.post('/:id/request-extension', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (existing.assignee_id !== req.user.id) return res.status(403).json({ error: 'Only the assignee can request an extension' });
  if (existing.status === STATUS.IN_REVIEW || existing.status === STATUS.COMPLETED || existing.status === STATUS.DRAFT || existing.status === STATUS.PENDING_APPROVAL) {
    return res.status(400).json({ error: 'An extension can only be requested while the task is still in progress' });
  }

  const { requestedDueDate, reason } = req.body;
  if (!requestedDueDate) return res.status(400).json({ error: 'A new due date is required' });
  if (existing.due_date && requestedDueDate <= existing.due_date) {
    return res.status(400).json({ error: 'The new due date must be later than the current one' });
  }
  if (!reason || !reason.trim()) return res.status(400).json({ error: 'A reason is required' });

  await prepare('UPDATE tasks SET requested_due_date = ?, extension_reason = ? WHERE id = ?')
    .run(requestedDueDate, reason.trim(), req.params.id);
  await insertTaskEvent(req.params.id, `${await userName(req.user.id)} requested extending the due date to ${requestedDueDate}`);
  await insertNotification(await teamLeadId(existing.team_id), req.user.id, 'extension_requested', `${await userName(req.user.id)} requested a due date extension on "${existing.title}"`, req.params.id);

  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.post('/:id/approve-extension', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!(await userCanReview(req.user, existing))) return res.status(403).json({ error: 'You are not a reviewer for this task' });
  if (!existing.requested_due_date) return res.status(400).json({ error: 'There is no pending extension request' });

  const newDueDate = existing.requested_due_date;
  await prepare('UPDATE tasks SET due_date = ?, requested_due_date = NULL, extension_reason = NULL WHERE id = ?')
    .run(newDueDate, req.params.id);
  await insertTaskEvent(req.params.id, `Extension approved — due date moved to ${newDueDate}`);
  await insertNotification(existing.assignee_id, req.user.id, 'extension_approved', `${await userName(req.user.id)} approved your extension request on "${existing.title}" — new due date ${newDueDate}`, req.params.id);

  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.post('/:id/reject-extension', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!(await userCanReview(req.user, existing))) return res.status(403).json({ error: 'You are not a reviewer for this task' });
  if (!existing.requested_due_date) return res.status(400).json({ error: 'There is no pending extension request' });

  await prepare('UPDATE tasks SET requested_due_date = NULL, extension_reason = NULL WHERE id = ?').run(req.params.id);
  await insertTaskEvent(req.params.id, 'Extension request declined');
  await insertNotification(existing.assignee_id, req.user.id, 'extension_rejected', `${await userName(req.user.id)} declined your extension request on "${existing.title}"`, req.params.id);

  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.patch('/:id/marks', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  if (!(await userCanReview(req.user, existing))) return res.status(403).json({ error: 'You are not a reviewer for this task' });
  // Grading only makes sense once there's submitted work to grade — not on a
  // task that's still To Do/In Progress, and never on a Draft.
  if (existing.status !== STATUS.IN_REVIEW && existing.status !== STATUS.COMPLETED) {
    return res.status(400).json({ error: 'Marks can only be given once a task has been submitted for review' });
  }

  const { marks } = req.body;
  if (marks !== null && (typeof marks !== 'number' || !Number.isInteger(marks) || marks < 0 || marks > 100)) {
    return res.status(400).json({ error: 'Marks must be a whole number between 0 and 100' });
  }

  await prepare('UPDATE tasks SET marks = ? WHERE id = ?').run(marks, req.params.id);
  if (marks !== null) {
    await insertTaskEvent(req.params.id, `Marked ${marks}% by ${await userName(req.user.id)}`);
    await insertNotification(existing.assignee_id, req.user.id, 'marked', `${await userName(req.user.id)} gave you ${marks}% on "${existing.title}"`, req.params.id);
  }

  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.patch('/:id/subtasks/:subtaskId', asyncRoute(async (req, res) => {
  const task = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.assignee_id !== req.user.id) return res.status(403).json({ error: 'Only the assignee can update subtasks' });

  const sub = await prepare('SELECT * FROM task_subtasks WHERE id = ? AND task_id = ?').get(req.params.subtaskId, req.params.id);
  if (!sub) return res.status(404).json({ error: 'Subtask not found' });

  await prepare('UPDATE task_subtasks SET done = ? WHERE id = ?').run(sub.done ? 0 : 1, req.params.subtaskId);
  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.post('/:id/comments', asyncRoute(async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });
  const task = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!(await userCanAccessTask(req.user, task))) return res.status(403).json({ error: 'You do not have access to this task' });

  // authorId always comes from the verified session, never the request body —
  // otherwise anyone could post a comment attributed to someone else.
  await prepare('INSERT INTO comments (id, task_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(`c-${randomUUID()}`, req.params.id, req.user.id, text.trim(), TODAY);

  // Notify the other people on this task — insertNotification already no-ops
  // when the recipient is the commenter themselves, so this naturally covers
  // "assignee comments" (notify creator), "creator comments" (notify
  // assignee), and "third party comments" (notify both) with one call each.
  const commentText = `${await userName(req.user.id)} commented on "${task.title}"`;
  await insertNotification(task.assignee_id, req.user.id, 'comment_added', commentText, req.params.id);
  await insertNotification(task.created_by, req.user.id, 'comment_added', commentText, req.params.id);

  res.status(201).json({ task: await getTask(req.params.id), activity: null });
}));

router.patch('/:id/comments/:commentId', asyncRoute(async (req, res) => {
  const comment = await prepare('SELECT * FROM comments WHERE id = ? AND task_id = ?').get(req.params.commentId, req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.author_id !== req.user.id) return res.status(403).json({ error: 'You can only edit your own comments' });

  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });
  await prepare('UPDATE comments SET text = ? WHERE id = ?').run(text.trim(), req.params.commentId);
  res.json({ task: await getTask(req.params.id), activity: null });
}));

router.delete('/:id/comments/:commentId', asyncRoute(async (req, res) => {
  const task = await prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const comment = await prepare('SELECT * FROM comments WHERE id = ? AND task_id = ?').get(req.params.commentId, req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  const isOwner = comment.author_id === req.user.id;
  // Admin/manager override: moderation reach follows the same scope rule as
  // viewing the task (a manager can only moderate within their own department).
  const isModerator = (req.user.role === 'admin' || req.user.role === 'manager') && (await userCanAccessTask(req.user, task));
  if (!isOwner && !isModerator) return res.status(403).json({ error: 'You do not have permission to delete this comment' });

  await prepare('DELETE FROM comments WHERE id = ?').run(req.params.commentId);
  res.json({ task: await getTask(req.params.id), activity: null });
}));

export default router;
