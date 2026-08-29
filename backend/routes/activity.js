import { Router } from 'express';
import { getGlobalActivity } from '../database/helpers.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = Router();

router.get('/', requireAuth, asyncRoute(async (req, res) => {
  res.json(await getGlobalActivity());
}));

export default router;
