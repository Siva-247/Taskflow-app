import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — see backend/.env.example');
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  // Optional override, unset in production — the Supabase pooler's
  // session-mode connection cap is shared across every client on the
  // project (this app's deployed instance included), so a low value here
  // is useful for a local dev process sharing that same cap.
  ...(process.env.DB_POOL_MAX ? { max: Number(process.env.DB_POOL_MAX) } : {}),
});

// An idle pooled client can be dropped by the Supabase pooler at any time
// (recycled, network blip) — pg emits that as an 'error' event on the pool,
// and node's EventEmitter re-throws (crashing the whole process) if nothing
// is listening. The pool itself already discards the dead client and opens
// a fresh one on the next query, so there's nothing to do here beyond not
// letting an idle-connection hiccup take the entire server down.
pool.on('error', (err) => {
  console.error('Unexpected idle Postgres client error (pool recovers automatically):', err.message);
});

// Blanks out the interior of every single-quoted string literal (keeping the
// quotes and the overall length) so placeholder detection below never
// mistakes literal content for a real placeholder — e.g. the '@' in
// `LIKE '%@taskflow.local'`, or a stray '?' inside a literal.
function maskStringLiterals(sql) {
  let out = '';
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      if (inString && sql[i + 1] === "'") {
        out += '  ';
        i += 1;
        continue;
      }
      inString = !inString;
      out += ch;
      continue;
    }
    out += inString ? ' ' : ch;
  }
  return out;
}

// Translates a SQLite-style query (either `?` positional or `@name` named
// placeholders — both used across the existing route files) into Postgres's
// `$1, $2, ...` style, once per distinct SQL string. Repeated `@name`
// occurrences reuse the same `$n`; `names` records the order so values can
// be pulled from the object passed to .get/.all/.run in the right sequence.
// Placeholder positions are found in a string-literal-masked copy, then
// applied to the real SQL text, so nothing inside a literal is ever touched.
function translateSql(sql) {
  const masked = maskStringLiterals(sql);
  const namedMatches = [...masked.matchAll(/@(\w+)/g)];

  if (namedMatches.length > 0) {
    const order = [];
    const seen = new Map();
    let translated = '';
    let lastIndex = 0;
    for (const m of namedMatches) {
      const name = m[1];
      if (!seen.has(name)) {
        seen.set(name, order.length + 1);
        order.push(name);
      }
      translated += sql.slice(lastIndex, m.index) + `$${seen.get(name)}`;
      lastIndex = m.index + m[0].length;
    }
    translated += sql.slice(lastIndex);
    return { sql: translated, mode: 'named', names: order };
  }

  let i = 0;
  let translated = '';
  let lastIndex = 0;
  for (const m of masked.matchAll(/\?/g)) {
    translated += sql.slice(lastIndex, m.index) + `$${++i}`;
    lastIndex = m.index + 1;
  }
  translated += sql.slice(lastIndex);
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
