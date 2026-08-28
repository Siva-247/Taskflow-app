// One-off migration: adds the nullable `marks` column to tasks for the
// team-lead grading feature. Simple ADD COLUMN — no table rebuild needed
// since it's nullable with no new constraint.
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'taskflow.db'));

const columns = db.prepare("PRAGMA table_info(tasks)").all().map((c) => c.name);
if (columns.includes('marks')) {
  console.log('marks column already exists — nothing to do.');
} else {
  db.exec('ALTER TABLE tasks ADD COLUMN marks INTEGER;');
  console.log('Added marks column to tasks table.');
}

db.close();
