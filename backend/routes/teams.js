import { Router } from 'express';
import { prepare } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { scopeTeams } from '../database/helpers.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const all = prepare('SELECT id, name, department_id as departmentId, lead_id as leadId FROM teams ORDER BY rowid ASC').all();
  res.json(scopeTeams(req.user, all));
});

export default router;
