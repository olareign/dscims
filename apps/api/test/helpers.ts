import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import bcrypt from 'bcrypt';
import type { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { MailService } from '../src/core/mail/mail.service.js';
import { TenantDb } from '../src/database/tenant-db.js';

export const PASSWORD = 'Correct-horse-42';
export const PLATFORM_EMAIL = 'ops@pacifylabs.test';
export const PLATFORM_PASSWORD = 'PlatformPass-2026';

export interface Ctx {
  app: INestApplication;
  http: Server;
  mail: MailService;
  ds: DataSource;
  db: TenantDb;
}

export async function bootApp(): Promise<Ctx> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  const ds = app.get(DataSource);
  await ds.query(
    `INSERT INTO platform_admins (email, name, password_hash) VALUES ($1, 'Ops', $2) ON CONFLICT DO NOTHING`,
    [PLATFORM_EMAIL, await bcrypt.hash(PLATFORM_PASSWORD, 4)],
  );
  return { app, http: app.getHttpServer() as Server, mail: app.get(MailService), ds, db: app.get(TenantDb) };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
export const tokenFromLink = (link: string) => link.split('/').pop()!;

let counter = 0;
export const uniq = (prefix: string) => `${prefix}${Date.now().toString(36)}${counter++}`;

export async function platformToken(ctx: Ctx): Promise<string> {
  const res = await request(ctx.http).post('/platform/auth/login').send({ email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD }).expect(200);
  return res.body.token;
}

export interface Dealer {
  tenantId: string;
  name: string;
  ownerEmail: string;
  ownerToken: string;
  shopId: string;
  userId: string;
}

/** Creates a dealer through the platform console and completes the owner's invite, like a real onboarding. */
export async function onboardDealer(ctx: Ctx, tag = uniq('dealer')): Promise<Dealer> {
  const admin = await platformToken(ctx);
  const ownerEmail = `${tag}-owner@example.test`;
  const created = await request(ctx.http).post('/platform/dealers').set(bearer(admin))
    .send({ businessName: `${tag} Ltd`, ownerName: 'Olu Owner', ownerEmail, shopName: 'Main shop' }).expect(201);
  const mail = [...ctx.mail.outbox].reverse().find((m) => m.to === ownerEmail)!;
  const accepted = await request(ctx.http).post('/auth/accept-invite').send({ token: tokenFromLink(mail.link), password: PASSWORD }).expect(200);
  const me = accepted.body.me;
  return { tenantId: created.body.dealer.id, name: `${tag} Ltd`, ownerEmail, ownerToken: accepted.body.token, shopId: me.shops[0].id, userId: me.user.id };
}

/** Owner invites a user and the user accepts, returning their token. */
export async function addUser(ctx: Ctx, dealer: Dealer, role: 'manager' | 'staff', name = 'Sam Staff', shopId = dealer.shopId) {
  const email = `${uniq('u')}@example.test`;
  const res = await request(ctx.http).post('/users').set(bearer(dealer.ownerToken)).send({ name, email, role, shopId }).expect(201);
  const mail = [...ctx.mail.outbox].reverse().find((m) => m.to === email)!;
  const accepted = await request(ctx.http).post('/auth/accept-invite').send({ token: tokenFromLink(mail.link), password: PASSWORD }).expect(200);
  return { id: res.body.user.id as string, email, token: accepted.body.token as string };
}
