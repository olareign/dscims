import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { accessFor } from '@dscims/shared';
import type { Capability, Role } from '@dscims/shared';
import { AppError, accessEnded, forbidden, unauthenticated } from '../../common/errors.js';
import { CAN_KEY, PLATFORM_KEY, PUBLIC_KEY } from '../../common/decorators.js';
import '../../common/auth.types.js';

export interface TokenPayload {
  sub: string;
  typ: 'user' | 'platform';
  tid?: string;
  sid?: string;
}

interface SessionRow {
  revoked_at: Date | null;
  expires_at: Date;
  user_status: 'active' | 'invited' | 'deactivated';
  role: Role;
  shop_id: string | null;
  name: string;
  email: string;
  tenant_status: 'active' | 'suspended';
  grace_ends_at: Date | null;
}

// Locked dealers can still ask who they are and sign out, so the web can explain what happened.
const ALLOWED_WHEN_LOCKED = new Set(['/auth/me', '/auth/logout']);

/**
 * Checks the token, then the session row on every request, so turning a user off or revoking a session
 * takes effect immediately (AUTH-4 asks for under a minute). Also enforces suspended (read-only) and locked dealers.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthenticated();

    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(header.slice(7));
    } catch {
      throw unauthenticated('Your session has expired. Sign in again.');
    }

    if (this.reflector.getAllAndOverride<boolean>(PLATFORM_KEY, targets)) {
      if (payload.typ !== 'platform') throw forbidden();
      const rows: { id: string; email: string; name: string }[] = await this.dataSource.query(
        'SELECT id, email, name FROM platform_admins WHERE id = $1',
        [payload.sub],
      );
      if (!rows[0]) throw unauthenticated();
      req.platform = { adminId: rows[0].id, email: rows[0].email, name: rows[0].name };
      return true;
    }

    if (payload.typ !== 'user' || !payload.sid || !payload.tid) throw unauthenticated();
    const rows: SessionRow[] = await this.dataSource.query(
      `SELECT s.revoked_at, s.expires_at, u.status AS user_status, u.role, u.shop_id, u.name, u.email,
              t.status AS tenant_status, t.grace_ends_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN tenants t ON t.id = s.tenant_id
        WHERE s.id = $1 AND s.user_id = $2 AND s.tenant_id = $3`,
      [payload.sid, payload.sub, payload.tid],
    );
    const row = rows[0];
    if (!row || row.revoked_at || new Date(row.expires_at) <= new Date()) throw unauthenticated('Your session has ended. Sign in again.');
    if (row.user_status === 'deactivated') throw accessEnded();
    if (row.user_status !== 'active') throw unauthenticated();

    const locked = row.tenant_status === 'suspended' && row.grace_ends_at !== null && new Date(row.grace_ends_at) <= new Date();
    if (locked && !ALLOWED_WHEN_LOCKED.has(req.path)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'TENANT_LOCKED', 'This account is locked. Contact Pacifylabs.');
    }
    if (row.tenant_status === 'suspended' && !['GET', 'HEAD'].includes(req.method) && req.path !== '/auth/logout') {
      throw new AppError(HttpStatus.FORBIDDEN, 'TENANT_READ_ONLY', 'This account is read-only for now. Contact Pacifylabs.');
    }

    req.principal = {
      userId: payload.sub,
      tenantId: payload.tid,
      sessionId: payload.sid,
      role: row.role,
      shopId: row.shop_id,
      name: row.name,
      email: row.email,
      tenantStatus: row.tenant_status,
    };
    return true;
  }
}

/** Enforces @Can(capability) with the role matrix from @dscims/shared. Default is deny for owner-only routes that forget a decorator? No: routes without @Can are open to any signed-in user. */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const capability = this.reflector.getAllAndOverride<Capability | undefined>(CAN_KEY, [context.getHandler(), context.getClass()]);
    if (!capability) return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.principal || accessFor(req.principal.role, capability) !== 'Y') throw forbidden();
    return true;
  }
}
