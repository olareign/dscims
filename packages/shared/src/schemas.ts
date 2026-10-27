import { z } from 'zod';
import { DEVICE_CONDITIONS, DEVICE_STATUSES, FLAG_OUTCOMES, FLAG_TYPES, MAX_DEVICE_PHOTOS, PAYMENT_METHODS, PROOF_OF_OWNERSHIP_TYPES, proofNeedsApproval } from './device.js';
import { isValidImei } from './imei.js';
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
  category: z.enum(['sign_in', 'security', 'user', 'settings', 'stock']).optional(),
  actorId: z.string().uuid().optional(),
  shopId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const dealerListQuery = pageQuery.extend({
  status: z.enum(['active', 'suspended', 'locked']).optional(),
  sort: z.enum(['newest', 'name']).default('newest'),
});

// ---- Phase 2: sellers, devices, purchases ----
const digits = (v: string) => v.replace(/[\s-]/g, '');
/** Nigerian mobile numbers, stored as 11 digits starting with 0 (so +234 803 456 7812 and 0803 456 7812 match). */
export const phone = z
  .string()
  .trim()
  .transform((v) => digits(v).replace(/^\+?234/, '0'))
  .pipe(z.string().regex(/^0\d{10}$/, 'Enter an 11-digit phone number, like 0803 456 7812'));

const elevenDigits = (label: string) =>
  z.string().trim().transform(digits).pipe(z.string().regex(/^\d{11}$/, `${label} is 11 digits`)).optional().or(z.literal('').transform(() => undefined));

export const sellerInput = z.object({
  name,
  phone,
  address: z.string().trim().min(5, 'Enter the seller\'s address').max(300),
  nin: elevenDigits('NIN'),
  bvn: elevenDigits('BVN'),
  idFileId: z.string().uuid().optional().nullable(),
});

export const sellerListQuery = pageQuery.extend({
  tag: z.enum(['flagged', 'no_id']).optional(),
  sort: z.enum(['name', 'recent']).default('name'),
});

const kobo = z.number().int('Use a whole number of kobo').min(1, 'Enter an amount').max(100_000_000_00);
const shortText = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const purchaseDeviceInput = z
  .object({
    imei: z.string().trim().refine(isValidImei, 'That IMEI is not valid. Dial *#06# and check all 15 digits'),
    brand: z.string().trim().min(2, 'Enter the brand').max(60),
    model: z.string().trim().min(1, 'Enter the model').max(80),
    storage: shortText(20),
    colour: shortText(40),
    condition: z.enum(DEVICE_CONDITIONS),
    costKobo: kobo,
    sellingKobo: kobo,
    proofType: z.enum(PROOF_OF_OWNERSHIP_TYPES).default('receipt'),
    proofNote: shortText(300),
    proofReference: shortText(80),
    proofAuthority: shortText(120),
    proofFileId: z.string().uuid().optional().nullable(),
    photoFileIds: z.array(z.string().uuid()).max(MAX_DEVICE_PHOTOS).default([]),
  })
  .superRefine((d, ctx) => {
    if (!proofNeedsApproval(d.proofType)) return;
    if (!d.proofFileId) ctx.addIssue({ code: 'custom', path: ['proofFileId'], message: 'Add a photo or scan of the document' });
    if (!d.proofReference) ctx.addIssue({ code: 'custom', path: ['proofReference'], message: 'Enter the document or reference number' });
    if (!d.proofAuthority) ctx.addIssue({ code: 'custom', path: ['proofAuthority'], message: 'Enter who issued it' });
  });

export const purchaseInput = z
  .object({
    sellerId: z.string().uuid(),
    shopId: z.string().uuid().optional(),
    devices: z.array(purchaseDeviceInput).min(1, 'Add at least one phone').max(20, 'Add up to 20 phones in one purchase'),
    paymentMethod: z.enum(PAYMENT_METHODS),
    paidKobo: z.number().int().min(0).optional(),
    declaration: z.literal(true, { errorMap: () => ({ message: 'The seller must confirm the declaration' }) }),
    declaredBy: z.string().trim().min(2, 'Type the seller\'s name as their signature').max(120),
  })
  .superRefine((p, ctx) => {
    const imeis = p.devices.map((d) => d.imei);
    if (new Set(imeis).size !== imeis.length) ctx.addIssue({ code: 'custom', path: ['devices'], message: 'The same IMEI is listed twice' });
    const total = p.devices.reduce((sum, d) => sum + d.costKobo, 0);
    if (p.paymentMethod === 'part' && (p.paidKobo === undefined || p.paidKobo >= total)) {
      ctx.addIssue({ code: 'custom', path: ['paidKobo'], message: 'For a part payment, enter an amount less than the total' });
    }
  });

export const deviceListQuery = pageQuery.extend({
  status: z.enum(DEVICE_STATUSES).optional(),
  condition: z.enum(DEVICE_CONDITIONS).optional(),
  shopId: z.string().uuid().optional(),
  brand: z.string().trim().max(60).optional(),
  age: z.enum(['over60']).optional(),
  sort: z.enum(['newest', 'oldest', 'price_high', 'price_low']).default('newest'),
});

export const deviceUpdateInput = z.object({
  brand: z.string().trim().min(2).max(60).optional(),
  model: z.string().trim().min(1).max(80).optional(),
  storage: shortText(20).optional(),
  colour: shortText(40).optional(),
  condition: z.enum(DEVICE_CONDITIONS).optional(),
  sellingKobo: kobo.optional(),
  costKobo: kobo.optional(),
});

export const flagInput = z.object({
  type: z.enum(FLAG_TYPES),
  reference: shortText(80),
  note: z.string().trim().min(3, 'Say what you saw or heard').max(500),
});
export const resolveFlagInput = z.object({
  outcome: z.enum(FLAG_OUTCOMES),
  note: z.string().trim().min(3, 'A note is required to resolve a flag').max(500),
});
export const addPhotoInput = z.object({ fileId: z.string().uuid() });
export const imeiCheckQuery = z.object({ imei: z.string().trim().max(20) });
export const fileKindInput = z.object({ kind: z.enum(['seller_id', 'device_photo', 'proof']) });

export type SellerInput = z.infer<typeof sellerInput>;
export type SellerListQuery = z.infer<typeof sellerListQuery>;
export type PurchaseInput = z.infer<typeof purchaseInput>;
export type PurchaseDeviceInput = z.infer<typeof purchaseDeviceInput>;
export type DeviceListQuery = z.infer<typeof deviceListQuery>;
export type DeviceUpdateInput = z.infer<typeof deviceUpdateInput>;
export type FlagInput = z.infer<typeof flagInput>;
export type ResolveFlagInput = z.infer<typeof resolveFlagInput>;

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
