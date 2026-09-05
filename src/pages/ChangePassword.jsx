import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Field, TextInput, Button } from '../components/ui.jsx';
import { IconLogo } from '../components/icons.jsx';

export default function ChangePassword() {
  const { currentUser, mustChangePassword, changePassword } = useApp();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!currentUser) return <Navigate to="/" replace />;

  const handleSubmit = async () => {
    setError('');
    if (!currentPassword) { setError('Enter your current password.'); return; }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (newPassword !== confirm) { setError('New passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate('/dashboard');
    } catch {
      // context already surfaced a toast for the failure
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
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>
              {mustChangePassword ? 'Set a permanent password' : 'Change your password'}
            </div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
              {mustChangePassword ? "You're signed in with a temporary password — set your own before continuing." : `Signed in as ${currentUser.name}`}
            </div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--card-shadow)', padding: '26px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label={mustChangePassword ? 'Temporary password' : 'Current password'} required>
              <TextInput value={currentPassword} onChange={setCurrentPassword} placeholder="••••••••" type="password" />
            </Field>
            <Field label="New password" required>
              <TextInput value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" type="password" />
            </Field>
            <Field label="Confirm new password" required>
              <TextInput value={confirm} onChange={setConfirm} placeholder="Repeat the password" type="password" />
            </Field>
            {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              {!mustChangePassword && (
                <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate(-1)}>Cancel</Button>
              )}
              <Button variant="primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Saving…' : 'Save password'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
