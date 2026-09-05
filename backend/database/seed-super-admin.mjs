// One-time (and safely re-runnable) provisioning script: ensures exactly one
// Super Admin row exists in the live database. This row is needed purely
// for referential integrity — several tables have foreign keys to users(id)
// (chat_members, chat_reactions, password_resets are NOT NULL ones, so a
// row-less "virtual" user would break the instant Super Admin ever touched
// chat) — it is NEVER used for authentication. Super Admin logs in via
// SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD checked directly in
// routes/auth.js, and this row's own password_hash column is left NULL and
// never read. Uses the same static `import pg from 'pg'` pattern as
// migrate-postgres-schema.mjs — NOT setup-admin.mjs, which is dead
// SQLite-era code the running (Postgres-only) app can no longer reach.
import 'dotenv/config';
import pg from 'pg';
import { SUPER_ADMIN_ID } from './hierarchy.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in backend/.env');
  process.exit(1);
}
if (!process.env.SUPER_ADMIN_EMAIL || !process.env.SUPER_ADMIN_PASSWORD) {
  console.error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must both be set in backend/.env before provisioning.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  // Re-running this after SUPER_ADMIN_EMAIL changes keeps the row's display
  // email in sync — the actual auth check always reads the env var fresh,
  // this is purely so the row isn't stale if anyone ever looks at it directly.
  await client.query(
    `INSERT INTO users (id, name, role, team_id, department_id, title, initial, email, password_hash, must_change_password, is_active)
     VALUES ($1, $2, 'super_admin', NULL, NULL, 'Super Admin', 'SA', $3, NULL, 0, 1)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email`,
    [SUPER_ADMIN_ID, 'Super Admin', process.env.SUPER_ADMIN_EMAIL.trim().toLowerCase()],
  );

  const { rows } = await client.query(`SELECT id, email FROM users WHERE role = 'super_admin'`);
  console.log(`Super Admin provisioned. ${rows.length} row(s) with role='super_admin':`, rows);
  if (rows.length !== 1) {
    console.warn('WARNING: expected exactly one super_admin row — investigate before relying on this.');
  }
} catch (err) {
  console.error('Super Admin provisioning failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
