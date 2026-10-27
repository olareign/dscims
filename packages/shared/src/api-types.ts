import type { Role } from './roles.js';

export type UserStatus = 'active' | 'invited' | 'deactivated';
export type TenantStatus = 'active' | 'suspended' | 'locked';
export type AuditCategory = 'sign_in' | 'security' | 'user' | 'settings';

export const ROLE_LABELS: Record<Role, string> = { owner: 'Owner', manager: 'Manager', staff: 'Sales staff' };
export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = { sign_in: 'Sign-in', security: 'Security', user: 'User', settings: 'Settings' };

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  shopId: string | null;
  shopName: string | null;
  lastSignInAt: string | null;
}

export interface ShopDto {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  isMain: boolean;
  userCount: number;
}

export interface SettingsDto {
  businessName: string;
  discountLimitPercent: number;
  creditDueDays: 14 | 30 | 60;
  receiptText: string;
  onboarded: boolean;
}

export interface MeDto {
  user: UserDto;
  tenant: { id: string; name: string; status: TenantStatus; graceEndsAt: string | null };
  shops: { id: string; name: string }[];
  settings: SettingsDto;
}

export interface AuditEntryDto {
  id: string;
  createdAt: string;
  category: AuditCategory;
  action: string;
  actorName: string;
  actorRole: Role | 'platform' | null;
  message: string;
  shopName: string | null;
  entityLabel: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  userAgent: string | null;
}

export interface OverviewDto {
  users: { total: number; active: number; deactivated: number; invited: number; addedThisMonth: number };
  signedInToday: number;
  failedSignIns24h: number;
  shops: { id: string; name: string; address: string; userCount: number }[];
  roles: { owner: number; manager: number; staff: number };
  signInsByDay: { date: string; count: number }[];
  recent: AuditEntryDto[];
}

export interface DealerDto {
  id: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  shops: number;
  users: number;
  status: TenantStatus;
  createdAt: string;
}

export interface InviteResultDto {
  user: UserDto;
  /** Present only when email is not configured, so the owner can share the link by hand. */
  inviteUrl: string | null;
  emailSent: boolean;
}

export interface ApiErrorBody {
  statusCode: number;
  code?: string;
  message: string | string[];
}
