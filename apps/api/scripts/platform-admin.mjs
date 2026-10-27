// Creates (or resets the password of) a Pacifylabs platform admin.
//   PLATFORM_ADMIN_PASSWORD='...' node --env-file=.env scripts/platform-admin.mjs ops@pacifylabs.com "Ops Team"
// The password comes from the environment so it never lands in shell history.
import bcrypt from 'bcrypt';
import pg from 'pg';

const [email, name = 'Platform admin'] = process.argv.slice(2);
const password = process.env.PLATFORM_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error('Usage: PLATFORM_ADMIN_PASSWORD=<12+ characters> node scripts/platform-admin.mjs <email> [name]');
  process.exit(1);
}

const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
const client = new pg.Client(
  url
    ? { connectionString: url, ssl: process.env.DB_SSL === 'true' }
    : { host: process.env.DB_HOST ?? 'localhost', port: Number(process.env.DB_PORT ?? 5456), user: process.env.DB_USERNAME ?? 'dscims_user', password: process.env.DB_PASSWORD ?? 'dscims_password', database: process.env.DB_DATABASE ?? 'dscims_db' },
);
await client.connect();
try {
  const hash = await bcrypt.hash(password, 12);
  await client.query(
    `INSERT INTO platform_admins (email, name, password_hash) VALUES (lower($1), $2, $3)
     ON CONFLICT ((lower(email))) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
    [email, name, hash],
  );
  console.log(`Platform admin ready: ${email.toLowerCase()}`);
} finally {
  await client.end();
}
