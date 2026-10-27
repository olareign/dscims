import { Injectable } from '@nestjs/common';
import type { SettingsDto, SettingsInput } from '@dscims/shared';
import type { Principal, ReqMeta } from '../../common/auth.types.js';
import { TenantDb } from '../../database/tenant-db.js';
import { AuditService } from '../audit/audit.service.js';
import { Settings, Tenant } from '../entities.js';

@Injectable()
export class SettingsService {
  constructor(private readonly db: TenantDb, private readonly audit: AuditService) {}

  get(tenantId: string): Promise<SettingsDto> {
    return this.db.run(tenantId, async (m) => {
      const tenant = await m.findOneByOrFail(Tenant, { id: tenantId });
      const settings = await m.findOneByOrFail(Settings, { tenantId });
      return {
        businessName: tenant.name,
        discountLimitPercent: settings.discountLimitPercent,
        creditDueDays: settings.creditDueDays,
        receiptText: settings.receiptText,
        onboarded: tenant.onboardedAt !== null,
      };
    });
  }

  update(p: Principal, input: SettingsInput, meta: ReqMeta): Promise<SettingsDto> {
    return this.db.run(p.tenantId, async (m) => {
      const tenant = await m.findOneByOrFail(Tenant, { id: p.tenantId });
      const settings = await m.findOneByOrFail(Settings, { tenantId: p.tenantId });
      const before = { businessName: tenant.name, discountLimitPercent: settings.discountLimitPercent, creditDueDays: settings.creditDueDays, receiptText: settings.receiptText };
      const after = { ...before, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) };
      const changed = (Object.keys(after) as (keyof typeof after)[]).filter((k) => after[k] !== before[k]);
      if (changed.length === 0) return this.dto(after, tenant.onboardedAt !== null);

      if (after.businessName !== before.businessName) await m.update(Tenant, { id: p.tenantId }, { name: after.businessName, updatedAt: new Date() });
      await m.update(Settings, { tenantId: p.tenantId }, {
        discountLimitPercent: after.discountLimitPercent, creditDueDays: after.creditDueDays, receiptText: after.receiptText, updatedAt: new Date(),
      });
      const message = changed.length === 1 && changed[0] === 'discountLimitPercent'
        ? `changed the discount limit from ${before.discountLimitPercent}% to ${after.discountLimitPercent}%`
        : changed.length === 1 && changed[0] === 'creditDueDays'
          ? `changed the default credit due date from ${before.creditDueDays} to ${after.creditDueDays} days`
          : changed.length === 1 && changed[0] === 'receiptText' ? 'changed the receipt text' : 'updated the business settings';
      await this.audit.record(m, {
        tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'settings.updated', category: 'settings', message,
        entity: { type: 'settings', id: null, label: 'Sales rules' },
        before: Object.fromEntries(changed.map((k) => [k, before[k]])), after: Object.fromEntries(changed.map((k) => [k, after[k]])), meta,
      });
      return this.dto(after, tenant.onboardedAt !== null);
    });
  }

  completeSetup(p: Principal, meta: ReqMeta): Promise<void> {
    return this.db.run(p.tenantId, async (m) => {
      const tenant = await m.findOneByOrFail(Tenant, { id: p.tenantId });
      if (tenant.onboardedAt) return;
      await m.update(Tenant, { id: p.tenantId }, { onboardedAt: new Date(), updatedAt: new Date() });
      await this.audit.record(m, { tenantId: p.tenantId, actor: { id: p.userId, name: p.name, role: p.role }, action: 'setup.completed', category: 'settings', message: 'finished first-run setup', meta });
    });
  }

  private dto(v: { businessName: string; discountLimitPercent: number; creditDueDays: 14 | 30 | 60; receiptText: string }, onboarded: boolean): SettingsDto {
    return { ...v, onboarded };
  }
}
