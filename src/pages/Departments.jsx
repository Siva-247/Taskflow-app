import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Card, Avatar, ProgressBar, Button, Modal, Field, TextInput } from '../components/ui.jsx';
import { IconPlusCircle } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

export default function Departments() {
  const { users, teams, departments, tasks, statsFor, addDepartment, editDepartment, deleteDepartment, addManager } = useApp();
  const navigate = useNavigate();
  const allowed = useRoleGuard(ROLES.ADMIN);

  const [showAddDept, setShowAddDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [addManagerFor, setAddManagerFor] = useState(null);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdManager, setCreatedManager] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [pendingDeleteDept, setPendingDeleteDept] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  if (!allowed) return null;

  const rows = departments.map((dept) => {
    const deptTeams = teams.filter((t) => t.departmentId === dept.id);
    const manager = users.find((u) => u.role === ROLES.MANAGER && u.departmentId === dept.id);
    const employeeCount = users.filter((u) => u.role === ROLES.EMPLOYEE && u.departmentId === dept.id).length;
    const deptTeamIds = new Set(deptTeams.map((t) => t.id));
    const deptTasks = tasks.filter((t) => deptTeamIds.has(t.teamId));
    const stats = statsFor(deptTasks);
    const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
    return { dept, manager, teamCount: deptTeams.length, employeeCount, ...stats, completionRate };
  });

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const resetAddDept = () => { setShowAddDept(false); setNewDeptName(''); setError(''); };
  const resetAddManager = () => { setAddManagerFor(null); setNewManagerName(''); setNewManagerEmail(''); setError(''); setCreatedManager(null); };

  const handleAddDept = async () => {
    if (!newDeptName.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      await addDepartment({ name: newDeptName.trim() });
      resetAddDept();
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  const handleAddManager = async () => {
    if (!newManagerName.trim()) { setError('Name is required.'); return; }
    if (!EMAIL_RE.test(newManagerEmail.trim())) { setError('Enter a valid email address.'); return; }
    setSaving(true);
    try {
      const result = await addManager({ name: newManagerName.trim(), email: newManagerEmail.trim(), departmentId: addManagerFor.id });
      setCreatedManager(result);
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  const startEditDept = (dept) => { setEditingDept(dept); setEditDeptName(dept.name); setError(''); };
  const resetEditDept = () => { setEditingDept(null); setEditDeptName(''); setError(''); };

  const handleEditDept = async () => {
    if (!editDeptName.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    try {
      await editDepartment(editingDept.id, { name: editDeptName.trim() });
      resetEditDept();
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDept = async () => {
    setSaving(true);
    setDeleteError('');
    try {
      await deleteDepartment(pendingDeleteDept.id);
      setPendingDeleteDept(null);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete department');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Departments</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Company-wide department overview</div>
        </div>
        <Button onClick={() => setShowAddDept(true)}>
          <IconPlusCircle size={15} color="#FFFFFF" /> Add department
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {rows.map((row) => (
          <Card key={row.dept.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--heading)' }}>{row.dept.name}</div>
                {row.manager ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Avatar initial={row.manager.initial} size={22} />
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>{row.manager.name} · {row.manager.title || 'Manager'}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-muted)' }}>No manager assigned yet</span>
                    <span onClick={() => setAddManagerFor(row.dept)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>+ Add manager</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span onClick={() => startEditDept(row.dept)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                  Edit
                </span>
                <span onClick={() => { setPendingDeleteDept(row.dept); setDeleteError(''); }} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)', cursor: 'pointer' }}>
                  Delete
                </span>
                <div
                  onClick={() => navigate('/teams')}
                  style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}
                >
                  View teams →
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginTop: 20 }}>
              <DeptStat value={row.teamCount} label="Teams" />
              <DeptStat value={row.employeeCount} label="Employees" />
              <DeptStat value={row.total} label="Tasks" />
              <DeptStat value={row.completed} label="Completed" />
              <DeptStat value={row.inProgress} label="In Progress" />
              <DeptStat value={row.overdue} label="Overdue" color={row.overdue > 0 ? 'var(--amber-text)' : undefined} />
            </div>

            <div style={{ marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>Completion rate</span>
                <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--heading)' }}>{row.completionRate}%</span>
              </div>
              <ProgressBar value={row.completionRate} height={8} />
            </div>
          </Card>
        ))}
      </div>

      {showAddDept && (
        <Modal title="Add department" onClose={resetAddDept}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Name" required>
              <TextInput value={newDeptName} onChange={setNewDeptName} placeholder="e.g. Design" />
            </Field>
            {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetAddDept}>Cancel</Button>
            <Button variant="primary" onClick={handleAddDept} disabled={saving}>{saving ? 'Adding…' : 'Add department'}</Button>
          </div>
        </Modal>
      )}

      {editingDept && (
        <Modal title="Edit department" onClose={resetEditDept}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Name" required>
              <TextInput value={editDeptName} onChange={setEditDeptName} placeholder="e.g. Design" />
            </Field>
            {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetEditDept}>Cancel</Button>
            <Button variant="primary" onClick={handleEditDept} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </Modal>
      )}

      {pendingDeleteDept && (
        <Modal title={`Delete ${pendingDeleteDept.name}?`} onClose={() => setPendingDeleteDept(null)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This can't be undone. A department can only be deleted once every team and member has been moved out of it or removed.
          </div>
          {deleteError && <div style={{ marginTop: 12, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{deleteError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeleteDept(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteDept} disabled={saving}>{saving ? 'Deleting…' : 'Delete department'}</Button>
          </div>
        </Modal>
      )}

      {addManagerFor && !createdManager && (
        <Modal title={`Add manager to ${addManagerFor.name}`} onClose={resetAddManager}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full name" required>
              <TextInput value={newManagerName} onChange={setNewManagerName} placeholder="Full name" />
            </Field>
            <Field label="Email" required>
              <TextInput value={newManagerEmail} onChange={setNewManagerEmail} placeholder="name@company.com" />
            </Field>
            {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetAddManager}>Cancel</Button>
            <Button variant="primary" onClick={handleAddManager} disabled={saving}>{saving ? 'Adding…' : 'Add manager'}</Button>
          </div>
        </Modal>
      )}

      {createdManager && (
        <Modal title={`${createdManager.user.name} was added`} onClose={resetAddManager}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Share these sign-in details with them directly — there's no email delivery configured, so this is the only place the temporary password is shown.
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--field-bg)', border: '1px dashed var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CredentialRow label="Email" value={createdManager.user.email} />
              <CredentialRow label="Temporary password" value={createdManager.tempPassword} mono />
            </div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              They'll be required to set their own password the first time they sign in.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
            <Button variant="primary" onClick={resetAddManager}>Done</Button>
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

function DeptStat({ value, label, color = 'var(--heading)' }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 6px', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 17, color }}>{value}</div>
      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 10.5, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
