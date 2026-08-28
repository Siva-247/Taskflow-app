import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, ROUNDS);
}

export function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(plain, hash);
}

// A cryptographically random temp password handed to a newly-created user in
// the API response (dev-mode stand-in for an email invitation — see
// routes/auth.js and routes/users.js for where this gets surfaced).
export function generateTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
