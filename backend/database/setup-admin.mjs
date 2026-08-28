// One-time, out-of-band admin provisioning. Run manually by whoever deploys
// the app — this is deliberately NOT reachable through any HTTP endpoint,
// since the admin account must never be claimable through public signup.
//
// Usage:
//   node database/setup-admin.mjs admin@yourcompany.com "a-strong-password"
//
// Refuses to run if an admin has already been claimed (real email attached),
// so it can't be used to silently take over an in-use admin account.
//
// Uses dynamic import() rather than static imports: on this project's
// Windows/Node/better-sqlite3 combination, a plain top-level `import
// Database from 'better-sqlite3'` in a standalone script crashes on exit
// with a native "Statement::`scalar deleting destructor'" assertion — the
// same class of crash documented in database/db.js. Dynamic import sidesteps
// it reliably; every other one-off script here should follow this pattern
// too if it starts crashing the same way.
const { default: Database } = await import('better-sqlite3');
const { default: bcrypt } = await import('bcryptjs');
const path = await import('node:path');
const { fileURLToPath } = await import('node:url');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'taskflow.db'));

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node database/setup-admin.mjs <email> <password>');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('That does not look like a valid email address.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const admin = db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY rowid ASC LIMIT 1").get();
if (!admin) {
  console.error('No seeded admin user found — nothing to set up.');
  process.exit(1);
}
if (!admin.email.endsWith('@taskflow.local')) {
  console.error(`The admin account is already set up (${admin.email}). Refusing to overwrite it — sign in and use "Forgot password" instead.`);
  process.exit(1);
}

const existingEmail = db.prepare('SELECT 1 FROM users WHERE email = ? COLLATE NOCASE').get(email);
if (existingEmail) {
  console.error('That email is already in use by another account.');
  process.exit(1);
}

db.prepare('UPDATE users SET email = ?, password_hash = ?, must_change_password = 0 WHERE id = ?')
  .run(email.trim().toLowerCase(), bcrypt.hashSync(password, 10), admin.id);

console.log(`Admin account is ready. Sign in with:\n  email: ${email}\n  password: (as provided)`);
db.close();
