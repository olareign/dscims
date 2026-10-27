import { CallHandler, ExecutionContext, HttpStatus, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { from, Observable, lastValueFrom } from 'rxjs';
import { IdempotencyKey } from '../core/entities.js';
import { TenantDb } from '../database/tenant-db.js';
import { AppError } from './errors.js';
import { sha256 } from './crypto.js';
import './auth.types.js';

/**
 * PWA-4: a create request retried with the same Idempotency-Key returns the first result instead of creating a
 * second record. Same key with a different body is rejected. Only 2xx results are remembered.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly db: TenantDb) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const key = req.headers['idempotency-key'];
    if (req.method !== 'POST' || typeof key !== 'string' || !req.principal) return next.handle();
    return from(this.handle(req, http.getResponse<Response>(), key.slice(0, 120), next));
  }

  private async handle(req: Request, res: Response, key: string, next: CallHandler): Promise<unknown> {
    const { tenantId, userId } = req.principal!;
    const requestHash = sha256(JSON.stringify({ path: req.path, body: req.body ?? null }));
    const found = await this.db.run(tenantId, (m) => m.findOneBy(IdempotencyKey, { userId, key }));
    if (found) {
      if (found.requestHash !== requestHash) {
        throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'IDEMPOTENCY_KEY_REUSED', 'That Idempotency-Key was already used for a different request');
      }
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(HttpStatus.OK);
      return found.response;
    }
    const result = await lastValueFrom(next.handle());
    await this.db.run(tenantId, (m) => m.getRepository(IdempotencyKey).createQueryBuilder().insert().values({ tenantId, userId, key, requestHash, response: result ?? null }).orIgnore().execute());
    return result;
  }
}
