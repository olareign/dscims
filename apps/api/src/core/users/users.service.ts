import { HttpStatus, Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { paginated, ROLE_LABELS } from '@dscims/shared';
import type { InviteResultDto, InviteUserInput, Paginated, UpdateUserInput, UserDto, UserListQuery } from '@dscims/shared';
import { AppError, conflict, notFound } from '../../common/errors.js';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { AppConfig } from '../../config/app-config.js';
import { TenantDb } from '../../database/tenant-db.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';
import { Session, Shop, Tenant, User } from '../entities.js';
import { MailService } from '../mail/mail.service.js';

const toDto = (u: User, shopName: string | null): UserDto => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  shopId: u.shopId,
  shopName,
  lastSignInAt: u.lastSignInAt?.toISOString() ?? null,
});

const isUniqueViolation = (err: unknown) => err instanceof QueryFailedError && (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: TenantDb,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
  ) {}

  list(tenantId: string, q: UserListQuery): Promise<Paginated<UserDto>> {
    return this.db.run(tenantId, async (m) => {
      const qb = m.getRepository(User).createQueryBuilder('u').leftJoinAndMapOne('u.shop', Shop, 's', 's.id = u.shop_id');
      if (q.role) qb.andWhere('u.role = :role', { role: q.role });
      if (q.status) qb.andWhere('u.status = :status', { status: q.status });
      if (q.shopId) qb.andWhere('u.shop_id = :shopId', { shopId: q.shopId });
      if (q.search) qb.andWhere('(u.name ILIKE :s OR u.email ILIKE :s)', { s: `%${q.search.replace(/[%_]/g, '\\$&')}%` });
      if (q.lastSignIn === 'today') qb.andWhere("u.last_sign_in_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos'");
      if (q.lastSignIn === '7d') qb.andWhere("u.last_sign_in_at >= now() - interval '7 days'");
      if (q.lastSignIn === 'over30d') qb.andWhere("(u.last_sign_in_at IS NULL OR u.last_sign_in_at < now() - interval '30 days')");
      const total = await qb.getCount();
      if (q.sort === 'last_sign_in') qb.orderBy('u.last_sign_in_at', 'DESC', 'NULLS LAST');
      else qb.orderBy('lower(u.name)', 'ASC');
      const rows = await qb.addOrderBy('u.id').offset((q.page - 1) * q.pageSize).limit(q.pageSize).getMany();
      return paginated(rows.map((u) => toDto(u, (u as User & { shop?: Shop }).shop?.name ?? null)), total, q.page, q.pageSize);
    });
  }

  /** Counts for the status tabs. */
  counts(tenantId: string): Promise<{ all: number; active: number; invited: number; deactivated: number }> {
    return this.db.run(tenantId, async (m) => {
      const rows: { status: User['status']; n: string }[] = await m.query('SELECT status, count(*)::text AS n FROM users GROUP BY status');
      const out = { all: 0, active: 0, invited: 0, deactivated: 0 };
      for (const r of rows) { out[r.status] = Number(r.n); out.all += Number(r.n); }
      return out;
    });
  }

  get(tenantId: string, id: string): Promise<UserDto> {
    return this.db.run(tenantId, async (m) => {
      const user = await m.findOneBy(User, { id });
      if (!user) throw notFound('User');
      const shop = user.shopId ? await m.findOneBy(Shop, { id: user.shopId }) : null;
      return toDto(user, shop?.name ?? null);
    });
  }

  async invite(p: Principal, input: InviteUserInput, meta: ReqMeta): Promise<InviteResultDto> {
    let rawToken = '';
    const { dto, business, user } = await this.db.run(p.tenantId, async (m) => {
      const shop = await m.findOneBy(Shop, { id: input.shopId });
      if (!shop) throw notFound('Shop');
      let created: User;
      try {
        created = await m.save(User, m.create(User, { tenantId: p.tenantId, shopId: shop.id, name: input.name, email: input.email, role: input.role, status: 'invited', createdBy: p.userId }));
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict('EMAIL_TAKEN', 'That email already has an account');
        throw err;
      }
      rawToken = await this.auth.issueToken(m, created, 'invite');
      const tenant = await m.findOneByOrFail(Tenant, { id: p.tenantId });
      await this.audit.record(m, {
        tenantId: p.tenantId,
        actor: { id: p.userId, name: p.name, role: p.role },
        action: 'user.invited',
        category: 'user',
        message: `invited ${created.name} as ${ROLE_LABELS[created.role]}`,
        entity: { type: 'user', id: created.id, label: created.email },
        shop: { id: shop.id, name: shop.name },
        after: { role: created.role, shop: shop.name, status: 'invited' },
        meta,
      });
      return { dto: toDto(created, shop.name), business: tenant.name, user: created };
    });
    const url = this.auth.inviteUrl(rawToken);
    const emailSent = await this.mail.invite(user.email, user.name, business, url);
    return { user: dto, emailSent, inviteUrl: emailSent ? null : url };
  }

  async resendInvite(p: Principal, id: string, meta: ReqMeta): Promise<InviteResultDto> {
    let rawToken = '';
    const { user, business, shopName } = await this.db.run(p.tenantId, async (m) => {
      const found = await m.findOneBy(User, { id });
      if (!found) throw notFound('User');
      if (found.status !== 'invited') throw new AppError(HttpStatus.CONFLICT, 'NOT_INVITED', 'This person has already set a password');
      rawToken = await this.auth.issueToken(m, found, 'invite');
      const tenant = await m.findOneByOrFail(Tenant, { id: p.tenantId });
      const shop = found.shopId ? await m.findOneBy(Shop, { id: found.shopId }) : null;
      await this.audit.record(m, { tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'user.invite_resent', category: 'user', message: `sent a new invite to ${found.name}`, entity: { type: 'user', id: found.id, label: found.email }, shop: shop ? { id: shop.id, name: shop.name } : undefined, meta });
      return { user: found, business: tenant.name, shopName: shop?.name ?? null };
    });
    const url = this.auth.inviteUrl(rawToken);
    const emailSent = await this.mail.invite(user.email, user.name, business, url);
    return { user: toDto(user, shopName), emailSent, inviteUrl: emailSent ? null : url };
  }

  update(p: Principal, id: string, input: UpdateUserInput, meta: ReqMeta): Promise<UserDto> {
    return this.db.run(p.tenantId, async (m) => {
      const user = await m.findOneBy(User, { id });
      if (!user) throw notFound('User');
      if (user.role === 'owner') throw new AppError(HttpStatus.FORBIDDEN, 'OWNER_PROTECTED', 'The owner account cannot be changed here');
      const shop = input.shopId ? await m.findOneBy(Shop, { id: input.shopId }) : user.shopId ? await m.findOneBy(Shop, { id: user.shopId }) : null;
      if (input.shopId && !shop) throw notFound('Shop');
      const before = { name: user.name, role: user.role, shop: user.shopId };
      await m.update(User, { id }, { name: input.name ?? user.name, role: input.role ?? user.role, shopId: shop?.id ?? user.shopId, updatedAt: new Date() });
      const next = await m.findOneByOrFail(User, { id });
      await this.audit.record(m, {
        tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'user.updated', category: 'user',
        message: `updated ${next.name}`, entity: { type: 'user', id, label: next.email }, shop: shop ? { id: shop.id, name: shop.name } : undefined,
        before, after: { name: next.name, role: next.role, shop: next.shopId }, meta,
      });
      return toDto(next, shop?.name ?? null);
    });
  }

  /** Turns a user off and ends every session, so they are signed out on the next request (AUTH-4). */
  deactivate(p: Principal, id: string, meta: ReqMeta): Promise<UserDto> {
    return this.db.run(p.tenantId, async (m) => {
      const user = await m.findOneBy(User, { id });
      if (!user) throw notFound('User');
      if (user.id === p.userId) throw new AppError(HttpStatus.CONFLICT, 'SELF', 'You cannot turn off your own access');
      if (user.role === 'owner') throw new AppError(HttpStatus.FORBIDDEN, 'OWNER_PROTECTED', 'The owner account cannot be turned off');
      if (user.status === 'deactivated') return toDto(user, null);
      await m.update(User, { id }, { status: 'deactivated', updatedAt: new Date() });
      await m.update(Session, { userId: id }, { revokedAt: new Date() });
      const shop = user.shopId ? await m.findOneBy(Shop, { id: user.shopId }) : null;
      await this.audit.record(m, {
        tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'user.deactivated', category: 'user',
        message: `turned off access for ${user.name}`, entity: { type: 'user', id, label: user.email }, shop: shop ? { id: shop.id, name: shop.name } : undefined,
        before: { status: user.status }, after: { status: 'deactivated' }, meta,
      });
      return toDto({ ...user, status: 'deactivated' } as User, shop?.name ?? null);
    });
  }

  reactivate(p: Principal, id: string, meta: ReqMeta): Promise<UserDto> {
    return this.db.run(p.tenantId, async (m) => {
      const user = await m.getRepository(User).createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id }).getOne();
      if (!user) throw notFound('User');
      if (user.status !== 'deactivated') return toDto(user, null);
      // Someone who never set a password goes back to "invited" and needs a fresh link.
      const status = user.passwordHash ? 'active' : 'invited';
      await m.update(User, { id }, { status, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() });
      const shop = user.shopId ? await m.findOneBy(Shop, { id: user.shopId }) : null;
      await this.audit.record(m, {
        tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'user.reactivated', category: 'user',
        message: `turned access back on for ${user.name}`, entity: { type: 'user', id, label: user.email }, shop: shop ? { id: shop.id, name: shop.name } : undefined,
        before: { status: 'deactivated' }, after: { status }, meta,
      });
      return toDto({ ...user, status } as User, shop?.name ?? null);
    });
  }
}
