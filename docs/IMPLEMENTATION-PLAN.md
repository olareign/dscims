# Implementation plan

Phases for building d-scims. Scope comes from [PRD.md](PRD.md) (requirement IDs in brackets); live status is in [IMPLEMENTATION.md](IMPLEMENTATION.md). Phases 1 to 5 deliver the PRD's MVP and map to its roadmap stages 1 to 5. Phases 6 and 7 are the PRD's Phase 2 and Phase 3.

## The cycle (every phase)

1. **Design.** Screens for the phase are designed on the Claude design canvas, phone-first (360 px), and shared as a link.
2. **Review and approve.** The product owner reviews and approves, or sends changes. No implementation starts before approval.
3. **Implement.** API and web ship together as vertical slices.
4. **Test.** The gates below must pass.
5. **Deploy.** Web to Vercel, API with Postgres and Redis to Render. Then the next phase starts at step 1.

### Frontend and backend stay in sync

- **One contract.** Request and response schemas live in `packages/shared` (zod) and are used by the API's validation and by the web's forms and fetchers. The API's OpenAPI doc (`/docs`) is generated from the same DTOs.
- **Vertical slices.** A feature is done only when its endpoint, its screen and a test that exercises both exist. No endpoint ships without a screen that uses it, and no screen ships on mocked data.
- **Same-phase migration.** Each phase's migration, API change and web change deploy together. Deploy order: migration, then API, then web. API changes inside a phase are additive, so the previous web build keeps working during rollout.
- **Phase gate.** A phase is closed only when every item in its exit checklist is ticked in `IMPLEMENTATION.md`.

### Test gates (every phase)

- `pnpm lint`, `pnpm build`, `pnpm test` green in CI.
- Unit tests for new rules; unhappy paths covered (empty, boundary, permission failure, duplicate submit).
- Tenant-isolation e2e for every new table and endpoint (AUTH-1).
- Migrations e2e: a database built from `scripts/migrations/*.sql` matches the entities.
- Role checks: each endpoint tested for owner, manager, staff and anonymous; cost and profit never returned to non-owners.
- Browser smoke on a 360 px viewport for the phase's main flow.
- Manual check on a real low-end Android phone before closing a phase (installed PWA).

### Deploy targets

| Part | Host | Notes |
|---|---|---|
| Web (`apps/web`) | Vercel | Project root `apps/web`; env `API_URL`, `NEXT_PUBLIC_SITE_URL` |
| API (`apps/api`) | Render web service | Docker image from the root `Dockerfile` (`api` target); health check `/health` |
| Postgres | Render Postgres | Daily backups, 30-day retention (PRD section 8); RLS enabled per table |
| Redis | Render Key Value | BullMQ queues |
| Config | `render.yaml` blueprint + Vercel project settings | Secrets set in the hosts, never committed |

Environments: local, staging, production (PRD 9.4). Staging deploys on merge to `main`; production is promoted by hand after the phase checklist is signed off.

## Phase 1: Foundation (roadmap stage 1)

Goal: a dealer owner can be set up, sign in on a phone, add staff and shops, and see an audit trail, inside an installable app shell that later phases fill.

| Backend | Frontend |
|---|---|
| Migration 001: tenants, shops, users, settings, audit log, sessions; RLS policies and tenant context per request [AUTH-1] | Login by email, forgot and reset password [AUTH-2] |
| Email and password login with rate limiting, reset by email, invite-by-email for new users, JWT with server-side revocation. No phone number in auth [AUTH-2, AUTH-4] | First-run setup for the owner: shop details with optional "use my location" address fill, discount limit, credit rules, receipt text (PRD design principle 4) |
| Fixed roles via `@dscims/shared` capability matrix; guard on every route [AUTH-3] | App shell: bottom navigation on phones, role-aware menu, later sections shown as "coming soon", offline banner, install prompt [PWA-1, PWA-2, PWA-5] |
| Users: add, edit, deactivate; deactivated sessions rejected within 1 minute [AUTH-4] | Users (owner): searchable, filterable, paginated list; invite; deactivate |
| Shops: create, edit [AUTH-1] | Shops screen (owner) |
| Append-only audit log for create, update, delete and login events [AUTH-5] | Audit log (owner): search, filters by type, date, person and shop, pagination; all times in AM/PM with date and WAT |
| Platform admin: create and suspend tenants, read-only grace period [PLAT-1] | Platform console (separate route, platform-admin only) |
| Idempotency-key middleware for later create endpoints [PWA-4 foundation] | Client helper that attaches idempotency keys and keeps local drafts |
| Tenant-isolation test harness reused by every later phase | Accessible, large-target form components |

Design deliverable: login, reset, first-run setup, app shell and navigation per role, users, shops, audit log, platform console, offline state, installed-app splash.

Status: **built and tested locally; deploy files prepared in [DEPLOY.md](DEPLOY.md), not yet deployed.**

Exit: owner onboarded on a phone from a Vercel/Render staging URL; staff cannot see owner-only screens or fields; deactivation locks a user out within a minute; audit log shows the actions; PWA installs on Android.

## Phase 2: Inventory, sellers and purchases (stage 2)

Goal: record what is bought, from whom, with proof of ownership, and track each device.

- **Backend:** devices with IMEI Luhn check and per-tenant uniqueness, conditions, status lifecycle and `DeviceEvent`s, quantity items, photos and private uploads with signed URLs, proof of ownership types (with owner approval for certificate and police/government credentials), flags and owner resolution, sellers with encrypted NIN/BVN and statement upload, purchases with declaration and purchase receipt [INV-1 to INV-8, SELL-1 to SELL-4, DOC-3].
- **Frontend:** inventory list and search, device detail with timeline, flag and resolve flow, seller registration and profile, guided purchase flow (seller, devices, proof, declaration, payment).
- **Exit:** a purchase creates devices and a receipt; a flagged device is blocked from the picker; cost price hidden from staff in UI and API.

## Phase 3: Sales, credit, returns and receipts (stage 3)

- **Backend:** one-screen sale with atomic status change, discount limit approval, split payments, credit accounts and derived balances, staff-recorded payments, debtors list with daily overdue job, returns with manager approval, PDF receipts with gap-free numbers and QR verification page, share links, void and reissue [SALE-1 to SALE-4, CRED-1 to CRED-4, RET-1 to RET-4, DOC-1, DOC-2, DOC-4].
- **Frontend:** sale screen (under 30 seconds), credit sale and ledger, record payment, debtors list, return flow, receipt viewer and share, public receipt verification page.
- **Exit:** the same IMEI cannot be sold twice under concurrent requests; ledger balance equals sales minus payments; a void keeps its receipt number.

## Phase 4: Reports, evidence and demo (stage 4)

- **Backend:** dashboard aggregates, sales, stock aging, debtors, purchases by seller, returns and flagged reports with CSV and PDF export, owner-only profit, device timeline API, evidence pack PDF with export logging, evidence immutability, demo tenant seed and 24-hour reset job, demo role switching [REP-1 to REP-5, TRACE-1 to TRACE-3, DEMO-1 to DEMO-5].
- **Frontend:** dashboard, report screens with filters and export, evidence pack export, landing page with one-tap demo, role switcher, five-step guided walkthrough.
- **Exit:** every flow in PRD section 6 can be tried on demo data; dashboard loads in under 3 seconds; search under 2 seconds at 50,000 devices.

## Phase 5: Pilot hardening (stage 5)

- **Backend and frontend together:** pilot dealer onboarding and opening stock entry, performance tuning on 3G-class connections, backup restore test, monitoring and error tracking, security review of auth, uploads, field encryption and RLS, data-protection notices and consent capture at registration, terms and receipt wording, fixes from the one-week parallel run [PRD 10.2, section 8].
- **Exit:** pilot dealer runs a full week with no paper records (PRD MVP exit criterion).

## Phase 6: Open to other dealers (PRD Phase 2, weeks 15 to 22)

Self-signup with 14-day trial, plans and limits, subscriptions and invoices, seller and customer portals, customer online payment, SMS and WhatsApp receipts and reminders, offline queue, CSV import, branch transfers, NIN/BVN provider verification, daily owner summary [PLAT-2 to PLAT-6, SELL-5, SELL-6, CRED-5 to CRED-7, DOC-5, PWA-3, INV-9, INV-10, REP-6, DEMO-6]. Split into sub-phases (billing, portals and payments, messaging, offline) when this phase is designed.

## Phase 7: Growth (PRD Phase 3)

Barcode and IMEI scanner, warranty tracking, stock counts, accounting exports, reservations, other electronics trades [INV-11, SALE-5].

## Dependencies on open questions

| Question | Needed by |
|---|---|
| Production domain and brand assets | Phase 1 deploy |
| Pilot dealer details | Phase 2 design (fields, volumes) |
| Payment gateway, SMS and WhatsApp providers | Phase 6 (SMS password reset moves there) |
| NIN/BVN verification provider | Phase 6 |
| Retention period, legal review | Phase 5 |
