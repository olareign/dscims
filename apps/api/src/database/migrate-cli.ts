// Run by the deploy pipeline before the API starts: node dist/database/migrate-cli.js
import pg from 'pg';
import { runMigrations } from './migrator.js';

const url = process.env.DATABASE_URL;
const client = new pg.Client(
  url
    ? { connectionString: url, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5456),
        user: process.env.DB_USERNAME ?? 'dscims_user',
        password: process.env.DB_PASSWORD ?? 'dscims_password',
        database: process.env.DB_DATABASE ?? 'dscims_db',
      },
);

await client.connect();
try {
  const applied = await runMigrations({ query: async (sql, params) => (await client.query(sql, params as unknown[])).rows });
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
} finally {
  await client.end();
}
