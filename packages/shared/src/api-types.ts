import type { DeviceCondition, DeviceStatus, FlagOutcome, FlagType, PaymentMethod, ProofOfOwnershipType } from './device.js';
import type { Role } from './roles.js';

export type UserStatus = 'active' | 'invited' | 'deactivated';
export type TenantStatus = 'active' | 'suspended' | 'locked';
export type AuditCategory = 'sign_in' | 'security' | 'user' | 'settings' | 'stock';

export const ROLE_LABELS: Record<Role, string> = { owner: 'Owner', manager: 'Manager', staff: 'Sales staff' };
export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = { sign_in: 'Sign-in', security: 'Security', user: 'User', settings: 'Settings', stock: 'Stock' };

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

export interface FileDto {
  id: string;
  kind: 'seller_id' | 'device_photo' | 'proof';
  filename: string;
  mime: string;
  bytes: number;
}

export interface DeviceFlagDto {
  id: string;
  type: FlagType;
  reference: string | null;
  note: string;
  raisedByName: string;
  raisedAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
  outcome: FlagOutcome | null;
  resolutionNote: string | null;
}

export interface DeviceEventDto {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  actorName: string;
  createdAt: string;
}

/** Cost, seller and proof fields are left out of the response for sales staff (not just hidden on screen). */
export interface DeviceListItemDto {
  id: string;
  brand: string;
  model: string;
  storage: string | null;
  colour: string | null;
  imei: string;
  condition: DeviceCondition;
  status: DeviceStatus;
  shopId: string;
  shopName: string;
  sellingKobo: number;
  costKobo?: number;
  sellerName?: string | null;
  receivedAt: string;
  ageDays: number;
}

export interface DeviceDto extends DeviceListItemDto {
  purchaseNumber?: string | null;
  sellerId?: string | null;
  proofType?: ProofOfOwnershipType | null;
  proofNote?: string | null;
  proofReference?: string | null;
  proofAuthority?: string | null;
  proofFileId?: string | null;
  proofApproved?: boolean;
  photos: FileDto[];
  openFlag: DeviceFlagDto | null;
  flags: DeviceFlagDto[];
  events: DeviceEventDto[];
}

export interface StockCountsDto {
  all: number;
  in_stock: number;
  flagged: number;
  sold: number;
  returned: number;
  under_review: number;
  over60Days: number;
  /** Only for the owner and managers. */
  stockAtCostKobo?: number;
}

export interface SellerDto {
  id: string;
  name: string;
  phone: string;
  address: string;
  hasId: boolean;
  ninLast4: string | null;
  bvnLast4: string | null;
  deviceCount: number;
  flaggedCount: number;
  lastPurchaseAt: string | null;
}

export interface SellerDetailDto extends SellerDto {
  idFileId: string | null;
  totalKobo: number;
  devices: { id: string; brand: string; model: string; imei: string; status: DeviceStatus; costKobo: number; purchaseNumber: string; receivedAt: string }[];
}

export interface PurchaseDto {
  id: string;
  number: string;
  sellerId: string;
  sellerName: string;
  shopName: string;
  paymentMethod: PaymentMethod;
  totalKobo: number;
  paidKobo: number;
  declaredBy: string;
  declaredAt: string;
  recordedByName: string;
  createdAt: string;
  devices: { id: string; brand: string; model: string; storage: string | null; colour: string | null; imei: string; costKobo: number; status: DeviceStatus; proofType: ProofOfOwnershipType }[];
}

export interface ImeiCheckDto {
  valid: boolean;
  exists: boolean;
  deviceId: string | null;
  message: string | null;
}
