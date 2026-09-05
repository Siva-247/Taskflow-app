import { Router } from 'express';
import { prepare } from '../database/db.js';
import { insertGlobalActivity, insertNotification, userName, initialsOf, uniqueUserId, uniqueTeamId } from '../database/helpers.js';
import { canManage, scopeUsers } from '../database/hierarchy.js';
import { hashPassword, generateTempPassword } from '../auth/passwords.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute } from '../middleware/asyncRoute.js';

const router = Router();
router.use(requireAuth);

const SELECT_USER = `SELECT id, name, role, team_id as "teamId", department_id as "departmentId", title, initial, email, is_active as "isActive" FROM users`;
const TITLE_OPTIONS = ['Intern', 'Developer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', asyncRoute(async (req, res) => {
  const all = await prepare(`${SELECT_USER} ORDER BY seq ASC`).all();
  res.json(scopeUsers(req.user, all));
}));

// Team leads and assistant managers can grow their own team with
// interns/developers. Managers can add a new assistant manager (for an
// existing team of theirs) or a new team lead (with a brand-new team for
// them to run) or a new intern/developer directly, all scoped to their own
// department — same reach as hierarchy.canManage, just for creation instead
// of editing. Admin/Super Admin can additionally create managers (placed on
// any department) and place a new intern/developer on any team. Everyone
// else has no business creating accounts.
router.post('/', requireRole('team_lead', 'assistant_manager', 'manager', 'admin', 'super_admin'), asyncRoute(async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (await prepare('SELECT 1 FROM users WHERE lower(email) = ?').get(email)) {
    return res.status(409).json({ error: 'That email is already in use' });
  }

  const wantsManager = req.body.role === 'manager';
  const wantsAssistantManager = req.body.role === 'assistant_manager';
  const wantsTeamLead = req.body.role === 'team_lead';
  if (wantsManager && !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only an admin can add a manager' });
  }
  if (wantsAssistantManager && !['admin', 'super_admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only an admin or manager can add an assistant manager' });
  }
  if (wantsTeamLead && !['admin', 'super_admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only an admin or manager can add a team lead' });
  }

  // No email delivery is wired up — a generated temp password is normally
  // returned once, in this response, for whoever created the account to
  // hand off directly. Whoever's creating it may instead type in an exact
  // password up front (e.g. so a new member can sign in with real
  // credentials right away instead of a random string relayed by hand) —
  // still forces must_change_password below either way, so it gets
  // rotated on first use. The role checks above already gate WHO may
  // create WHAT; this doesn't loosen that, just who may pick the password.
  let tempPassword = null;
  let passwordHash;
  if (req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    passwordHash = hashPassword(req.body.password);
  } else {
    tempPassword = generateTempPassword();
    passwordHash = hashPassword(tempPassword);
  }

  if (wantsManager) {
    const departmentId = req.body.departmentId;
    if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });
    const department = await prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
    if (!department) return res.status(404).json({ error: 'Department not found' });

    const title = (req.body.title || '').trim() || 'Manager';
    const id = await uniqueUserId(name);
    await prepare(`INSERT INTO users (id, name, role, team_id, department_id, title, initial, email, password_hash, must_change_password)
      VALUES (@id, @name, 'manager', NULL, @departmentId, @title, @initial, @email, @passwordHash, 1)`).run({
      id, name, departmentId: department.id, title, initial: initialsOf(name), email, passwordHash,
    });
    await insertGlobalActivity('joined', `${await userName(req.user.id)} added ${name} as manager of ${department.name}`, null);
    await insertNotification(id, req.user.id, 'appointed', `You've been appointed as Manager of ${department.name}`, null);
    const user = await prepare(`${SELECT_USER} WHERE id = ?`).get(id);
    return res.status(201).json({ user, tempPassword });
  }

  // Unlike a team lead (who gets a brand-new team created for them),
  // an assistant manager is placed onto an EXISTING team — the one their
  // scope covers going forward. One per team: teams.assistant_manager_id
  // has a real FK, so a stale/duplicate assignment isn't possible, but a
  // clear 409 here is friendlier than letting a second INSERT attempt fail.
  if (wantsAssistantManager) {
    const teamId = req.body.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });
    const team = await prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (req.user.role === 'manager' && team.department_id !== req.user.department_id) {
      return res.status(403).json({ error: 'You can only add an assistant manager to a team in your own department' });
    }
    if (team.assistant_manager_id) return res.status(409).json({ error: 'This team already has an assistant manager' });

    const id = await uniqueUserId(name);
    await prepare(`INSERT INTO users (id, name, role, team_id, department_id, title, initial, email, password_hash, must_change_password)
      VALUES (@id, @name, 'assistant_manager', @teamId, @departmentId, 'Assistant Manager', @initial, @email, @passwordHash, 1)`).run({
      id, name, teamId: team.id, departmentId: team.department_id, initial: initialsOf(name), email, passwordHash,
    });
    await prepare('UPDATE teams SET assistant_manager_id = ? WHERE id = ?').run(id, team.id);
    await insertGlobalActivity('joined', `${await userName(req.user.id)} added ${name} as Assistant Manager of ${team.name}`, team.id);
    await insertNotification(id, req.user.id, 'appointed', `You've been appointed as Assistant Manager of ${team.name}`, null);
    const user = await prepare(`${SELECT_USER} WHERE id = ?`).get(id);
    return res.status(201).json({ user, tempPassword });
  }

  if (wantsTeamLead) {
    const teamName = (req.body.teamName || '').trim();
    if (!teamName) return res.status(400).json({ error: 'Team name is required' });
    // A manager can only staff their own department; only an admin may pick one.
    const departmentId = req.user.role === 'manager' ? req.user.department_id : req.body.departmentId;
    if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });
    const department = await prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
    if (!department) return res.status(404).json({ error: 'Department not found' });

    const id = await uniqueUserId(name);
    const teamId = await uniqueTeamId(teamName);
    // teams.lead_id carries no FK constraint, so it's safe to point it at
    // this not-yet-created user id before inserting the user row itself —
    // but the user row's team_id DOES reference teams(id), so the team must
    // be created first.
    await prepare('INSERT INTO teams (id, name, department_id, lead_id) VALUES (?, ?, ?, ?)').run(teamId, teamName, department.id, id);
    await prepare(`INSERT INTO users (id, name, role, team_id, department_id, title, initial, email, password_hash, must_change_password)
      VALUES (@id, @name, 'team_lead', @teamId, @departmentId, 'Team Lead', @initial, @email, @passwordHash, 1)`).run({
      id, name, teamId, departmentId: department.id, initial: initialsOf(name), email, passwordHash,
    });
    await insertGlobalActivity('joined', `${await userName(req.user.id)} added ${name} as Team Lead of ${teamName}`, teamId);
    await insertNotification(id, req.user.id, 'appointed', `You've been appointed as Team Lead of ${teamName}`, null);
    const user = await prepare(`${SELECT_USER} WHERE id = ?`).get(id);
    return res.status(201).json({ user, tempPassword });
  }

  const title = req.body.title;
  if (!TITLE_OPTIONS.includes(title)) return res.status(400).json({ error: 'Title must be Intern or Developer' });

  let teamId;
  if (['team_lead', 'assistant_manager'].includes(req.user.role)) {
    teamId = req.user.team_id;
  } else {
    teamId = req.body.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });
  }

  const team = await prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  // A manager can staff any team in their own department directly (not just
  // via that team's lead) — same reach hierarchy.canManage already grants
  // them for editing. Never another department's team.
  if (req.user.role === 'manager' && team.department_id !== req.user.department_id) {
    return res.status(403).json({ error: 'You can only add members to a team in your own department' });
  }

  const id = await uniqueUserId(name);
  await prepare(`INSERT INTO users (id, name, role, team_id, department_id, title, initial, email, password_hash, must_change_password)
    VALUES (@id, @name, 'employee', @teamId, @departmentId, @title, @initial, @email, @passwordHash, 1)`).run({
    id, name, teamId: team.id, departmentId: team.department_id, title, initial: initialsOf(name), email, passwordHash,
  });

  await insertGlobalActivity('joined', `${await userName(req.user.id)} added ${name} to ${team.name}`, team.id);
  await insertNotification(id, req.user.id, 'joined', `You've been added to ${team.name} by ${await userName(req.user.id)}`, null);

  const user = await prepare(`${SELECT_USER} WHERE id = ?`).get(id);
  res.status(201).json({ user, tempPassword });
}));

// Edit of a member's basic details, scoped by hierarchy.canManage (cascades
// down the whole chain: admin/super_admin reach anyone, a manager their
// whole department, an assistant manager/team lead their own team).
// Deliberately NOT allowing team/department here — moving someone between
// teams has structural implications (task scoping, review authority) that a
// simple field edit shouldn't quietly trigger; that stays a
// create-a-new-placement operation. Deliberately no user DELETE anywhere in
// this file either — a hard delete would leave every task/comment/daily-
// update they ever touched pointing at a nonexistent user. Deactivate
// (below) is the safe equivalent: it blocks sign-in while keeping their
// history intact and reversible.
router.patch('/:id', asyncRoute(async (req, res) => {
  const target = await prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'super_admin') return res.status(403).json({ error: 'Super Admin credentials are managed through the server .env file only' });
  if (!canManage(req.user, target)) return res.status(403).json({ error: 'You do not have permission to edit this person' });

  const name = req.body.name !== undefined ? req.body.name.trim() : target.name;
  const title = req.body.title !== undefined ? req.body.title.trim() : target.title;
  const email = req.body.email !== undefined ? req.body.email.trim().toLowerCase() : target.email;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (email !== target.email && await prepare('SELECT 1 FROM users WHERE lower(email) = ? AND id != ?').get(email, req.params.id)) {
    return res.status(409).json({ error: 'That email is already in use' });
  }

  await prepare('UPDATE users SET name = ?, title = ?, email = ?, initial = ? WHERE id = ?')
    .run(name, title, email, initialsOf(name), req.params.id);

  const user = await prepare(`${SELECT_USER} WHERE id = ?`).get(req.params.id);
  res.json({ user });
}));

// Escape hatch for the "forgot password" dead end: most accounts here use
// non-real demo emails, and even a real one has nowhere to go unless SMTP
// is configured, so self-service reset can't be relied on. Scoped by the
// same hierarchy.canManage chain as the edit route above. Mirrors the
// temp-password pattern already used for brand-new accounts — generate
// one, hash it, force must_change_password so they set their own real
// password on next login, and hand the plaintext back once in this
// response for whoever reset it to relay directly. Never persisted anywhere else.
router.patch('/:id/password', asyncRoute(async (req, res) => {
  const target = await prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'super_admin') return res.status(403).json({ error: 'Super Admin credentials are managed through the server .env file only' });
  if (!canManage(req.user, target)) return res.status(403).json({ error: "You do not have permission to reset this person's password" });

  const tempPassword = generateTempPassword();
  const passwordHash = hashPassword(tempPassword);
  await prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(passwordHash, req.params.id);

  res.json({ tempPassword });
}));

// Activate/deactivate — same cascading scope as hierarchy.canManage.
// Nobody can deactivate themselves, to avoid a self-lockout, and Super
// Admin can never be deactivated through the app at all.
router.patch('/:id/active', requireRole('admin', 'super_admin', 'manager', 'assistant_manager', 'team_lead'), asyncRoute(async (req, res) => {
  const target = await prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account' });
  if (target.role === 'super_admin') return res.status(403).json({ error: 'Super Admin cannot be deactivated' });

  if (!canManage(req.user, target)) return res.status(403).json({ error: 'You do not have permission to manage this user' });

  const isActive = Boolean(req.body.isActive);
  await prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, req.params.id);
  await insertGlobalActivity(
    isActive ? 'activated' : 'deactivated',
    `${await userName(req.user.id)} ${isActive ? 'reactivated' : 'deactivated'} ${target.name}'s account`,
    target.team_id,
  );

  const user = await prepare(`${SELECT_USER} WHERE id = ?`).get(req.params.id);
  res.json({ user });
}));

// Delete — same scoping as activate/deactivate. Blocked while the person
// still has any tasks (assigned or created), comments, or daily updates:
// those rows reference users(id) with no cascade, so a real delete would
// either fail outright or orphan real history. Deactivate is the right move
// for anyone with existing work; delete is for someone added by mistake or
// who never did anything yet (e.g. a leftover test account).
router.delete('/:id', requireRole('admin', 'super_admin', 'manager', 'assistant_manager', 'team_lead'), asyncRoute(async (req, res) => {
  const target = await prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  if (target.role === 'super_admin') return res.status(403).json({ error: 'Super Admin cannot be deleted' });

  if (!canManage(req.user, target)) return res.status(403).json({ error: 'You do not have permission to manage this user' });

  const taskCount = (await prepare('SELECT COUNT(*)::int AS count FROM tasks WHERE assignee_id = ? OR created_by = ?').get(req.params.id, req.params.id)).count;
  const updateCount = (await prepare('SELECT COUNT(*)::int AS count FROM daily_updates WHERE user_id = ?').get(req.params.id)).count;
  const commentCount = (await prepare('SELECT COUNT(*)::int AS count FROM comments WHERE author_id = ?').get(req.params.id)).count;
  if (taskCount > 0 || updateCount > 0 || commentCount > 0) {
    return res.status(400).json({ error: `${target.name} has existing tasks, comments, or daily updates — deactivate their account instead of deleting it, so that history stays intact.` });
  }
  // teams.assistant_manager_id carries a real FK (unlike lead_id) — a raw
  // Postgres constraint violation would otherwise surface here instead of
  // the app's own friendly error.
  if (target.role === 'assistant_manager') {
    const staffedTeam = await prepare('SELECT id FROM teams WHERE assistant_manager_id = ?').get(req.params.id);
    if (staffedTeam) return res.status(400).json({ error: `${target.name} is still that team's assistant manager — reassign or clear that role first.` });
  }

  // Notifications aren't meaningful history (just transient alerts) and
  // have no cascade, so they're cleaned up here rather than counted above —
  // otherwise almost every account (even a brand-new one) would be
  // permanently blocked from deletion by its own welcome notification.
  await prepare('DELETE FROM notifications WHERE user_id = ?').run(req.params.id);
  await prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  await insertGlobalActivity('removed', `${await userName(req.user.id)} removed ${target.name}'s account`, target.team_id);
  res.json({ ok: true });
}));

export default router;
