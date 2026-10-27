# Engineering handbook

Everything a new session (human or AI) needs to be productive without the history of how it got here. Product scope: [PRD.md](PRD.md). Status: [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Layout

| Path | What |
|---|---|
| `apps/api` | NestJS 12, TypeORM, PostgreSQL, BullMQ, ESM. Modules mirror PRD 9.3 |
| `apps/web` | Next.js 16 App Router PWA (read `node_modules/next/dist/docs/` before using an API) |
| `packages/shared` | `@dscims/shared`: zod schemas (the API and web contract), roles and capability matrix, API types, Lagos date formatting, paging helpers, `isValidImei`, kobo helpers. **Built to `dist/`**: run `pnpm --filter @dscims/shared build` (or `pnpm dev`, which watches) after changing it |
| `apps/api/scripts/migrations` | Forward-only `NNN-name.sql` production schema |
| `docker-compose.yml` | Postgres `dscims_postgres` (:5456) and Redis `dscims_redis` (:6381) |

API modules (`apps/api/src`): `core` (tenants, shops, users, auth, audit), `parties`, `inventory` (devices, flags, events), `transactions` (purchases, sales, payments, credit, returns), `documents` (receipts, uploads, evidence-packs), `reporting`, `billing` (+ `platform`), `notifications`, `demo`, plus `health`, `database`, `common`. New modules: `pnpm --filter api exec nest g module <path> --no-spec`.

## Running it

```bash
docker compose up -d
pnpm install
pnpm --filter @dscims/shared build
pnpm --filter api start:dev     # API :3006 (applies migrations on start in development)
pnpm --filter web dev           # web :3001
```

## Checks before calling something done

```bash
pnpm --filter @dscims/shared test
pnpm --filter api lint && pnpm --filter api build
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter web lint && pnpm --filter web build
```

`ECONNREFUSED ::1:5456` in tests means the Postgres container is stopped.

## Conventions that matter

**Tenancy (AUTH-1).** Every business table extends `TenantScopedEntity` (`tenantId`, uuid id, `createdBy`, timestamps). Tenant code reaches the database only through `TenantDb.run(tenantId, fn)`: one transaction that switches to the `dscims_app` role and sets `app.tenant_id`, so row-level security confines every query to that dealer even if a `where` is forgotten. `TenantDb.system(fn)` is the owner connection for sign-in, token redemption and the platform console only. Each new table needs `tenant_id`, an RLS policy and grants in its migration; `test/migrations.e2e-spec.ts` fails if a table has `tenant_id` and no RLS. Every module also ships a cross-tenant e2e test (another dealer's id returns 404, not 403).

**Auth.** Email and password only (no phone). The web keeps the API token in an httpOnly cookie and calls the API from the server (`apps/web/src/lib/api.ts`); the browser never holds the token. The API checks the session row on every request, so turning a user off or revoking a session works immediately. `ZodPipe` validates every body and query with the shared schemas. Lists use `?page&pageSize&search&...` and return `{ items, total, page, pageSize, totalPages }`.

**Dates.** Stored as UTC `timestamptz`. Show people `formatDateTime` and friends from `@dscims/shared` (`27 Oct 2026, 9:12 AM`, Lagos time). Never format dates by hand.

**Money.** Integer kobo only (`Kobo`, `nairaToKobo`, `formatNaira` in shared). Never floats. API amounts are integers in kobo.

**Roles (AUTH-3).** `ROLE_ACCESS` in shared is the single source for the PRD 3.2 matrix. `A` (needs approval) is enforced by an approval request recorded in the audit log, not by hiding buttons. Cost price and profit fields are stripped from API responses for non-owners, not just hidden in the UI.

**Device status.** One current status per device. Changes happen only through a sale, return, flag or authorised adjustment, in a transaction that also writes a `DeviceEvent`. A device with an open flag is `flagged` and cannot be sold, reserved or transferred (`isSellable`). Sale creation locks the device row to stop double sales.

**Evidence is append-only (TRACE-3).** `DeviceEvent`, `AuditLog`, flags, documents and receipts are never updated or hard-deleted by tenant users. Corrections are voids that link a replacement. Documents carry a content hash.

**Receipts (DOC-4).** Sequential per tenant with no gaps (allocate in the same transaction as the sale, from a per-tenant counter row). Voids keep their number. Public receipt links are derived HMAC tokens; only a hash is stored.

**Credit (CRED-3).** Balance is derived from credit sales minus payments, never stored as an editable field.

**Sensitive data.** NIN and BVN are encrypted at field level with `FIELD_ENCRYPTION_KEY` and masked in responses by default; reveal is Owner/Manager only and audited. ID photos, statements and proof documents go to private storage and are served through short-lived signed URLs. Never log these values or full tokens.

**Idempotency (PWA-4).** Every create-transaction endpoint accepts an `Idempotency-Key` header and returns the original result on retry. BullMQ handlers are idempotent with explicit retry/backoff and a dead-letter path.

**Demo (DEMO-5).** `DEMO_MODE=true` requires a database ending in `_demo` and switches off SMS, WhatsApp and payments at the provider layer. Demo data is fictitious only.

**Schema changes.** The schema comes only from `apps/api/scripts/migrations/NNN-*.sql`, applied in order, once each. There is no `synchronize`. Development and tests apply them on start (`RUN_MIGRATIONS=true`); production runs `node dist/database/migrate-cli.js` before the new API version starts. `test/migrations.e2e-spec.ts` fails when an entity column and the database disagree. Never edit an applied migration; add a new one.

**Copy.** Plain dealer words: In stock, Sold, Owing, Flagged. No accounting jargon. Receipts and terms must say the app provides records and does not certify a device is not stolen.

**Commits.** Conventional Commits, small and focused. No AI attribution anywhere.
