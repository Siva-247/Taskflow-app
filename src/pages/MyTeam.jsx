import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES, teamById } from '../data/mockData.js';
import { Card, Avatar, ProgressBar, Button, Modal, Field, TextInput, Select } from '../components/ui.jsx';
import { IconPlusCircle } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

const TITLE_OPTIONS = ['Intern', 'Developer'];

export default function MyTeam() {
  const { currentUser, users, departments, scopedTasks, statsFor, addTeamMember, setUserActive, deleteUser } = useApp();
  const navigate = useNavigate();
  const allowed = useRoleGuard(ROLES.TEAM_LEAD);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTitle, setNewTitle] = useState('Intern');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [pendingDeactivate, setPendingDeactivate] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!allowed) return null;

  const team = teamById(currentUser.teamId);
  const department = departments.find((d) => d.id === currentUser.departmentId);
  const teamTasks = scopedTasks(currentUser);
  const teamStats = statsFor(teamTasks);
  const completionRate = teamStats.total ? Math.round((teamStats.completed / teamStats.total) * 100) : 0;

  const members = users.filter((u) => u.teamId === currentUser.teamId && u.role === ROLES.EMPLOYEE);
  const rows = members.map((u) => {
    const assigned = teamTasks.filter((t) => t.assigneeId === u.id);
    const uStats = statsFor(assigned);
    return { user: u, assigned: uStats.total, completed: uStats.completed };
  });

  const resetAddForm = () => {
    setShowAdd(false); setNewName(''); setNewEmail(''); setNewTitle('Intern'); setError(''); setCreated(null);
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Name is required.'); return; }
    if (!EMAIL_RE.test(newEmail.trim())) { setError('Enter a valid email address.'); return; }
    setSaving(true);
    try {
      const result = await addTeamMember({ name: newName.trim(), email: newEmail.trim(), title: newTitle });
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
            {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              They'll join {team?.name} with a temporary password you'll need to share with them directly.
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
              Share these sign-in details with them directly — there's no email delivery configured, so this is the only place the temporary password is shown.
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--field-bg)', border: '1px dashed var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CredentialRow label="Email" value={created.user.email} />
              <CredentialRow label="Temporary password" value={created.tempPassword} mono />
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
