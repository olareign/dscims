import { vi } from 'vitest';
import request from 'supertest';
import { bearer, bootApp, onboardDealer, type Ctx, type Dealer } from './helpers.js';

describe('shops, settings and the audit log', () => {
  let ctx: Ctx;
  let dealer: Dealer;
  beforeAll(async () => { ctx = await bootApp(); dealer = await onboardDealer(ctx); });
  afterAll(async () => { await ctx.app.close(); });
  afterEach(() => vi.restoreAllMocks());

  describe('shops', () => {
    it('creates, lists, updates and rejects duplicate names', async () => {
      const created = await request(ctx.http).post('/shops').set(bearer(dealer.ownerToken)).send({ name: 'Lekki shop', address: '5 Admiralty Way, Lekki, Lagos', latitude: 6.45, longitude: 3.47, phone: '0805 400 2210' }).expect(201);
      expect(created.body).toMatchObject({ name: 'Lekki shop', latitude: 6.45, isMain: false, userCount: 0 });
      await request(ctx.http).post('/shops').set(bearer(dealer.ownerToken)).send({ name: 'LEKKI SHOP', address: '9 Other Road, Lagos' }).expect(409);
      const list = await request(ctx.http).get('/shops?search=lekki').set(bearer(dealer.ownerToken)).expect(200);
      expect(list.body.items.map((s: { name: string }) => s.name)).toEqual(['Lekki shop']);
      const updated = await request(ctx.http).patch(`/shops/${created.body.id}`).set(bearer(dealer.ownerToken)).send({ name: 'Lekki shop', address: '7 Admiralty Way, Lekki, Lagos' }).expect(200);
      expect(updated.body.address).toBe('7 Admiralty Way, Lekki, Lagos');
    });

    it('validates coordinates and required fields', async () => {
      await request(ctx.http).post('/shops').set(bearer(dealer.ownerToken)).send({ name: 'X', address: 'short' }).expect(400);
      await request(ctx.http).post('/shops').set(bearer(dealer.ownerToken)).send({ name: 'Moon shop', address: '1 Crater Road, Moon', latitude: 120, longitude: 3 }).expect(400);
    });

    it('turns coordinates into an address through the geocoder and says so plainly when that fails', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ display_name: '14 Computer Village Rd, Ikeja, Lagos' }), { status: 200 }));
      const ok = await request(ctx.http).get('/shops/address-lookup?lat=6.6&lng=3.35').set(bearer(dealer.ownerToken)).expect(200);
      expect(ok.body.address).toBe('14 Computer Village Rd, Ikeja, Lagos');
      expect(String(fetchSpy.mock.calls[0][0])).toContain('lat=6.6');
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('network down'));
      const bad = await request(ctx.http).get('/shops/address-lookup?lat=6.6&lng=3.35').set(bearer(dealer.ownerToken)).expect(502);
      expect(bad.body.code).toBe('GEOCODE_FAILED');
      await request(ctx.http).get('/shops/address-lookup?lat=abc&lng=3').set(bearer(dealer.ownerToken)).expect(400);
    });
  });

  describe('settings and first-run setup', () => {
    it('updates the sales rules and logs the change in plain words', async () => {
      const res = await request(ctx.http).put('/settings').set(bearer(dealer.ownerToken)).send({ discountLimitPercent: 10 }).expect(200);
      expect(res.body.discountLimitPercent).toBe(10);
      const audit = await request(ctx.http).get('/audit?category=settings').set(bearer(dealer.ownerToken)).expect(200);
      expect(audit.body.items[0]).toMatchObject({ message: 'changed the discount limit from 5% to 10%', before: { discountLimitPercent: 5 }, after: { discountLimitPercent: 10 } });
    });

    it('writes nothing to the audit log when nothing changed', async () => {
      const before = (await request(ctx.http).get('/audit/counts').set(bearer(dealer.ownerToken))).body.all;
      await request(ctx.http).put('/settings').set(bearer(dealer.ownerToken)).send({ discountLimitPercent: 10 }).expect(200);
      expect((await request(ctx.http).get('/audit/counts').set(bearer(dealer.ownerToken))).body.all).toBe(before);
    });

    it('only allows 14, 30 or 60 credit days and a sensible discount', async () => {
      await request(ctx.http).put('/settings').set(bearer(dealer.ownerToken)).send({ creditDueDays: 45 }).expect(400);
      await request(ctx.http).put('/settings').set(bearer(dealer.ownerToken)).send({ discountLimitPercent: 101 }).expect(400);
    });

    it('marks setup as finished once', async () => {
      expect((await request(ctx.http).get('/settings').set(bearer(dealer.ownerToken))).body.onboarded).toBe(false);
      await request(ctx.http).post('/settings/complete-setup').set(bearer(dealer.ownerToken)).expect(204);
      await request(ctx.http).post('/settings/complete-setup').set(bearer(dealer.ownerToken)).expect(204);
      expect((await request(ctx.http).get('/settings').set(bearer(dealer.ownerToken))).body.onboarded).toBe(true);
      const audit = await request(ctx.http).get('/audit?search=first-run').set(bearer(dealer.ownerToken)).expect(200);
      expect(audit.body.total).toBe(1);
    });
  });

  describe('audit log (AUTH-5, TRACE-3)', () => {
    it('filters by category, text and Lagos calendar dates and pages the results', async () => {
      const today = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
      const all = await request(ctx.http).get('/audit?pageSize=10').set(bearer(dealer.ownerToken)).expect(200);
      expect(all.body.items.length).toBeGreaterThan(0);
      const times = all.body.items.map((e: { createdAt: string }) => e.createdAt);
      expect(times).toEqual([...times].sort().reverse());
      const dated = await request(ctx.http).get(`/audit?from=${today}&to=${today}`).set(bearer(dealer.ownerToken)).expect(200);
      expect(dated.body.total).toBeGreaterThan(0);
      const past = await request(ctx.http).get('/audit?from=2020-01-01&to=2020-01-02').set(bearer(dealer.ownerToken)).expect(200);
      expect(past.body.total).toBe(0);
      const p2 = await request(ctx.http).get('/audit?pageSize=1&page=2').set(bearer(dealer.ownerToken)).expect(200);
      expect(p2.body.items).toHaveLength(1);
    });

    it('returns one entry with before and after and 404s for unknown ids', async () => {
      const list = await request(ctx.http).get('/audit?category=settings').set(bearer(dealer.ownerToken)).expect(200);
      const one = await request(ctx.http).get(`/audit/${list.body.items[0].id}`).set(bearer(dealer.ownerToken)).expect(200);
      expect(one.body.id).toBe(list.body.items[0].id);
      await request(ctx.http).get('/audit/00000000-0000-4000-8000-000000000000').set(bearer(dealer.ownerToken)).expect(404);
    });

    it('cannot be edited or deleted, even by the database owner', async () => {
      await expect(ctx.ds.query("UPDATE audit_log SET message = 'tampered' WHERE tenant_id = $1", [dealer.tenantId])).rejects.toThrow(/append-only/);
      await expect(ctx.ds.query('DELETE FROM audit_log WHERE tenant_id = $1', [dealer.tenantId])).rejects.toThrow(/append-only/);
      await expect(ctx.db.run(dealer.tenantId, (m) => m.query('DELETE FROM audit_log'))).rejects.toThrow(/permission denied|append-only/);
    });

    it('counts entries per category for the tabs', async () => {
      const c = await request(ctx.http).get('/audit/counts').set(bearer(dealer.ownerToken)).expect(200);
      expect(c.body.all).toBe(c.body.sign_in + c.body.security + c.body.user + c.body.settings);
    });
  });

  describe('overview', () => {
    it('summarises users, shops, sign-ins and failures', async () => {
      await request(ctx.http).post('/auth/login').send({ email: dealer.ownerEmail, password: 'wrong-wrong-1' }).expect(401);
      const res = await request(ctx.http).get('/dashboard/overview').set(bearer(dealer.ownerToken)).expect(200);
      expect(res.body.users.total).toBe(1);
      expect(res.body.roles).toEqual({ owner: 1, manager: 0, staff: 0 });
      expect(res.body.failedSignIns24h).toBeGreaterThanOrEqual(1);
      expect(res.body.signInsByDay).toHaveLength(7);
      expect(res.body.signedInToday).toBe(1);
      expect(res.body.recent.length).toBeGreaterThan(0);
      expect(res.body.shops[0].name).toBe('Main shop');
    });
  });
});
