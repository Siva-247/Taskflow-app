import crypto from 'node:crypto';

// Demo-scale signed session token: no DB-backed session store needed since
// tokens are stateless and verified by signature. Not for production use —
// a real deployment would rotate this secret and store it outside source.
const SECRET = process.env.TASKFLOW_SESSION_SECRET || 'taskflow-demo-secret-do-not-use-in-production';
const MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours

export function createToken(userId) {
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (Date.now() - payload.iat > MAX_AGE_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
