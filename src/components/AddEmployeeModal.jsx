import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Modal, Field, TextInput, Select, Button } from './ui.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTHER_DEPT = '__other_dept__';
const NEW_TEAM = '__new_team__';
const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
  { value: 'intern', label: 'Intern' },
  { value: 'other', label: 'Other' },
];

// One popup that can hire into any department/team, creating either on the
// spot if they don't exist yet — same "Other reveals a text box" idiom as
// RaiseBlockerModal's Category field. Role here is a UI convenience over the
// real role/title split, not a new role value: Manager maps to role
// 'manager'; Employee/Intern/Other all stay role 'employee', only the title
// differs (Developer / Intern / whatever was typed) — the six-value role
// enum every authorization check depends on never changes.
export default function AddEmployeeModal({ onClose }) {
  const { departments, teams, addDepartment, addTeam, addManager, addTeamMember, showToast } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deptSelection, setDeptSelection] = useState(departments[0]?.id || OTHER_DEPT);
  const [customDept, setCustomDept] = useState('');
  const [role, setRole] = useState('employee');
  const [customTitle, setCustomTitle] = useState('');
  const [teamSelection, setTeamSelection] = useState('');
  const [customTeam, setCustomTeam] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const needsTeam = role !== 'manager';
  const teamsForDept = deptSelection === OTHER_DEPT ? [] : teams.filter((t) => t.departmentId === deptSelection);
  const needsNewTeamField = needsTeam && (teamsForDept.length === 0 || teamSelection === NEW_TEAM);

  const handleDeptChange = (value) => {
    setDeptSelection(value);
    setTeamSelection('');
    setCustomTeam('');
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = true;
    if (!EMAIL_RE.test(email.trim())) e.email = true;
    if (password && password.length < 8) e.password = true;
    if (deptSelection === OTHER_DEPT && !customDept.trim()) e.customDept = true;
    if (role === 'other' && !customTitle.trim()) e.customTitle = true;
    if (needsTeam) {
      if (needsNewTeamField && !customTeam.trim()) e.customTeam = true;
      if (!needsNewTeamField && !teamSelection) e.teamSelection = true;
    }
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      showToast(e.password ? 'Password must be at least 8 characters' : 'Fill in the required fields first');
      return;
    }
    setSaving(true);
    try {
      let departmentId = deptSelection;
      if (deptSelection === OTHER_DEPT) {
        const dept = await addDepartment({ name: customDept.trim() });
        departmentId = dept.id;
      }

      let result;
      if (role === 'manager') {
        result = await addManager({ name: name.trim(), email: email.trim(), departmentId, ...(password ? { password } : {}) });
      } else {
        let teamId = teamSelection;
        if (needsNewTeamField) {
          const team = await addTeam({ name: customTeam.trim(), departmentId });
          teamId = team.id;
        }
        const title = role === 'intern' ? 'Intern' : role === 'employee' ? 'Developer' : customTitle.trim();
        result = await addTeamMember({ name: name.trim(), email: email.trim(), title, teamId, ...(password ? { password } : {}) });
      }
      setCreated(result);
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Modal title={`${created.user.name} was added`} onClose={onClose}>
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
          <Button variant="primary" onClick={onClose}>Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add employee" onClose={onClose} maxWidth={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Full name" required>
          <TextInput value={name} onChange={setName} placeholder="Full name" />
        </Field>
        {errors.name && <ErrorText>Name is required.</ErrorText>}

        <Field label="Email" required>
          <TextInput value={email} onChange={setEmail} placeholder="name@company.com" />
        </Field>
        {errors.email && <ErrorText>Enter a valid email address.</ErrorText>}

        <Field label="Password (optional)">
          <TextInput value={password} onChange={setPassword} placeholder="Leave blank to auto-generate one" type="password" />
        </Field>

        <Field label="Department" required>
          <Select
            value={deptSelection}
            onChange={handleDeptChange}
            options={[...departments.map((d) => ({ value: d.id, label: d.name })), { value: OTHER_DEPT, label: 'Other — add a new department' }]}
          />
        </Field>
        {deptSelection === OTHER_DEPT && (
          <Field label="New department name" required>
            <TextInput value={customDept} onChange={setCustomDept} placeholder="e.g. Operations" />
          </Field>
        )}
        {errors.customDept && <ErrorText>Enter the new department's name.</ErrorText>}

        <Field label="Role" required>
          <Select value={role} onChange={setRole} options={ROLE_OPTIONS} />
        </Field>
        {role === 'other' && (
          <Field label="Describe the role" required>
            <TextInput value={customTitle} onChange={setCustomTitle} placeholder="e.g. QA Lead" />
          </Field>
        )}
        {errors.customTitle && <ErrorText>Describe the role.</ErrorText>}

        {needsTeam && !needsNewTeamField && (
          <Field label="Team" required>
            <Select
              value={teamSelection}
              onChange={setTeamSelection}
              options={[{ value: '', label: 'Select a team' }, ...teamsForDept.map((t) => ({ value: t.id, label: t.name })), { value: NEW_TEAM, label: '+ New team' }]}
            />
          </Field>
        )}
        {errors.teamSelection && <ErrorText>Select a team.</ErrorText>}
        {needsNewTeamField && (
          <Field label="New team name" required>
            <TextInput value={customTeam} onChange={setCustomTeam} placeholder="e.g. Operations Team" />
          </Field>
        )}
        {errors.customTeam && <ErrorText>Enter the new team's name.</ErrorText>}

        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
          Set a password yourself if you'd rather they sign in with a real one right away — otherwise a temporary one is generated for you to hand off. Either way they'll set their own on first sign-in.
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Adding…' : 'Add employee'}</Button>
      </div>
    </Modal>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: -8, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{children}</div>;
}

function CredentialRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'monospace' : "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
