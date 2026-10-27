import { Injectable } from '@nestjs/common';
import type { OverviewDto } from '@dscims/shared';
import { TenantDb } from '../../database/tenant-db.js';
import { toAuditDto } from '../audit/audit-query.service.js';
import { AuditLog } from '../entities.js';

const LAGOS = "'Africa/Lagos'";
const TODAY_START = `date_trunc('day', now() AT TIME ZONE ${LAGOS}) AT TIME ZONE ${LAGOS}`;
const MONTH_START = `date_trunc('month', now() AT TIME ZONE ${LAGOS}) AT TIME ZONE ${LAGOS}`;

@Injectable()
export class DashboardService {
  constructor(private readonly db: TenantDb) {}

  overview(tenantId: string): Promise<OverviewDto> {
    return this.db.run(tenantId, async (m) => {
      // One connection per transaction, so these run one after another.
      const q = async <T>(sql: string): Promise<T> => (await m.query(sql)) as T;
      const statusRows = await q<{ status: string; n: number }[]>('SELECT status, count(*)::int AS n FROM users GROUP BY status');
      const roleRows = await q<{ role: string; n: number }[]>('SELECT role, count(*)::int AS n FROM users GROUP BY role');
      const added = await q<{ n: number }[]>(`SELECT count(*)::int AS n FROM users WHERE created_at >= ${MONTH_START}`);
      const signedIn = await q<{ n: number }[]>(`SELECT count(*)::int AS n FROM users WHERE last_sign_in_at >= ${TODAY_START}`);
      const failed = await q<{ n: number }[]>("SELECT count(*)::int AS n FROM audit_log WHERE action IN ('auth.sign_in_failed', 'auth.sign_in_paused') AND created_at >= now() - interval '24 hours'");
      const shops = await q<OverviewDto['shops']>('SELECT s.id, s.name, s.address, (SELECT count(*)::int FROM users u WHERE u.shop_id = s.id) AS "userCount" FROM shops s ORDER BY s.is_main DESC, lower(s.name)');
      const days = await q<OverviewDto['signInsByDay']>(
        `SELECT to_char(d.day, 'YYYY-MM-DD') AS date, count(a.id)::int AS count
           FROM generate_series((now() AT TIME ZONE ${LAGOS})::date - 6, (now() AT TIME ZONE ${LAGOS})::date, interval '1 day') AS d(day)
           LEFT JOIN audit_log a ON a.action = 'auth.sign_in' AND (a.created_at AT TIME ZONE ${LAGOS})::date = d.day::date
          GROUP BY d.day ORDER BY d.day`,
      );
      const recent = await m.getRepository(AuditLog).find({ order: { createdAt: 'DESC' }, take: 5 });

      const by = (key: string) => statusRows.find((r) => r.status === key)?.n ?? 0;
      const role = (key: string) => roleRows.find((r) => r.role === key)?.n ?? 0;
      return {
        users: { total: statusRows.reduce((a, r) => a + r.n, 0), active: by('active'), deactivated: by('deactivated'), invited: by('invited'), addedThisMonth: added[0]?.n ?? 0 },
        signedInToday: signedIn[0]?.n ?? 0,
        failedSignIns24h: failed[0]?.n ?? 0,
        shops,
        roles: { owner: role('owner'), manager: role('manager'), staff: role('staff') },
        signInsByDay: days,
        recent: recent.map(toAuditDto),
      };
    });
  }
}
