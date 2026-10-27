import request from 'supertest';
import { bearer, bootApp, type Ctx } from './helpers.js';

describe('app', () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await bootApp(); });
  afterAll(async () => { await ctx.app.close(); });

  it('GET /health reports ok without signing in', async () => {
    await request(ctx.http).get('/health').expect(200).expect({ status: 'ok' });
  });

  it('rejects anonymous calls to protected routes', async () => {
    await request(ctx.http).get('/auth/me').expect(401);
    await request(ctx.http).get('/users').expect(401);
    await request(ctx.http).get('/auth/me').set(bearer('not-a-token')).expect(401);
  });
});
