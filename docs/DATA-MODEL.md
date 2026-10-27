# Data model notes

The PRD (section 7) lists the entities. This file records the implementation decisions layered on top. Every table below carries `tenant_id`, `created_at`, `created_by`, `updated_at` (`TenantScopedEntity`) unless stated.

## Conventions

- Primary keys are uuid. Money columns are `bigint` kobo. Timestamps are `timestamptz`; display in Africa/Lagos.
- Enums are stored as `varchar` with a check constraint and mirror the lists in `@dscims/shared` (`device.ts`, `roles.ts`).
- Soft delete (`deleted_at`) for Party, Device and transactions, blocked once linked evidence exists.

## Entities and key constraints

| Entity | Constraints worth encoding |
|---|---|
| Tenant (no `tenant_id`) | `status` active/suspended/locked, `is_demo` flag, `plan` |
| Shop | unique `(tenant_id, name)` |
| User | unique `(tenant_id, phone)` and `(tenant_id, email)`; role in owner/manager/staff; `status` for instant deactivation (AUTH-4) |
| Party | unique `(tenant_id, phone)`; NIN and BVN encrypted columns; `verification_status` default `not_verified` |
| Device | unique `(tenant_id, imei1)`; `imei1` Luhn-valid; one current `status`; proof columns required together per proof type |
| Flag | open flag count drives device status; `outcome` and `resolution_note` required on resolve |
| Sale / SaleLine | partial unique index so a device has at most one open sale line |
| Receipt counter | one row per `(tenant_id, series)`; incremented inside the sale/purchase transaction for gap-free numbers |
| Payment | `direction` in/out; `recorded_by` staff or online; amount > 0 |
| CreditAccount | no stored balance column; balance is a query over credit sales minus payments |
| Document | `sha256`, `storage_key`, `linked_entity_type/id`; append-only |
| DeviceEvent, AuditLog | insert-only; revoke UPDATE/DELETE from the app role |

## Device status transitions

```
in_stock  -> reserved | sold | flagged | written_off | under_review
reserved  -> in_stock | sold | flagged
sold      -> returned
returned  -> under_review
under_review -> in_stock | flagged | written_off
flagged   -> (previous status) on Cleared | written_off on Written off | written_off on Released to authority
```

Any other transition is rejected. `flagged` is entered only by raising a flag and left only by resolving it (owner).

## Row-level security

Each tenant table gets `ENABLE ROW LEVEL SECURITY` and a policy `tenant_id = current_setting('app.tenant_id')::uuid`. The API sets `app.tenant_id` with `SET LOCAL` at the start of every request transaction. The platform admin role is a separate DB role with no blanket read; support access is a logged, time-limited grant (PLAT-6).
