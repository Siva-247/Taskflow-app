import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, teamById } from '../data/mockData.js';
import { Card, Avatar, Select, TextInput, Button, Modal, Field, Pagination, PAGE_SIZE } from '../components/ui.jsx';
import AddEmployeeModal from '../components/AddEmployeeModal.jsx';
import { IconSearch, IconPlusCircle } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_LABELS = {
  [ROLES.MANAGER]: 'Manager',
  [ROLES.ASSISTANT_MANAGER]: 'Assistant Manager',
  [ROLES.TEAM_LEAD]: 'Team Lead',
};
// Manager/Assistant Manager/Team Lead show their role; an Employee shows
// their title instead (Developer/Intern/whatever a custom "Other" hire
// typed) — same distinction Profile.jsx already draws elsewhere.
const roleLabel = (u) => ROLE_LABELS[u.role] || u.title || 'Employee';

export default function Employees() {
  const { currentUser, users, teams, departments, tasks, statsFor, setUserActive, editUser, deleteUser, resetUserPassword } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetResult, setPasswordResetResult] = useState(null);
  const [page, setPage] = useState(1);
  const allowed = useRoleGuard([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]);
  if (!allowed) return null;

  const isAdmin_ = currentUser.role === ROLES.SUPER_ADMIN || currentUser.role === ROLES.ADMIN;

  const startEdit = (user) => { setEditingUser(user); setEditName(user.name); setEditTitle(user.title || ''); setEditEmail(user.email || ''); setEditError(''); };
  const resetEdit = () => { setEditingUser(null); setEditName(''); setEditTitle(''); setEditEmail(''); setEditError(''); };

  const handleSaveEdit = async () => {
    if (!editName.trim()) { setEditError('Name is required.'); return; }
    if (!EMAIL_RE.test(editEmail.trim())) { setEditError('Enter a valid email address.'); return; }
    setEditSaving(true);
    try {
      await editUser(editingUser.id, { name: editName.trim(), title: editTitle.trim(), email: editEmail.trim() });
      resetEdit();
    } catch (err) {
      setEditError(err.message || 'Could not save changes');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteUser(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err.message || 'Could not remove member');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    setResettingPassword(true);
    try {
      const tempPassword = await resetUserPassword(pendingPasswordReset.id);
      setPasswordResetResult({ name: pendingPasswordReset.name, tempPassword });
      setPendingPasswordReset(null);
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setResettingPassword(false);
    }
  };

  const isAdmin = currentUser.role === ROLES.SUPER_ADMIN || currentUser.role === ROLES.ADMIN;

  // ---- Admin/Super Admin: company-wide, grouped by department ----
  const groups = useMemo(() => {
    if (!isAdmin) return [];
    const q = search.trim().toLowerCase();
    return departments
      .map((dept) => {
        const people = users
          .filter((u) => u.departmentId === dept.id && u.role !== ROLES.SUPER_ADMIN && u.role !== ROLES.ADMIN)
          .filter((u) => !q || u.name.toLowerCase().includes(q))
          .map((u) => {
            const assigned = tasks.filter((t) => t.assigneeId === u.id);
            const uStats = statsFor(assigned);
            return { user: u, team: teamById(u.teamId), assigned: uStats.total, completed: uStats.completed };
          });
        return { dept, people };
      })
      .filter((g) => g.people.length > 0 || !search.trim());
  }, [isAdmin, departments, users, search, tasks, statsFor]);

  // ---- Manager: unchanged — their own department's Employees/Interns ----
  const scopedTeams = teams.filter((t) => t.departmentId === currentUser.departmentId);
  const myDepartment = departments.find((d) => d.id === currentUser.departmentId);
  const teamIds = new Set(scopedTeams.map((t) => t.id));
  const employees = users.filter((u) => u.role === ROLES.EMPLOYEE && teamIds.has(u.teamId));
  const managerRows = useMemo(() => employees
    .filter((u) => (teamFilter === 'all' || u.teamId === teamFilter))
    .filter((u) => !search.trim() || u.name.toLowerCase().includes(search.trim().toLowerCase()))
    .map((u) => {
      const assigned = tasks.filter((t) => t.assigneeId === u.id);
      const uStats = statsFor(assigned);
      return { user: u, team: teamById(u.teamId), assigned: uStats.total, completed: uStats.completed };
    }), [employees, teamFilter, search, tasks, statsFor]);

  // Only the Manager's flat table paginates — the Admin/Super Admin view is
  // already grouped/chunked by department, not one long list.
  useEffect(() => setPage(1), [teamFilter, search]);
  const managerPageCount = Math.max(1, Math.ceil(managerRows.length / PAGE_SIZE));
  useEffect(() => { if (page > managerPageCount) setPage(managerPageCount); }, [page, managerPageCount]);
  const managerPageRows = managerRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const actionCell = (user) => {
    const isActive = user.isActive === undefined || !!user.isActive;
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {isAdmin_ && (
          <span onClick={() => startEdit(user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
            Edit
          </span>
        )}
        {isAdmin_ && (
          <span onClick={() => setPendingPasswordReset(user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
            Reset password
          </span>
        )}
        {isActive ? (
          <span onClick={() => setPendingDeactivate(user)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--green-text, #1F7A44)', cursor: 'pointer' }}>
            ● Active
          </span>
        ) : (
          <span onClick={() => setUserActive(user.id, true)} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--amber-text)', cursor: 'pointer' }}>
            ● Inactive — Reactivate
          </span>
        )}
        <span onClick={() => { setPendingDelete(user); setDeleteError(''); }} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer' }}>
          Delete
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Employees</div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            {isAdmin ? 'Every department across the company' : `Employees across ${myDepartment?.name || 'your department'}`}
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAdd(true)}>
            <IconPlusCircle size={15} color="#FFFFFF" /> Add employee
          </Button>
        )}
      </div>

      <Card padded={false} style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 9, padding: '9px 14px' }}>
            <IconSearch size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              style={{ border: 'none', outline: 'none', flex: 1, fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-primary)' }}
            />
          </div>
          {!isAdmin && scopedTeams.length > 1 && (
            <div className="filter-field" style={{ width: 170 }}>
              <Select value={teamFilter} onChange={setTeamFilter} options={[{ value: 'all', label: 'All teams' }, ...scopedTeams.map((t) => ({ value: t.id, label: t.name }))]} />
            </div>
          )}
        </div>
      </Card>

      {isAdmin ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groups.map(({ dept, people }) => (
            <Card key={dept.id} padded={false}>
              <div style={{ padding: '18px 22px 4px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>{dept.name}</div>
                <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{people.length} member{people.length === 1 ? '' : 's'}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 800 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.7fr 0.9fr 1.2fr', padding: '10px 22px', marginTop: 8, background: 'var(--field-bg)' }}>
                    {['Employee', 'Team', 'Role', 'Assigned', 'Completed', 'Status'].map((h) => (
                      <div key={h} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
                    ))}
                  </div>
                  {people.map((row, i) => (
                    <div
                      key={row.user.id}
                      onClick={() => navigate(`/tasks?assignee=${row.user.id}`)}
                      style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.7fr 0.9fr 1.2fr', padding: '13px 22px', alignItems: 'center', borderTop: '1px solid var(--border)', borderBottom: i === people.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', opacity: (row.user.isActive === undefined || row.user.isActive) ? 1 : 0.55 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar initial={row.user.initial} size={26} />
                        <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.user.name}</span>
                      </div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.team?.name || '—'}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{roleLabel(row.user)}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.assigned}</div>
                      <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.completed}</div>
                      {actionCell(row.user)}
                    </div>
                  ))}
                  {people.length === 0 && (
                    <div style={{ padding: '22px', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13, color: 'var(--text-muted)' }}>
                      No one in this department yet.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {groups.length === 0 && (
            <Card>
              <div style={{ textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>No departments yet.</div>
            </Card>
          )}
        </div>
      ) : (
        <Card padded={false}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 760 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 0.9fr 0.8fr 1fr 1fr', padding: '12px 22px', background: 'var(--field-bg)', borderBottom: '1px solid var(--border)' }}>
                {['Employee', 'Team', 'Role', 'Assigned', 'Completed', 'Status'].map((h) => (
                  <div key={h} style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
                ))}
              </div>
              {managerPageRows.map((row, i) => (
                <div
                  key={row.user.id}
                  onClick={() => navigate(`/tasks?assignee=${row.user.id}`)}
                  style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.1fr 0.9fr 0.8fr 1fr 1fr', padding: '14px 22px', alignItems: 'center', borderBottom: i < managerPageRows.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', opacity: (row.user.isActive === undefined || row.user.isActive) ? 1 : 0.55 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initial={row.user.initial} size={26} />
                    <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.user.name}</span>
                  </div>
                  <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.team?.name}</div>
                  <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.user.title}</div>
                  <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.assigned}</div>
                  <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.completed}</div>
                  {actionCell(row.user)}
                </div>
              ))}
              {managerRows.length === 0 && (
                <div style={{ padding: '32px 22px', textAlign: 'center', fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-muted)' }}>
                  No employees match your filters.
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {!isAdmin && <Pagination page={page} totalItems={managerRows.length} onChange={setPage} />}

      {showAdd && <AddEmployeeModal onClose={() => setShowAdd(false)} />}

      {editingUser && (
        <Modal title={`Edit ${editingUser.name}`} onClose={resetEdit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full name" required>
              <TextInput value={editName} onChange={setEditName} placeholder="Full name" />
            </Field>
            <Field label="Title">
              <TextInput value={editTitle} onChange={setEditTitle} placeholder="e.g. Developer" />
            </Field>
            <Field label="Email" required>
              <TextInput value={editEmail} onChange={setEditEmail} placeholder="name@company.com" />
            </Field>
            {editError && <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{editError}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetEdit}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </Modal>
      )}

      {pendingDeactivate && (
        <Modal title={`Deactivate ${pendingDeactivate.name}?`} onClose={() => setPendingDeactivate(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            They will no longer be able to sign in. Their existing tasks and history stay intact and can be reassigned or reviewed as normal — this can be undone at any time.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeactivate(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setUserActive(pendingDeactivate.id, false); setPendingDeactivate(null); }}>Deactivate</Button>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal title={`Delete ${pendingDelete.name}?`} onClose={() => setPendingDelete(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This permanently removes their account. It only works if they have no tasks, comments, or daily updates yet — if they've done any real work, deactivate them instead so that history stays intact.
          </div>
          {deleteError && <div style={{ marginTop: 12, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{deleteError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete member'}</Button>
          </div>
        </Modal>
      )}

      {pendingPasswordReset && (
        <Modal title={`Reset ${pendingPasswordReset.name}'s password?`} onClose={() => setPendingPasswordReset(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Their current password stops working immediately. You'll get a new temporary password to hand off to them directly — they'll be asked to set their own on next sign-in.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingPasswordReset(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmPasswordReset} disabled={resettingPassword}>{resettingPassword ? 'Resetting…' : 'Reset password'}</Button>
          </div>
        </Modal>
      )}

      {passwordResetResult && (
        <Modal title={`${passwordResetResult.name}'s new temporary password`} onClose={() => setPasswordResetResult(null)}>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Share this with them now — it won't be shown again. They'll be asked to set their own password the next time they sign in.
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 16,
            padding: '12px 16px', background: 'var(--field-bg)', border: '1px solid var(--border)', borderRadius: 9,
          }}>
            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, letterSpacing: '0.04em', color: 'var(--heading)' }}>
              {passwordResetResult.tempPassword}
            </span>
            <Button
              variant="secondary"
              style={{ padding: '6px 14px', fontSize: 12 }}
              onClick={() => navigator.clipboard?.writeText(passwordResetResult.tempPassword)}
            >
              Copy
            </Button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
            <Button variant="primary" onClick={() => setPasswordResetResult(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
