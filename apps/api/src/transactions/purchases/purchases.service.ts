import { HttpStatus, Injectable } from '@nestjs/common';
import { EntityManager, QueryFailedError } from 'typeorm';
import { PROOF_LABELS, proofNeedsApproval } from '@dscims/shared';
import type { DeviceStatus, PurchaseDto, PurchaseInput } from '@dscims/shared';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { AppError, conflict, forbidden, notFound } from '../../common/errors.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { Device, DevicePhoto, Purchase, Seller, Shop, StoredFileRow, Tenant } from '../../core/entities.js';
import { TenantDb } from '../../database/tenant-db.js';
import { DeviceEventsService, naira } from '../../inventory/events/device-events.service.js';
import { purchaseNumber } from '../../parties/sellers/sellers.service.js';

const isUniqueViolation = (err: unknown) => err instanceof QueryFailedError && (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505';

@Injectable()
export class PurchasesService {
  constructor(private readonly db: TenantDb, private readonly audit: AuditService, private readonly events: DeviceEventsService) {}

  create(p: Principal, input: PurchaseInput, meta: ReqMeta): Promise<PurchaseDto> {
    return this.db.run(p.tenantId, async (m) => {
      const shop = await this.shopFor(m, p, input.shopId);
      const seller = await m.findOneBy(Seller, { id: input.sellerId });
      if (!seller) throw notFound('Seller');
      await this.checkFiles(m, input);
      await this.checkImeis(m, input);

      // Numbers are per dealer and increase by one. The lock stops two purchases taking the same number.
      await m.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`purchase:${p.tenantId}`]);
      const next = Number((await m.query('SELECT coalesce(max(number), 0) + 1 AS n FROM purchases WHERE tenant_id = $1', [p.tenantId]))[0].n);
      const total = input.devices.reduce((sum, d) => sum + d.costKobo, 0);
      const now = new Date();
      const purchase = await m.save(Purchase, m.create(Purchase, {
        tenantId: p.tenantId, shopId: shop.id, sellerId: seller.id, number: next, paymentMethod: input.paymentMethod, totalKobo: total,
        paidKobo: input.paymentMethod === 'part' ? input.paidKobo! : total, declaredBy: input.declaredBy, declaredAt: now, createdBy: p.userId, createdByName: p.name,
      }));
      const number = purchaseNumber(next);
      const actor = { id: p.userId, name: p.name };

      const created: Device[] = [];
      for (const d of input.devices) {
        // INV-1a: a certificate or police/government credentials hold the phone for the owner. An owner's own purchase is approved on the spot.
        const needsApproval = proofNeedsApproval(d.proofType);
        const held = needsApproval && p.role !== 'owner';
        const status: DeviceStatus = held ? 'under_review' : 'in_stock';
        let device: Device;
        try {
          device = await m.save(Device, m.create(Device, {
            tenantId: p.tenantId, createdBy: p.userId, shopId: shop.id, purchaseId: purchase.id, sellerId: seller.id, brand: d.brand, model: d.model, storage: d.storage, colour: d.colour,
            imei: d.imei, condition: d.condition, status, costKobo: d.costKobo, sellingKobo: d.sellingKobo, proofType: d.proofType, proofNote: d.proofNote, proofReference: d.proofReference,
            proofAuthority: d.proofAuthority, proofFileId: d.proofFileId ?? null, proofApprovedBy: needsApproval && !held ? p.userId : null, proofApprovedAt: needsApproval && !held ? now : null,
          }));
        } catch (err) {
          // Two purchases racing for the same IMEI: the unique index decides.
          if (isUniqueViolation(err)) throw conflict('IMEI_EXISTS', `The IMEI ${d.imei} is already in stock`);
          throw err;
        }
        created.push(device);
        for (const fileId of d.photoFileIds) await m.insert(DevicePhoto, { tenantId: p.tenantId, deviceId: device.id, fileId });
        await this.events.record(m, { tenantId: p.tenantId, deviceId: device.id, type: 'proof', title: `Proof of ownership: ${PROOF_LABELS[d.proofType].toLowerCase()}`, detail: `Seller declared ownership${d.proofReference ? `. Ref ${d.proofReference}` : ''}`, actor });
        await this.events.record(m, { tenantId: p.tenantId, deviceId: device.id, type: 'received', title: `Received into ${shop.name}`, detail: `Purchase ${number} from ${seller.name}`, actor });
        await this.events.record(m, { tenantId: p.tenantId, deviceId: device.id, type: 'price_set', title: `Price set to ${naira(d.sellingKobo)}`, actor });
        if (held) await this.events.record(m, { tenantId: p.tenantId, deviceId: device.id, type: 'under_review', title: 'Held for the owner to approve the proof', detail: 'Cannot be sold until approved', actor });
      }

      await this.audit.record(m, {
        tenantId: p.tenantId, actor: { ...actor, role: p.role }, action: 'purchase.recorded', category: 'stock',
        message: `recorded purchase ${number} of ${created.length} phone${created.length === 1 ? '' : 's'} from ${seller.name} for ${naira(total)}`,
        entity: { type: 'purchase', id: purchase.id, label: number }, shop: { id: shop.id, name: shop.name }, after: { number, seller: seller.name, total, payment: input.paymentMethod, imeis: created.map((d) => d.imei) }, meta,
      });
      return this.toDto(purchase, seller.name, shop.name, created);
    });
  }

  get(tenantId: string, id: string): Promise<PurchaseDto> {
    return this.db.run(tenantId, async (m) => {
      const purchase = await m.findOneBy(Purchase, { id });
      if (!purchase) throw notFound('Purchase');
      const seller = await m.findOneByOrFail(Seller, { id: purchase.sellerId });
      const shop = await m.findOneByOrFail(Shop, { id: purchase.shopId });
      const devices = await m.find(Device, { where: { purchaseId: id }, order: { createdAt: 'ASC' } });
      return this.toDto(purchase, seller.name, shop.name, devices);
    });
  }

  businessName(tenantId: string): Promise<string> {
    return this.db.run(tenantId, async (m) => (await m.findOneByOrFail(Tenant, { id: tenantId })).name);
  }

  private toDto(p: Purchase, sellerName: string, shopName: string, devices: Device[]): PurchaseDto {
    return {
      id: p.id, number: purchaseNumber(p.number), sellerId: p.sellerId, sellerName, shopName, paymentMethod: p.paymentMethod, totalKobo: p.totalKobo, paidKobo: p.paidKobo,
      declaredBy: p.declaredBy, declaredAt: p.declaredAt.toISOString(), recordedByName: p.createdByName, createdAt: p.createdAt.toISOString(),
      devices: devices.map((d) => ({ id: d.id, brand: d.brand, model: d.model, storage: d.storage, colour: d.colour, imei: d.imei, costKobo: d.costKobo, status: d.status, proofType: d.proofType })),
    };
  }

  /** A manager buys for their own shop. The owner names the shop. */
  private async shopFor(m: EntityManager, p: Principal, requested?: string): Promise<Shop> {
    const home = p.role === 'owner' ? undefined : (p.shopId ?? undefined);
    const id = home ?? requested;
    if (!id) throw new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'Choose the shop that is buying', { errors: [{ path: 'shopId', message: 'Choose the shop that is buying' }] });
    if (home && requested && requested !== home) throw forbidden('You can only buy for your own shop');
    const shop = await m.findOneBy(Shop, { id });
    if (!shop) throw notFound('Shop');
    return shop;
  }

  private async checkFiles(m: EntityManager, input: PurchaseInput): Promise<void> {
    const wanted = new Map<string, StoredFileRow['kind']>();
    for (const d of input.devices) {
      if (d.proofFileId) wanted.set(d.proofFileId, 'proof');
      for (const id of d.photoFileIds) wanted.set(id, 'device_photo');
    }
    if (wanted.size === 0) return;
    const found = await m.query('SELECT id, kind FROM files WHERE id = ANY($1::uuid[])', [[...wanted.keys()]]) as { id: string; kind: string }[];
    for (const [id, kind] of wanted) {
      if (found.find((f) => f.id === id)?.kind !== kind) throw notFound(kind === 'proof' ? 'Proof document' : 'Photo');
    }
  }

  private async checkImeis(m: EntityManager, input: PurchaseInput): Promise<void> {
    const existing = await m.query('SELECT imei, brand, model FROM devices WHERE imei = ANY($1::char(15)[])', [input.devices.map((d) => d.imei)]) as { imei: string; brand: string; model: string }[];
    if (existing.length) {
      const first = existing[0];
      throw new AppError(HttpStatus.CONFLICT, 'IMEI_EXISTS', `The IMEI ${first.imei} is already in stock as ${first.brand} ${first.model}`, { errors: input.devices.map((d, i) => ({ d, i })).filter(({ d }) => existing.some((e) => e.imei === d.imei)).map(({ i }) => ({ path: `devices.${i}.imei`, message: 'Already in stock. It cannot be added again' })) });
    }
  }
}
