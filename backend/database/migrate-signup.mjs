// One-off migration: adds is_active (for the login "account active" check)
// and upgrades the email unique index to be case-insensitive, since sign-up
// must treat "Siva@x.com" and "siva@x.com" as the same account.
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'taskflow.db'));

const columns = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!columns.includes('is_active')) {
  db.exec('ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;');
  console.log('Added is_active column (default 1) to users.');
} else {
  console.log('is_active column already present.');
}

const indexes = db.prepare('PRAGMA index_list(users)').all();
const emailIndex = indexes.find((i) => i.name.toLowerCase().includes('email'));
if (emailIndex) db.exec(`DROP INDEX IF EXISTS ${emailIndex.name};`);
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE);');
console.log('Rebuilt idx_users_email as case-insensitive.');

db.close();
