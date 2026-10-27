import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Two ways to reach the database:
 * - `run(tenantId, fn)`: one transaction as the dscims_app role with app.tenant_id set, so row-level security
 *   confines every query to that dealer (AUTH-1).
 * - `system(fn)`: the owner connection, which sees every dealer. Only for sign-in, token redemption and the
 *   platform console, where there is no tenant yet or the caller is the platform.
 */
@Injectable()
export class TenantDb {
  constructor(private readonly dataSource: DataSource) {}

  run<T>(tenantId: string, fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    if (!UUID.test(tenantId)) throw new Error('A tenant id is required');
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SET LOCAL ROLE dscims_app');
      await manager.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      return fn(manager);
    });
  }

  system<T>(fn: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(fn);
  }
}
