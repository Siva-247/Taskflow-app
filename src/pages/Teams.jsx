import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Card, Avatar, ProgressBar, Button, Modal, Field, TextInput, Select } from '../components/ui.jsx';
import { IconPlusCircle } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Teams() {
  const { currentUser, users, teams, departments, tasks, statsFor, addTeamLead, addTeam, editTeam, deleteTeam, editUser, resetUserPassword, addAssistantManager } = useApp();
  const navigate = useNavigate();
  const allowed = useRoleGuard([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetResult, setPasswordResetResult] = useState(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeamOnlyName, setNewTeamOnlyName] = useState('');
  const [newTeamDeptId, setNewTeamDeptId] = useState('');
  const [addTeamSaving, setAddTeamSaving] = useState(false);
  const [addTeamError, setAddTeamError] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [editTeamSaving, setEditTeamSaving] = useState(false);
  const [editTeamError, setEditTeamError] = useState('');
  const [pendingDeleteTeam, setPendingDeleteTeam] = useState(null);
  const [deleteTeamError, setDeleteTeamError] = useState('');
  const [deletingTeam, setDeletingTeam] = useState(false);
  const [addAMFor, setAddAMFor] = useState(null);
  const [newAMName, setNewAMName] = useState('');
  const [newAMEmail, setNewAMEmail] = useState('');
  const [newAMPassword, setNewAMPassword] = useState('');
  const [amSaving, setAmSaving] = useState(false);
  const [amError, setAmError] = useState('');
  const [createdAM, setCreatedAM] = useState(null);

  if (!allowed) return null;

  const isAdmin = currentUser.role === ROLES.SUPER_ADMIN || currentUser.role === ROLES.ADMIN;
  const scopedTeams = isAdmin ? teams : teams.filter((t) => t.departmentId === currentUser.departmentId);
  const myDepartment = departments.find((d) => d.id === currentUser.departmentId);

  const rows = scopedTeams.map((team) => {
    const lead = users.find((u) => u.id === team.leadId);
    const assistantManager = users.find((u) => u.id === team.assistantManagerId);
    const members = users.filter((u) => u.teamId === team.id && u.role === ROLES.EMPLOYEE);
    const teamTasks = tasks.filter((t) => t.teamId === team.id);
    const stats = statsFor(teamTasks);
    const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
    return { team, lead, assistantManager, memberCount: members.length, ...stats, completionRate };
  });

  const resetAddForm = () => {
    setShowAdd(false); setNewName(''); setNewEmail(''); setNewPassword(''); setNewTeamName(''); setError(''); setCreated(null);
  };

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Name is required.'); return; }
    if (!EMAIL_RE.test(newEmail.trim())) { setError('Enter a valid email address.'); return; }
    if (!newTeamName.trim()) { setError('Team name is required.'); return; }
    if (newPassword && newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      const result = await addTeamLead({
        name: newName.trim(), email: newEmail.trim(), teamName: newTeamName.trim(),
        ...(newPassword ? { password: newPassword } : {}),
      });
      setCreated(result);
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  const resetAddAM = () => {
    setAddAMFor(null); setNewAMName(''); setNewAMEmail(''); setNewAMPassword(''); setAmError(''); setCreatedAM(null);
  };

  const handleAddAM = async () => {
    if (!newAMName.trim()) { setAmError('Name is required.'); return; }
    if (!EMAIL_RE.test(newAMEmail.trim())) { setAmError('Enter a valid email address.'); return; }
    if (newAMPassword && newAMPassword.length < 8) { setAmError('Password must be at least 8 characters.'); return; }
    setAmSaving(true);
    try {
      const result = await addAssistantManager({
        name: newAMName.trim(), email: newAMEmail.trim(), teamId: addAMFor.id,
        ...(newAMPassword ? { password: newAMPassword } : {}),
      });
      setCreatedAM(result);
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setAmSaving(false);
    }
  };

  const startEdit = (user) => { setEditingUser(user); setEditName(user.name); setEditEmail(user.email || ''); setEditError(''); };
  const resetEdit = () => { setEditingUser(null); setEditName(''); setEditEmail(''); setEditError(''); };

  const handleSaveEdit = async () => {
    if (!editName.trim()) { setEditError('Name is required.'); return; }
    if (!EMAIL_RE.test(editEmail.trim())) { setEditError('Enter a valid email address.'); return; }
    setEditSaving(true);
    try {
      await editUser(editingUser.id, { name: editName.trim(), email: editEmail.trim() });
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

  const resetAddTeamForm = () => { setShowAddTeam(false); setNewTeamOnlyName(''); setNewTeamDeptId(''); setAddTeamError(''); };

  const handleAddTeam = async () => {
    if (!newTeamOnlyName.trim()) { setAddTeamError('Team name is required.'); return; }
    if (!newTeamDeptId) { setAddTeamError('Select a department.'); return; }
    setAddTeamSaving(true);
    try {
      await addTeam({ name: newTeamOnlyName.trim(), departmentId: newTeamDeptId });
      resetAddTeamForm();
    } catch (err) {
      setAddTeamError(err.message || 'Could not add team');
    } finally {
      setAddTeamSaving(false);
    }
  };

  const startEditTeam = (team) => { setEditingTeam(team); setEditTeamName(team.name); setEditTeamError(''); };
  const resetEditTeam = () => { setEditingTeam(null); setEditTeamName(''); setEditTeamError(''); };

  const handleSaveEditTeam = async () => {
    if (!editTeamName.trim()) { setEditTeamError('Team name is required.'); return; }
    setEditTeamSaving(true);
    try {
      await editTeam(editingTeam.id, { name: editTeamName.trim() });
      resetEditTeam();
    } catch (err) {
      setEditTeamError(err.message || 'Could not save changes');
    } finally {
      setEditTeamSaving(false);
    }
  };

  const handleDeleteTeam = async () => {
    setDeletingTeam(true);
    setDeleteTeamError('');
    try {
      await deleteTeam(pendingDeleteTeam.id);
      setPendingDeleteTeam(null);
    } catch (err) {
      setDeleteTeamError(err.message || 'Could not delete team');
    } finally {
      setDeletingTeam(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="stack-mobile" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Teams</div>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            {isAdmin ? 'Every team across the company' : `Teams in ${myDepartment?.name || 'your department'}`}
          </div>
        </div>
        {!isAdmin && (
          <Button onClick={() => setShowAdd(true)}>
            <IconPlusCircle size={15} color="#FFFFFF" /> Add team lead
          </Button>
        )}
        {isAdmin && (
          <Button onClick={() => setShowAddTeam(true)}>
            <IconPlusCircle size={15} color="#FFFFFF" /> Add team
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {rows.map((row) => (
          <Card key={row.team.id} style={{ cursor: 'pointer' }}>
            <div onClick={() => navigate(`/tasks?team=${row.team.id}`)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>{row.team.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--text-muted)' }}>{row.memberCount} member{row.memberCount === 1 ? '' : 's'}</span>
                  {isAdmin && (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span onClick={() => startEditTeam(row.team)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                        Edit
                      </span>
                      <span onClick={() => { setPendingDeleteTeam(row.team); setDeleteTeamError(''); }} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--amber-text)', cursor: 'pointer' }}>
                        Delete
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar initial={row.lead?.initial} size={24} />
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>{row.lead?.name} · Team Lead</span>
                </div>
                {!isAdmin && row.lead && (
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span onClick={() => startEdit(row.lead)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                      Edit
                    </span>
                    <span onClick={() => setPendingPasswordReset(row.lead)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                      Reset password
                    </span>
                  </div>
                )}
              </div>

              {!isAdmin && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {row.assistantManager ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar initial={row.assistantManager.initial} size={24} />
                        <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>{row.assistantManager.name} · Assistant Manager</span>
                      </div>
                      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span onClick={() => startEdit(row.assistantManager)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                          Edit
                        </span>
                        <span onClick={() => setPendingPasswordReset(row.assistantManager)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                          Reset password
                        </span>
                      </div>
                    </>
                  ) : (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13, color: 'var(--text-muted)' }}>No assistant manager assigned yet</span>
                      <span onClick={() => setAddAMFor(row.team)} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>+ Add assistant manager</span>
                    </div>
                  )}
                </div>
              )}

              <div className="responsive-grid" style={{ display: 'grid', '--cols': 'repeat(4,1fr)', gap: 8, marginTop: 18 }}>
                <TeamStat value={row.total} label="Total" />
                <TeamStat value={row.completed} label="Done" />
                <TeamStat value={row.inProgress} label="Active" />
                <TeamStat value={row.overdue} label="Overdue" color={row.overdue > 0 ? 'var(--amber-text)' : undefined} />
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 11.5, color: 'var(--text-muted)' }}>Completion</span>
                  <span style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 12.5, color: 'var(--heading)' }}>{row.completionRate}%</span>
                </div>
                <ProgressBar value={row.completionRate} height={7} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {showAdd && !created && (
        <Modal title="Add team lead" onClose={resetAddForm}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full name" required>
              <TextInput value={newName} onChange={setNewName} placeholder="Full name" />
            </Field>
            <Field label="Email" required>
              <TextInput value={newEmail} onChange={setNewEmail} placeholder="name@company.com" />
            </Field>
            <Field label="New team name" required>
              <TextInput value={newTeamName} onChange={setNewTeamName} placeholder="e.g. Priya's Team" />
            </Field>
            <Field label="Password (optional)">
              <TextInput value={newPassword} onChange={setNewPassword} placeholder="Leave blank to auto-generate one" type="password" />
            </Field>
            {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              A new team is created with them as its lead. Set a password yourself if you'd rather they sign in with a real one right away — otherwise a temporary one is generated for you to hand off. Either way they'll set their own on first sign-in.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetAddForm}>Cancel</Button>
            <Button variant="primary" onClick={handleAdd} disabled={saving}>{saving ? 'Adding…' : 'Add team lead'}</Button>
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

      {editingUser && (
        <Modal title={`Edit ${editingUser.name}`} onClose={resetEdit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full name" required>
              <TextInput value={editName} onChange={setEditName} placeholder="Full name" />
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

      {addAMFor && !createdAM && (
        <Modal title={`Add assistant manager to ${addAMFor.name}`} onClose={resetAddAM}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full name" required>
              <TextInput value={newAMName} onChange={setNewAMName} placeholder="Full name" />
            </Field>
            <Field label="Email" required>
              <TextInput value={newAMEmail} onChange={setNewAMEmail} placeholder="name@company.com" />
            </Field>
            <Field label="Password (optional)">
              <TextInput value={newAMPassword} onChange={setNewAMPassword} placeholder="Leave blank to auto-generate one" type="password" />
            </Field>
            {amError && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{amError}</div>}
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              They'll oversee {addAMFor.name}, including its Team Lead. Set a password yourself if you'd rather they sign in with a real one right away — otherwise a temporary one is generated for you to hand off. Either way they'll set their own on first sign-in.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetAddAM}>Cancel</Button>
            <Button variant="primary" onClick={handleAddAM} disabled={amSaving}>{amSaving ? 'Adding…' : 'Add assistant manager'}</Button>
          </div>
        </Modal>
      )}

      {createdAM && (
        <Modal title={`${createdAM.user.name} was added`} onClose={resetAddAM}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {createdAM.tempPassword
                ? "Share these sign-in details with them directly — there's no email delivery configured, so this is the only place the temporary password is shown."
                : "They can sign in with the password you set. Here's their email for reference."}
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--field-bg)', border: '1px dashed var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CredentialRow label="Email" value={createdAM.user.email} />
              {createdAM.tempPassword && <CredentialRow label="Temporary password" value={createdAM.tempPassword} mono />}
            </div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              They'll be required to set their own password the first time they sign in.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 22 }}>
            <Button variant="primary" onClick={resetAddAM}>Done</Button>
          </div>
        </Modal>
      )}

      {showAddTeam && (
        <Modal title="Add team" onClose={resetAddTeamForm}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Team name" required>
              <TextInput value={newTeamOnlyName} onChange={setNewTeamOnlyName} placeholder="e.g. Priya's Team" />
            </Field>
            <Field label="Department" required>
              <Select
                value={newTeamDeptId}
                onChange={setNewTeamDeptId}
                options={[{ value: '', label: 'Choose a department' }, ...departments.map((d) => ({ value: d.id, label: d.name }))]}
              />
            </Field>
            {addTeamError && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{addTeamError}</div>}
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              Creates an empty team with no lead yet — add one later from Employees, or use "Add team lead" as a manager to create both together.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetAddTeamForm}>Cancel</Button>
            <Button variant="primary" onClick={handleAddTeam} disabled={addTeamSaving}>{addTeamSaving ? 'Adding…' : 'Add team'}</Button>
          </div>
        </Modal>
      )}

      {editingTeam && (
        <Modal title={`Edit ${editingTeam.name}`} onClose={resetEditTeam}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Team name" required>
              <TextInput value={editTeamName} onChange={setEditTeamName} placeholder="Team name" />
            </Field>
            {editTeamError && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{editTeamError}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={resetEditTeam}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveEditTeam} disabled={editTeamSaving}>{editTeamSaving ? 'Saving…' : 'Save changes'}</Button>
          </div>
        </Modal>
      )}

      {pendingDeleteTeam && (
        <Modal title={`Delete ${pendingDeleteTeam.name}?`} onClose={() => setPendingDeleteTeam(null)}>
          <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            This only works if the team has no lead or members left on it — reassign or remove them first if it does.
          </div>
          {deleteTeamError && <div style={{ marginTop: 12, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{deleteTeamError}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <Button variant="secondary" onClick={() => setPendingDeleteTeam(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteTeam} disabled={deletingTeam}>{deletingTeam ? 'Deleting…' : 'Delete team'}</Button>
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

function TeamStat({ value, label, color = 'var(--heading)' }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 16, color }}>{value}</div>
      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 10.5, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
