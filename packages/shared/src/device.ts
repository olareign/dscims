// Vocabulary from PRD sections 5.2 and 7. Dealers' own words are used for labels.
export const DEVICE_STATUSES = ['in_stock', 'reserved', 'sold', 'returned', 'under_review', 'flagged', 'written_off'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const DEVICE_CONDITIONS = ['brand_new', 'uk_used', 'nigeria_used', 'open_box', 'refurbished', 'faulty'] as const;
export type DeviceCondition = (typeof DEVICE_CONDITIONS)[number];

// INV-1a: receipt is the default; the other two are rare and need a document.
export const PROOF_OF_OWNERSHIP_TYPES = ['receipt', 'certificate_of_ownership', 'police_or_government_credentials'] as const;
export type ProofOfOwnershipType = (typeof PROOF_OF_OWNERSHIP_TYPES)[number];

export const FLAG_TYPES = ['reported_stolen', 'police_case', 'government_case', 'security_concern', 'customer_complaint', 'other'] as const;
export type FlagType = (typeof FLAG_TYPES)[number];

export const FLAG_OUTCOMES = ['cleared', 'released_to_authority', 'written_off'] as const;
export type FlagOutcome = (typeof FLAG_OUTCOMES)[number];

// INV-7: a device in one of these states cannot be sold, reserved or transferred.
export function isSellable(status: DeviceStatus): boolean {
  return status === 'in_stock';
}

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  in_stock: 'In stock', reserved: 'Reserved', sold: 'Sold', returned: 'Returned', under_review: 'Under review', flagged: 'Flagged', written_off: 'Written off',
};
export const DEVICE_CONDITION_LABELS: Record<DeviceCondition, string> = {
  brand_new: 'Brand new', uk_used: 'UK-used', nigeria_used: 'Nigeria-used', open_box: 'Open-box', refurbished: 'Refurbished', faulty: 'Faulty',
};
export const PROOF_LABELS: Record<ProofOfOwnershipType, string> = {
  receipt: 'Purchase receipt', certificate_of_ownership: 'Certificate of ownership', police_or_government_credentials: 'Police or government credentials',
};
export const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  reported_stolen: 'Reported stolen', police_case: 'Police case', government_case: 'Government case', security_concern: 'Security concern', customer_complaint: 'Customer complaint', other: 'Other',
};
export const FLAG_OUTCOME_LABELS: Record<FlagOutcome, string> = { cleared: 'Cleared', released_to_authority: 'Released to authority', written_off: 'Written off' };

/** INV-1a: a certificate or police/government credentials hold the phone for the owner's approval. */
export function proofNeedsApproval(type: ProofOfOwnershipType): boolean {
  return type !== 'receipt';
}

export const PAYMENT_METHODS = ['cash', 'transfer', 'part'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cash: 'Cash', transfer: 'Transfer', part: 'Part payment' };

export const MAX_DEVICE_PHOTOS = 6;

/** The most one phone can be priced at: ₦100 million, in kobo. Anything above is almost surely a typing slip. */
export const MAX_PRICE_KOBO = 100_000_000_00;
