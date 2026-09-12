import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prepare } from '../database/db.js';
import { TODAY } from '../database/constants.js';
import { insertGlobalActivity } from '../database/helpers.js';
import { canManageBlocker, canManage } from '../database/hierarchy.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = Router();
router.use(requireAuth);

export const CLOSED_STATUSES = ['Resolved', 'Closed'];

const SELECT_COLUMNS = `id, linked_task_id as "linkedTaskId", linked_task_title as "linkedTaskTitle", raised_by as "raisedBy", project, raised_date as "raisedDate",
  category, description, blocking_what as "blockingWhat", owner_to_resolve_id as "ownerToResolveId",
  target_resolution as "targetResolution", escalation_level as "escalationLevel", status,
  closed_date as "closedDate", resolution_note as "resolutionNote", seq`;

// Deliberately unscoped — every logged-in user sees every blocker regardless
// of role/department/team (see schema.postgres.sql's comment on the table
// itself). Resolving one often needs someone outside the raiser's own chain,
// so hiding it from them would defeat the point.
router.get('/', asyncRoute(async (req, res) => {
  const rows = await prepare(`SELECT ${SELECT_COLUMNS} FROM blockers ORDER BY seq ASC`).all();
  res.json(rows);
}));

// The one place a genuinely company-wide (not department-scoped) user list
// is needed: naming an "Owner to Resolve" who may be outside the raiser's
// own department. Separate from GET /api/users, which stays department-
// scoped for everything else that relies on that.
router.get('/directory', asyncRoute(async (req, res) => {
  const rows = await prepare(`SELECT id, name, initial, department_id as "departmentId", team_id as "teamId", role FROM users WHERE is_active = 1 ORDER BY name ASC`).all();
  res.json(rows);
}));

router.post('/', asyncRoute(async (req, res) => {
  const b = req.body;
  if (!b.category) return res.status(400).json({ error: 'Category is required' });
  if (!b.description || !b.description.trim()) return res.status(400).json({ error: 'Description is required' });
  if (!b.escalationLevel) return res.status(400).json({ error: 'Escalation level is required' });

  let linkedTaskTitle = '';
  if (b.linkedTaskId) {
    const task = await prepare('SELECT title FROM tasks WHERE id = ?').get(b.linkedTaskId);
    if (!task) return res.status(400).json({ error: 'Linked task not found' });
    linkedTaskTitle = task.title;
  }
  let owner = null;
  if (b.ownerToResolveId) {
    owner = await prepare('SELECT * FROM users WHERE id = ?').get(b.ownerToResolveId);
    if (!owner) return res.status(400).json({ error: 'Owner to resolve not found' });
  }

  const id = `blocker-${randomUUID()}`;
  // raisedBy always comes from the verified session, never the request body
  // — otherwise anyone could raise a blocker as someone else.
  await prepare(`INSERT INTO blockers (id, linked_task_id, linked_task_title, raised_by, project, raised_date, category, description,
    blocking_what, owner_to_resolve_id, target_resolution, escalation_level, status, resolution_note)
    VALUES (@id, @linkedTaskId, @linkedTaskTitle, @raisedBy, @project, @raisedDate, @category, @description, @blockingWhat,
    @ownerToResolveId, @targetResolution, @escalationLevel, 'Open', '')`).run({
    id,
    linkedTaskId: b.linkedTaskId || null,
    linkedTaskTitle,
    raisedBy: req.user.id,
    project: b.project || '',
    raisedDate: b.raisedDate || TODAY,
    category: b.category,
    description: b.description.trim(),
    blockingWhat: b.blockingWhat || '',
    ownerToResolveId: b.ownerToResolveId || null,
    targetResolution: b.targetResolution || null,
    escalationLevel: b.escalationLevel,
  });

  await insertGlobalActivity('blocker_raised', `${req.user.name} raised a blocker (${b.category})`, req.user.team_id);

  if (owner) {
    await prepare('INSERT INTO notifications (id, user_id, type, text, blocker_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
      .run(`note-${randomUUID()}`, owner.id, 'blocker_assigned', `${req.user.name} named you as owner to resolve a blocker`, id, TODAY);
  }

  // Also tell everyone with management authority over the raiser — their
  // team lead, assistant manager, manager, and any admin/super admin.
  // Deliberately narrower than canManageBlocker itself (which now lets ANY
  // management-tier role act on ANY blocker company-wide, not just the
  // raiser's own chain) — proactively notifying every manager/lead in the
  // company every time anyone raises a blocker would be noise, not signal;
  // the register itself is where someone outside the chain would go
  // looking. Skips whoever was already notified as the named owner, and
  // never notifies the raiser about their own submission (canManage
  // already excludes self-management).
  const allUsers = await prepare('SELECT * FROM users WHERE is_active = 1').all();
  const chain = allUsers.filter((u) => u.id !== owner?.id && canManage(u, req.user));
  const insertChainNotification = prepare('INSERT INTO notifications (id, user_id, type, text, blocker_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)');
  for (const person of chain) {
    await insertChainNotification.run(`note-${randomUUID()}`, person.id, 'blocker_assigned', `${req.user.name} raised a blocker (${b.category})`, id, TODAY);
  }

  const blocker = await prepare(`SELECT ${SELECT_COLUMNS} FROM blockers WHERE id = ?`).get(id);
  res.status(201).json({ blocker });
}));

router.patch('/:id', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM blockers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Blocker not found' });

  if (!canManageBlocker(req.user, existing)) {
    return res.status(403).json({ error: 'You do not have permission to update this blocker' });
  }

  const b = req.body;

  // `??` treats an explicit `null` the same as "field omitted", which is
  // wrong for these two nullable references — clearing "Linked task"/"Owner
  // to resolve" back to none must actually stick, not silently keep the old
  // value. Every other field here is either non-nullable or a plain
  // required-on-write value, so `??` (letting a genuinely-omitted field fall
  // back to what's already stored) is correct for those.
  const linkedTaskId = b.linkedTaskId !== undefined ? b.linkedTaskId : existing.linked_task_id;
  const ownerToResolveId = b.ownerToResolveId !== undefined ? b.ownerToResolveId : existing.owner_to_resolve_id;

  let linkedTaskTitle = existing.linked_task_title;
  if (linkedTaskId !== existing.linked_task_id) {
    if (linkedTaskId) {
      const task = await prepare('SELECT title FROM tasks WHERE id = ?').get(linkedTaskId);
      if (!task) return res.status(400).json({ error: 'Linked task not found' });
      linkedTaskTitle = task.title;
    } else {
      linkedTaskTitle = '';
    }
  }
  if (ownerToResolveId && !(await prepare('SELECT 1 FROM users WHERE id = ?').get(ownerToResolveId))) {
    return res.status(400).json({ error: 'Owner to resolve not found' });
  }

  const nextStatus = b.status ?? existing.status;
  const closingNow = CLOSED_STATUSES.includes(nextStatus) && !CLOSED_STATUSES.includes(existing.status);
  // Reopening (Resolved/Closed -> Open/In Progress) must clear a stale
  // closed_date from the previous closure, not leave it stuck.
  const reopening = !CLOSED_STATUSES.includes(nextStatus) && CLOSED_STATUSES.includes(existing.status);
  const closedDate = b.closedDate ?? (closingNow ? TODAY : reopening ? null : existing.closed_date);

  await prepare(`UPDATE blockers SET linked_task_id=@linkedTaskId, linked_task_title=@linkedTaskTitle, project=@project, raised_date=@raisedDate,
    category=@category, description=@description, blocking_what=@blockingWhat, owner_to_resolve_id=@ownerToResolveId,
    target_resolution=@targetResolution, escalation_level=@escalationLevel, status=@status, closed_date=@closedDate,
    resolution_note=@resolutionNote WHERE id=@id`).run({
    id: req.params.id,
    linkedTaskId,
    linkedTaskTitle,
    project: b.project ?? existing.project,
    raisedDate: b.raisedDate ?? existing.raised_date,
    category: b.category ?? existing.category,
    description: b.description ?? existing.description,
    blockingWhat: b.blockingWhat ?? existing.blocking_what,
    ownerToResolveId,
    targetResolution: b.targetResolution !== undefined ? b.targetResolution : existing.target_resolution,
    escalationLevel: b.escalationLevel ?? existing.escalation_level,
    status: nextStatus,
    closedDate,
    resolutionNote: b.resolutionNote ?? existing.resolution_note,
  });

  if (closingNow) {
    await insertGlobalActivity('blocker_resolved', `${req.user.name} marked a blocker as ${nextStatus.toLowerCase()}`, req.user.team_id);
    if (existing.raised_by !== req.user.id) {
      await prepare('INSERT INTO notifications (id, user_id, type, text, blocker_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
        .run(`note-${randomUUID()}`, existing.raised_by, 'blocker_resolved', `${req.user.name} marked your blocker as ${nextStatus.toLowerCase()}`, req.params.id, TODAY);
    }
  }

  if (ownerToResolveId && ownerToResolveId !== existing.owner_to_resolve_id && ownerToResolveId !== req.user.id) {
    await prepare('INSERT INTO notifications (id, user_id, type, text, blocker_id, read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)')
      .run(`note-${randomUUID()}`, ownerToResolveId, 'blocker_assigned', `${req.user.name} named you as owner to resolve a blocker`, req.params.id, TODAY);
  }

  const blocker = await prepare(`SELECT ${SELECT_COLUMNS} FROM blockers WHERE id = ?`).get(req.params.id);
  res.json({ blocker });
}));

// Same authority as editing — the raiser, the named owner, or any
// management-tier role, company-wide. The register now opens as a popup
// with inline edit/delete rather than a routed page, so delete needs to
// work for whoever the UI already lets manage the row.
router.delete('/:id', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM blockers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Blocker not found' });

  if (!canManageBlocker(req.user, existing)) {
    return res.status(403).json({ error: 'You do not have permission to delete this blocker' });
  }

  await prepare('DELETE FROM blockers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

export default router;
