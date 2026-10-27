import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { paginated } from '@dscims/shared';
import type { Paginated, ShopDto, ShopInput, ShopListQuery } from '@dscims/shared';
import { conflict, notFound } from '../../common/errors.js';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { AppConfig } from '../../config/app-config.js';
import { TenantDb } from '../../database/tenant-db.js';
import { AuditService } from '../audit/audit.service.js';
import { Shop } from '../entities.js';

type ShopRow = Shop & { userCount?: string };

const toDto = (s: ShopRow): ShopDto => ({
  id: s.id, name: s.name, address: s.address, latitude: s.latitude, longitude: s.longitude, phone: s.phone, isMain: s.isMain, userCount: Number(s.userCount ?? 0),
});

const isUniqueViolation = (err: unknown) => err instanceof QueryFailedError && (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';

@Injectable()
export class ShopsService {
  private readonly log = new Logger(ShopsService.name);

  constructor(private readonly db: TenantDb, private readonly audit: AuditService, private readonly config: AppConfig) {}

  list(tenantId: string, q: ShopListQuery): Promise<Paginated<ShopDto>> {
    return this.db.run(tenantId, async (m) => {
      const qb = m.getRepository(Shop).createQueryBuilder('s').addSelect('(SELECT count(*) FROM users u WHERE u.shop_id = s.id)', 'userCount');
      if (q.search) qb.andWhere('(s.name ILIKE :q OR s.address ILIKE :q)', { q: `%${q.search.replace(/[%_]/g, '\\$&')}%` });
      const total = await qb.getCount();
      if (q.sort === 'created') qb.orderBy('s.created_at', 'DESC'); else qb.orderBy('s.is_main', 'DESC').addOrderBy('lower(s.name)', 'ASC');
      const { entities, raw } = await qb.offset((q.page - 1) * q.pageSize).limit(q.pageSize).getRawAndEntities();
      const items = entities.map((e, i) => toDto({ ...e, userCount: raw[i]?.userCount } as ShopRow));
      return paginated(items, total, q.page, q.pageSize);
    });
  }

  get(tenantId: string, id: string): Promise<ShopDto> {
    return this.db.run(tenantId, async (m) => {
      const { entities, raw } = await m.getRepository(Shop).createQueryBuilder('s')
        .addSelect('(SELECT count(*) FROM users u WHERE u.shop_id = s.id)', 'userCount').where('s.id = :id', { id }).getRawAndEntities();
      if (!entities[0]) throw notFound('Shop');
      return toDto({ ...entities[0], userCount: raw[0]?.userCount } as ShopRow);
    });
  }

  create(p: Principal, input: ShopInput, meta: ReqMeta): Promise<ShopDto> {
    return this.db.run(p.tenantId, async (m) => {
      try {
        const shop = await m.save(Shop, m.create(Shop, { ...input, tenantId: p.tenantId, createdBy: p.userId, isMain: false }));
        await this.audit.record(m, {
          tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'shop.created', category: 'settings',
          message: `added the shop ${shop.name}`, entity: { type: 'shop', id: shop.id, label: shop.name }, shop: { id: shop.id, name: shop.name },
          after: { name: shop.name, address: shop.address }, meta,
        });
        return toDto(shop);
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict('SHOP_NAME_TAKEN', 'You already have a shop with that name');
        throw err;
      }
    });
  }

  update(p: Principal, id: string, input: ShopInput, meta: ReqMeta): Promise<ShopDto> {
    return this.db.run(p.tenantId, async (m) => {
      const shop = await m.findOneBy(Shop, { id });
      if (!shop) throw notFound('Shop');
      const before = { name: shop.name, address: shop.address, phone: shop.phone };
      try {
        await m.update(Shop, { id }, { ...input, updatedAt: new Date() });
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict('SHOP_NAME_TAKEN', 'You already have a shop with that name');
        throw err;
      }
      const next = await m.findOneByOrFail(Shop, { id });
      await this.audit.record(m, {
        tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'shop.updated', category: 'settings',
        message: `updated the shop ${next.name}`, entity: { type: 'shop', id, label: next.name }, shop: { id, name: next.name },
        before, after: { name: next.name, address: next.address, phone: next.phone }, meta,
      });
      return toDto(next);
    });
  }

  /** Turns coordinates the browser gave us into a street address. Used only when the owner taps "Use my location". */
  async addressFor(lat: number, lng: number): Promise<{ address: string }> {
    const url = new URL(this.config.env.GEOCODER_URL);
    url.search = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '18', addressdetails: '0' }).toString();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': this.config.env.GEOCODER_USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Geocoder answered ${res.status}`);
      const body = (await res.json()) as { display_name?: string };
      if (!body.display_name) throw new Error('No address found');
      return { address: body.display_name.slice(0, 300) };
    } catch (err) {
      this.log.warn(`Address lookup failed: ${(err as Error).message}`);
      throw new BadGatewayException({ statusCode: 502, code: 'GEOCODE_FAILED', message: 'We could not find an address for your location. Type it instead.' });
    }
  }
}
