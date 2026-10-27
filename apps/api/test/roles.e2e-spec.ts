import request from 'supertest';
import { addUser, bearer, bootApp, onboardDealer, platformToken, type Ctx, type Dealer } from './helpers.js';

describe('roles and capabilities (AUTH-3)', () => {
  let ctx: Ctx;
  let dealer: Dealer;
  let manager: { token: string };
  let staff: { token: string };
  beforeAll(async () => {
    ctx = await bootApp();
    dealer = await onboardDealer(ctx);
    manager = await addUser(ctx, dealer, 'manager', 'Mia Manager');
    staff = await addUser(ctx, dealer, 'staff', 'Sam Staff');
  });
  afterAll(async () => { await ctx.app.close(); });

  const ownerOnly: [string, string][] = [
    ['get', '/users'], ['get', '/users/counts'], ['get', '/shops'], ['get', '/audit'], ['get', '/audit/counts'],
    ['get', '/dashboard/overview'], ['put', '/settings'], ['post', '/settings/complete-setup'],
  ];

  it.each(ownerOnly)('keeps %s %s to the owner', async (method, path) => {
    const call = (token: string) => (request(ctx.http) as unknown as Record<string, (p: string) => request.Test>)[method](path).set(bearer(token)).send({});
    await call(manager.token).expect(403);
    await call(staff.token).expect(403);
    await call('').expect(401);
    expect([200, 204, 400]).toContain((await call(dealer.ownerToken)).status);
  });

  it('lets every signed-in role read its own profile and the sales rules', async () => {
    for (const token of [dealer.ownerToken, manager.token, staff.token]) {
      await request(ctx.http).get('/auth/me').set(bearer(token)).expect(200);
      await request(ctx.http).get('/settings').set(bearer(token)).expect(200);
    }
  });

  it('shows managers and staff only their own shop', async () => {
    const second = await request(ctx.http).post('/shops').set(bearer(dealer.ownerToken)).send({ name: 'Second shop', address: '22 Allen Avenue, Ikeja, Lagos' }).expect(201);
    const mine = await request(ctx.http).get('/auth/me').set(bearer(staff.token)).expect(200);
    expect(mine.body.shops).toHaveLength(1);
    const owner = await request(ctx.http).get('/auth/me').set(bearer(dealer.ownerToken)).expect(200);
    expect(owner.body.shops.map((s: { id: string }) => s.id)).toContain(second.body.id);
  });

  it('never lets an invite create another owner', async () => {
    await request(ctx.http).post('/users').set(bearer(dealer.ownerToken)).send({ name: 'Sneaky', email: 'sneaky@example.test', role: 'owner', shopId: dealer.shopId }).expect(400);
  });

  it('keeps dealer tokens and platform tokens apart', async () => {
    const admin = await platformToken(ctx);
    await request(ctx.http).get('/platform/dealers').set(bearer(dealer.ownerToken)).expect(403);
    await request(ctx.http).get('/users').set(bearer(admin)).expect(401);
    await request(ctx.http).get('/platform/dealers').expect(401);
  });
});
