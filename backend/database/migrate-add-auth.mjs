// One-off migration: adds real email/password authentication to the users
// table (email, password_hash, must_change_password) plus a password_resets
// table for the forgot-password flow, then backfills every existing user
// with a working login so the app isn't left broken mid-migration.
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'taskflow.db'));

const SEED_PASSWORD = 'TaskFlow@123';
const passwordHash = bcrypt.hashSync(SEED_PASSWORD, 10);

const columns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);

if (!columns.includes('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT;');
if (!columns.includes('password_hash')) db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT;');
if (!columns.includes('must_change_password')) db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;');

db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);`);

const usersNeedingBackfill = db.prepare('SELECT id FROM users WHERE email IS NULL OR password_hash IS NULL').all();
const backfill = db.prepare('UPDATE users SET email = ?, password_hash = ?, must_change_password = 1 WHERE id = ?');
const tx = db.transaction((rows) => {
  rows.forEach((row) => backfill.run(`${row.id}@taskflow.local`, passwordHash, row.id));
});
tx(usersNeedingBackfill);

db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);');

console.log(`Migration complete. Backfilled ${usersNeedingBackfill.length} user(s) with email + temp password "${SEED_PASSWORD}" (must_change_password=1).`);
db.close();
