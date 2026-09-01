import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { prepare } from '../database/db.js';
import { TODAY } from '../database/constants.js';
import { getGlobalActivity, insertGlobalActivity, scopeDailyUpdates } from '../database/helpers.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = Router();
router.use(requireAuth);

const SELECT_COLUMNS = `id, user_id as "userId", task_id as "taskId", task_title as "taskTitle", date, status,
  task_completed as "taskCompleted", concepts_covered as "conceptsCovered", practical_task as "practicalTask",
  videos_completed as "videosCompleted", video_link as "videoLink"`;

router.get('/', asyncRoute(async (req, res) => {
  const all = await prepare(`SELECT ${SELECT_COLUMNS} FROM daily_updates ORDER BY seq ASC`).all();
  res.json(await scopeDailyUpdates(req.user, all));
}));

router.post('/', asyncRoute(async (req, res) => {
  const b = req.body;
  const id = `du-${randomUUID()}`;

  // One update per person per day — the unique index backs this up at the
  // database level too, but checking here first gives a clear error instead
  // of a raw constraint-violation.
  const existing = await prepare('SELECT id FROM daily_updates WHERE user_id = ? AND date = ?').get(req.user.id, b.date);
  if (existing) return res.status(409).json({ error: "You already have an update for this date — edit it instead of creating a new one." });

  // userId always comes from the verified session, never the request body —
  // otherwise anyone could log a daily update as someone else.
  await prepare(`INSERT INTO daily_updates (id, user_id, task_id, task_title, date, status, task_completed, concepts_covered, practical_task, videos_completed, video_link)
    VALUES (@id, @userId, @taskId, @taskTitle, @date, @status, @taskCompleted, @conceptsCovered, @practicalTask, @videosCompleted, @videoLink)`).run({
    id,
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
  await prepare(`UPDATE daily_updates SET task_id=@taskId, task_title=@taskTitle, status=@status, task_completed=@taskCompleted,
    concepts_covered=@conceptsCovered, practical_task=@practicalTask, videos_completed=@videosCompleted, video_link=@videoLink WHERE id=@id`).run({
    id: req.params.id,
    taskId: b.taskId ?? existing.task_id,
    taskTitle: b.taskTitle ?? existing.task_title,
    status: b.status ?? existing.status,
    taskCompleted: b.taskCompleted ?? existing.task_completed,
    conceptsCovered: b.conceptsCovered ?? existing.concepts_covered,
    practicalTask: b.practicalTask ?? existing.practical_task,
    videosCompleted: b.videosCompleted ?? existing.videos_completed,
    videoLink: b.videoLink ?? existing.video_link,
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
  if (req.user.role !== 'admin') {
    if (existing.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own daily updates' });
    if (existing.date !== TODAY) return res.status(403).json({ error: 'You can only delete a daily update from today' });
  }

  await prepare('DELETE FROM daily_updates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

export default router;
