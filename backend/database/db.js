import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Overridable so a real deployment can point at a persistent volume instead
// of the file living next to the source code — server.js loads dotenv/config
// before this module, so DATABASE_PATH is already set by the time this runs.
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'taskflow.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

export const isNewDb = !fs.existsSync(DB_PATH);

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

if (isNewDb) {
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

// better-sqlite3 wraps every prepared statement in a native handle with its
// own GC finalizer. Calling db.prepare() fresh on every request (as route
// handlers originally did) creates and discards thousands of these over a
// session, which has been observed to crash Node's isolate cleanup under
// GC pressure. Caching by SQL text means each distinct query is prepared
// exactly once for the process's lifetime.
const statementCache = new Map();
export function prepare(sql) {
  let stmt = statementCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    statementCache.set(sql, stmt);
  }
  return stmt;
}
