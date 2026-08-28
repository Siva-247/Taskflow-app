import { Router } from 'express';
import { getGlobalActivity } from '../database/helpers.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json(getGlobalActivity());
});

export default router;
