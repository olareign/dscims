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
