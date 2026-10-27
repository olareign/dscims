import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { paginated } from '@dscims/shared';
import type { CreateDealerInput, DealerDto, DealerListQuery, Paginated, TenantStatus } from '@dscims/shared';
import { AppError, conflict, notFound } from '../../common/errors.js';
import type { PlatformPrincipal } from '../../common/auth.types.js';
import { AppConfig } from '../../config/app-config.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { AuthService } from '../../core/auth/auth.service.js';
import { PlatformAdmin, Settings, Shop, Tenant, User } from '../../core/entities.js';
import { MailService } from '../../core/mail/mail.service.js';
import { TenantDb } from '../../database/tenant-db.js';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

interface DealerRow {
  id: string; name: string; status: 'active' | 'suspended'; grace_ends_at: Date | null; created_at: Date;
  shops: number; users: number; owner_name: string | null; owner_email: string | null;
}

const effectiveStatus = (status: 'active' | 'suspended', grace: Date | null): TenantStatus =>
  status === 'suspended' && grace !== null && new Date(grace) <= new Date() ? 'locked' : status;

const toDto = (r: DealerRow): DealerDto => ({
  id: r.id, name: r.name, ownerName: r.owner_name, ownerEmail: r.owner_email, shops: r.shops, users: r.users,
  status: effectiveStatus(r.status, r.grace_ends_at), createdAt: new Date(r.created_at).toISOString(),
});

const PLATFORM_ACTOR = (admin: PlatformPrincipal) => ({ id: null, name: `${admin.name} (Pacifylabs)`, role: 'platform' as const });

@Injectable()
export class PlatformService {
  constructor(
    private readonly db: TenantDb,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; admin: { name: string; email: string } }> {
    const admin = await this.db.system((m) => m.getRepository(PlatformAdmin).createQueryBuilder('a').addSelect('a.passwordHash').where('lower(a.email) = :email', { email }).getOne());
    const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !ok) throw new AppError(HttpStatus.UNAUTHORIZED, 'BAD_CREDENTIALS', 'Wrong email or password');
    const token = await this.jwt.signAsync({ sub: admin.id, typ: 'platform' }, { expiresIn: '12h' });
    return { token, admin: { name: admin.name, email: admin.email } };
  }

  async list(q: DealerListQuery): Promise<Paginated<DealerDto>> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (q.search) { params.push(`%${q.search.replace(/[%_]/g, '\\$&')}%`); where.push(`(t.name ILIKE $${params.length} OR o.email ILIKE $${params.length} OR o.name ILIKE $${params.length})`); }
    if (q.status === 'active') where.push("t.status = 'active'");
    if (q.status === 'suspended') where.push("t.status = 'suspended' AND t.grace_ends_at > now()");
    if (q.status === 'locked') where.push("t.status = 'suspended' AND t.grace_ends_at <= now()");
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = "FROM tenants t LEFT JOIN users o ON o.tenant_id = t.id AND o.role = 'owner'";
    return this.db.system(async (m) => {
      const [{ n }]: { n: number }[] = await m.query(`SELECT count(*)::int AS n ${from} ${clause}`, params);
      const order = q.sort === 'name' ? 'lower(t.name)' : 't.created_at DESC';
      const rows: DealerRow[] = await m.query(
        `SELECT t.id, t.name, t.status, t.grace_ends_at, t.created_at, o.name AS owner_name, o.email AS owner_email,
                (SELECT count(*)::int FROM shops s WHERE s.tenant_id = t.id) AS shops,
                (SELECT count(*)::int FROM users u WHERE u.tenant_id = t.id) AS users
           ${from} ${clause} ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, q.pageSize, (q.page - 1) * q.pageSize],
      );
      return paginated(rows.map(toDto), n, q.page, q.pageSize);
    });
  }

  counts(): Promise<{ all: number; active: number; suspended: number; locked: number }> {
    return this.db.system(async (m) => {
      const rows: { status: 'active' | 'suspended'; grace_ends_at: Date | null }[] = await m.query('SELECT status, grace_ends_at FROM tenants');
      const out = { all: rows.length, active: 0, suspended: 0, locked: 0 };
      for (const r of rows) out[effectiveStatus(r.status, r.grace_ends_at)]++;
      return out;
    });
  }

  async create(admin: PlatformPrincipal, input: CreateDealerInput): Promise<{ dealer: DealerDto; emailSent: boolean; inviteUrl: string | null }> {
    let raw = '';
    try {
      const created = await this.db.system(async (m) => {
        const tenant = await m.save(Tenant, m.create(Tenant, { name: input.businessName }));
        const shop = await m.save(Shop, m.create(Shop, { tenantId: tenant.id, name: input.shopName, isMain: true }));
        await m.insert(Settings, { tenantId: tenant.id });
        const owner = await m.save(User, m.create(User, { tenantId: tenant.id, shopId: shop.id, name: input.ownerName, email: input.ownerEmail, role: 'owner', status: 'invited' }));
        raw = await this.auth.issueToken(m, owner, 'invite');
        await this.audit.record(m, { tenantId: tenant.id, actor: PLATFORM_ACTOR(admin), action: 'tenant.created', category: 'settings', message: `created the dealer account for ${tenant.name}`, entity: { type: 'tenant', id: tenant.id, label: tenant.name } });
        return { tenant, owner };
      });
      const url = this.auth.inviteUrl(raw);
      const emailSent = await this.mail.invite(created.owner.email, created.owner.name, created.tenant.name, url);
      return {
        dealer: { id: created.tenant.id, name: created.tenant.name, ownerName: created.owner.name, ownerEmail: created.owner.email, shops: 1, users: 1, status: 'active', createdAt: created.tenant.createdAt.toISOString() },
        emailSent,
        inviteUrl: emailSent ? null : url,
      };
    } catch (err) {
      if (err instanceof QueryFailedError && (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') {
        throw conflict('EMAIL_TAKEN', 'That email already has an account');
      }
      throw err;
    }
  }

  suspend(admin: PlatformPrincipal, id: string): Promise<void> {
    const grace = new Date(Date.now() + this.config.env.TENANT_GRACE_DAYS * 86400000);
    return this.db.system(async (m) => {
      const tenant = await m.findOneBy(Tenant, { id });
      if (!tenant) throw notFound('Dealer');
      if (tenant.status === 'suspended') return;
      await m.update(Tenant, { id }, { status: 'suspended', graceEndsAt: grace, updatedAt: new Date() });
      await this.audit.record(m, { tenantId: id, actor: PLATFORM_ACTOR(admin), action: 'tenant.suspended', category: 'settings', message: 'suspended the account (read-only until the grace period ends)', entity: { type: 'tenant', id, label: tenant.name }, before: { status: 'active' }, after: { status: 'suspended', graceEndsAt: grace.toISOString() } });
    });
  }

  reactivate(admin: PlatformPrincipal, id: string): Promise<void> {
    return this.db.system(async (m) => {
      const tenant = await m.findOneBy(Tenant, { id });
      if (!tenant) throw notFound('Dealer');
      if (tenant.status === 'active') return;
      await m.update(Tenant, { id }, { status: 'active', graceEndsAt: null, updatedAt: new Date() });
      await this.audit.record(m, { tenantId: id, actor: PLATFORM_ACTOR(admin), action: 'tenant.reactivated', category: 'settings', message: 'reactivated the account', entity: { type: 'tenant', id, label: tenant.name }, before: { status: 'suspended' }, after: { status: 'active' } });
    });
  }
}
