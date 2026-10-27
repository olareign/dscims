import request from 'supertest';
import { bearer, bootApp, onboardDealer, platformToken, PASSWORD, PLATFORM_EMAIL, uniq, type Ctx } from './helpers.js';

describe('platform console (PLAT-1)', () => {
  let ctx: Ctx;
  let admin: string;
  beforeAll(async () => { ctx = await bootApp(); admin = await platformToken(ctx); });
  afterAll(async () => { await ctx.app.close(); });

  it('rejects a wrong platform password the same way as an unknown admin', async () => {
    await request(ctx.http).post('/platform/auth/login').send({ email: PLATFORM_EMAIL, password: 'wrong-wrong-1' }).expect(401);
    await request(ctx.http).post('/platform/auth/login').send({ email: 'nobody@pacifylabs.test', password: 'wrong-wrong-1' }).expect(401);
  });

  it('creates a dealer with a main shop, default rules and an invited owner', async () => {
    const email = `${uniq('new')}-owner@example.test`;
    const res = await request(ctx.http).post('/platform/dealers').set(bearer(admin)).send({ businessName: 'Bright Mobile Ltd', ownerName: 'Funke Alabi', ownerEmail: email, shopName: 'Main shop' }).expect(201);
    expect(res.body.dealer).toMatchObject({ name: 'Bright Mobile Ltd', ownerEmail: email, shops: 1, users: 1, status: 'active' });
    expect(ctx.mail.outbox.some((m) => m.to === email)).toBe(true);
    await request(ctx.http).post('/platform/dealers').set(bearer(admin)).send({ businessName: 'Again', ownerName: 'Funke', ownerEmail: email, shopName: 'Main' }).expect(409);
  });

  it('lists dealers with search, status filter, sort and pages', async () => {
    for (let i = 0; i < 3; i++) await onboardDealer(ctx, uniq('listdealer'));
    const page = await request(ctx.http).get('/platform/dealers?pageSize=2&page=1').set(bearer(admin)).expect(200);
    expect(page.body.items).toHaveLength(2);
    expect(page.body.total).toBeGreaterThanOrEqual(4);
    const found = await request(ctx.http).get(`/platform/dealers?search=${encodeURIComponent(page.body.items[0].name)}`).set(bearer(admin)).expect(200);
    expect(found.body.items[0].name).toBe(page.body.items[0].name);
    const counts = await request(ctx.http).get('/platform/dealers/counts').set(bearer(admin)).expect(200);
    expect(counts.body.all).toBe(counts.body.active + counts.body.suspended + counts.body.locked);
  });

  describe('suspending a dealer', () => {
    it('makes it read-only during the grace period, then locked, and back to normal on reactivation', async () => {
      const dealer = await onboardDealer(ctx);
      await request(ctx.http).post(`/platform/dealers/${dealer.tenantId}/suspend`).set(bearer(admin)).expect(204);

      // Read-only: looking is fine, changing is not.
      await request(ctx.http).get('/users').set(bearer(dealer.ownerToken)).expect(200);
      const blocked = await request(ctx.http).put('/settings').set(bearer(dealer.ownerToken)).send({ discountLimitPercent: 20 }).expect(403);
      expect(blocked.body.code).toBe('TENANT_READ_ONLY');
      const me = await request(ctx.http).get('/auth/me').set(bearer(dealer.ownerToken)).expect(200);
      expect(me.body.tenant.status).toBe('suspended');
      const filtered = await request(ctx.http).get('/platform/dealers?status=suspended&pageSize=50').set(bearer(admin)).expect(200);
      expect(filtered.body.items.map((d: { id: string }) => d.id)).toContain(dealer.tenantId);

      // Grace period over: locked. Sign-out and "who am I" still work so the app can explain.
      await ctx.ds.query("UPDATE tenants SET grace_ends_at = now() - interval '1 minute' WHERE id = $1", [dealer.tenantId]);
      const locked = await request(ctx.http).get('/users').set(bearer(dealer.ownerToken)).expect(403);
      expect(locked.body.code).toBe('TENANT_LOCKED');
      const lockedMe = await request(ctx.http).get('/auth/me').set(bearer(dealer.ownerToken)).expect(200);
      expect(lockedMe.body.tenant.status).toBe('locked');
      const login = await request(ctx.http).post('/auth/login').send({ email: dealer.ownerEmail, password: PASSWORD }).expect(403);
      expect(login.body.code).toBe('TENANT_LOCKED');
      const lockedList = await request(ctx.http).get('/platform/dealers?status=locked&pageSize=50').set(bearer(admin)).expect(200);
      expect(lockedList.body.items.map((d: { id: string }) => d.id)).toContain(dealer.tenantId);

      await request(ctx.http).post(`/platform/dealers/${dealer.tenantId}/reactivate`).set(bearer(admin)).expect(204);
      await request(ctx.http).put('/settings').set(bearer(dealer.ownerToken)).send({ discountLimitPercent: 20 }).expect(200);

      // The dealer can see what Pacifylabs did, in its own audit log.
      const audit = await request(ctx.http).get('/audit?category=settings&pageSize=50').set(bearer(dealer.ownerToken)).expect(200);
      const actions = audit.body.items.map((e: { action: string }) => e.action);
      expect(actions).toEqual(expect.arrayContaining(['tenant.suspended', 'tenant.reactivated']));
    });

    it('404s for a dealer that does not exist', async () => {
      await request(ctx.http).post('/platform/dealers/00000000-0000-4000-8000-000000000000/suspend').set(bearer(admin)).expect(404);
    });
  });
});
