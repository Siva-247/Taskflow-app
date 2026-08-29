// One-time script: creates the TaskFlow schema in the Postgres database
// pointed to by DATABASE_URL. Safe to re-run — every statement in
// schema.postgres.sql uses IF NOT EXISTS.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in backend/.env');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf8');

try {
  await client.connect();
  await client.query(schemaSql);
  console.log('Postgres schema created (or already present).');
} catch (err) {
  console.error('Schema creation failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
