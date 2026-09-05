import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, teamById } from '../data/mockData.js';
import { assignableTargets } from '../data/hierarchy.js';
import { Card, Avatar, ProgressBar, Button, Modal, Field, TextInput, Select } from '../components/ui.jsx';
import { IconPlusCircle } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

const TITLE_OPTIONS = ['Intern', 'Developer'];

export default function MyTeam() {
  const { currentUser, users, departments, scopedTasks, statsFor, addTeamMember, setUserActive, deleteUser, editUser, resetUserPassword } = useApp();
  const navigate = useNavigate();
  const allowed = useRoleGuard([ROLES.TEAM_LEAD, ROLES.ASSISTANT_MANAGER]);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newTitle, setNewTitle] = useState('Intern');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetResult, setPasswordResetResult] = useState(null);

  if (!allowed) return null;

  const team = teamById(currentUser.teamId);
  const department = departments.find((d) => d.id === currentUser.departmentId);
  const teamTasks = scopedTasks(currentUser);
  const teamStats = statsFor(teamTasks);
  const completionRate = teamStats.total ? Math.round((teamStats.completed / teamStats.total) * 100) : 0;

  // Anyone strictly below the viewer's rank on this team — for a Team Lead
  // that's just Employees/Interns (as before); for an Assistant Manager it
  // also includes the team's Team Lead, mirroring assignableTargets.
  const members = assignableTargets(currentUser, users);
  const rows = members.map((u) => {
    const assigned = teamTasks.filter((t) => t.assigneeId === u.id);
    const uStats = statsFor(assigned);
    return { user: u, assigned: uStats.total, completed: uStats.completed };
  });

  const resetAddForm = () => {
    setShowAdd(false); setNewName(''); setNewEmail(''); setNewPassword(''); setNewTitle('Intern'); setError(''); setCreated(null);
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Name is required.'); return; }
    if (!EMAIL_RE.test(newEmail.trim())) { setError('Enter a valid email address.'); return; }
    if (newPassword && newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      const result = await addTeamMember({
        name: newName.trim(), email: newEmail.trim(), title: newTitle,
        ...(newPassword ? { password: newPassword } : {}),
      });
      setCreated(result);
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="stack-mobile" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>{team?.name}</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{members.length} member{members.length === 1 ? '' : 's'} · {department?.name}</div>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <IconPlusCircle size={15} color="#FFFFFF" /> Add team member
        </Button>
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--text-muted)' }}>Team completion rate</span>
          <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--heading)' }}>{completionRate}%</span>
        </div>
        <div style={{ marginTop: 10 }}><ProgressBar value={completionRate} height={8} /></div>
      </Card>

      <Card padded={false}>
        <div style={{ padding: '22px 26px 4px', fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 15.5, color: 'var(--heading)' }}>Team members</div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.8fr 1fr 1fr', padding: '12px 26px', marginTop: 12, background: 'var(--field-bg)' }}>
              {['Employee', 'Role', 'Assigned', 'Completed', 'Status'].map((h) => (
                <div key={h} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{h}</div>
              ))}
            </div>
            {rows.map((row, i) => {
              const isActive = row.user.isActive === undefined || !!row.user.isActive;
              return (
                <div
                  key={row.user.id}
                  onClick={() => navigate(`/tasks?assignee=${row.user.id}`)}
                  style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr 0.8fr 1fr 1fr', padding: '13px 26px', alignItems: 'center', borderTop: '1px solid var(--border)', borderBottom: i === rows.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer', opacity: isActive ? 1 : 0.55 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initial={row.user.initial} size={24} />
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.user.name}</span>
                  </div>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-secondary)' }}>{row.user.title}</div>
                  <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.assigned}</div>
                  <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--heading)' }}>{row.completed}</div>
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span onClick={() => startEdit(row.user)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                      Edit
                    </span>
                    <span onClick={() => setPendingPasswordReset(row.user)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                      Reset password
                    </span>
                    {isActive ? (
                      <span onClick={() => setPendingDeactivate(row.user)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: '#1F7A44', cursor: 'pointer' }}>
                        ● Active
                      </span>
                    ) : (
                      <span onClick={() => setUserActive(row.user.id, true)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--amber-text)', cursor: 'pointer' }}>
                        ● Inactive — Reactivate
                      </span>
                    )}
                    <span onClick={() => { setPendingDelete(row.user); setDeleteError(''); }} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11.5, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      Delete
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {showAdd && !created && (
        <Modal title="Add team member" onClose={resetAddForm}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full name" required>
              <TextInput value={newName} onChange={setNewName} placeholder="Full name" />
            </Field>
            <Field label="Email" required>
              <TextInput value={newEmail} onChange={setNewEmail} placeholder="name@company.com" />
            </Field>
            <Field label="Title" required>
              <Select value={newTitle} onChange={setNewTitle} options={TITLE_OPTIONS.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="Password (optional)">
              <TextInput value={newPassword} onChange={setNewPassword} placeholder="Leave blank to auto-generate one" type="password" />
            </Field>
            {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              They'll join {team?.name}. Set a password yourself if you'd rather they sign in with a real one right away — otherwise a temporary one is generated for you to hand off. Either way they'll set their own on first sign-in.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetAddForm}>Cancel</Button>
            <Button variant="primary" onClick={handleAdd} disabled={saving}>{saving ? 'Adding…' : 'Add member'}</Button>
          </div>
        </Modal>
      )}

      {created && (
        <Modal title={`${created.user.name} was added`} onClose={resetAddForm}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {created.tempPassword
                ? "Share these sign-in details with them directly — there's no email delivery configured, so this is the only place the temporary password is shown."
                : "They can sign in with the password you set. Here's their email for reference."}
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--field-bg)', border: '1px dashed var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CredentialRow label="Email" value={created.user.email} />
              {created.tempPassword && <CredentialRow label="Temporary password" value={created.tempPassword} mono />}
            </div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              They'll be required to set their own password the first time they sign in.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
            <Button variant="primary" onClick={resetAddForm}>Done</Button>
          </div>
        </Modal>
      )}

      {pendingDeactivate && (
        <Modal title={`Deactivate ${pendingDeactivate.name}?`} onClose={() => setPendingDeactivate(null)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            They will no longer be able to sign in. Their existing tasks and history stay intact — this can be undone at any time.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeactivate(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setUserActive(pendingDeactivate.id, false); setPendingDeactivate(null); }}>Deactivate</Button>
          </div>
        </Modal>
      )}

      {pendingDelete && (
        <Modal title={`Delete ${pendingDelete.name}?`} onClose={() => setPendingDelete(null)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This permanently removes their account. It only works if they have no tasks, comments, or daily updates yet — if they've done any real work, deactivate them instead so that history stays intact.
          </div>
          {deleteError && <div style={{ marginTop: 12, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{deleteError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete member'}</Button>
          </div>
        </Modal>
      )}

      {editingUser && (
        <Modal title={`Edit ${editingUser.name}`} onClose={resetEdit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full name" required>
              <TextInput value={editName} onChange={setEditName} placeholder="Full name" />
            </Field>
            <Field label="Title">
              <Select value={editTitle} onChange={setEditTitle} options={TITLE_OPTIONS.map((t) => ({ value: t, label: t }))} />
            </Field>
            <Field label="Email" required>
              <TextInput value={editEmail} onChange={setEditEmail} placeholder="name@company.com" />
            </Field>
            {editError && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{editError}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetEdit}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </Modal>
      )}

      {pendingPasswordReset && (
        <Modal title={`Reset ${pendingPasswordReset.name}'s password?`} onClose={() => setPendingPasswordReset(null)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
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
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
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

function CredentialRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'monospace' : "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
