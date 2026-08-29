// Explicit, one-time seeding — run with `npm run seed`, never automatically
// on server startup. Refuses to run if the database already has data (see
// seedIfEmpty in seed.js).
import 'dotenv/config';
import { seedIfEmpty } from './seed.js';
import { pool } from './db.js';

await seedIfEmpty();
await pool.end();
