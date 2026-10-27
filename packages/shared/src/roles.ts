// Fixed roles, no custom role builder in the MVP (PRD section 3.2).
export const ROLES = ['owner', 'manager', 'staff'] as const;
export type Role = (typeof ROLES)[number];

// Y = allowed, N = not allowed, A = allowed with approval from a higher role.
export type Access = 'Y' | 'N' | 'A';

export const CAPABILITIES = [
  'inventory.view',
  'device.write',
  'purchase.record',
  'sale.record',
  'sale.credit',
  'sale.discount_above_limit',
  'flag.raise',
  'flag.resolve',
  'sale.void_or_return',
  'finance.cost_and_profit',
  'reports.view',
  'users.manage',
  'audit.view',
  'shops.manage',
  'settings.manage',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_ACCESS: Record<Capability, Record<Role, Access>> = {
  'inventory.view': { owner: 'Y', manager: 'Y', staff: 'Y' },
  'device.write': { owner: 'Y', manager: 'Y', staff: 'A' },
  'purchase.record': { owner: 'Y', manager: 'Y', staff: 'A' },
  'sale.record': { owner: 'Y', manager: 'Y', staff: 'Y' },
  'sale.credit': { owner: 'Y', manager: 'Y', staff: 'A' },
  'sale.discount_above_limit': { owner: 'Y', manager: 'A', staff: 'N' },
  'flag.raise': { owner: 'Y', manager: 'Y', staff: 'Y' },
  'flag.resolve': { owner: 'Y', manager: 'N', staff: 'N' },
  'sale.void_or_return': { owner: 'Y', manager: 'A', staff: 'N' },
  'finance.cost_and_profit': { owner: 'Y', manager: 'N', staff: 'N' },
  'reports.view': { owner: 'Y', manager: 'A', staff: 'N' }, // manager: "Limited" in the PRD; modelled as A until scoped
  'users.manage': { owner: 'Y', manager: 'N', staff: 'N' },
  'audit.view': { owner: 'Y', manager: 'N', staff: 'N' },
  'shops.manage': { owner: 'Y', manager: 'N', staff: 'N' },
  'settings.manage': { owner: 'Y', manager: 'N', staff: 'N' },
};

export function accessFor(role: Role, capability: Capability): Access {
  return ROLE_ACCESS[capability][role];
}
