import { DataSource } from 'typeorm';
import { ENTITIES } from '../src/core/entities.js';
import { MIGRATIONS_DIR, runMigrations } from '../src/database/migrator.js';
import { bootApp, type Ctx } from './helpers.js';

describe('migrations keep the schema and the entities in step', () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await bootApp(); });
  afterAll(async () => { await ctx.app.close(); });

  const typeFamily: Record<string, string> = {
    uuid: 'uuid', varchar: 'character varying', char: 'character', text: 'text', integer: 'integer', boolean: 'boolean',
    timestamptz: 'timestamp with time zone', jsonb: 'jsonb', 'double precision': 'double precision',
  };

  it('has a column in the database for every entity column, with the same type and nullability', async () => {
    const problems: string[] = [];
    for (const entity of ENTITIES) {
      const meta = ctx.ds.getMetadata(entity);
      const cols: { column_name: string; data_type: string; is_nullable: string }[] = await ctx.ds.query(
        'SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2', ['public', meta.tableName]);
      for (const c of meta.columns) {
        const row = cols.find((r) => r.column_name === c.databaseName);
        if (!row) { problems.push(`${meta.tableName}.${c.databaseName} is missing from the database`); continue; }
        const want = typeFamily[String(c.type)] ?? String(c.type);
        if (row.data_type !== want) problems.push(`${meta.tableName}.${c.databaseName} is ${row.data_type}, entity says ${want}`);
        if ((row.is_nullable === 'YES') !== c.isNullable) problems.push(`${meta.tableName}.${c.databaseName} nullability differs`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('enables row-level security on every tenant table', async () => {
    const rows: { relname: string; relrowsecurity: boolean }[] = await ctx.ds.query(
      "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'");
    const tenantTables = ['tenants', 'shops', 'users', 'sessions', 'user_tokens', 'settings', 'audit_log', 'idempotency_keys'];
    for (const t of tenantTables) expect(rows.find((r) => r.relname === t)?.relrowsecurity, t).toBe(true);
    // Any future table with a tenant_id column must be added to the list above.
    const withTenant: { table_name: string }[] = await ctx.ds.query("SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenant_id'");
    for (const { table_name } of withTenant) expect(tenantTables, `${table_name} has tenant_id but no row-level security check`).toContain(table_name);
  });

  it('is safe to run twice and applies nothing the second time', async () => {
    const runner = ctx.ds.createQueryRunner();
    await runner.connect();
    try {
      expect(await runMigrations({ query: (sql, params) => runner.query(sql, params) }, MIGRATIONS_DIR)).toEqual([]);
    } finally { await runner.release(); }
  });

  it('builds the whole schema from nothing', async () => {
    const admin = new DataSource({ type: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: 'postgres' });
    await admin.initialize();
    const name = `dscims_mig_${Date.now().toString(36)}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const fresh = new DataSource({ type: 'postgres', host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: name });
    try {
      await fresh.initialize();
      const runner = fresh.createQueryRunner();
      await runner.connect();
      const applied = await runMigrations({ query: (sql, params) => runner.query(sql, params) });
      await runner.release();
      expect(applied).toContain('001-foundation.sql');
    } finally {
      if (fresh.isInitialized) await fresh.destroy();
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      await admin.destroy();
    }
  });
});
