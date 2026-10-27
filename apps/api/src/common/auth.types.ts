import type { Role } from '@dscims/shared';

export interface Principal {
  userId: string;
  tenantId: string;
  sessionId: string;
  role: Role;
  shopId: string | null;
  name: string;
  email: string;
  tenantStatus: 'active' | 'suspended';
}

export interface PlatformPrincipal {
  adminId: string;
  email: string;
  name: string;
}

export interface ReqMeta {
  ip: string | null;
  userAgent: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal;
      platform?: PlatformPrincipal;
    }
  }
}
