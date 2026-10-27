import request from 'supertest';
import { addUser, bearer, bootApp, onboardDealer, PASSWORD, tokenFromLink, uniq, type Ctx, type Dealer } from './helpers.js';

describe('auth (email and password only)', () => {
  let ctx: Ctx;
  let dealer: Dealer;
  beforeAll(async () => { ctx = await bootApp(); dealer = await onboardDealer(ctx); });
  afterAll(async () => { await ctx.app.close(); });

  it('onboards an owner from the invite link and returns who they are', async () => {
    const me = await request(ctx.http).get('/auth/me').set(bearer(dealer.ownerToken)).expect(200);
    expect(me.body.user).toMatchObject({ email: dealer.ownerEmail, role: 'owner', status: 'active' });
    expect(me.body.tenant).toMatchObject({ name: dealer.name, status: 'active' });
    expect(me.body.settings).toMatchObject({ discountLimitPercent: 5, creditDueDays: 30, onboarded: false });
    expect(me.body.shops).toHaveLength(1);
  });

  it('signs in with email and password and records it in the audit log', async () => {
    const res = await request(ctx.http).post('/auth/login').send({ email: dealer.ownerEmail.toUpperCase(), password: PASSWORD }).expect(200);
    expect(res.body.token).toBeTruthy();
    const audit = await request(ctx.http).get('/audit?category=sign_in').set(bearer(res.body.token)).expect(200);
    expect(audit.body.items[0]).toMatchObject({ action: 'auth.sign_in', actorName: 'Olu Owner' });
  });

  it('does not accept a phone number as a login id', async () => {
    const res = await request(ctx.http).post('/auth/login').send({ email: '0803 123 4567', password: PASSWORD }).expect(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrong = await request(ctx.http).post('/auth/login').send({ email: dealer.ownerEmail, password: 'nope-nope-nope' }).expect(401);
    const unknown = await request(ctx.http).post('/auth/login').send({ email: `${uniq('ghost')}@example.test`, password: 'nope-nope-nope' }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect(wrong.body.code).toBe('BAD_CREDENTIALS');
  });

  it('pauses sign-in after three wrong passwords, even for the right password, and logs it', async () => {
    const user = await addUser(ctx, dealer, 'staff', 'Lock Me');
    for (let i = 0; i < 3; i++) await request(ctx.http).post('/auth/login').send({ email: user.email, password: 'wrong-wrong-1' }).expect(401);
    const paused = await request(ctx.http).post('/auth/login').send({ email: user.email, password: PASSWORD }).expect(429);
    expect(paused.body.code).toBe('SIGN_IN_PAUSED');
    const audit = await request(ctx.http).get('/audit?category=security').set(bearer(dealer.ownerToken)).expect(200);
    const actions = audit.body.items.map((e: { action: string }) => e.action);
    expect(actions).toContain('auth.sign_in_paused');
    expect(actions).toContain('auth.sign_in_failed');
  });

  it('ends a session on sign-out', async () => {
    const login = await request(ctx.http).post('/auth/login').send({ email: dealer.ownerEmail, password: PASSWORD }).expect(200);
    await request(ctx.http).post('/auth/logout').set(bearer(login.body.token)).expect(204);
    await request(ctx.http).get('/auth/me').set(bearer(login.body.token)).expect(401);
  });

  it('rejects an invite link used twice and one that never existed', async () => {
    const email = `${uniq('inv')}@example.test`;
    const shopId = dealer.shopId;
    await request(ctx.http).post('/users').set(bearer(dealer.ownerToken)).send({ name: 'Once Only', email, role: 'staff', shopId }).expect(201);
    const link = [...ctx.mail.outbox].reverse().find((m) => m.to === email)!.link;
    await request(ctx.http).post('/auth/accept-invite').send({ token: tokenFromLink(link), password: PASSWORD }).expect(200);
    const again = await request(ctx.http).post('/auth/accept-invite').send({ token: tokenFromLink(link), password: PASSWORD }).expect(400);
    expect(again.body.code).toBe('INVALID_TOKEN');
    await request(ctx.http).post('/auth/accept-invite').send({ token: 'x'.repeat(43), password: PASSWORD }).expect(400);
  });

  it('enforces the password policy when accepting an invite', async () => {
    const email = `${uniq('pol')}@example.test`;
    await request(ctx.http).post('/users').set(bearer(dealer.ownerToken)).send({ name: 'Weak Pass', email, role: 'staff', shopId: dealer.shopId }).expect(201);
    const link = [...ctx.mail.outbox].reverse().find((m) => m.to === email)!.link;
    await request(ctx.http).post('/auth/accept-invite').send({ token: tokenFromLink(link), password: 'short1' }).expect(400);
  });

  it('resets a forgotten password by email and signs the person out everywhere', async () => {
    const user = await addUser(ctx, dealer, 'manager', 'Forgetful');
    await request(ctx.http).post('/auth/forgot-password').send({ email: user.email }).expect(202);
    const link = [...ctx.mail.outbox].reverse().find((m) => m.to === user.email && m.subject.includes('Reset'))!.link;
    await request(ctx.http).post('/auth/reset-password').send({ token: tokenFromLink(link), password: 'Brand-new-pass-9' }).expect(204);
    await request(ctx.http).get('/auth/me').set(bearer(user.token)).expect(401);
    await request(ctx.http).post('/auth/login').send({ email: user.email, password: PASSWORD }).expect(401);
    await request(ctx.http).post('/auth/login').send({ email: user.email, password: 'Brand-new-pass-9' }).expect(200);
    await request(ctx.http).post('/auth/reset-password').send({ token: tokenFromLink(link), password: 'Another-pass-77' }).expect(400);
  });

  it('answers forgot-password the same for unknown emails and sends nothing', async () => {
    const before = ctx.mail.outbox.length;
    await request(ctx.http).post('/auth/forgot-password').send({ email: `${uniq('nobody')}@example.test` }).expect(202);
    expect(ctx.mail.outbox.length).toBe(before);
  });

  it('changes a password only with the current one', async () => {
    const user = await addUser(ctx, dealer, 'staff', 'Changer');
    await request(ctx.http).post('/auth/change-password').set(bearer(user.token)).send({ currentPassword: 'wrong', password: 'Fresh-pass-1234' }).expect(400);
    await request(ctx.http).post('/auth/change-password').set(bearer(user.token)).send({ currentPassword: PASSWORD, password: 'Fresh-pass-1234' }).expect(204);
  });
});
