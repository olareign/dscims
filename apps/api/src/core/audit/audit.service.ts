import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import type { Role } from '@dscims/shared';
import type { ReqMeta } from '../../common/auth.types.js';
import { AuditLog } from '../entities.js';

export interface AuditEntry {
  tenantId: string;
  actor: { id: string | null; name: string; role: Role | 'platform' | null };
  action: string;
  category: AuditLog['category'];
  message: string;
  entity?: { type: string; id: string | null; label: string | null };
  shop?: { id: string | null; name: string | null };
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: ReqMeta;
}

@Injectable()
export class AuditService {
  /** Always called inside the same transaction as the change it describes, so the two succeed or fail together. */
  async record(manager: EntityManager, e: AuditEntry): Promise<void> {
    await manager.insert(AuditLog, {
      tenantId: e.tenantId,
      actorId: e.actor.id,
      actorName: e.actor.name,
      actorRole: e.actor.role,
      action: e.action,
      category: e.category,
      message: e.message.slice(0, 300),
      entityType: e.entity?.type ?? null,
      entityId: e.entity?.id ?? null,
      entityLabel: e.entity?.label ?? null,
      shopId: e.shop?.id ?? null,
      shopName: e.shop?.name ?? null,
      before: e.before ?? null,
      after: e.after ?? null,
      ip: e.meta?.ip ?? null,
      userAgent: e.meta?.userAgent ?? null,
    } as QueryDeepPartialEntity<AuditLog>);
  }
}
