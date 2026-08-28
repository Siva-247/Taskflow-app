import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { ROLES } from '../data/mockData.js';
import { Card, Avatar, ProgressBar, Button, Modal, Field, TextInput } from '../components/ui.jsx';
import { IconPlusCircle } from '../components/icons.jsx';
import { useRoleGuard } from '../hooks/useRoleGuard.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Teams() {
  const { currentUser, users, teams, departments, tasks, statsFor, addTeamLead } = useApp();
  const navigate = useNavigate();
  const allowed = useRoleGuard([ROLES.ADMIN, ROLES.MANAGER]);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  if (!allowed) return null;

  const isAdmin = currentUser.role === ROLES.ADMIN;
  const scopedTeams = isAdmin ? teams : teams.filter((t) => t.departmentId === currentUser.departmentId);
  const myDepartment = departments.find((d) => d.id === currentUser.departmentId);

  const rows = scopedTeams.map((team) => {
    const lead = users.find((u) => u.id === team.leadId);
    const members = users.filter((u) => u.teamId === team.id && u.role === ROLES.EMPLOYEE);
    const teamTasks = tasks.filter((t) => t.teamId === team.id);
    const stats = statsFor(teamTasks);
    const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
    return { team, lead, memberCount: members.length, ...stats, completionRate };
  });

  const resetAddForm = () => {
    setShowAdd(false); setNewName(''); setNewEmail(''); setNewTeamName(''); setError(''); setCreated(null);
  };

  const handleAdd = async () => {
    if (!newName.trim()) { setError('Name is required.'); return; }
    if (!EMAIL_RE.test(newEmail.trim())) { setError('Enter a valid email address.'); return; }
    if (!newTeamName.trim()) { setError('Team name is required.'); return; }
    setSaving(true);
    try {
      const result = await addTeamLead({ name: newName.trim(), email: newEmail.trim(), teamName: newTeamName.trim() });
      setCreated(result);
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {rows.map((row) => (
          <Card key={row.team.id} style={{ cursor: 'pointer' }}>
            <div onClick={() => navigate(`/tasks?team=${row.team.id}`)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 16.5, color: 'var(--heading)' }}>{row.team.name}</div>
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--text-muted)' }}>{row.memberCount} member{row.memberCount === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <Avatar initial={row.lead?.initial} size={24} />
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>{row.lead?.name} · Team Lead</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 18 }}>
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
            {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{error}</div>}
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              A new team is created with them as its lead, with a temporary password you'll need to share with them directly.
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
