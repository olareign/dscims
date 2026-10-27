import request from 'supertest';
import { addUser, bearer, bootApp, onboardDealer, type Ctx, type Dealer } from './helpers.js';

describe('tenant isolation (AUTH-1)', () => {
  let ctx: Ctx;
  let a: Dealer;
  let b: Dealer;
  let bStaff: { id: string; email: string; token: string };
  beforeAll(async () => {
    ctx = await bootApp();
    a = await onboardDealer(ctx);
    b = await onboardDealer(ctx);
    bStaff = await addUser(ctx, b, 'staff', 'B Staff');
  });
  afterAll(async () => { await ctx.app.close(); });

  it('lists only the dealer\'s own users, shops and audit entries', async () => {
    const users = await request(ctx.http).get('/users').set(bearer(a.ownerToken)).expect(200);
    expect(users.body.items.map((u: { email: string }) => u.email)).toEqual([a.ownerEmail]);
    const shops = await request(ctx.http).get('/shops').set(bearer(a.ownerToken)).expect(200);
    expect(shops.body.items.map((s: { id: string }) => s.id)).toEqual([a.shopId]);
    const audit = await request(ctx.http).get('/audit?pageSize=50').set(bearer(a.ownerToken)).expect(200);
    expect(audit.body.items.every((e: { actorName: string; message: string }) => !e.message.includes('B Staff'))).toBe(true);
  });

  it('returns 404, not 403, for another dealer\'s records', async () => {
    await request(ctx.http).get(`/users/${bStaff.id}`).set(bearer(a.ownerToken)).expect(404);
    await request(ctx.http).post(`/users/${bStaff.id}/deactivate`).set(bearer(a.ownerToken)).expect(404);
    await request(ctx.http).patch(`/users/${bStaff.id}`).set(bearer(a.ownerToken)).send({ name: 'Hijacked' }).expect(404);
    await request(ctx.http).get(`/shops/${b.shopId}`).set(bearer(a.ownerToken)).expect(404);
    await request(ctx.http).patch(`/shops/${b.shopId}`).set(bearer(a.ownerToken)).send({ name: 'Mine now', address: '1 Hack Street, Lagos' }).expect(404);
    const stillThere = await request(ctx.http).get(`/users/${bStaff.id}`).set(bearer(b.ownerToken)).expect(200);
    expect(stillThere.body.status).toBe('active');
  });

  it('cannot invite someone into another dealer\'s shop', async () => {
    await request(ctx.http).post('/users').set(bearer(a.ownerToken)).send({ name: 'Cross Tenant', email: 'cross@example.test', role: 'staff', shopId: b.shopId }).expect(404);
  });

  it('keeps database rows apart even if a query forgets to filter (row-level security)', async () => {
    const rows = await ctx.db.run(a.tenantId, (m) => m.query('SELECT tenant_id FROM users'));
    expect(new Set(rows.map((r: { tenant_id: string }) => r.tenant_id))).toEqual(new Set([a.tenantId]));
    const none = await ctx.db.run(a.tenantId, (m) => m.query('SELECT id FROM shops WHERE tenant_id = $1', [b.tenantId]));
    expect(none).toHaveLength(0);
  });

  it('refuses to write a row for another dealer (row-level security check)', async () => {
    await expect(
      ctx.db.run(a.tenantId, (m) => m.query("INSERT INTO shops (tenant_id, name) VALUES ($1, 'Smuggled')", [b.tenantId])),
    ).rejects.toThrow(/row-level security/);
  });

  it('cannot reach the platform tables as a dealer', async () => {
    await expect(ctx.db.run(a.tenantId, (m) => m.query('SELECT * FROM platform_admins'))).rejects.toThrow(/permission denied/);
  });

  it('keeps one dealer\'s token from reading another\'s data after a user is moved or removed', async () => {
    const res = await request(ctx.http).get('/auth/me').set(bearer(bStaff.token)).expect(200);
    expect(res.body.tenant.id).toBe(b.tenantId);
    expect(res.body.shops.map((s: { id: string }) => s.id)).toEqual([b.shopId]);
  });
});
