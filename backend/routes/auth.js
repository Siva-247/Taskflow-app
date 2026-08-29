import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { prepare } from '../database/db.js';
import { createToken } from '../auth/tokens.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { insertGlobalActivity, slugify } from '../database/helpers.js';
import { requireAuth } from '../middleware/auth.js';
import { isEmailConfigured, sendPasswordResetEmail } from '../email/mailer.js';

const router = Router();

const SELECT_USER = `SELECT id, name, role, team_id as teamId, department_id as departmentId, title, initial, email,
  must_change_password as mustChangePassword FROM users WHERE id = ?`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(id) {
  const user = prepare(SELECT_USER).get(id);
  return user ? { ...user, mustChangePassword: !!user.mustChangePassword } : null;
}

function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

function normalizeEmail(raw) {
  return (raw || '').trim().toLowerCase();
}

// People naturally type their title alongside their name at signup ("Hari
// Lead", "Sivakavitha Intern") — strip those role/title words (longest
// phrases first, so "team lead" doesn't leave a stray "team" behind) so the
// bare name still matches the seeded identity underneath.
const ROLE_WORDS = ['department head', 'team lead', 'lead', 'manager', 'developer', 'intern', 'employee', 'admin'];
function stripRoleWords(rawName) {
  let cleaned = ` ${rawName} `;
  for (const word of ROLE_WORDS) {
    const re = new RegExp(`\\s+${word.replace(' ', '\\s+')}\\s+`, 'gi');
    cleaned = cleaned.replace(re, ' ');
  }
  return cleaned.trim().replace(/\s+/g, ' ');
}
function nameCandidates(rawName) {
  const stripped = stripRoleWords(rawName);
  return stripped && stripped !== rawName ? [rawName, stripped] : [rawName];
}

// The signup form's Role dropdown, mapped to how that role is actually
// stored (team leads/employees/interns all share the `title` column for
// finer distinctions the `role` column alone doesn't carry).
//
// Deliberately NO 'admin' entry: admin is never claimable through public
// signup, no matter what a request claims — see setup-admin.mjs for how the
// one seeded admin account actually gets real credentials.
const ROLE_DROPDOWN = {
  manager: { role: 'manager', label: 'Manager' },
  lead: { role: 'team_lead', label: 'Team Lead' },
  employee: { role: 'employee', excludeTitle: 'Intern', label: 'Employee' },
  intern: { role: 'employee', title: 'Intern', label: 'Intern' },
};

function roleMatches(user, roleConfig) {
  if (user.role !== roleConfig.role) return false;
  if (roleConfig.title) return user.title === roleConfig.title;
  if (roleConfig.excludeTitle) return user.title !== roleConfig.excludeTitle;
  return true;
}

function describeRole(user) {
  if (user.role === 'admin') return 'Admin';
  if (user.role === 'employee') return user.title === 'Intern' ? 'Intern' : 'Employee';
  const found = Object.values(ROLE_DROPDOWN).find((r) => r.role === user.role);
  return found ? found.label : user.role;
}

function departmentNameOf(departmentId) {
  return prepare('SELECT name FROM departments WHERE id = ?').get(departmentId)?.name || 'a different department';
}

// Public (pre-login) department list/create for the signup form's
// Department dropdown — deliberately separate from the admin-gated
// /api/departments used by the org-management pages. Only name+id are ever
// exposed, and creation here is intentionally open (whoever signs up first
// for a brand-new department has to be able to name it).
router.get('/departments', (req, res) => {
  res.json(prepare('SELECT id, name FROM departments ORDER BY rowid ASC').all());
});

router.post('/departments', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Department name is required' });

  const existing = prepare('SELECT id, name FROM departments WHERE name = ? COLLATE NOCASE').get(name);
  if (existing) return res.status(200).json({ department: existing });

  const base = slugify(name) || 'department';
  let id = base;
  let n = 1;
  while (prepare('SELECT 1 FROM departments WHERE id = ?').get(id)) {
    n += 1;
    id = `${base}-${n}`;
  }
  prepare('INSERT INTO departments (id, name) VALUES (?, ?)').run(id, name);
  res.status(201).json({ department: { id, name } });
});

// TaskFlow is a closed company roster, not open self-registration: signup
// NEVER creates a new person. The name entered must match one of the
// existing seeded identities (Santhosh, Sivakavitha, etc.) that hasn't been
// claimed yet — matching claims that exact record (same id, role, team,
// task history) by attaching real credentials to it. Any name that doesn't
// match an existing unclaimed record is rejected outright.
//
// "Unclaimed" is detected by the seed placeholder email pattern
// (`<id>@taskflow.local`, set at seed/migration time) — once a real email is
// attached, that identity can never be claimed again, only signed into.
router.post('/signup', (req, res) => {
  const name = (req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const { password, role, departmentId } = req.body;

  if (!name) return res.status(400).json({ error: 'Full name is required' });
  const roleConfig = ROLE_DROPDOWN[role];
  if (!roleConfig) return res.status(400).json({ error: 'Select your role' });
  // Admin oversees the whole org rather than one department, so it's the
  // only role that isn't department-scoped.
  const needsDepartment = roleConfig.role !== 'admin';
  if (needsDepartment) {
    if (!departmentId) return res.status(400).json({ error: 'Select your department' });
    if (!prepare('SELECT 1 FROM departments WHERE id = ?').get(departmentId)) {
      return res.status(400).json({ error: 'Select a valid department' });
    }
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(email)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const candidates = nameCandidates(name);

  // Matched on name alone (any role/department) first, so a wrong
  // role/department selection gets a precise "here's what's actually on
  // file" message instead of a generic "not registered" rejection.
  let seedMatch = null;
  for (const candidate of candidates) {
    seedMatch = prepare(`SELECT * FROM users WHERE name = ? COLLATE NOCASE AND email LIKE '%@taskflow.local'`).get(candidate);
    if (seedMatch) break;
  }
  if (seedMatch) {
    if (!roleMatches(seedMatch, roleConfig)) {
      return res.status(409).json({ error: `${seedMatch.name} is registered as ${describeRole(seedMatch)}. Please select that role instead.` });
    }
    if (needsDepartment && seedMatch.department_id !== departmentId) {
      return res.status(409).json({ error: `${seedMatch.name} is registered under ${departmentNameOf(seedMatch.department_id)}. Please select that department instead.` });
    }
    prepare('UPDATE users SET email = ?, password_hash = ?, must_change_password = 0 WHERE id = ?')
      .run(email, hashPassword(password), seedMatch.id);
    insertGlobalActivity('joined', `${seedMatch.name} claimed their account`, seedMatch.team_id);
    const token = createToken(seedMatch.id);
    return res.json({ token, user: publicUser(seedMatch.id) });
  }

  let nameAlreadyClaimed = null;
  for (const candidate of candidates) {
    nameAlreadyClaimed = prepare('SELECT 1 FROM users WHERE name = ? COLLATE NOCASE').get(candidate);
    if (nameAlreadyClaimed) break;
  }
  if (nameAlreadyClaimed) {
    return res.status(409).json({ error: 'This user already has an account. Please sign in using the registered email.' });
  }

  return res.status(403).json({ error: 'Your name is not registered in TaskFlow. Please contact the administrator.' });
});

router.post('/login', (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const row = prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(email);
  // Same error either way — never reveal whether the email itself was the wrong part.
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (!row.is_active) {
    return res.status(403).json({ error: 'This account has been deactivated. Contact your admin.' });
  }

  const token = createToken(row.id);
  res.json({ token, user: publicUser(row.id) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user.id) });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  if (!currentPassword || !verifyPassword(currentPassword, req.user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(hashPassword(newPassword), req.user.id);
  res.json({ user: publicUser(req.user.id) });
});

// This endpoint always answers with the same generic message (never reveals
// whether the address exists). When SMTP is configured (see backend/.env),
// it emails the real reset link; otherwise it falls back to handing the raw
// token back in the response for local dev, exactly as before.
router.post('/forgot-password', async (req, res) => {
  const generic = { ok: true, message: 'If that email exists, a reset link has been created.' };
  const email = normalizeEmail(req.body.email);
  if (!email) return res.json(generic);

  const user = prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (!user) return res.json(generic);

  const rawToken = randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 1000 * 60 * 30;
  prepare('INSERT INTO password_resets (id, user_id, token_hash, expires_at, used) VALUES (?, ?, ?, ?, 0)')
    .run(`reset-${randomBytes(8).toString('hex')}`, user.id, hashToken(rawToken), expiresAt);

  const resetLink = `${process.env.APP_URL || 'http://localhost:5173'}/#/reset-password?token=${rawToken}`;

  if (isEmailConfigured()) {
    try {
      await sendPasswordResetEmail(email, resetLink);
      return res.json(generic);
    } catch (err) {
      console.error('[password reset email] send failed:', err.message);
      return res.json(generic);
    }
  }

  if (process.env.NODE_ENV === 'production') return res.json(generic);

  console.log(`[DEV-ONLY password reset] user=${user.id} token=${rawToken} (expires in 30 min) — never log this in production`);
  res.json({ ...generic, devResetToken: rawToken });
});

router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'A reset token and a new password (min 8 characters) are required' });
  }
  const row = prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?')
    .get(hashToken(token), Date.now());
  if (!row) return res.status(400).json({ error: 'This reset link is invalid or has expired' });

  prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
    .run(hashPassword(newPassword), row.user_id);
  prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

export default router;
