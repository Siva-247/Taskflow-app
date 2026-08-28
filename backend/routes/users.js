import { Router } from 'express';
import { prepare } from '../database/db.js';
import { insertGlobalActivity, insertNotification, userName, initialsOf, uniqueUserId, uniqueTeamId, scopeUsers } from '../database/helpers.js';
import { hashPassword, generateTempPassword } from '../auth/passwords.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const SELECT_USER = `SELECT id, name, role, team_id as teamId, department_id as departmentId, title, initial, email, is_active as isActive FROM users`;
const TITLE_OPTIONS = ['Intern', 'Developer'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', (req, res) => {
  const all = prepare(`${SELECT_USER} ORDER BY rowid ASC`).all();
  res.json(scopeUsers(req.user, all));
});

// Team leads can only grow their own team with interns/developers. Managers
// can only add a new team lead (with a brand-new team for them to run) in
// their own department. Admins can additionally create managers (placed on
// any department) and place a new intern/developer on any team. Everyone
// else has no business creating accounts.
router.post('/', requireRole('team_lead', 'manager', 'admin'), (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' });
  if (prepare('SELECT 1 FROM users WHERE lower(email) = ?').get(email)) {
    return res.status(409).json({ error: 'That email is already in use' });
  }

  const wantsManager = req.body.role === 'manager';
  const wantsTeamLead = req.body.role === 'team_lead';
  if (wantsManager && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only an admin can add a manager' });
  }
  if (wantsTeamLead && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only an admin or manager can add a team lead' });
  }
  if (!wantsManager && !wantsTeamLead && req.user.role === 'manager') {
    return res.status(403).json({ error: 'Managers can only add team leads — a team lead adds their own interns and developers' });
  }

  // No email delivery is wired up — the temp password is returned once, in
  // this response, for whoever created the account to hand off directly.
  // That's a dev-mode stand-in for a real invitation email, not a pattern to
  // ship to production.
  const tempPassword = generateTempPassword();
  const passwordHash = hashPassword(tempPassword);

  if (wantsManager) {
    const departmentId = req.body.departmentId;
    if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });
    const department = prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
    if (!department) return res.status(404).json({ error: 'Department not found' });

    const title = (req.body.title || '').trim() || 'Manager';
    const id = uniqueUserId(name);
    prepare(`INSERT INTO users (id, name, role, team_id, department_id, title, initial, email, password_hash, must_change_password)
      VALUES (@id, @name, 'manager', NULL, @departmentId, @title, @initial, @email, @passwordHash, 1)`).run({
      id, name, departmentId: department.id, title, initial: initialsOf(name), email, passwordHash,
    });
    insertGlobalActivity('joined', `${userName(req.user.id)} added ${name} as manager of ${department.name}`, null);
    insertNotification(id, req.user.id, 'appointed', `You've been appointed as Manager of ${department.name}`, null);
    const user = prepare(`${SELECT_USER} WHERE id = ?`).get(id);
    return res.status(201).json({ user, tempPassword });
  }

  if (wantsTeamLead) {
    const teamName = (req.body.teamName || '').trim();
    if (!teamName) return res.status(400).json({ error: 'Team name is required' });
    // A manager can only staff their own department; only an admin may pick one.
    const departmentId = req.user.role === 'manager' ? req.user.department_id : req.body.departmentId;
    if (!departmentId) return res.status(400).json({ error: 'departmentId is required' });
    const department = prepare('SELECT * FROM departments WHERE id = ?').get(departmentId);
    if (!department) return res.status(404).json({ error: 'Department not found' });

    const id = uniqueUserId(name);
    const teamId = uniqueTeamId(teamName);
    // teams.lead_id carries no FK constraint, so it's safe to point it at
    // this not-yet-created user id before inserting the user row itself —
    // but the user row's team_id DOES reference teams(id), so the team must
    // be created first.
    prepare('INSERT INTO teams (id, name, department_id, lead_id) VALUES (?, ?, ?, ?)').run(teamId, teamName, department.id, id);
    prepare(`INSERT INTO users (id, name, role, team_id, department_id, title, initial, email, password_hash, must_change_password)
      VALUES (@id, @name, 'team_lead', @teamId, @departmentId, 'Team Lead', @initial, @email, @passwordHash, 1)`).run({
      id, name, teamId, departmentId: department.id, initial: initialsOf(name), email, passwordHash,
    });
    insertGlobalActivity('joined', `${userName(req.user.id)} added ${name} as Team Lead of ${teamName}`, teamId);
    insertNotification(id, req.user.id, 'appointed', `You've been appointed as Team Lead of ${teamName}`, null);
    const user = prepare(`${SELECT_USER} WHERE id = ?`).get(id);
    return res.status(201).json({ user, tempPassword });
  }

  const title = req.body.title;
  if (!TITLE_OPTIONS.includes(title)) return res.status(400).json({ error: 'Title must be Intern or Developer' });

  let teamId;
  if (req.user.role === 'team_lead') {
    teamId = req.user.team_id;
  } else {
    teamId = req.body.teamId;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });
  }

  const team = prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  const id = uniqueUserId(name);
  prepare(`INSERT INTO users (id, name, role, team_id, department_id, title, initial, email, password_hash, must_change_password)
    VALUES (@id, @name, 'employee', @teamId, @departmentId, @title, @initial, @email, @passwordHash, 1)`).run({
    id, name, teamId: team.id, departmentId: team.department_id, title, initial: initialsOf(name), email, passwordHash,
  });

  insertGlobalActivity('joined', `${userName(req.user.id)} added ${name} to ${team.name}`, team.id);
  insertNotification(id, req.user.id, 'joined', `You've been added to ${team.name} by ${userName(req.user.id)}`, null);

  const user = prepare(`${SELECT_USER} WHERE id = ?`).get(id);
  res.status(201).json({ user, tempPassword });
});

// Activate/deactivate — scoped the same way creation is: admin manages
// anyone, a manager manages employees/team leads in their own department
// (never another manager or admin), a team lead manages employees on their
// own team only. Nobody can deactivate themselves, to avoid a self-lockout.
router.patch('/:id/active', requireRole('admin', 'manager', 'team_lead'), (req, res) => {
  const target = prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot deactivate your own account' });

  const canManage = req.user.role === 'admin'
    || (req.user.role === 'manager' && target.department_id === req.user.department_id && !['admin', 'manager'].includes(target.role))
    || (req.user.role === 'team_lead' && target.team_id === req.user.team_id && target.role === 'employee');
  if (!canManage) return res.status(403).json({ error: 'You do not have permission to manage this user' });

  const isActive = Boolean(req.body.isActive);
  prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, req.params.id);
  insertGlobalActivity(
    isActive ? 'activated' : 'deactivated',
    `${userName(req.user.id)} ${isActive ? 'reactivated' : 'deactivated'} ${target.name}'s account`,
    target.team_id,
  );

  const user = prepare(`${SELECT_USER} WHERE id = ?`).get(req.params.id);
  res.json({ user });
});

export default router;
