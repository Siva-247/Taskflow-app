import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Field, TextInput, Button } from '../components/ui.jsx';
import { IconLogo } from '../components/icons.jsx';

export default function ResetPassword() {
  const { resetPassword } = useApp();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setDone(true);
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
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconLogo size={24} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>Choose a new password</div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--card-shadow)', padding: '26px 24px' }}>
          {!token ? (
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--amber-text)' }}>
              This reset link is missing its token. Request a new one from the sign-in page.
            </div>
          ) : done ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontSize: 13.5, color: 'var(--text-secondary)' }}>Your password has been reset.</div>
              <Button variant="primary" style={{ justifyContent: 'center' }} onClick={() => navigate('/')}>Go to sign in</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="New password" required>
                <TextInput value={newPassword} onChange={setNewPassword} placeholder="At least 8 characters" type="password" />
              </Field>
              <Field label="Confirm new password" required>
                <TextInput value={confirm} onChange={setConfirm} placeholder="Repeat the password" type="password" />
              </Field>
              {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{error}</div>}
              <Button variant="primary" style={{ justifyContent: 'center' }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Resetting…' : 'Reset password'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
