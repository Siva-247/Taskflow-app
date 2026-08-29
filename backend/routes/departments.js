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

router.post('/', requireRole('admin'), asyncRoute(async (req, res) => {
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

export default router;
