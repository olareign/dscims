import { Injectable } from '@nestjs/common';
import { AUDIT_CATEGORY_LABELS, paginated } from '@dscims/shared';
import type { AuditEntryDto, AuditListQuery, Paginated } from '@dscims/shared';
import { notFound } from '../../common/errors.js';
import { TenantDb } from '../../database/tenant-db.js';
import { AuditLog } from '../entities.js';

export const toAuditDto = (a: AuditLog): AuditEntryDto => ({
  id: a.id,
  createdAt: a.createdAt.toISOString(),
  category: a.category,
  action: a.action,
  actorName: a.actorName,
  actorRole: (a.actorRole as AuditEntryDto['actorRole']) ?? null,
  message: a.message,
  shopName: a.shopName,
  entityLabel: a.entityLabel,
  before: a.before,
  after: a.after,
  userAgent: a.userAgent,
});

@Injectable()
export class AuditQueryService {
  constructor(private readonly db: TenantDb) {}

  list(tenantId: string, q: AuditListQuery): Promise<Paginated<AuditEntryDto>> {
    return this.db.run(tenantId, async (m) => {
      const qb = m.getRepository(AuditLog).createQueryBuilder('a');
      if (q.category) qb.andWhere('a.category = :c', { c: q.category });
      if (q.actorId) qb.andWhere('a.actor_id = :actor', { actor: q.actorId });
      if (q.shopId) qb.andWhere('a.shop_id = :shop', { shop: q.shopId });
      // Dates are Lagos calendar days.
      if (q.from) qb.andWhere("a.created_at >= (:from::date::timestamp AT TIME ZONE 'Africa/Lagos')", { from: q.from });
      if (q.to) qb.andWhere("a.created_at < ((:to::date + 1)::timestamp AT TIME ZONE 'Africa/Lagos')", { to: q.to });
      if (q.search) {
        qb.andWhere('(a.actor_name ILIKE :s OR a.message ILIKE :s OR a.entity_label ILIKE :s)', { s: `%${q.search.replace(/[%_]/g, '\\$&')}%` });
      }
      const total = await qb.getCount();
      const rows = await qb.orderBy('a.created_at', 'DESC').addOrderBy('a.id', 'DESC').offset((q.page - 1) * q.pageSize).limit(q.pageSize).getMany();
      return paginated(rows.map(toAuditDto), total, q.page, q.pageSize);
    });
  }

  get(tenantId: string, id: string): Promise<AuditEntryDto> {
    return this.db.run(tenantId, async (m) => {
      const row = await m.findOneBy(AuditLog, { id });
      if (!row) throw notFound('Audit entry');
      return toAuditDto(row);
    });
  }

  /** Counts per category for the filter tabs. */
  counts(tenantId: string): Promise<Record<keyof typeof AUDIT_CATEGORY_LABELS | 'all', number>> {
    return this.db.run(tenantId, async (m) => {
      const rows: { category: keyof typeof AUDIT_CATEGORY_LABELS; n: string }[] = await m.query('SELECT category, count(*)::text AS n FROM audit_log GROUP BY category');
      const out = { all: 0, sign_in: 0, security: 0, user: 0, settings: 0, stock: 0 };
      for (const r of rows) { out[r.category] = Number(r.n); out.all += Number(r.n); }
      return out;
    });
  }
}
