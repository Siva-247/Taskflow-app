import { Router } from 'express';
import { prepare } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = Router();
router.use(requireAuth);

const SELECT_COLUMNS = `id, user_id as "userId", type, text, task_id as "taskId", read, created_at as "createdAt"`;

router.get('/', asyncRoute(async (req, res) => {
  const rows = await prepare(`SELECT ${SELECT_COLUMNS} FROM notifications WHERE user_id = ? ORDER BY seq DESC LIMIT 50`).all(req.user.id);
  res.json(rows.map((r) => ({ ...r, read: Boolean(r.read) })));
}));

router.patch('/:id/read', asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
  if (!existing || existing.user_id !== req.user.id) return res.status(404).json({ error: 'Notification not found' });
  await prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

router.post('/read-all', asyncRoute(async (req, res) => {
  await prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').run(req.user.id);
  res.json({ ok: true });
}));

export default router;
