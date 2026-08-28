// One-off migration: notifications.task_id was missing ON DELETE CASCADE,
// which caused deleting a task with any notification history to crash with
// a foreign-key-constraint 500. SQLite can't ALTER a foreign key in place,
// so this rebuilds the table with the corrected constraint and copies the data.
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, 'taskflow.db'));

const before = db.prepare('SELECT COUNT(*) as n FROM notifications').get().n;

db.pragma('foreign_keys = OFF');
const migrate = db.transaction(() => {
  db.exec(`
    CREATE TABLE notifications_new (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      type TEXT,
      text TEXT NOT NULL,
      task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
      read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);
  db.exec(`INSERT INTO notifications_new SELECT * FROM notifications;`);
  db.exec(`DROP TABLE notifications;`);
  db.exec(`ALTER TABLE notifications_new RENAME TO notifications;`);
});
migrate();
db.pragma('foreign_keys = ON');

const after = db.prepare('SELECT COUNT(*) as n FROM notifications').get().n;
const fkCheck = db.pragma('foreign_key_check');

console.log(`Migrated notifications table. Row count before: ${before}, after: ${after}.`);
console.log(`Foreign key check: ${fkCheck.length === 0 ? 'clean' : JSON.stringify(fkCheck)}`);

db.close();
