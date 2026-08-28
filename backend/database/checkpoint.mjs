const { default: Database } = await import('better-sqlite3');
const path = await import('node:path');
const { fileURLToPath } = await import('node:url');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'taskflow.db');

const db = new Database(dbPath);
const before = db.pragma('wal_checkpoint(TRUNCATE)');
console.log('Checkpoint result:', before);
db.close();
