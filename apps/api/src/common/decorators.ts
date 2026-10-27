import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Capability } from '@dscims/shared';
import type { PlatformPrincipal, Principal, ReqMeta } from './auth.types.js';
import './auth.types.js';

export const PUBLIC_KEY = 'public';
export const PLATFORM_KEY = 'platform';
export const CAN_KEY = 'capability';

/** No sign-in needed (login, reset, health). */
export const Public = () => SetMetadata(PUBLIC_KEY, true);
/** Platform console routes: need a platform-admin token instead of a dealer token. */
export const PlatformRoute = () => SetMetadata(PLATFORM_KEY, true);
/** Requires the role matrix in @dscims/shared to say Y for this capability. */
export const Can = (capability: Capability) => SetMetadata(CAN_KEY, capability);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): Principal => {
  const req = ctx.switchToHttp().getRequest<Request>();
  if (!req.principal) throw new Error('CurrentUser used on a route without sign-in');
  return req.principal;
});

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext): PlatformPrincipal => {
  const req = ctx.switchToHttp().getRequest<Request>();
  if (!req.platform) throw new Error('CurrentAdmin used on a route without platform sign-in');
  return req.platform;
});

export const Meta = createParamDecorator((_: unknown, ctx: ExecutionContext): ReqMeta => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return { ip: req.ip ?? null, userAgent: (req.headers['user-agent'] ?? '').slice(0, 300) || null };
});
