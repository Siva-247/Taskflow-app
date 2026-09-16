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

// Which of the four UI role choices a real {role, title} pair maps back to,
// for pre-filling the form when editing — the reverse of the role===... ?
// title mapping the submit handler below applies.
function roleSelectionFor(user) {
  if (user.role === 'manager') return 'manager';
  if (user.title === 'Developer') return 'employee';
  if (user.title === 'Intern') return 'intern';
  return 'other';
}

// One popup that both hires (creating into any department/team on the spot
// if they don't exist yet — same "Other reveals a text box" idiom as
// RaiseBlockerModal's Category field) and edits an existing member, reusing
// the exact same fields either way so moving someone between roles/teams
// looks like re-filling the form that placed them in the first place. Role
// here is a UI convenience over the real role/title split, not a new role
// value: Manager maps to role 'manager'; Employee/Intern/Other all stay
// role 'employee', only the title differs (Developer / Intern / whatever
// was typed) — the six-value role enum every authorization check depends
// on never changes. Pass `user` to edit them; omit it to create someone new.
export default function AddEmployeeModal({ user, onClose }) {
  const { currentUser, departments, teams, addDepartment, addTeam, addManager, addTeamMember, editUser, showToast } = useApp();
  const isEditing = Boolean(user);
  // A manager only ever staffs their own department (every backend route
  // here enforces that already) — locking the field instead of just letting
  // the request 403 avoids a confusing dead-end where the department picker
  // looks free to change but silently isn't.
  const isDeptLocked = currentUser.role === 'manager';
  // team_lead/assistant_manager/super_admin carry bookkeeping (teams.lead_id/
  // assistant_manager_id, the fixed Super Admin row) this form was never
  // built to rewrite — editing one of them falls back to a minimal Name/
  // Email/Title-only form instead of the full role/team/department reshape,
  // matching exactly what the backend's own PATCH route will actually apply
  // (see routes/users.js's canReshape).
  const isLockedRole = isEditing && !['manager', 'employee'].includes(user.role);

  const roleOptions = isDeptLocked ? ROLE_OPTIONS.filter((o) => o.value !== 'manager') : ROLE_OPTIONS;
  const myDepartment = departments.find((d) => d.id === currentUser.departmentId);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [deptSelection, setDeptSelection] = useState(isDeptLocked ? currentUser.departmentId : (user?.departmentId || departments[0]?.id || OTHER_DEPT));
  const [customDept, setCustomDept] = useState('');
  const [role, setRole] = useState(user ? roleSelectionFor(user) : 'employee');
  const [customTitle, setCustomTitle] = useState(isEditing && roleSelectionFor(user) === 'other' ? (user.title || '') : '');
  const [teamSelection, setTeamSelection] = useState(user?.teamId || '');
  const [customTeam, setCustomTeam] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const needsTeam = role !== 'manager';
  const teamsForDept = deptSelection === OTHER_DEPT ? [] : teams.filter((t) => t.departmentId === deptSelection);
  // Only forced when actually chosen — an empty teamsForDept used to force
  // this on by itself (no teams yet = you MUST create one), which fought
  // against Team being optional: a department with zero teams should still
  // let you add someone with no team at all, not railroad you into creating
  // one just because the list happens to be empty.
  const needsNewTeamField = needsTeam && teamSelection === NEW_TEAM;

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
    if (isLockedRole) {
      if (!customTitle.trim()) e.customTitle = true;
      return e;
    }
    if (deptSelection === OTHER_DEPT && !customDept.trim()) e.customDept = true;
    if (role === 'other' && !customTitle.trim()) e.customTitle = true;
    // Team is optional, full stop — including the "+ New team" text field:
    // leaving it blank isn't an incomplete form, it just means the person
    // ends up on no team, exactly as if "No team" had been picked instead.
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
      if (isEditing) {
        if (isLockedRole) {
          await editUser(user.id, { name: name.trim(), email: email.trim(), title: customTitle.trim() });
        } else {
          let departmentId = deptSelection;
          if (deptSelection === OTHER_DEPT) {
            const dept = await addDepartment({ name: customDept.trim() });
            departmentId = dept.id;
          }
          const payload = { name: name.trim(), email: email.trim(), departmentId };
          if (role === 'manager') {
            payload.role = 'manager';
          } else {
            let teamId = teamSelection;
            if (needsNewTeamField) {
              teamId = customTeam.trim() ? (await addTeam({ name: customTeam.trim(), departmentId })).id : undefined;
            }
            payload.role = 'employee';
            payload.teamId = teamId || undefined;
            payload.title = role === 'intern' ? 'Intern' : role === 'employee' ? 'Developer' : customTitle.trim();
          }
          await editUser(user.id, payload);
        }
        onClose();
        return;
      }

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
          teamId = customTeam.trim() ? (await addTeam({ name: customTeam.trim(), departmentId })).id : undefined;
        }
        const title = role === 'intern' ? 'Intern' : role === 'employee' ? 'Developer' : customTitle.trim();
        // departmentId always goes along for the ride now, not just when a
        // team supplies it — the backend needs it directly for a team-less
        // hire, since there's no team left to derive it from.
        result = await addTeamMember({ name: name.trim(), email: email.trim(), title, teamId: teamId || undefined, departmentId, ...(password ? { password } : {}) });
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
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {created.tempPassword
              ? "Share these sign-in details with them directly — there's no email delivery configured, so this is the only place the temporary password is shown."
              : "They can sign in with the password you set. Here's their email for reference."}
          </div>
          <div style={{ padding: '14px 16px', background: 'var(--field-bg)', border: '1px dashed var(--border)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <CredentialRow label="Email" value={created.user.email} />
            {created.tempPassword && <CredentialRow label="Temporary password" value={created.tempPassword} mono />}
          </div>
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
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
    <Modal title={isEditing ? `Edit ${user.name}` : 'Add employee'} onClose={onClose} maxWidth={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Full name" required>
          <TextInput value={name} onChange={setName} placeholder="Full name" />
        </Field>
        {errors.name && <ErrorText>Name is required.</ErrorText>}

        <Field label="Email" required>
          <TextInput value={email} onChange={setEmail} placeholder="name@company.com" />
        </Field>
        {errors.email && <ErrorText>Enter a valid email address.</ErrorText>}

        {!isEditing && (
          <Field label="Password (optional)">
            <TextInput value={password} onChange={setPassword} placeholder="Leave blank to auto-generate one" type="password" />
          </Field>
        )}

        {isLockedRole ? (
          <>
            <Field label="Title" required>
              <TextInput value={customTitle} onChange={setCustomTitle} placeholder="e.g. Team Lead" />
            </Field>
            {errors.customTitle && <ErrorText>Title is required.</ErrorText>}
            <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
              {user.role === 'team_lead' ? 'Team Lead' : user.role === 'assistant_manager' ? 'Assistant Manager' : 'This'} role, team, and department
              aren't editable from here — reassign or clear their team-level role first if you need to move them.
            </div>
          </>
        ) : (
          <>
            {isDeptLocked ? (
              <Field label="Department">
                <div style={{ padding: '9px 14px', border: '1px solid var(--border)', borderRadius: 9, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 13.5, color: 'var(--text-secondary)', background: 'var(--field-bg)' }}>
                  {myDepartment?.name || 'Your department'}
                </div>
              </Field>
            ) : (
              <>
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
              </>
            )}

            <Field label="Role" required>
              <Select value={role} onChange={setRole} options={roleOptions} />
            </Field>
            {role === 'other' && (
              <Field label="Describe the role" required>
                <TextInput value={customTitle} onChange={setCustomTitle} placeholder="e.g. QA Lead" />
              </Field>
            )}
            {errors.customTitle && <ErrorText>Describe the role.</ErrorText>}

            {needsTeam && !needsNewTeamField && (
              <Field label="Team (optional)">
                <Select
                  value={teamSelection}
                  onChange={setTeamSelection}
                  options={[{ value: '', label: 'No team' }, ...teamsForDept.map((t) => ({ value: t.id, label: t.name })), { value: NEW_TEAM, label: '+ New team' }]}
                />
              </Field>
            )}
            {needsNewTeamField && (
              <Field label="New team name (optional)">
                <TextInput value={customTeam} onChange={setCustomTeam} placeholder="e.g. Operations Team — leave blank for no team" />
              </Field>
            )}
          </>
        )}

        {!isEditing && (
          <div style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--text-muted)' }}>
            Set a password yourself if you'd rather they sign in with a real one right away — otherwise a temporary one is generated for you to hand off. Either way they'll set their own on first sign-in.
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
          {isEditing ? (saving ? 'Saving…' : 'Save changes') : (saving ? 'Adding…' : 'Add employee')}
        </Button>
      </div>
    </Modal>
  );
}

function ErrorText({ children }) {
  return <div style={{ marginTop: -8, fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--amber-text)' }}>{children}</div>;
}

function CredentialRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontFamily: "'Outfit',system-ui,sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily: mono ? 'monospace' : "'Outfit',system-ui,sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
