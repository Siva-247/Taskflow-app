import { prepare } from '../database/db.js';
import { verifyToken } from '../auth/tokens.js';
import { asyncRoute } from './asyncRoute.js';

// Attaches req.user (the full DB row — snake_case columns) from a verified
// Bearer token. This is the server-side identity every route trusts instead
// of whatever the client claims in the request body. Wrapped in asyncRoute
// itself (rather than leaving every consumer to remember to) since this is
// async middleware, not just a terminal handler.
export const requireAuth = asyncRoute(async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Your session expired — please sign in again' });

  const user = await prepare('SELECT * FROM users WHERE id = ?').get(payload.userId);
  if (!user) return res.status(401).json({ error: 'Your session expired — please sign in again' });

  req.user = user;
  next();
});

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this' });
    }
    next();
  };
}
