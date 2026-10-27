import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { formatNaira } from '@dscims/shared';
import { DeviceEvent } from '../../core/entities.js';

export interface DeviceEventEntry {
  tenantId: string;
  deviceId: string;
  type: 'received' | 'proof' | 'under_review' | 'proof_approved' | 'edited' | 'price_set' | 'photo_added' | 'flagged' | 'flag_resolved';
  title: string;
  detail?: string | null;
  actor: { id: string | null; name: string };
}

/** Naira without the trailing .00, the way dealers write prices. */
export const naira = (kobo: number) => formatNaira(kobo).replace(/\.00$/, '');

@Injectable()
export class DeviceEventsService {
  /** TRACE-3: events are only ever added, in the same transaction as the change they describe. */
  async record(m: EntityManager, e: DeviceEventEntry): Promise<void> {
    await m.insert(DeviceEvent, { tenantId: e.tenantId, deviceId: e.deviceId, type: e.type, title: e.title.slice(0, 160), detail: e.detail?.slice(0, 300) ?? null, actorId: e.actor.id, actorName: e.actor.name });
  }
}
