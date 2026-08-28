import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Field, TextInput, Button } from '../components/ui.jsx';
import { IconLogo } from '../components/icons.jsx';

export default function Login() {
  const { login, requestPasswordReset } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [resetSent, setResetSent] = useState(false);
  const [devResetToken, setDevResetToken] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (!result.ok) { setSubmitting(false); return; }
      navigate(result.mustChangePassword ? '/change-password' : '/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    if (!email.trim()) { setError('Enter the email on your account.'); return; }
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(email.trim());
      setResetSent(true);
      setDevResetToken(result.devResetToken || '');
    } catch {
      // context already surfaced a toast for the failure
    } finally {
      setSubmitting(false);
    }
  };

  const backToLogin = () => {
    setMode('login'); setError(''); setResetSent(false); setDevResetToken(''); setPassword('');
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '40px 20px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 32 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconLogo size={24} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 24, color: 'var(--heading)' }}>
              {mode === 'login' ? 'Sign in to TaskFlow' : 'Reset your password'}
            </div>
            <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--text-secondary)', marginTop: 6 }}>
              {mode === 'login' ? 'Task Management System' : "We'll create a reset link for the email on your account"}
            </div>
          </div>
        </div>

        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--card-shadow)', padding: '26px 24px' }}>
          {mode === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Field label="Email" required>
                <TextInput value={email} onChange={setEmail} placeholder="you@company.com" />
              </Field>
              <Field label="Password" required>
                <TextInput value={password} onChange={setPassword} placeholder="••••••••" type="password" />
              </Field>
              {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{error}</div>}
              <Button variant="primary" style={{ justifyContent: 'center', marginTop: 4 }} onClick={handleLogin} disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign In'}
              </Button>
              <div style={{ textAlign: 'center' }}>
                <span onClick={() => { setMode('forgot'); setError(''); }} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                  Forgot password?
                </span>
              </div>
              <div style={{ textAlign: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  Don't have an account?{' '}
                  <span onClick={() => navigate('/signup')} style={{ color: 'var(--accent-dark)', fontWeight: 700, cursor: 'pointer' }}>Create Account</span>
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!resetSent ? (
                <>
                  <Field label="Email" required>
                    <TextInput value={email} onChange={setEmail} placeholder="you@company.com" />
                  </Field>
                  {error && <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--amber-text)' }}>{error}</div>}
                  <Button variant="primary" style={{ justifyContent: 'center' }} onClick={handleForgot} disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send reset link'}
                  </Button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    If that email exists on an account, a reset link has been created. It expires in 30 minutes.
                  </div>
                  {devResetToken && (
                    <div style={{ padding: '12px 14px', background: 'var(--field-bg)', border: '1px dashed var(--border)', borderRadius: 10 }}>
                      <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                        Dev mode — no email server configured
                      </div>
                      <div style={{ fontFamily: "monospace", fontSize: 11.5, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{devResetToken}</div>
                      <div
                        onClick={() => navigate(`/reset-password?token=${encodeURIComponent(devResetToken)}`)}
                        style={{ marginTop: 10, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}
                      >
                        Use this token to reset now →
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <span onClick={backToLogin} style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 600, fontSize: 12.5, color: 'var(--accent-dark)', cursor: 'pointer' }}>
                  ← Back to sign in
                </span>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 12.5, color: 'var(--text-muted)' }}>
          Your role and access are set by your account — there's no role picker here.
        </div>
      </div>
    </div>
  );
}
