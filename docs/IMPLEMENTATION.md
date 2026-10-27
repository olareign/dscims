# Implementation status

Updated 2026-10-27 (Phase 1 deployed; Phase 2 built and tested, deploy pending). [PRD.md](PRD.md) is the scope; this file records what exists in code. Tick a row when it ships with tests, and name the module that owns it.

Legend: `[x]` done, `[ ]` not started. Priority: P0 MVP, P1 Phase 2, P2 Phase 3.

## Phase 1: Foundation (deployed)

- [x] Migration `001-foundation.sql`: tenants, shops, users, sessions, tokens, settings, audit log, platform admins, idempotency keys; row-level security on every tenant table; append-only audit log
- [x] API: email and password sign-in with lockout, invites, password reset, session revocation; users, shops, settings, audit log, dashboard overview; platform console (create, suspend, reactivate dealers)
- [x] Web: sign-in, forgot and reset password, invite acceptance, first-run setup, overview, users, shops (with "use my location"), audit log, sales rules, your account (change password), more menu, platform console; phone, tablet and desktop layouts
- [x] Tests: 27 shared, 66 API (including tenant isolation, roles, migrations), 8 web. Browser smoke test of onboarding on tablet, phone and desktop widths
- [x] Deploy files: `render.yaml`, `apps/web/vercel.json`, `Dockerfile`, [DEPLOY.md](DEPLOY.md)
- Not done in Phase 1: Lighthouse installability run, real-device Android check, global search (shown in the design, removed because nothing is searchable yet), local drafts

## Phase 2: Stock, sellers and purchases (built and tested)

Design: https://claude.ai/artifact/AY1Zbftw8zFe4Ye7T7z9Cu (sections 6 to 9), approved 2026-10-27.

- [x] Migration `002-stock-sellers-purchases.sql`: files, sellers, purchases, devices, device photos, flags, device events; row-level security on all; append-only device timeline; unique IMEI per dealer; `stock` audit category
- [x] API: `documents/uploads` (private files on Cloudinary, JPG/PNG/PDF up to 10 MB, type checked by content), `parties/sellers` (NIN/BVN encrypted with `FIELD_ENCRYPTION_KEY`, last 4 only), `inventory/devices` (list, search, counts, detail with timeline, edit, photos, flag, resolve, approve proof), `transactions/purchases` (one transaction: numbered purchase, devices, timeline, audit; idempotent; PDF receipt)
- [x] Web: stock list (tabs, filters, paging), device detail (history, flag/resolve, approve proof, photos), edit, sellers list/register/profile, guided purchase (four steps on phone and tablet, one page with a summary on desktop), purchase recorded + PDF
- [x] Tests: 37 shared, 123 API (including cost hiding for staff, proof approval, flags, shop scope, tenant isolation, append-only timeline), 14 web. Browser walkthrough: register seller, buy, flag, staff view, phone width
- Not done in Phase 2: INV-4 quantity items (accessories) and DOC-3 uploads of other documents (not in the approved design), a Share button on the purchase receipt, CSV export on stock, seller edit

## Scaffold (done)

- [x] Monorepo (pnpm, Turborepo), CI workflow, Dockerfile, Postgres + Redis compose
- [x] `apps/api`: bootstrap, config, database module, BullMQ root, health endpoint, empty modules for PRD 9.3
- [x] `apps/web`: Next.js 16, Tailwind 4, PWA manifest, service worker, offline page and banner, placeholder icons
- [x] `packages/shared`: roles matrix, device vocabulary, IMEI Luhn check, kobo helpers (with tests)

## Requirements

Owner module is where the work belongs (API path under `apps/api/src`).

| ID | P | Owner module | Done |
|---|---|---|---|
| AUTH-1 tenant isolation + RLS | P0 | core/tenants, database | [x] |
| AUTH-2 login, reset, rate limit (email only, no SMS) | P0 | core/auth | [x] |
| AUTH-3 fixed roles, cost hidden from staff | P0 | core/auth + shared | [x] cost, seller and proof are left out of API responses for staff |
| AUTH-4 deactivate user | P0 | core/users | [x] |
| AUTH-5 audit log | P0 | core/audit | [x] |
| INV-1, INV-1a device + proof of ownership | P0 | inventory/devices | [x] |
| INV-2 conditions | P0 | inventory/devices | [x] |
| INV-3 status lifecycle | P0 | inventory/devices | [x] |
| INV-4 quantity items | P0 | inventory/devices | [ ] |
| INV-5 photos | P0 | documents/uploads | [x] (up to 6, compressed in the browser before upload) |
| INV-6 search | P0 | inventory/devices | [x] |
| INV-7 flags | P0 | inventory/flags | [x] |
| INV-8 resolve flags | P0 | inventory/flags | [x] |
| INV-9 CSV import | P1 | inventory/devices | [ ] |
| INV-10 branch transfer | P1 | inventory/devices | [ ] |
| INV-11 stock count | P2 | inventory/devices | [ ] |
| SELL-1 seller registration | P0 | parties | [x] |
| SELL-2 purchase | P0 | transactions/purchases | [x] |
| SELL-3 declaration | P0 | transactions/purchases | [x] |
| SELL-4 seller history | P0 | parties | [x] |
| SELL-5 NIN/BVN provider check | P1 | parties | [ ] |
| SELL-6 seller portal | P1 | parties | [ ] |
| SALE-1 one-screen sale | P0 | transactions/sales | [ ] |
| SALE-2 discount limit | P0 | transactions/sales | [ ] |
| SALE-3 profit (owner only) | P0 | transactions/sales | [ ] |
| SALE-4 staff + shop on sale | P0 | transactions/sales | [ ] |
| SALE-5 reserve | P2 | transactions/sales | [ ] |
| CRED-1 credit sale | P0 | transactions/credit | [ ] |
| CRED-2 staff-recorded payment | P0 | transactions/payments | [ ] |
| CRED-3 customer ledger | P0 | transactions/credit | [ ] |
| CRED-4 debtors list | P0 | transactions/credit | [ ] |
| CRED-5 online payment | P1 | transactions/payments | [ ] |
| CRED-6 reminders | P1 | notifications | [ ] |
| CRED-7 customer portal | P1 | transactions/credit | [ ] |
| DOC-1 PDF receipts + QR | P0 | documents/receipts | [ ] |
| DOC-2 share link | P0 | documents/receipts | [ ] |
| DOC-3 uploads | P0 | documents/uploads | [x] (seller IDs, proof documents, device photos) |
| DOC-4 void and reissue | P0 | documents/receipts | [ ] |
| DOC-5 WhatsApp receipts | P1 | notifications | [ ] |
| RET-1..RET-4 returns | P0 | transactions/returns | [ ] |
| TRACE-1 device timeline | P0 | inventory/events | [x] |
| TRACE-2 evidence pack PDF | P0 | documents/evidence-packs | [ ] |
| TRACE-3 evidence immutability | P0 | inventory/events, core/audit | [x] (device timeline and audit log are append-only) |
| REP-1 dashboard | P0 | reporting | [ ] |
| REP-2..REP-5 reports | P0 | reporting | [ ] |
| REP-6 daily summary | P1 | notifications | [ ] |
| PWA-1 installable | P0 | web (manifest, sw) | [x] scaffold; Lighthouse check pending |
| PWA-2 offline shell + banner | P0 | web | [x] scaffold; verify on device |
| PWA-3 offline queue | P1 | web | [ ] |
| PWA-4 drafts + idempotency keys | P0 | web + api | [x] idempotency keys on create endpoints; local drafts later |
| PWA-5 one-handed 360px layout | P0 | web | [x] Phase 1 screens; check each later phase |
| DEMO-1..DEMO-5 demo tenant | P0 | demo | [ ] |
| DEMO-6 load demo into tenant | P1 | demo | [ ] |
| PLAT-1 create/suspend tenants | P0 | billing/platform | [x] |
| PLAT-2..PLAT-6 plans, billing, trial, support access | P1 | billing | [ ] |

## Known gaps

- PWA icons are solid navy placeholders. Replace with brand assets before the pilot.
- Service worker registers in production builds only; installability has not been checked with Lighthouse yet.
- Receipt counters (gap-free numbers) are not built yet; they arrive with sales in Phase 3.
