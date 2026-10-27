import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { DEVICE_STATUS_LABELS, FLAG_OUTCOME_LABELS, FLAG_TYPE_LABELS, MAX_DEVICE_PHOTOS, PROOF_LABELS, accessFor, isValidImei, paginated, proofNeedsApproval } from '@dscims/shared';
import type {
  DeviceDto, DeviceEventDto, DeviceFlagDto, DeviceListItemDto, DeviceListQuery, DeviceStatus, DeviceUpdateInput, FileDto, FlagInput, ImeiCheckDto, Paginated, ResolveFlagInput, Role, StockCountsDto,
} from '@dscims/shared';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { AppError, conflict, notFound } from '../../common/errors.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { Device, DeviceEvent, DeviceFlag, DevicePhoto, StoredFileRow } from '../../core/entities.js';
import { TenantDb } from '../../database/tenant-db.js';
import { purchaseNumber } from '../../parties/sellers/sellers.service.js';
import { DeviceEventsService, naira } from '../events/device-events.service.js';

const canSeeCost = (role: Role) => accessFor(role, 'cost.view') === 'Y';
const DAY = 24 * 60 * 60 * 1000;
// Where a phone was bought and what proof the seller gave are not for sales staff, so those timeline entries are left out for them.
const HIDDEN_FROM_STAFF = new Set(['proof', 'under_review', 'proof_approved']);

interface Raw {
  id: string; brand: string; model: string; storage: string | null; colour: string | null; imei: string; condition: DeviceListItemDto['condition']; status: DeviceStatus;
  shop_id: string; shop_name: string; selling_kobo: string; cost_kobo: string; seller_id: string | null; seller_name: string | null; created_at: Date; purchase_number: number | null;
  proof_type: Device['proofType']; proof_note: string | null; proof_reference: string | null; proof_authority: string | null; proof_file_id: string | null; proof_approved_at: Date | null;
}

const SELECT = `d.id, d.brand, d.model, d.storage, d.colour, d.imei, d.condition, d.status, d.shop_id, sh.name AS shop_name, d.selling_kobo, d.cost_kobo,
  d.seller_id, se.name AS seller_name, d.created_at, pu.number AS purchase_number,
  d.proof_type, d.proof_note, d.proof_reference, d.proof_authority, d.proof_file_id, d.proof_approved_at`;
const FROM = `devices d JOIN shops sh ON sh.id = d.shop_id LEFT JOIN sellers se ON se.id = d.seller_id LEFT JOIN purchases pu ON pu.id = d.purchase_id`;

function listItem(r: Raw, role: Role): DeviceListItemDto {
  const item: DeviceListItemDto = {
    id: r.id, brand: r.brand, model: r.model, storage: r.storage, colour: r.colour, imei: r.imei, condition: r.condition, status: r.status,
    shopId: r.shop_id, shopName: r.shop_name, sellingKobo: Number(r.selling_kobo), receivedAt: new Date(r.created_at).toISOString(),
    ageDays: Math.max(0, Math.floor((Date.now() - new Date(r.created_at).getTime()) / DAY)),
  };
  // Cost and seller are left out of the response for sales staff, not just hidden on screen (AUTH-3).
  if (canSeeCost(role)) { item.costKobo = Number(r.cost_kobo); item.sellerName = r.seller_name; }
  return item;
}

const flagDto = (f: DeviceFlag): DeviceFlagDto => ({
  id: f.id, type: f.type, reference: f.reference, note: f.note, raisedByName: f.raisedByName, raisedAt: f.raisedAt.toISOString(),
  resolvedAt: f.resolvedAt?.toISOString() ?? null, resolvedByName: f.resolvedByName, outcome: f.outcome, resolutionNote: f.resolutionNote,
});

@Injectable()
export class DevicesService {
  constructor(private readonly db: TenantDb, private readonly audit: AuditService, private readonly events: DeviceEventsService) {}

  /** Managers and sales staff see their own shop; the owner sees every shop or one they pick (an owner's home shop is not a limit). */
  private shopScope(p: Principal, requested?: string): string | undefined {
    return p.role === 'owner' ? requested : (p.shopId ?? undefined);
  }

  list(p: Principal, q: DeviceListQuery): Promise<Paginated<DeviceListItemDto>> {
    return this.db.run(p.tenantId, async (m) => {
      const where: string[] = [];
      const params: unknown[] = [];
      const add = (sql: string, ...values: unknown[]) => {
        let i = params.length;
        where.push(sql.replace(/\?/g, () => `$${++i}`));
        params.push(...values);
      };
      const shop = this.shopScope(p, q.shopId);
      if (shop) add('d.shop_id = ?', shop);
      if (q.status) add('d.status = ?', q.status);
      if (q.condition) add('d.condition = ?', q.condition);
      if (q.brand) add('lower(d.brand) = lower(?)', q.brand);
      if (q.age === 'over60') add("d.status = 'in_stock' AND d.created_at < now() - interval '60 days'");
      if (q.search) {
        const like = `%${q.search.replace(/[\\%_]/g, '\\$&')}%`;
        const parts = ['d.imei LIKE ?', "concat_ws(' ', d.brand, d.model, d.storage, d.colour) ILIKE ?"];
        const values: unknown[] = [like, like];
        // Seller name and purchase number are not searchable by sales staff, so they cannot be probed that way.
        if (canSeeCost(p.role)) { parts.push('se.name ILIKE ?', "('PUR-' || lpad(pu.number::text, 6, '0')) ILIKE ?"); values.push(like, like); }
        add(`(${parts.join(' OR ')})`, ...values);
      }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = Number((await m.query(`SELECT count(*) AS n FROM ${FROM} ${clause}`, params))[0].n);
      const order = { newest: 'd.created_at DESC', oldest: 'd.created_at ASC', price_high: 'd.selling_kobo DESC, d.created_at DESC', price_low: 'd.selling_kobo ASC, d.created_at DESC' }[q.sort];
      const rows: Raw[] = await m.query(`SELECT ${SELECT} FROM ${FROM} ${clause} ORDER BY ${order} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`, params);
      return paginated(rows.map((r) => listItem(r, p.role)), total, q.page, q.pageSize);
    });
  }

  counts(p: Principal, requestedShop?: string): Promise<StockCountsDto> {
    return this.db.run(p.tenantId, async (m) => {
      const shop = this.shopScope(p, requestedShop);
      const rows: { status: DeviceStatus; n: string; cost: string; over60: string }[] = await m.query(
        `SELECT status, count(*) AS n, coalesce(sum(cost_kobo), 0) AS cost,
                count(*) FILTER (WHERE status = 'in_stock' AND created_at < now() - interval '60 days') AS over60
           FROM devices ${shop ? 'WHERE shop_id = $1' : ''} GROUP BY status`, shop ? [shop] : []);
      const n = (s: DeviceStatus) => Number(rows.find((r) => r.status === s)?.n ?? 0);
      const out: StockCountsDto = {
        all: rows.reduce((sum, r) => sum + Number(r.n), 0), in_stock: n('in_stock'), flagged: n('flagged'), sold: n('sold'), returned: n('returned'), under_review: n('under_review'),
        over60Days: Number(rows.find((r) => r.status === 'in_stock')?.over60 ?? 0),
      };
      if (canSeeCost(p.role)) out.stockAtCostKobo = Number(rows.find((r) => r.status === 'in_stock')?.cost ?? 0);
      return out;
    });
  }

  async imeiCheck(tenantId: string, imei: string): Promise<ImeiCheckDto> {
    if (!isValidImei(imei)) return { valid: false, exists: false, deviceId: null, message: 'That IMEI is not valid. Dial *#06# and check all 15 digits' };
    const found = await this.db.run(tenantId, (m) => m.findOneBy(Device, { imei }));
    return found
      ? { valid: true, exists: true, deviceId: found.id, message: `This IMEI is already in stock as ${found.brand} ${found.model}. It cannot be added again` }
      : { valid: true, exists: false, deviceId: null, message: null };
  }

  async get(p: Principal, id: string): Promise<DeviceDto> {
    return this.db.run(p.tenantId, async (m) => {
      await this.load(m, p, id);
      // One after the other: a transaction is a single connection and cannot run queries at the same time.
      const photos: FileDto[] = await m.query(`SELECT f.id, f.kind, f.filename, f.mime, f.bytes FROM device_photos dp JOIN files f ON f.id = dp.file_id WHERE dp.device_id = $1 ORDER BY dp.created_at`, [id]);
      const flags = await m.find(DeviceFlag, { where: { deviceId: id }, order: { raisedAt: 'DESC' } });
      const events = await m.find(DeviceEvent, { where: { deviceId: id }, order: { createdAt: 'DESC' } });
      const raw: Raw = (await m.query(`SELECT ${SELECT} FROM ${FROM} WHERE d.id = $1`, [id]))[0];
      const dto: DeviceDto = {
        ...listItem(raw, p.role), photos, flags: flags.map(flagDto), openFlag: flags.filter((f) => !f.resolvedAt).map(flagDto)[0] ?? null,
        events: events.filter((e) => canSeeCost(p.role) || !HIDDEN_FROM_STAFF.has(e.type)).map((e): DeviceEventDto => ({
          id: e.id, type: e.type, title: e.title, detail: canSeeCost(p.role) ? e.detail : e.type === 'received' ? null : e.detail, actorName: e.actorName, createdAt: e.createdAt.toISOString(),
        })),
      };
      // Where it was bought and what proof the seller gave are for the owner and managers only.
      if (canSeeCost(p.role)) {
        Object.assign(dto, {
          purchaseNumber: raw.purchase_number ? purchaseNumber(raw.purchase_number) : null, sellerId: raw.seller_id, proofType: raw.proof_type, proofNote: raw.proof_note,
          proofReference: raw.proof_reference, proofAuthority: raw.proof_authority, proofFileId: raw.proof_file_id, proofApproved: raw.proof_approved_at !== null || !proofNeedsApproval(raw.proof_type),
        });
      }
      return dto;
    });
  }

  update(p: Principal, id: string, input: DeviceUpdateInput, meta: ReqMeta): Promise<DeviceDto> {
    return this.db.run(p.tenantId, async (m) => {
      const device = await this.lock(m, p, id);
      const changes: string[] = [];
      const patch: Partial<Device> = {};
      for (const key of ['brand', 'model', 'storage', 'colour', 'condition'] as const) {
        if (input[key] !== undefined && input[key] !== device[key]) { (patch as Record<string, unknown>)[key] = input[key]; changes.push(key); }
      }
      const priceChanged = input.sellingKobo !== undefined && input.sellingKobo !== device.sellingKobo;
      if (priceChanged) patch.sellingKobo = input.sellingKobo;
      if (input.costKobo !== undefined && input.costKobo !== device.costKobo) { patch.costKobo = input.costKobo; changes.push('cost price'); }
      if (priceChanged || changes.length) {
        await m.update(Device, { id }, { ...patch, updatedAt: new Date() });
        const actor = { id: p.userId, name: p.name };
        if (priceChanged) await this.events.record(m, { tenantId: p.tenantId, deviceId: id, type: 'price_set', title: `Price set to ${naira(input.sellingKobo!)}`, detail: `Was ${naira(device.sellingKobo)}`, actor });
        if (changes.length) await this.events.record(m, { tenantId: p.tenantId, deviceId: id, type: 'edited', title: 'Details changed', detail: changes.join(', '), actor });
        await this.audit.record(m, {
          tenantId: p.tenantId, actor: { ...actor, role: p.role }, action: 'device.updated', category: 'stock', message: `changed ${[...changes, ...(priceChanged ? ['selling price'] : [])].join(', ')} on ${device.brand} ${device.model}`,
          entity: { type: 'device', id, label: `${device.brand} ${device.model}` }, meta,
        });
      }
    }).then(() => this.get(p, id));
  }

  addPhoto(p: Principal, id: string, fileId: string, meta: ReqMeta): Promise<DeviceDto> {
    return this.db.run(p.tenantId, async (m) => {
      const device = await this.lock(m, p, id);
      const file = await m.findOneBy(StoredFileRow, { id: fileId, kind: 'device_photo' });
      if (!file) throw notFound('Photo');
      const count = await m.countBy(DevicePhoto, { deviceId: id });
      if (count >= MAX_DEVICE_PHOTOS) throw new AppError(HttpStatus.BAD_REQUEST, 'PHOTO_LIMIT', `A phone can have up to ${MAX_DEVICE_PHOTOS} photos`);
      await m.insert(DevicePhoto, { tenantId: p.tenantId, deviceId: id, fileId });
      await this.events.record(m, { tenantId: p.tenantId, deviceId: id, type: 'photo_added', title: 'Photo added', actor: { id: p.userId, name: p.name } });
      await this.audit.record(m, { tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'device.photo_added', category: 'stock', message: `added a photo to ${device.brand} ${device.model}`, entity: { type: 'device', id, label: `${device.brand} ${device.model}` }, meta });
    }).then(() => this.get(p, id));
  }

  flag(p: Principal, id: string, input: FlagInput, meta: ReqMeta): Promise<DeviceDto> {
    return this.db.run(p.tenantId, async (m) => {
      const device = await this.lock(m, p, id);
      if (device.status === 'flagged') throw conflict('ALREADY_FLAGGED', 'This phone is already flagged');
      if (device.status === 'written_off') throw conflict('WRITTEN_OFF', 'A written-off phone cannot be flagged');
      await m.insert(DeviceFlag, { tenantId: p.tenantId, deviceId: id, type: input.type, reference: input.reference, note: input.note, raisedBy: p.userId, raisedByName: p.name });
      await m.update(Device, { id }, { status: 'flagged', statusBeforeFlag: device.status, updatedAt: new Date() });
      const label = `${device.brand} ${device.model}`;
      await this.events.record(m, { tenantId: p.tenantId, deviceId: id, type: 'flagged', title: `Flagged: ${FLAG_TYPE_LABELS[input.type]}`, detail: input.reference ? `${input.reference}. ${input.note}` : input.note, actor: { id: p.userId, name: p.name } });
      await this.audit.record(m, { tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'device.flagged', category: 'stock', message: `flagged ${label} (${FLAG_TYPE_LABELS[input.type]})`, entity: { type: 'device', id, label }, before: { status: device.status }, after: { status: 'flagged' }, meta });
    }).then(() => this.get(p, id));
  }

  resolveFlag(p: Principal, id: string, input: ResolveFlagInput, meta: ReqMeta): Promise<DeviceDto> {
    return this.db.run(p.tenantId, async (m) => {
      const device = await this.lock(m, p, id);
      const open = await m.findOne(DeviceFlag, { where: { deviceId: id, resolvedAt: IsNull() } });
      if (!open || device.status !== 'flagged') throw conflict('NOT_FLAGGED', 'This phone has no open flag');
      await m.update(DeviceFlag, { id: open.id }, { resolvedAt: new Date(), resolvedBy: p.userId, resolvedByName: p.name, outcome: input.outcome, resolutionNote: input.note });
      // INV-8: Cleared goes back to where it was; released to authority and written off both close the stock record.
      const next: DeviceStatus = input.outcome === 'cleared' ? (device.statusBeforeFlag ?? 'in_stock') : 'written_off';
      await m.update(Device, { id }, { status: next, statusBeforeFlag: null, updatedAt: new Date() });
      const label = `${device.brand} ${device.model}`;
      await this.events.record(m, { tenantId: p.tenantId, deviceId: id, type: 'flag_resolved', title: `Flag resolved: ${FLAG_OUTCOME_LABELS[input.outcome]}`, detail: input.note, actor: { id: p.userId, name: p.name } });
      await this.audit.record(m, { tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'device.flag_resolved', category: 'stock', message: `resolved the flag on ${label}: ${FLAG_OUTCOME_LABELS[input.outcome]}`, entity: { type: 'device', id, label }, before: { status: 'flagged' }, after: { status: next }, meta });
    }).then(() => this.get(p, id));
  }

  approveProof(p: Principal, id: string, meta: ReqMeta): Promise<DeviceDto> {
    return this.db.run(p.tenantId, async (m) => {
      const device = await this.lock(m, p, id);
      if (device.status !== 'under_review' || device.proofApprovedAt || !proofNeedsApproval(device.proofType)) throw conflict('NOTHING_TO_APPROVE', 'This phone is not waiting for proof approval');
      await m.update(Device, { id }, { status: 'in_stock', proofApprovedBy: p.userId, proofApprovedAt: new Date(), updatedAt: new Date() });
      const label = `${device.brand} ${device.model}`;
      await this.events.record(m, { tenantId: p.tenantId, deviceId: id, type: 'proof_approved', title: `Proof approved: ${PROOF_LABELS[device.proofType]}`, detail: 'Moved from Under review to In stock', actor: { id: p.userId, name: p.name } });
      await this.audit.record(m, { tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'device.proof_approved', category: 'stock', message: `approved the ${PROOF_LABELS[device.proofType].toLowerCase()} for ${label}`, entity: { type: 'device', id, label }, before: { status: DEVICE_STATUS_LABELS.under_review }, after: { status: DEVICE_STATUS_LABELS.in_stock }, meta });
    }).then(() => this.get(p, id));
  }

  /** A device in another shop looks like a missing one to managers and staff. */
  private async load(m: EntityManager, p: Principal, id: string): Promise<Device> {
    const device = await m.findOneBy(Device, { id });
    if (!device || (this.shopScope(p) && device.shopId !== this.shopScope(p))) throw notFound('Phone');
    return device;
  }

  /** Locks the row so two people cannot change the same phone at once (the same lock a sale will use). */
  private async lock(m: EntityManager, p: Principal, id: string): Promise<Device> {
    const device = await m.createQueryBuilder(Device, 'd').setLock('pessimistic_write').where('d.id = :id', { id }).getOne();
    if (!device || (this.shopScope(p) && device.shopId !== this.shopScope(p))) throw notFound('Phone');
    return device;
  }
}
