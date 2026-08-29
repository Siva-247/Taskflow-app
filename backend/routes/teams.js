import { Router } from 'express';
import { prepare } from '../database/db.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';
import { scopeTeams } from '../database/helpers.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncRoute(async (req, res) => {
  const all = await prepare('SELECT id, name, department_id as "departmentId", lead_id as "leadId" FROM teams ORDER BY seq ASC').all();
  res.json(scopeTeams(req.user, all));
}));

export default router;
