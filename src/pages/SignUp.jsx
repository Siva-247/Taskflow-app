import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Field, TextInput, Select, Button } from '../components/ui.jsx';
import { IconLogo } from '../components/icons.jsx';

// No 'admin' option — the admin account is never claimable through public
// signup (see backend/routes/auth.js and backend/database/setup-admin.mjs).
const ROLE_OPTIONS = [
  { value: '', label: 'Select your role' },
  { value: 'manager', label: 'Manager' },
  { value: 'assistant-manager', label: 'Assistant Manager' },
  { value: 'lead', label: 'Team Lead' },
  { value: 'employee', label: 'Employee' },
  { value: 'intern', label: 'Intern' },
];

const OTHER_DEPARTMENT = '__other__';

export default function SignUp() {
  const { signup, fetchSignupDepartments, addSignupDepartment } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [departments, setDepartments] = useState([]);
  const [departmentId, setDepartmentId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [addingDept, setAddingDept] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Admin oversees the whole org rather than one department, so it's the
  // only role that doesn't need a department selected.
  const needsDepartment = role && role !== 'admin';

  useEffect(() => {
    fetchSignupDepartments().then(setDepartments);
  }, [fetchSignupDepartments]);

  const departmentOptions = [
    { value: '', label: 'Select your department' },
    ...departments.map((d) => ({ value: d.id, label: d.name })),
    { value: OTHER_DEPARTMENT, label: 'Other — add a new department' },
  ];

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    setAddingDept(true);
    const created = await addSignupDepartment(newDeptName.trim());
    setAddingDept(false);
    if (!created) return;
    setDepartments((prev) => [...prev, created]);
    setDepartmentId(created.id);
    setNewDeptName('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) { setError('Enter your full name.'); return; }
    if (!role) { setError('Select your role.'); return; }
    if (needsDepartment && !departmentId) { setError('Select your department.'); return; }
    if (needsDepartment && departmentId === OTHER_DEPARTMENT) { setError('Add your new department first.'); return; }
    if (!email.trim()) { setError('Enter your email.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const result = await signup(name.trim(), email.trim(), password, role, needsDepartment ? departmentId : undefined);
      if (!result.ok) { setSubmitting(false); return; }
      navigate('/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '40px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 32 }}>
          <IconLogo size={46} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Create your TMS account</div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
              Enter your name exactly as your team lead has it on file — this connects your account to your existing role, team, and task history.
            </div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--card-shadow)', padding: '26px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Full Name" required>
              <TextInput value={name} onChange={setName} placeholder="Your full name" />
            </Field>
            <Field label="Role" required>
              <Select value={role} onChange={setRole} options={ROLE_OPTIONS} />
            </Field>
            {needsDepartment && (
              <Field label="Department" required>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Select value={departmentId} onChange={setDepartmentId} options={departmentOptions} />
                  {departmentId === OTHER_DEPARTMENT && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <TextInput value={newDeptName} onChange={setNewDeptName} placeholder="New department name" />
                      </div>
                      <Button variant="secondary" onClick={handleAddDepartment} disabled={addingDept || !newDeptName.trim()}>
                        {addingDept ? 'Adding…' : 'Add'}
                      </Button>
                    </div>
                  )}
                </div>
              </Field>
            )}
            <Field label="Email" required>
              <TextInput value={email} onChange={setEmail} placeholder="you.company@gmail.com" />
            </Field>
            <Field label="Password" required>
              <TextInput value={password} onChange={setPassword} placeholder="At least 8 characters" type="password" />
            </Field>
            <Field label="Confirm Password" required>
              <TextInput value={confirm} onChange={setConfirm} placeholder="Repeat the password" type="password" />
            </Field>
            {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{error}</div>}
            <Button variant="primary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create Account'}
            </Button>
            <div style={{ textAlign: 'center' }}>
              <span onClick={() => navigate('/')} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                Already have an account? <span style={{ color: 'var(--accent-dark)', fontWeight: 700, cursor: 'pointer' }}>Sign In</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
