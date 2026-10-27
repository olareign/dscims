import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './pagination.js';

// One contract for the API (validation) and the web (forms). Auth is email and password only (design review 2026-10-27).
export const email = z.string().trim().toLowerCase().email('Enter a valid email').max(254);

export const password = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number');

export const loginInput = z.object({ email, password: z.string().min(1, 'Enter your password').max(128) });
export const forgotPasswordInput = z.object({ email });
export const resetPasswordInput = z.object({ token: z.string().min(20).max(200), password });
export const acceptInviteInput = resetPasswordInput;
export const changePasswordInput = z.object({ currentPassword: z.string().min(1).max(128), password });

const name = z.string().trim().min(2, 'Enter a name').max(120);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const inviteUserInput = z.object({
  name,
  email,
  role: z.enum(['manager', 'staff']),
  shopId: z.string().uuid(),
});
export const updateUserInput = z.object({
  name: name.optional(),
  role: z.enum(['manager', 'staff']).optional(),
  shopId: z.string().uuid().optional(),
});

export const shopInput = z.object({
  name: z.string().trim().min(2, 'Enter a shop name').max(120),
  address: z.string().trim().min(5, 'Enter the shop address').max(300),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  phone: optionalText(30),
});

export const settingsInput = z.object({
  businessName: z.string().trim().min(2).max(120).optional(),
  discountLimitPercent: z.number().int().min(0).max(100).optional(),
  creditDueDays: z.union([z.literal(14), z.literal(30), z.literal(60)]).optional(),
  receiptText: z.string().trim().min(1).max(600).optional(),
});

export const createDealerInput = z.object({
  businessName: z.string().trim().min(2).max(120),
  ownerName: name,
  ownerEmail: email,
  shopName: z.string().trim().min(2).max(120),
});

export const geocodeQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(100).optional(),
});

export const userListQuery = pageQuery.extend({
  role: z.enum(['owner', 'manager', 'staff']).optional(),
  status: z.enum(['active', 'invited', 'deactivated']).optional(),
  shopId: z.string().uuid().optional(),
  lastSignIn: z.enum(['today', '7d', 'over30d']).optional(),
  sort: z.enum(['name', 'last_sign_in']).default('name'),
});

export const shopListQuery = pageQuery.extend({ sort: z.enum(['name', 'created']).default('name') });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const auditListQuery = pageQuery.extend({
  category: z.enum(['sign_in', 'security', 'user', 'settings']).optional(),
  actorId: z.string().uuid().optional(),
  shopId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const dealerListQuery = pageQuery.extend({
  status: z.enum(['active', 'suspended', 'locked']).optional(),
  sort: z.enum(['newest', 'name']).default('newest'),
});

export type LoginInput = z.infer<typeof loginInput>;
export type InviteUserInput = z.infer<typeof inviteUserInput>;
export type UpdateUserInput = z.infer<typeof updateUserInput>;
export type ShopInput = z.infer<typeof shopInput>;
export type SettingsInput = z.infer<typeof settingsInput>;
export type CreateDealerInput = z.infer<typeof createDealerInput>;
export type UserListQuery = z.infer<typeof userListQuery>;
export type ShopListQuery = z.infer<typeof shopListQuery>;
export type AuditListQuery = z.infer<typeof auditListQuery>;
export type DealerListQuery = z.infer<typeof dealerListQuery>;
