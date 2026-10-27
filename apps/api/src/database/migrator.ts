import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface Db {
  query(sql: string, params?: unknown[]): Promise<unknown>;
}

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../scripts/migrations/', import.meta.url));

/**
 * Applies scripts/migrations/NNN-name.sql in order, once each. Production schema comes only from these files
 * (forward-only). A Postgres advisory lock keeps two instances from migrating at the same time.
 * `db` must be a single connection.
 */
export async function runMigrations(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => /^\d{3}-.+\.sql$/.test(f)).sort();
  const applied: string[] = [];
  await db.query('SELECT pg_advisory_lock(727274)');
  try {
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set(((await db.query('SELECT name FROM schema_migrations')) as { name: string }[]).map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(new URL(file, `file://${dir}`), 'utf8');
      await db.query('BEGIN');
      try {
        await db.query(sql);
        await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await db.query('COMMIT');
      } catch (err) {
        await db.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
      }
      applied.push(file);
    }
  } finally {
    await db.query('SELECT pg_advisory_unlock(727274)');
  }
  return applied;
}
