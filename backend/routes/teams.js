import { Router } from 'express';
import { prepare } from '../database/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { scopeTeams } from '../database/helpers.js';

const router = Router();
router.use(requireAuth);

const SELECT_TEAM = `SELECT id, name, department_id as "departmentId", lead_id as "leadId" FROM teams`;

router.get('/', asyncRoute(async (req, res) => {
  const all = await prepare(`${SELECT_TEAM} ORDER BY seq ASC`).all();
  res.json(scopeTeams(req.user, all));
}));

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}

// Standalone team creation, with no lead attached yet — the normal path
// (adding a team lead) already creates its own brand-new team bundled with
// that person, so this exists for the cases that leaves uncovered: a
// pre-staffed placeholder, or replacing an empty team removed elsewhere.
router.post('/', requireRole('admin'), asyncRoute(async (req, res) => {
  const name = (req.body.name || '').trim();
  const departmentId = req.body.departmentId;
  if (!name) return res.status(400).json({ error: 'Team name is required' });
  if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });
  if (!(await prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId))) {
    return res.status(400).json({ error: 'Select a valid department' });
  }

  const base = slugify(name) || 'team';
  let id = base;
  let n = 1;
  while (await prepare('SELECT 1 FROM teams WHERE id = ?').get(id)) {
    n += 1;
    id = `${base}-${n}`;
  }

  await prepare('INSERT INTO teams (id, name, department_id, lead_id) VALUES (?, ?, ?, NULL)').run(id, name, departmentId);
  const team = await prepare(`${SELECT_TEAM} WHERE id = ?`).get(id);
  res.status(201).json({ team });
}));

router.patch('/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT id FROM teams WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Team not found' });

  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Team name is required' });

  await prepare('UPDATE teams SET name = ? WHERE id = ?').run(name, req.params.id);
  const team = await prepare(`${SELECT_TEAM} WHERE id = ?`).get(req.params.id);
  res.json({ team });
}));

// Deletion is blocked while anyone (lead or member) still points at this
// team — checking live user rows rather than the team's own lead_id column,
// since lead_id carries no foreign key and can be left holding a stale id
// after that person's account is deleted, which would otherwise look like
// an occupied team forever.
router.delete('/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const existing = await prepare('SELECT id FROM teams WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Team not found' });

  const memberCount = (await prepare('SELECT COUNT(*)::int AS count FROM users WHERE team_id = ?').get(req.params.id)).count;
  if (memberCount > 0) {
    return res.status(400).json({ error: `Reassign or remove its ${memberCount} member(s) (including the lead) first — a team can only be deleted once it's empty.` });
  }

  await prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

export default router;
