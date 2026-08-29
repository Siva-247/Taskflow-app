// One-time script: copies every row from the local SQLite database
// (backend/database/taskflow.db — the actual current org data: real
// departments, claimed accounts, tasks, everything) into the Postgres
// database pointed to by DATABASE_URL. Run migrate-postgres-schema.mjs
// first. Safe to re-run against an empty Postgres database; refuses to run
// if the destination already has data, so it never overwrites anything.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in backend/.env');
  process.exit(1);
}

// Dynamic import — a static top-level import of better-sqlite3 in a
// standalone script has been observed to crash on this Windows setup (see
// setup-admin.mjs for the full story); dynamic import avoids it reliably.
const { default: Database } = await import('better-sqlite3');

const sqlite = new Database(path.join(__dirname, 'taskflow.db'), { readonly: true });
const pgClient = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Order matters: every table only after the tables its foreign keys point
// to have already been inserted.
const TABLES = [
  'departments', 'teams', 'users', 'password_resets',
  'tasks', 'task_subtasks', 'comments', 'daily_updates',
  'activity_logs', 'notifications',
];

function buildInsert(table, columns) {
  const cols = columns.join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  return `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`;
}

try {
  await pgClient.connect();

  const guardCount = await pgClient.query('SELECT COUNT(*) AS n FROM users');
  if (Number(guardCount.rows[0].n) > 0) {
    console.error('Postgres already has user data — refusing to run and risk duplicating/overwriting it.');
    process.exit(1);
  }

  for (const table of TABLES) {
    const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
    if (rows.length === 0) {
      console.log(`${table}: 0 rows, skipped.`);
      continue;
    }
    const columns = Object.keys(rows[0]);
    const insertSql = buildInsert(table, columns);
    for (const row of rows) {
      const values = columns.map((c) => row[c]);
      await pgClient.query(insertSql, values);
    }
    console.log(`${table}: migrated ${rows.length} rows.`);
  }

  console.log('Migration complete.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  sqlite.close();
  await pgClient.end();
}
