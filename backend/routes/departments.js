import { Router } from 'express';
import { prepare } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncRoute(async (req, res) => {
  res.json(await prepare('SELECT id, name FROM departments ORDER BY seq ASC').all());
}));

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}

router.post('/', requireRole('admin', 'super_admin'), asyncRoute(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const base = slugify(name) || 'department';
  let id = base;
  let n = 1;
  while (await prepare('SELECT 1 FROM departments WHERE id = ?').get(id)) {
    n += 1;
    id = `${base}-${n}`;
  }

  await prepare('INSERT INTO departments (id, name) VALUES (?, ?)').run(id, name);
  res.status(201).json({ department: { id, name } });
}));

router.patch('/:id', requireRole('admin', 'super_admin'), asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Department not found' });

  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });

  await prepare('UPDATE departments SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json({ department: { id: req.params.id, name } });
}));

// Deletion is blocked while the department still has teams or users on it —
// there's no cascade here (a department going away shouldn't silently orphan
// or destroy people's accounts and history), so it must be emptied first.
router.delete('/:id', requireRole('admin', 'super_admin'), asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT * FROM departments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Department not found' });

  const teamCount = (await prepare('SELECT COUNT(*)::int AS count FROM teams WHERE department_id = ?').get(req.params.id)).count;
  const userCount = (await prepare('SELECT COUNT(*)::int AS count FROM users WHERE department_id = ?').get(req.params.id)).count;
  if (teamCount > 0 || userCount > 0) {
    return res.status(400).json({ error: `Move or remove its ${teamCount} team(s) and ${userCount} member(s) first — a department can only be deleted once it's empty.` });
  }

  await prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

export default router;
