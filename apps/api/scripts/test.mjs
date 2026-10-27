import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// Never use DB_DATABASE or .env here: tests own a disposable database.
const database = `dscims_test_${randomBytes(8).toString('hex')}`;
const connection = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? 5456),
  user: process.env.TEST_DB_USERNAME ?? 'dscims_user',
  password: process.env.TEST_DB_PASSWORD ?? 'dscims_password',
  database: 'postgres',
};
const admin = new pg.Client(connection);
let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  created = true;
  const child = spawn(process.execPath, [
    fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
    ...process.argv.slice(2),
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DB_HOST: connection.host, DB_PORT: String(connection.port),
      DB_USERNAME: connection.user, DB_PASSWORD: connection.password, DB_DATABASE: database,
      JWT_SECRET: randomBytes(32).toString('hex'),
      RUN_MIGRATIONS: 'true',
      BCRYPT_ROUNDS: '4',
      TENANT_GRACE_DAYS: '7',
      PUBLIC_WEB_URL: 'http://web.test',
      DSCIMS_TEST_DATABASE_READY: '1',
    },
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} finally {
  if (created) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await admin.end();
}
