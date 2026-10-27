import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { EntityManager, IsNull } from 'typeorm';
import type { MeDto, UserDto } from '@dscims/shared';
import { AppError, accessEnded } from '../../common/errors.js';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { newToken, sha256 } from '../../common/crypto.js';
import { AppConfig } from '../../config/app-config.js';
import { TenantDb } from '../../database/tenant-db.js';
import { AuditService } from '../audit/audit.service.js';
import { Session, Settings, Shop, Tenant, User, UserToken } from '../entities.js';
import { MailService } from '../mail/mail.service.js';
import type { TokenPayload } from './auth.guard.js';

const LOCK_AFTER_FAILURES = 3;
const LOCK_MINUTES = 5;
const INVITE_HOURS = 24;
const RESET_MINUTES = 30;
// Compared against when the email is unknown, so response time does not reveal which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

export interface SignedIn {
  token: string;
  me: MeDto;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: TenantDb,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async login(email: string, password: string, meta: ReqMeta): Promise<SignedIn> {
    const found = await this.db.system(async (m) => {
      const user = await m
        .getRepository(User)
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .where('lower(u.email) = :email', { email })
        .getOne();
      const tenant = user ? await m.findOneBy(Tenant, { id: user.tenantId }) : null;
      return { user, tenant };
    });
    const { user, tenant } = found;
    if (!user || !tenant) {
      await bcrypt.compare(password, DUMMY_HASH);
      throw new AppError(HttpStatus.UNAUTHORIZED, 'BAD_CREDENTIALS', 'Wrong email or password');
    }
    if (user.status === 'deactivated') throw accessEnded();
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
      throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'SIGN_IN_PAUSED', `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    }
    const ok = user.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!ok || user.status !== 'active') {
      await this.recordFailure(user, tenant, meta);
      throw new AppError(HttpStatus.UNAUTHORIZED, 'BAD_CREDENTIALS', 'Wrong email or password');
    }
    const locked = tenant.status === 'suspended' && tenant.graceEndsAt !== null && tenant.graceEndsAt <= new Date();
    if (locked) throw new AppError(HttpStatus.FORBIDDEN, 'TENANT_LOCKED', 'This account is locked. Contact Pacifylabs.');
    return this.startSession(user, meta, 'auth.sign_in', 'signed in');
  }

  private async recordFailure(user: User, tenant: Tenant, meta: ReqMeta): Promise<void> {
    await this.db.run(tenant.id, async (m) => {
      const attempts = user.failedAttempts + 1;
      const pause = attempts >= LOCK_AFTER_FAILURES;
      await m.update(User, { id: user.id }, {
        failedAttempts: pause ? 0 : attempts,
        lockedUntil: pause ? new Date(Date.now() + LOCK_MINUTES * 60000) : user.lockedUntil,
        updatedAt: new Date(),
      });
      await this.audit.record(m, {
        tenantId: tenant.id,
        actor: { id: user.id, name: user.name, role: user.role },
        action: pause ? 'auth.sign_in_paused' : 'auth.sign_in_failed',
        category: 'security',
        message: pause ? `Third wrong password, sign-in paused for ${LOCK_MINUTES} minutes` : `Wrong password (attempt ${attempts})`,
        entity: { type: 'user', id: user.id, label: user.email },
        meta,
      });
    });
  }

  /** Creates the session, stamps last sign-in, resets the failure count and writes the audit entry. */
  private async startSession(user: User, meta: ReqMeta, action: string, verb: string): Promise<SignedIn> {
    const expiresAt = new Date(Date.now() + this.config.env.SESSION_DAYS * 86400000);
    const sessionId = await this.db.run(user.tenantId, async (m) => {
      const session = await m.save(Session, m.create(Session, { tenantId: user.tenantId, userId: user.id, ip: meta.ip, userAgent: meta.userAgent, expiresAt }));
      await m.update(User, { id: user.id }, { lastSignInAt: new Date(), failedAttempts: 0, lockedUntil: null });
      const shop = user.shopId ? await m.findOneBy(Shop, { id: user.shopId }) : null;
      await this.audit.record(m, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.name, role: user.role },
        action,
        category: 'sign_in',
        message: verb,
        entity: { type: 'user', id: user.id, label: user.email },
        shop: shop ? { id: shop.id, name: shop.name } : undefined,
        meta,
      });
      return session.id;
    });
    const payload: TokenPayload = { sub: user.id, typ: 'user', tid: user.tenantId, sid: sessionId };
    const token = await this.jwt.signAsync(payload, { expiresIn: `${this.config.env.SESSION_DAYS}d` });
    const principal: Principal = { userId: user.id, tenantId: user.tenantId, sessionId, role: user.role, shopId: user.shopId, name: user.name, email: user.email, tenantStatus: 'active' };
    return { token, me: await this.me(principal) };
  }

  async logout(p: Principal, meta: ReqMeta): Promise<void> {
    await this.db.run(p.tenantId, async (m) => {
      await m.update(Session, { id: p.sessionId }, { revokedAt: new Date() });
      await this.audit.record(m, { tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'auth.sign_out', category: 'sign_in', message: 'signed out', meta });
    });
  }

  async me(p: Principal): Promise<MeDto> {
    return this.db.run(p.tenantId, async (m) => {
      // One connection per transaction: queries run one after another.
      const user = await m.findOneByOrFail(User, { id: p.userId });
      const tenant = await m.findOneByOrFail(Tenant, { id: p.tenantId });
      const shops = await m.find(Shop, { order: { isMain: 'DESC', name: 'ASC' } });
      const settings = await m.findOneByOrFail(Settings, { tenantId: p.tenantId });
      const shop = shops.find((s) => s.id === user.shopId) ?? null;
      const locked = tenant.status === 'suspended' && tenant.graceEndsAt !== null && tenant.graceEndsAt <= new Date();
      const dto: UserDto = {
        id: user.id, name: user.name, email: user.email, role: user.role, status: user.status,
        shopId: user.shopId, shopName: shop?.name ?? null, lastSignInAt: user.lastSignInAt?.toISOString() ?? null,
      };
      return {
        user: dto,
        tenant: { id: tenant.id, name: tenant.name, status: locked ? 'locked' : tenant.status, graceEndsAt: tenant.graceEndsAt?.toISOString() ?? null },
        // Owners see every shop; managers and staff see only their own.
        shops: shops.filter((s) => p.role === 'owner' || s.id === user.shopId).map((s) => ({ id: s.id, name: s.name })),
        settings: {
          businessName: tenant.name,
          discountLimitPercent: settings.discountLimitPercent,
          creditDueDays: settings.creditDueDays,
          receiptText: settings.receiptText,
          onboarded: tenant.onboardedAt !== null,
        },
      };
    });
  }

  // ---- tokens: invites and password resets ---------------------------------------------------------------

  /** Returns the raw token (shown once in the link); only its hash is stored. */
  async issueToken(m: EntityManager, user: User, type: 'invite' | 'reset'): Promise<string> {
    const raw = newToken();
    // A new link replaces any unused older one for the same purpose.
    await m.update(UserToken, { userId: user.id, type, usedAt: IsNull() }, { usedAt: new Date() });
    const ttl = type === 'invite' ? INVITE_HOURS * 3600000 : RESET_MINUTES * 60000;
    await m.save(UserToken, m.create(UserToken, { tenantId: user.tenantId, userId: user.id, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttl) }));
    return raw;
  }

  inviteUrl(token: string): string {
    return `${this.config.env.PUBLIC_WEB_URL}/invite/${token}`;
  }

  private async findToken(m: EntityManager, raw: string, type: 'invite' | 'reset') {
    const token = await m.findOneBy(UserToken, { tokenHash: sha256(raw), type });
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_TOKEN', 'This link has expired or was already used. Ask for a new one.');
    }
    return token;
  }

  async inviteInfo(raw: string): Promise<{ name: string; email: string; business: string }> {
    return this.db.system(async (m) => {
      const token = await this.findToken(m, raw, 'invite');
      const user = await m.findOneByOrFail(User, { id: token.userId });
      const tenant = await m.findOneByOrFail(Tenant, { id: token.tenantId });
      return { name: user.name, email: user.email, business: tenant.name };
    });
  }

  async acceptInvite(raw: string, password: string, meta: ReqMeta): Promise<SignedIn> {
    const user = await this.db.system(async (m) => {
      const token = await this.findToken(m, raw, 'invite');
      const u = await m.findOneByOrFail(User, { id: token.userId });
      if (u.status === 'deactivated') throw accessEnded();
      await m.update(User, { id: u.id }, { passwordHash: await bcrypt.hash(password, this.config.env.BCRYPT_ROUNDS), status: 'active', updatedAt: new Date() });
      await m.update(UserToken, { id: token.id }, { usedAt: new Date() });
      return m.findOneByOrFail(User, { id: u.id });
    });
    await this.db.run(user.tenantId, (m) =>
      this.audit.record(m, { tenantId: user.tenantId, actor: { id: user.id, name: user.name, role: user.role }, action: 'auth.invite_accepted', category: 'user', message: 'accepted the invite and set a password', entity: { type: 'user', id: user.id, label: user.email }, meta }),
    );
    return this.startSession(user, meta, 'auth.sign_in', 'signed in');
  }

  /** Always succeeds from the caller's side, so it cannot be used to discover which emails have accounts. */
  async forgotPassword(email: string, meta: ReqMeta): Promise<void> {
    const user = await this.db.system((m) => m.getRepository(User).createQueryBuilder('u').where('lower(u.email) = :email', { email }).getOne());
    if (!user || user.status !== 'active') return;
    const raw = await this.db.run(user.tenantId, async (m) => {
      const t = await this.issueToken(m, user, 'reset');
      await this.audit.record(m, { tenantId: user.tenantId, actor: { id: user.id, name: user.name, role: user.role }, action: 'auth.password_reset_requested', category: 'security', message: 'asked for a password reset link', entity: { type: 'user', id: user.id, label: user.email }, meta });
      return t;
    });
    await this.mail.reset(user.email, user.name, `${this.config.env.PUBLIC_WEB_URL}/reset-password/${raw}`);
  }

  async resetPassword(raw: string, password: string, meta: ReqMeta): Promise<void> {
    const user = await this.db.system(async (m) => {
      const token = await this.findToken(m, raw, 'reset');
      const u = await m.findOneByOrFail(User, { id: token.userId });
      if (u.status !== 'active') throw new AppError(HttpStatus.BAD_REQUEST, 'INVALID_TOKEN', 'This link has expired or was already used. Ask for a new one.');
      await m.update(User, { id: u.id }, { passwordHash: await bcrypt.hash(password, this.config.env.BCRYPT_ROUNDS), failedAttempts: 0, lockedUntil: null, updatedAt: new Date() });
      await m.update(UserToken, { id: token.id }, { usedAt: new Date() });
      // A reset signs the person out everywhere.
      await m.update(Session, { userId: u.id }, { revokedAt: new Date() });
      return u;
    });
    await this.db.run(user.tenantId, (m) =>
      this.audit.record(m, { tenantId: user.tenantId, actor: { id: user.id, name: user.name, role: user.role }, action: 'auth.password_reset', category: 'security', message: 'set a new password from a reset link', entity: { type: 'user', id: user.id, label: user.email }, meta }),
    );
  }

  async changePassword(p: Principal, current: string, next: string, meta: ReqMeta): Promise<void> {
    await this.db.run(p.tenantId, async (m) => {
      const user = await m.getRepository(User).createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id: p.userId }).getOneOrFail();
      if (!user.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) {
        throw new AppError(HttpStatus.BAD_REQUEST, 'BAD_CREDENTIALS', 'Your current password is wrong');
      }
      await m.update(User, { id: user.id }, { passwordHash: await bcrypt.hash(next, this.config.env.BCRYPT_ROUNDS), updatedAt: new Date() });
      await this.audit.record(m, { tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'auth.password_changed', category: 'security', message: 'changed their password', entity: { type: 'user', id: user.id, label: user.email }, meta });
    });
  }
}
