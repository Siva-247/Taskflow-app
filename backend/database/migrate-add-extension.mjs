// One-off migration: adds the nullable `requested_due_date`/`extension_reason`
// columns to tasks for the due-date extension request feature. Simple ADD
// COLUMN — no table rebuild needed since both are nullable with no new constraint.
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'taskflow.db'));

const columns = db.prepare("PRAGMA table_info(tasks)").all().map((c) => c.name);
if (columns.includes('requested_due_date')) {
  console.log('requested_due_date column already exists — nothing to do.');
} else {
  db.exec('ALTER TABLE tasks ADD COLUMN requested_due_date TEXT;');
  db.exec('ALTER TABLE tasks ADD COLUMN extension_reason TEXT;');
  console.log('Added requested_due_date and extension_reason columns to tasks table.');
}

db.close();
