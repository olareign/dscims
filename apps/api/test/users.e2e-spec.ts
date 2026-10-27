import request from 'supertest';
import { addUser, bearer, bootApp, onboardDealer, PASSWORD, uniq, type Ctx, type Dealer } from './helpers.js';

describe('users (invite, list, deactivate)', () => {
  let ctx: Ctx;
  let dealer: Dealer;
  beforeAll(async () => { ctx = await bootApp(); dealer = await onboardDealer(ctx); });
  afterAll(async () => { await ctx.app.close(); });

  const invite = (body: object, headers: Record<string, string> = {}) =>
    request(ctx.http).post('/users').set(bearer(dealer.ownerToken)).set(headers).send(body);

  it('invites a user by email and shows them as invited until they set a password', async () => {
    const email = `${uniq('new')}@example.test`;
    const res = await invite({ name: 'Ada Eze', email: email.toUpperCase(), role: 'staff', shopId: dealer.shopId }).expect(201);
    expect(res.body.user).toMatchObject({ email, role: 'staff', status: 'invited', shopName: 'Main shop' });
    expect(res.body.emailSent).toBe(true);
    expect(res.body.inviteUrl).toBeNull();
    expect(ctx.mail.outbox.some((m) => m.to === email && m.link.startsWith('http://web.test/invite/'))).toBe(true);
  });

  it('refuses an email that already has an account, in this or any dealer', async () => {
    const other = await onboardDealer(ctx);
    const res = await invite({ name: 'Dup', email: other.ownerEmail, role: 'staff', shopId: dealer.shopId }).expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('replays the first result when a create is retried with the same Idempotency-Key', async () => {
    const email = `${uniq('idem')}@example.test`;
    const body = { name: 'Retry Me', email, role: 'staff', shopId: dealer.shopId };
    const first = await invite(body, { 'Idempotency-Key': `key-${email}` }).expect(201);
    const second = await invite(body, { 'Idempotency-Key': `key-${email}` }).expect(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(ctx.mail.outbox.filter((m) => m.to === email)).toHaveLength(1);
    await invite({ ...body, name: 'Different' }, { 'Idempotency-Key': `key-${email}` }).expect(422);
  });

  describe('listing', () => {
    beforeAll(async () => {
      const second = await request(ctx.http).post('/shops').set(bearer(dealer.ownerToken)).send({ name: 'Alaba shop', address: 'Block C, Alaba Market, Ojo, Lagos' }).expect(201);
      for (let i = 0; i < 12; i++) await invite({ name: `Zed Person ${String(i).padStart(2, '0')}`, email: `${uniq('list')}@example.test`, role: i % 3 === 0 ? 'manager' : 'staff', shopId: i < 4 ? second.body.id : dealer.shopId }).expect(201);
    });

    it('pages results and reports totals', async () => {
      const p1 = await request(ctx.http).get('/users?pageSize=10&page=1').set(bearer(dealer.ownerToken)).expect(200);
      const p2 = await request(ctx.http).get('/users?pageSize=10&page=2').set(bearer(dealer.ownerToken)).expect(200);
      expect(p1.body.items).toHaveLength(10);
      expect(p1.body.total).toBeGreaterThanOrEqual(13);
      expect(p1.body.totalPages).toBe(Math.ceil(p1.body.total / 10));
      expect(p2.body.items.length).toBeGreaterThan(0);
      const ids = new Set([...p1.body.items, ...p2.body.items].map((u: { id: string }) => u.id));
      expect(ids.size).toBe(p1.body.items.length + p2.body.items.length);
    });

    it('filters by role, status, shop and search, and sorts by name', async () => {
      const managers = await request(ctx.http).get('/users?role=manager&pageSize=50').set(bearer(dealer.ownerToken)).expect(200);
      expect(managers.body.items.every((u: { role: string }) => u.role === 'manager')).toBe(true);
      const found = await request(ctx.http).get('/users?search=Zed%20Person%2007').set(bearer(dealer.ownerToken)).expect(200);
      expect(found.body.items.map((u: { name: string }) => u.name)).toEqual(['Zed Person 07']);
      const alaba = await request(ctx.http).get('/users?pageSize=50').set(bearer(dealer.ownerToken)).expect(200);
      const shopId = alaba.body.items.find((u: { shopName: string }) => u.shopName === 'Alaba shop').shopId;
      const inAlaba = await request(ctx.http).get(`/users?shopId=${shopId}&pageSize=50`).set(bearer(dealer.ownerToken)).expect(200);
      expect(inAlaba.body.items).toHaveLength(4);
      const names = alaba.body.items.map((u: { name: string }) => u.name.toLowerCase());
      expect(names).toEqual([...names].sort());
    });

    it('treats wildcard characters in search as plain text', async () => {
      const res = await request(ctx.http).get('/users?search=%25').set(bearer(dealer.ownerToken)).expect(200);
      expect(res.body.total).toBe(0);
    });

    it('rejects a page size above the limit and unknown filter values', async () => {
      await request(ctx.http).get('/users?pageSize=500').set(bearer(dealer.ownerToken)).expect(400);
      await request(ctx.http).get('/users?role=owner-ish').set(bearer(dealer.ownerToken)).expect(400);
    });

    it('counts users by status for the tabs', async () => {
      const res = await request(ctx.http).get('/users/counts').set(bearer(dealer.ownerToken)).expect(200);
      expect(res.body.all).toBe(res.body.active + res.body.invited + res.body.deactivated);
    });
  });

  describe('turning access off and on', () => {
    it('locks the user out on their very next request and keeps their history', async () => {
      const user = await addUser(ctx, dealer, 'staff', 'Leaving Larry');
      await request(ctx.http).get('/auth/me').set(bearer(user.token)).expect(200);
      const off = await request(ctx.http).post(`/users/${user.id}/deactivate`).set(bearer(dealer.ownerToken)).expect(200);
      expect(off.body.status).toBe('deactivated');
      const denied = await request(ctx.http).get('/auth/me').set(bearer(user.token)).expect(401);
      expect(denied.body.code === 'ACCESS_ENDED' || denied.body.code === 'UNAUTHENTICATED').toBe(true);
      const login = await request(ctx.http).post('/auth/login').send({ email: user.email, password: PASSWORD }).expect(401);
      expect(login.body.code).toBe('ACCESS_ENDED');
      const audit = await request(ctx.http).get('/audit?category=user').set(bearer(dealer.ownerToken)).expect(200);
      const entry = audit.body.items.find((e: { action: string }) => e.action === 'user.deactivated');
      expect(entry).toMatchObject({ message: 'turned off access for Leaving Larry', before: { status: 'active' }, after: { status: 'deactivated' } });
    });

    it('turns access back on', async () => {
      const user = await addUser(ctx, dealer, 'staff', 'Returning Rita');
      await request(ctx.http).post(`/users/${user.id}/deactivate`).set(bearer(dealer.ownerToken)).expect(200);
      const on = await request(ctx.http).post(`/users/${user.id}/reactivate`).set(bearer(dealer.ownerToken)).expect(200);
      expect(on.body.status).toBe('active');
      await request(ctx.http).post('/auth/login').send({ email: user.email, password: PASSWORD }).expect(200);
    });

    it('protects the owner and the caller from being turned off', async () => {
      const me = await request(ctx.http).post(`/users/${dealer.userId}/deactivate`).set(bearer(dealer.ownerToken)).expect(409);
      expect(me.body.code).toBe('SELF');
      const mgr = await addUser(ctx, dealer, 'manager', 'Mia Manager');
      await request(ctx.http).post(`/users/${dealer.userId}/deactivate`).set(bearer(mgr.token)).expect(403);
    });

    it('updates a name, role or shop but never the owner', async () => {
      const user = await addUser(ctx, dealer, 'staff', 'Old Name');
      const res = await request(ctx.http).patch(`/users/${user.id}`).set(bearer(dealer.ownerToken)).send({ name: 'New Name', role: 'manager' }).expect(200);
      expect(res.body).toMatchObject({ name: 'New Name', role: 'manager' });
      await request(ctx.http).patch(`/users/${dealer.userId}`).set(bearer(dealer.ownerToken)).send({ name: 'Hacked' }).expect(403);
    });

    it('resends an invite only to people who have not set a password', async () => {
      const email = `${uniq('re')}@example.test`;
      const created = await invite({ name: 'Slow Starter', email, role: 'staff', shopId: dealer.shopId }).expect(201);
      const before = ctx.mail.outbox.filter((m) => m.to === email).length;
      await request(ctx.http).post(`/users/${created.body.user.id}/resend-invite`).set(bearer(dealer.ownerToken)).expect(200);
      expect(ctx.mail.outbox.filter((m) => m.to === email).length).toBe(before + 1);
      const active = await addUser(ctx, dealer, 'staff', 'Already In');
      await request(ctx.http).post(`/users/${active.id}/resend-invite`).set(bearer(dealer.ownerToken)).expect(409);
    });
  });
});
