import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — see backend/.env.example');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Translates a SQLite-style query (either `?` positional or `@name` named
// placeholders — both used across the existing route files) into Postgres's
// `$1, $2, ...` style, once per distinct SQL string. Repeated `@name`
// occurrences reuse the same `$n`; `names` records the order so values can
// be pulled from the object passed to .get/.all/.run in the right sequence.
function translateSql(sql) {
  const hasNamed = /@\w+/.test(sql);
  if (hasNamed) {
    const order = [];
    const seen = new Map();
    const translated = sql.replace(/@(\w+)/g, (_, name) => {
      if (!seen.has(name)) {
        seen.set(name, order.length + 1);
        order.push(name);
      }
      return `$${seen.get(name)}`;
    });
    return { sql: translated, mode: 'named', names: order };
  }
  let i = 0;
  const translated = sql.replace(/\?/g, () => `$${++i}`);
  return { sql: translated, mode: 'positional' };
}

const compiledCache = new Map();
function compile(sql) {
  let compiled = compiledCache.get(sql);
  if (!compiled) {
    compiled = translateSql(sql);
    compiledCache.set(sql, compiled);
  }
  return compiled;
}

function resolveValues(compiled, args) {
  if (compiled.mode === 'named') {
    const obj = args[0] || {};
    // pg throws on `undefined` bound values (it requires `null` for SQL
    // NULL) — better-sqlite3 never let `undefined` reach this point either,
    // so this is a safety net, not a behavior change.
    return compiled.names.map((name) => (obj[name] === undefined ? null : obj[name]));
  }
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

// `executor` defaults to the pool (a fresh connection per query, which is
// correct for every normal route handler) but can be a checked-out client
// instead — see withTransaction below, used by seed/migration scripts that
// need several statements on the same connection.
export function prepare(sql, executor = pool) {
  const compiled = compile(sql);
  return {
    async get(...args) {
      const result = await executor.query(compiled.sql, resolveValues(compiled, args));
      return result.rows[0];
    },
    async all(...args) {
      const result = await executor.query(compiled.sql, resolveValues(compiled, args));
      return result.rows;
    },
    async run(...args) {
      const result = await executor.query(compiled.sql, resolveValues(compiled, args));
      return { changes: result.rowCount, lastInsertRowid: null };
    },
  };
}

// Runs `fn(client)` inside a single BEGIN/COMMIT — pass `client` (not the
// pool) to `prepare(sql, client)` for every statement that must be part of
// the same transaction. Rolls back and rethrows on any error.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkConnection() {
  await pool.query('SELECT 1');
}
