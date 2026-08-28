import nodemailer from 'nodemailer';

// Real SMTP delivery for transactional emails (password reset). Configured
// entirely via environment variables so credentials never live in source —
// see backend/.env.example. If SMTP_HOST is unset, sending is treated as
// "not configured" rather than an error, so local dev can still fall back
// to the on-screen dev token in routes/auth.js.
function buildTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

export const isEmailConfigured = () => !!process.env.SMTP_HOST;

export async function sendPasswordResetEmail(toEmail, resetLink) {
  const transport = buildTransport();
  if (!transport) throw new Error('SMTP is not configured');

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject: 'Reset your TaskFlow password',
    text: `We received a request to reset your TaskFlow password.\n\nReset it here (expires in 30 minutes):\n${resetLink}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<p>We received a request to reset your TaskFlow password.</p>
<p><a href="${resetLink}">Click here to reset your password</a> (expires in 30 minutes).</p>
<p>If you didn't request this, you can ignore this email.</p>`,
  });
}
