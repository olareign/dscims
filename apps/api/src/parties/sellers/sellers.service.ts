import { Injectable } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { paginated } from '@dscims/shared';
import type { Paginated, SellerDetailDto, SellerDto, SellerInput, SellerListQuery } from '@dscims/shared';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { conflict, notFound } from '../../common/errors.js';
import { FieldCrypto } from '../../common/field-crypto.js';
import { Seller, StoredFileRow } from '../../core/entities.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { TenantDb } from '../../database/tenant-db.js';

interface SellerRow extends Seller { deviceCount?: string; flaggedCount?: string; lastPurchaseAt?: Date | null }

const toDto = (s: SellerRow): SellerDto => ({
  id: s.id, name: s.name, phone: s.phone, address: s.address, hasId: s.idFileId !== null,
  ninLast4: s.ninLast4, bvnLast4: s.bvnLast4,
  deviceCount: Number(s.deviceCount ?? 0), flaggedCount: Number(s.flaggedCount ?? 0), lastPurchaseAt: s.lastPurchaseAt ? new Date(s.lastPurchaseAt).toISOString() : null,
});

const last4 = (v?: string) => (v ? v.slice(-4) : null);
const isUniqueViolation = (err: unknown) => err instanceof QueryFailedError && (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';

@Injectable()
export class SellersService {
  constructor(private readonly db: TenantDb, private readonly audit: AuditService, private readonly crypto: FieldCrypto) {}

  list(tenantId: string, q: SellerListQuery): Promise<Paginated<SellerDto>> {
    return this.db.run(tenantId, async (m) => {
      const qb = m.getRepository(Seller).createQueryBuilder('s')
        .addSelect('(SELECT count(*) FROM devices d WHERE d.seller_id = s.id)', 'deviceCount')
        .addSelect("(SELECT count(*) FROM devices d WHERE d.seller_id = s.id AND d.status = 'flagged')", 'flaggedCount')
        .addSelect('(SELECT max(p.created_at) FROM purchases p WHERE p.seller_id = s.id)', 'lastPurchaseAt');
      if (q.search) {
        const like = `%${q.search.replace(/[%_]/g, '\\$&')}%`;
        qb.andWhere('(s.name ILIKE :like OR s.phone LIKE :like)', { like });
      }
      if (q.tag === 'no_id') qb.andWhere('s.id_file_id IS NULL');
      if (q.tag === 'flagged') qb.andWhere("EXISTS (SELECT 1 FROM devices d WHERE d.seller_id = s.id AND d.status = 'flagged')");
      const total = await qb.getCount();
      if (q.sort === 'recent') qb.orderBy('"lastPurchaseAt"', 'DESC', 'NULLS LAST'); else qb.orderBy('lower(s.name)', 'ASC');
      const { entities, raw } = await qb.offset((q.page - 1) * q.pageSize).limit(q.pageSize).getRawAndEntities();
      return paginated(entities.map((e, i) => toDto({ ...e, deviceCount: raw[i]?.deviceCount, flaggedCount: raw[i]?.flaggedCount, lastPurchaseAt: raw[i]?.lastPurchaseAt } as SellerRow)), total, q.page, q.pageSize);
    });
  }

  get(tenantId: string, id: string): Promise<SellerDetailDto> {
    return this.db.run(tenantId, async (m) => {
      const seller = await m.findOneBy(Seller, { id });
      if (!seller) throw notFound('Seller');
      const devices = await m.query(
        `SELECT d.id, d.brand, d.model, d.imei, d.status, d.cost_kobo, d.created_at, p.number
           FROM devices d LEFT JOIN purchases p ON p.id = d.purchase_id WHERE d.seller_id = $1 ORDER BY d.created_at DESC LIMIT 200`, [id]) as
        { id: string; brand: string; model: string; imei: string; status: SellerDetailDto['devices'][number]['status']; cost_kobo: string; created_at: Date; number: number | null }[];
      const stats = await m.query(`SELECT max(created_at) AS last FROM purchases WHERE seller_id = $1`, [id]) as { last: Date | null }[];
      return {
        ...toDto({ ...seller, deviceCount: String(devices.length), flaggedCount: String(devices.filter((d) => d.status === 'flagged').length), lastPurchaseAt: stats[0]?.last ?? null } as SellerRow),
        idFileId: seller.idFileId,
        totalKobo: devices.reduce((sum, d) => sum + Number(d.cost_kobo), 0),
        devices: devices.map((d) => ({ id: d.id, brand: d.brand, model: d.model, imei: d.imei, status: d.status, costKobo: Number(d.cost_kobo), purchaseNumber: purchaseNumber(d.number), receivedAt: new Date(d.created_at).toISOString() })),
      };
    });
  }

  create(p: Principal, input: SellerInput, meta: ReqMeta): Promise<SellerDto> {
    return this.db.run(p.tenantId, async (m) => {
      if (input.idFileId && !(await m.findOneBy(StoredFileRow, { id: input.idFileId, kind: 'seller_id' }))) throw notFound('ID photo');
      try {
        const seller = await m.save(Seller, m.create(Seller, {
          tenantId: p.tenantId, createdBy: p.userId, name: input.name, phone: input.phone, address: input.address, idFileId: input.idFileId ?? null,
          ninEncrypted: input.nin ? this.crypto.encrypt(input.nin) : null, ninLast4: last4(input.nin),
          bvnEncrypted: input.bvn ? this.crypto.encrypt(input.bvn) : null, bvnLast4: last4(input.bvn),
        }));
        // The audit entry never holds NIN or BVN, not even masked.
        await this.audit.record(m, {
          tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'seller.created', category: 'stock',
          message: `registered the seller ${seller.name}`, entity: { type: 'seller', id: seller.id, label: seller.name }, after: { name: seller.name, phone: seller.phone, hasId: !!seller.idFileId }, meta,
        });
        return toDto(seller);
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict('SELLER_PHONE_TAKEN', 'A seller with that phone number is already registered');
        throw err;
      }
    });
  }
}

export const purchaseNumber = (n: number | null): string => (n === null ? '' : `PUR-${String(n).padStart(6, '0')}`);
