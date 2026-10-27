# PRD: d-scims — Phone Dealer Inventory & Transaction App

Version 0.2 · 2026-10-27

Changes from v0.1: added Flagged status and flag records, proof of ownership (including certificate or police/government-approved credentials), shop address and NIN/BVN/statement of account for sellers, PWA requirements, a prebuilt demo account, a simplicity-first section with trimmed scope, both online and staff-recorded credit payments, pricing recommendation, SCIMS reuse map, and removal of the partnership, funding and IMEI blacklist items.

## 1. Overview

d-scims is a simple web app (installable as a PWA) that lets Nigerian phone dealers and electronics traders track every device from purchase to sale, keep a verifiable ownership trail, run a credit-sale ledger, and issue receipts. It is a specialised product built on the SCIMS platform, multi-tenant so any dealer can subscribe. The first release targets one pilot dealer, then opens to other dealers on monthly or annual plans.

### 1.1 Problem

- Dealers record stock, purchases and credit sales in notebooks, WhatsApp chats and spreadsheets, so stock counts and debtor balances drift.
- Dealers buy devices from individuals and other dealers with no reliable record of who sold what; this exposes them when a device is stolen or disputed and the police trace it to their shop.
- Staff can see or alter more than they should, and owners cannot audit who sold or discounted what.
- Customers who buy on credit dispute balances because payments are not logged consistently.

### 1.2 Vision

Be the simplest system of record for a phone dealer's inventory, money owed, and device provenance: usable by a shop attendant with no training beyond a 15-minute walkthrough.

### 1.3 Objectives

| # | Objective | Measure |
| --- | --- | --- |
| O1 | Replace manual stock records | 100% of devices in stock carry an IMEI/serial record within 30 days of onboarding |
| O2 | Create a defensible ownership trail | Every purchase captures seller verification and a proof of ownership |
| O3 | Control credit exposure | Outstanding balance visible per customer in under 3 taps; overdue list generated daily |
| O4 | Control staff access | Owner sees an audit log of every sale, edit, discount, flag and void |
| O5 | Stay simple | A new staff member records a sale unaided after the demo walkthrough; a sale takes under 30 seconds |
| O6 | Prove commercial viability | At least 10 paying dealers within 6 months of public launch (target to be revisited) |

### 1.4 Success metrics

- Weekly active tenants and weekly active staff users per tenant.
- Devices recorded per tenant per week; share of sales with a receipt issued.
- Credit recovery rate: payments received against credit sales within 30 days.
- Demo-to-trial and trial-to-paid conversion; monthly recurring revenue and churn.
- Support tickets per tenant per month.

### 1.5 Commercial arrangement

The business and ownership arrangement is handled outside this document and does not affect the product requirements. Hosting and infrastructure costs are managed by Pacifylabs and are not covered here.

## 2. Design principles: keep it simple

Simplicity is a requirement, not a preference. Every feature in this PRD is judged against these rules.

1. **Three jobs first:** buy a device, sell a device, collect a debt. If a screen does not serve one of these or the owner's oversight of them, it waits.
2. **Few taps, few fields:** a sale is a single screen; a purchase is a short guided flow. Only fields needed for the record are required; rare ones (ownership certificate, flag details) appear only when needed.
3. **Fixed roles, no permission matrix to configure:** Owner, Manager, Sales staff. No custom roles in the MVP.
4. **Sensible defaults:** the owner sets discount limit, credit rules and receipt text once during setup, and everything else follows.
5. **Plain language:** labels use dealers' words (In stock, Sold, Owing, Flagged), with no accounting jargon.
6. **One way to do each thing:** no duplicate screens or alternative paths.
7. **Learn by doing:** a prebuilt demo account with sample data lets anyone understand the flow in minutes (section 4.11).
8. **Cut before adding:** features in Phase 2 and 3 are not built until the MVP is used daily by the pilot dealer.

Deliberately left out: online storefront, full accounting, repairs and parts, marketplace, and custom role builders.

## 3. Users, personas and permissions

### 3.1 Personas

| Persona | Who they are | Main need |
| --- | --- | --- |
| Dealer owner | Shop owner, often with 1 to 3 shops | Know stock, cash and debts at any time; audit staff; resolve flags |
| Manager | Trusted senior staff | Run daily sales and purchases; approve returns |
| Sales staff | Shop attendant | Record sales fast, check device availability |
| Seller (individual or dealer) | Person or business selling devices to the shop | Proof the shop bought from them; view their own records (Phase 2) |
| Credit customer | Buyer paying in instalments | See balance and payment history; pay online if they choose (Phase 2) |
| Platform admin | Pacifylabs team | Create tenants, manage plans, support, monitor health |

### 3.2 Role permissions (fixed roles)

Key: Y = allowed, N = not allowed, A = allowed with approval from a higher role.

| Capability | Owner | Manager | Sales staff |
| --- | --- | --- | --- |
| View inventory | Y | Y | Y |
| Add or edit device | Y | Y | A |
| Record purchase from seller | Y | Y | A |
| Record cash, transfer or POS sale | Y | Y | Y |
| Record credit sale | Y | Y | A |
| Discount above set limit | Y | A | N |
| Raise a flag on a device or seller | Y | Y | Y |
| Resolve a flag | Y | N | N |
| Void sale or process return | Y | A | N |
| See cost price and profit | Y | N | N |
| View reports | Y | Limited | N |
| Manage users | Y | N | N |
| View audit log | Y | N | N |

Seller and customer portals (Phase 2) only show the person's own records.

### 3.3 Platform roles

- **Platform admin:** manages tenants, plans, billing status; cannot read a tenant's business data without a logged, time-limited support grant from that tenant.
- **Support agent:** read-only access under a tenant's support grant.

## 4. Scope and phasing

| Phase | Contents | Exit criterion |
| --- | --- | --- |
| MVP (pilot dealer live) | Tenants and login, fixed roles, inventory with IMEI and ownership proof, status lifecycle including Flagged, flags, seller registration with verification, purchases, sales, credit ledger, returns, receipts (generated and uploaded), audit log, basic reports, PWA, prebuilt demo account | Pilot dealer runs a full week with no paper records |
| Phase 2 (open to other dealers) | Self-signup with 14-day trial, plans and billing, seller and customer portals, customer online payment, SMS/WhatsApp receipts and reminders, offline queue, CSV import, branch transfers | 10 dealers onboarded and paying |
| Phase 3 (growth) | Barcode/IMEI scanner, warranty tracking, stock counts, accounting exports, expansion to other electronics and trades | Retention above target |

### Out of scope

- Online storefront or marketplace for end customers.
- Holding customer funds: online payments settle directly to the dealer's account through the payment gateway.
- Repairs and parts management; full double-entry accounting.
- IMEI blacklist or stolen-device database checks.
- Native iOS and Android apps (the PWA covers mobile).

## 5. Functional requirements

Priority: P0 = MVP, P1 = Phase 2, P2 = Phase 3.

### 5.1 Tenancy, login and access (AUTH)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| AUTH-1 | Each dealer is an isolated tenant with one or more shops | P0 | A user in one tenant can never read or write another tenant's data, verified by automated tests |
| AUTH-2 | Login by email plus password; password reset by email. Phone numbers are not used for authentication (changed 2026-10-27) | P0 | Failed logins are rate-limited |
| AUTH-3 | Three fixed roles as in section 3.2 | P0 | A Sales staff user cannot see cost price in the UI or API responses |
| AUTH-4 | Owner can deactivate a user instantly | P0 | Deactivated user's sessions are rejected within 1 minute |
| AUTH-5 | Audit log of create, update, delete, discount, void, flag and login events | P0 | Entries are append-only and show user, time, shop, before and after |

### 5.2 Inventory (INV)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| INV-1 | Record a device with brand, model, storage, colour, IMEI 1 and 2 or serial, condition, cost price, selling price, shop, status, and **proof of ownership** | P0 | IMEI is 15 digits and passes the Luhn check; duplicate IMEI within a tenant is blocked |
| INV-1a | Proof of ownership types: **Receipt** (default), **Certificate of ownership**, or **Police/government-approved credentials** (rare; used when no receipt exists) | P0 | A purchase cannot be completed without one proof type. Certificate and police/government credentials require an uploaded document, document or reference number, and issuing authority; these also require owner approval |
| INV-2 | Conditions: Brand new, UK-used, Nigeria-used, Open-box, Refurbished, Faulty | P0 | Condition is filterable and shown on receipts |
| INV-3 | Status lifecycle: **In stock, Reserved, Sold, Returned, Under review, Flagged, Written off** | P0 | Status changes only through a sale, return, flag, or authorised adjustment, each logged |
| INV-4 | Accessories and non-serialised items tracked by quantity | P0 | Quantity cannot go below zero without owner override |
| INV-5 | Attach photos (device, box, IMEI screen) | P0 | Up to 6 images per device, compressed on upload |
| INV-6 | Search by IMEI, model, seller, buyer or receipt number | P0 | Results in under 2 seconds for 50,000 devices |
| INV-7 | Flag a device or seller with a **flag type**: Reported stolen, Police case, Government case, Security concern, Customer complaint, Other | P0 | Flag stores type, reference number (for example a police report number), note, who raised it, and date. A device with an open flag moves to **Flagged** and cannot be sold, reserved or transferred |
| INV-8 | Resolve a flag (owner only) with an outcome: Cleared (returns to its previous status), Released to authority, or Written off | P0 | Resolution note is required; flag and resolution stay in the device timeline permanently |
| INV-9 | Bulk import from CSV with a validation report | P1 | Invalid rows are listed and skipped without blocking valid rows |
| INV-10 | Transfer stock between shops | P1 | Needs sender and receiver confirmation |
| INV-11 | Stock count and reconciliation | P2 | Variance report lists missing and extra devices |

### 5.3 Seller registration and purchases (SELL)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| SELL-1 | Register a seller as individual or dealer with name, phone, residential address, **shop address**, photo of seller, **NIN**, **BVN**, and **statement of account** (uploaded) | P0 | Phone is unique per tenant; NIN and BVN are required; ID and statement files stored privately; NIN and BVN masked in the UI by default |
| SELL-2 | Record a purchase: seller, devices, agreed price, payment method, date | P0 | Creates inventory records and a purchase receipt |
| SELL-3 | Seller declaration: seller confirms the device is theirs and not stolen, by ticked statement plus signature or uploaded signed paper | P0 | A purchase cannot be completed without the declaration and a proof of ownership (INV-1a) |
| SELL-4 | Seller history: all purchases, total value, and flagged items | P0 | Seller profile lists every device ever bought from them |
| SELL-5 | Seller verification: NIN and BVN checked through a licensed verification provider | P1 | Verified or Not verified badge on the seller profile. Until then, details are recorded as entered. Provider and cost to be decided |
| SELL-6 | Seller portal showing their own transactions | P1 | Seller sees only their own records after phone OTP login |

### 5.4 Sales (SALE)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| SALE-1 | Create a sale on one screen: buyer (walk-in or registered), devices, price, discount, payment (cash, transfer, POS, credit, split) | P0 | Selling an In stock device sets it to Sold atomically; the same IMEI cannot be sold twice; a Flagged device cannot be added |
| SALE-2 | Discount limit set once by the owner | P0 | Discount above the limit needs manager or owner approval |
| SALE-3 | Profit per sale from cost price | P0 | Visible only to the Owner |
| SALE-4 | Sale records who made it and from which shop | P0 | Shown on receipt and reports |
| SALE-5 | Reserve a device for a customer | P2 | Reservation expires automatically |

### 5.5 Credit sales and debtors (CRED)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| CRED-1 | Credit sale records customer, total, deposit, balance and due date (optional instalment schedule) | P0 | Customer ID details are captured before credit is approved |
| CRED-2 | **Staff-recorded payment:** staff records a payment against a credit account with method, date and optional proof image | P0 | Balance updates and a payment receipt is issued |
| CRED-3 | Customer ledger: credit sales, payments and balance | P0 | Balance always equals sales minus payments |
| CRED-4 | Debtors list sorted by amount and days overdue | P0 | Overdue computed daily |
| CRED-5 | **Customer online payment:** customer pays through a payment link or customer portal, and the payment is recorded automatically | P1 | Both CRED-2 and CRED-5 are available for the same account; the ledger shows how each payment was made. Funds settle to the dealer's account |
| CRED-6 | Reminders by SMS or WhatsApp before and after due date | P1 | Owner can turn reminders off per customer |
| CRED-7 | Customer portal with balance and payment history | P1 | Customer sees only their own account |

### 5.6 Receipts and documents (DOC)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| DOC-1 | PDF receipts for sales, purchases, payments and returns with the dealer's logo, address, IMEI and terms | P0 | Unique sequential number per tenant and a QR code that opens a verification page |
| DOC-2 | Share receipt by link (WhatsApp, SMS, email) or print | P0 | Link opens without login and shows only that receipt |
| DOC-3 | Upload photos or scans of physical receipts and other documents | P0 | JPG, PNG, PDF up to 10 MB each |
| DOC-4 | Receipts cannot be edited after issue; corrections by void and reissue | P0 | Void keeps the original and links the replacement |
| DOC-5 | Automatic WhatsApp receipt sending | P1 | Depends on the messaging provider |

### 5.7 Returns (RET)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| RET-1 | Return linked to the original sale by receipt number or IMEI | P0 | Shows original price, date, seller and buyer |
| RET-2 | Return reason and refund method (cash, transfer, store credit, reduce credit balance) | P0 | A credit sale return reduces the customer's balance correctly |
| RET-3 | Returned device goes to Under review, then In stock, Flagged or Written off | P0 | Manager approval; every change logged |
| RET-4 | Return receipt issued | P0 | References the original receipt number |

### 5.8 Traceability and evidence (TRACE)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| TRACE-1 | Device timeline by IMEI: bought from whom, proof of ownership, price, date, status and flag changes, sold to whom, returned | P0 | Read-only; each event shows user and time |
| TRACE-2 | Export an evidence pack as PDF for a device or seller | P0 | Includes seller details, proof of ownership, declaration, receipts, photos, flags and timeline |
| TRACE-3 | Evidence records cannot be deleted by tenant users | P0 | Only a logged platform-level process can remove them, subject to the retention policy |

### 5.9 Reports and dashboard (REP)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| REP-1 | Dashboard: today's sales, cash collected, stock count and value, total owed, open flags | P0 | Loads in under 3 seconds |
| REP-2 | Sales report by day, week, month, shop, staff and payment method | P0 | Exportable to CSV and PDF |
| REP-3 | Stock report with aging (0 to 30, 31 to 60, 61 to 90, over 90 days) | P0 | Exportable |
| REP-4 | Debtors, purchases by seller, returns and flagged items | P0 | Exportable |
| REP-5 | Profit report | P0 | Owner only |
| REP-6 | Daily summary to the owner by WhatsApp or email | P1 | Owner picks time and channel |

### 5.10 PWA and mobile experience (PWA)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| PWA-1 | The app is an installable PWA: web manifest, service worker, app icon, standalone display, install prompt on Android and Chrome | P0 | Passes the Lighthouse PWA installability check; works from the home screen on a low-end Android phone |
| PWA-2 | Offline-tolerant shell: app opens without a connection and shows a clear offline banner | P0 | Previously viewed screens load; actions that need the server are disabled with a clear message |
| PWA-3 | Offline queue for sales, purchases and payments, synced when the connection returns | P1 | Queued entries show a pending label; if an IMEI was sold or flagged elsewhere in the meantime, the entry is held for review and never silently overwritten |
| PWA-4 | Drafts are saved locally and retried without creating duplicates | P0 | Idempotency keys on every submission |
| PWA-5 | Touch-friendly layout for phones with large targets | P0 | All MVP flows usable one-handed at 360 px width |

### 5.11 Demo account (DEMO)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| DEMO-1 | A prebuilt demo tenant ("Demo Phones") is available from the landing page and login screen with one tap, no signup | P0 | Visitor lands in the app as the demo owner within 5 seconds |
| DEMO-2 | Sample data covers every flow: about 40 devices across all conditions and statuses (including one Flagged device with a police case), 5 sellers with verification details, 6 customers, cash and credit sales, partial payments, one overdue debtor, one return, one device with a certificate of ownership, issued receipts, and a ready evidence pack | P0 | Every flow in section 6 can be tried end to end on sample data |
| DEMO-3 | Switch between demo roles (Owner, Manager, Sales staff) | P0 | One tap to switch, to see what each role can do |
| DEMO-4 | Guided walkthrough: five short steps (buy, sell, credit and payment, return, evidence pack) with highlights on screen | P0 | Can be skipped and reopened from the help menu |
| DEMO-5 | The demo resets automatically every 24 hours and on demand; it contains only fictitious data | P0 | No real personal data. SMS, WhatsApp and payments are switched off in the demo |
| DEMO-6 | Demo data can also be loaded into a new tenant for training and removed in one tap | P1 | Owner can clear sample data before going live |

### 5.12 Platform administration and billing (PLAT)

| ID | Requirement | Priority | Acceptance criteria |
| --- | --- | --- | --- |
| PLAT-1 | Platform admin creates and suspends tenants | P0 | Suspended tenant is read-only for a grace period, then locked |
| PLAT-2 | Plans with limits (users, shops, devices) | P1 | Limits enforced in UI and API |
| PLAT-3 | Monthly and annual subscriptions through a Nigerian payment gateway, with invoices | P1 | Failed payment triggers reminders, then grace period, then suspension |
| PLAT-4 | 14-day free trial | P1 | Data kept 30 days after trial expiry |
| PLAT-5 | Revenue and usage dashboard for the platform team | P1 | Per-tenant plan, status and usage |
| PLAT-6 | Time-limited support access granted by the tenant | P1 | Every support session is logged and visible to the tenant |

## 6. Key user flows

### 6.1 Buy a device from a seller

1. Staff taps New purchase and finds the seller by phone, or registers them (name, phone, addresses including shop address, photo, NIN, BVN, statement of account).
2. Staff adds each device: IMEI (typed or scanned), brand, model, storage, condition, price, photos.
3. Staff selects the proof of ownership: Receipt (default), or, rarely, Certificate of ownership or Police/government-approved credentials with the document attached.
4. System blocks duplicate IMEIs and warns if the device or seller has an open flag.
5. Seller confirms the declaration (signature on screen or uploaded paper).
6. Staff records payment to the seller.
7. System creates inventory records, a purchase receipt with a QR code and a timeline entry per device.

### 6.2 Sell a device

1. Staff searches the device by IMEI or model and adds it to the sale.
2. Staff picks the buyer (walk-in or registered), confirms price and discount; discounts above the limit ask for approval.
3. Staff picks payment: cash, transfer, POS, split or credit.
4. System marks the device Sold, issues the receipt, and logs staff and shop.

### 6.3 Sell on credit and collect payments

1. Staff picks or registers the customer and captures ID details.
2. Staff enters deposit and due date (optional schedule).
3. System issues the receipt showing deposit and balance and opens the ledger.
4. For each payment, either staff records it, or the customer pays through a payment link (Phase 2) and the system records it.
5. Overdue accounts appear on the debtors list and, in Phase 2, trigger reminders.

### 6.4 Flag a device

1. Any staff member opens the device and taps Flag.
2. Staff picks the type (Reported stolen, Police case, Government case, Security concern, Customer complaint, Other), adds a reference number and a note.
3. Device moves to Flagged and cannot be sold; the owner is notified.
4. The owner later resolves the flag (Cleared, Released to authority, Written off) with a note; the history stays on the timeline.

### 6.5 Process a return

1. Staff finds the original receipt or IMEI.
2. Staff records the reason and refund method; a manager approves.
3. Device moves to Under review; a manager then sets In stock, Flagged or Written off.
4. System issues a return receipt linked to the original and adjusts the customer's credit balance if applicable.

### 6.6 Respond to a dispute or police enquiry

1. Owner searches the IMEI and opens the device timeline.
2. Owner exports the evidence pack.
3. System logs the export with user and time.

## 7. Data model

Every business table carries `tenant_id`, `created_at`, `created_by` and `updated_at`. Money is stored as integer kobo (NGN). Evidence records are append-only.

| Entity | Key fields | Relationships |
| --- | --- | --- |
| Tenant | name, plan, status, branding, is_demo | Has many shops, users |
| Shop | name, address, phone | Belongs to tenant |
| User | name, phone, email, role (owner, manager, staff), status | Belongs to tenant |
| Party | type (seller, customer, both), name, phone, residential address, shop address, photo, NIN, BVN, statement of account file, verification status | Seller on purchases, buyer on sales |
| Device | IMEI 1, IMEI 2, serial, brand, model, storage, colour, condition, cost, price, status, shop, proof of ownership type, proof document, proof reference number, issuing authority | Belongs to a purchase line; may belong to a sale line |
| Flag | target (device or party), type, reference number, note, raised by, raised at, status (open, resolved), outcome, resolution note | Linked to a device or party |
| StockItem | name, quantity, cost, price | Accessories and non-serialised goods |
| Purchase | seller, total, payment method, declaration, date, staff | Has purchase lines and documents |
| Sale | buyer, total, discount, payment type, status, receipt number, staff | Has sale lines and payments |
| CreditAccount | party, total owed, total paid, balance, due date | Linked to credit sales and payments |
| Payment | amount, method (cash, transfer, POS, online), proof image, direction (in or out), recorded by (staff or online), date | Linked to sale, purchase or credit account |
| Return | original sale, reason, refund method, approver, status | Links to device and sale |
| Document | type, file reference, hash, linked entity | Receipts, ID files, proof files, declarations |
| DeviceEvent | device, event type, actor, timestamp, before and after | Powers the device timeline |
| AuditLog | actor, action, entity, before and after, timestamp | Append-only |
| Subscription | plan, period, status, renewal date | Belongs to tenant |

### Rules that must hold

- A device has exactly one current status and at most one open sale line.
- A device with an open flag has status Flagged and cannot be sold, reserved or transferred.
- Credit balance equals sum of credit sales minus sum of payments; it is derived, never edited by hand.
- Receipt numbers are sequential per tenant with no gaps; voids keep their number.
- Deleting a party, device or transaction is a soft delete and is blocked once it has linked evidence.
- Demo tenants can never send real messages or take real payments.

## 8. Non-functional requirements, security and compliance

| Area | Requirement |
| --- | --- |
| Simplicity | Sale in under 30 seconds; a new user completes the demo walkthrough in under 15 minutes |
| Performance | Pages load in under 3 seconds on a 3G-class connection; search under 2 seconds at 50,000 devices per tenant |
| Availability | 99.5% monthly uptime at launch |
| PWA | Installable, offline shell, offline queue in Phase 2 (see section 5.10) |
| Data isolation | Tenant ID enforced in every query; row-level security at the database; automated cross-tenant tests in CI |
| Authentication | Hashed passwords, rate limiting, optional OTP, session revocation |
| Encryption | TLS in transit; encryption at rest; NIN, BVN and ID images in private storage served by short-lived signed URLs; NIN and BVN encrypted at field level |
| Auditability | Append-only audit log and device events; document hashes to detect tampering |
| Backups | Daily backups, 30-day retention, quarterly restore test |
| Localisation | English, Naira (₦) formatting, Africa/Lagos time zone |
| Accessibility | Large touch targets, high contrast, plain language |

### Compliance and legal

- **Data protection:** The app holds personal data including NIN, BVN, bank statements and ID images. It must comply with the Nigeria Data Protection Act 2023: lawful basis and consent captured at registration, privacy notice, access and deletion handling, breach notification, and a documented retention policy. Confirm with a Nigerian lawyer whether registration with the data protection regulator is needed for Pacifylabs as processor and for each dealer as controller.
- **Roles:** Each dealer is the data controller for its own sellers and customers; the platform operator is the processor. A data processing agreement is part of the tenant terms.
- **Sensitive identifiers:** Collect NIN, BVN and statements only for seller verification and credit decisions; mask them in the UI; restrict access to the Owner and Manager.
- **Evidence use:** The app provides records; it does not certify that a device is not stolen. Terms and receipts must say so.
- **Payments:** Use a licensed Nigerian payment gateway; the app never stores card data and does not hold customer funds.
- **Retention:** To be discussed. Working proposal: keep evidence records for 7 years after a tenant leaves, unless the law requires earlier deletion.

## 9. Technical approach

A modular monolith with one shared database and tenant isolation, built to stay simple to run and to reuse as much of SCIMS as possible.

### 9.1 SCIMS reuse map

Based on what scims.app presents publicly (to be confirmed against the SCIMS codebase in the first assessment):

| SCIMS capability | Use in d-scims |
| --- | --- |
| Touch-friendly point of sale with multiple payment methods | Basis for the one-screen sale (SALE-1), with IMEI-based items |
| Branded receipts and WhatsApp receipts | Receipts (DOC-1, DOC-2, DOC-5) |
| Business dashboard and reports | Dashboard and reports (REP-1 to REP-6) |
| Smart inventory and supplier management | Inventory base; suppliers become Sellers with verification |
| Multi-store management | Shops and branch transfers |
| Offline sales with automatic sync | Offline queue (PWA-3) |
| Plans, 14-day trial and billing | Plans, trial and billing (PLAT-2 to PLAT-4) |
| Industry templates by business type | Phone-dealer template and demo data (DEMO-1 to DEMO-6) |
| Staff limits per plan | Plan limits |

New in d-scims (not in SCIMS as described): IMEI-level tracking, proof of ownership, Flagged status and flags, seller verification (NIN, BVN, statement of account), declarations, device timeline, evidence pack, and the credit ledger with online payment.

The first engineering task is a 2 to 3 day assessment confirming, for each row, whether to reuse as shared code, copy and adapt, or rebuild.

### 9.2 Proposed stack

Follows SCIMS where reused. Otherwise:

| Layer | Choice |
| --- | --- |
| Web app | Next.js with TypeScript, Tailwind, installable PWA with service worker |
| API | NestJS (TypeScript), REST with OpenAPI docs |
| Database | PostgreSQL with row-level security by `tenant_id` |
| Cache and jobs | Redis with BullMQ for PDFs, reports, reminders, webhooks |
| Files | S3-compatible private storage with signed URLs |
| Messaging | SMS and WhatsApp Business API provider (to be selected) |
| Payments | Nigerian gateway such as Paystack or Flutterwave (to be selected) |
| Observability | Error tracking, structured logs, uptime monitoring |

### 9.3 Module layout

1. Core: tenants, shops, users, roles, audit log.
2. Parties: sellers and customers, verification documents.
3. Inventory: devices, ownership proof, flags, device events.
4. Transactions: purchases, sales, payments, credit ledger, returns.
5. Documents: receipts, uploads, evidence packs.
6. Reporting.
7. Billing and platform admin.
8. Notifications.
9. Demo: sample data seeding and nightly reset.

### 9.4 Delivery

- Environments: local, staging, production; infrastructure as code.
- CI on every pull request: lint, type check, unit tests, tenant-isolation tests, migration check, PWA installability check.
- Versioned migrations; seed script builds the demo tenant.
- Feature flags for Phase 2 and 3 features.

## 10. Plans, roadmap, risks and open questions

### 10.1 Recommended subscription plans (for now, to be updated later)

SCIMS currently lists Starter at ₦15,000 and Business at ₦35,000 per month, with a 14-day trial. d-scims is a narrower tool without an online store, so it is recommended slightly below those prices. These are recommendations to test, not researched market figures.

| Plan | For | Limits | Price (₦ per month) | Annual (pay for 10 months) |
| --- | --- | --- | --- | --- |
| Starter | Single-shop dealer | 1 shop, 3 users, 1,000 devices | 10,000 | 100,000 |
| Business | Growing dealer | 3 shops, 10 users, 10,000 devices, portals, reminders, online credit payments | 25,000 | 250,000 |
| Enterprise | Large multi-shop trader | Custom limits, priority support | Custom | Custom |

All plans include the 14-day trial and the demo account. Pilot dealer terms are agreed separately.

### 10.2 Onboarding

1. Platform admin creates the tenant (Phase 2: self-signup).
2. Owner opens the demo or loads demo data to learn the flow; staff accounts are added.
3. Opening stock is entered by IMEI or imported by CSV; opening debtor balances are entered as opening entries.
4. One-week parallel run with the old notebook, then cut over.

### 10.3 Roadmap

Estimates assume a small team and reuse of SCIMS parts; re-estimate after the reuse assessment.

| Stage | Weeks | Output |
| --- | --- | --- |
| 0. Discovery | 1 to 2 | Dealer interviews, SCIMS reuse assessment, wireframes, demo script |
| 1. Foundation | 3 to 4 | Tenancy, login, fixed roles, audit log, PWA shell, CI |
| 2. Inventory and parties | 5 to 6 | Devices, ownership proof, flags, sellers with verification, purchases |
| 3. Sales, credit and returns | 7 to 9 | Sales, credit ledger, payments, returns, receipts |
| 4. Reports, evidence and demo | 10 to 11 | Dashboard, reports, timeline, evidence pack, demo tenant and walkthrough |
| 5. Pilot | 12 to 14 | Pilot dealer live, fixes |
| 6. Phase 2 | 15 to 22 | Self-signup, billing, portals, online payment, reminders, offline queue |

### 10.4 Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| App feels complicated | Low adoption | Section 2 rules, fixed roles, demo walkthrough, pilot feedback before adding features |
| Staff resist leaving paper or WhatsApp | Low adoption | Speed-first sale screen, parallel run, owner-driven rollout |
| Poor connectivity in shops | Lost or duplicated entries | PWA offline shell, drafts, idempotent submissions; offline queue in Phase 2 |
| Sensitive data leak (NIN, BVN, statements, IDs) | Legal and reputational damage | Field encryption, private storage, access limits, audit log, breach plan |
| App seen as proof a device is not stolen | Liability | Clear terms and receipt wording; legal review |
| Sellers refuse to give NIN, BVN and statements | Fewer purchases recorded | Clear consent wording; owner decides when to require the rare-case proofs |
| Dealers distrust a cloud system with their margins | Slow sales | Profit visible to Owner only; own-data export; clear privacy terms |
| Price sensitivity | Churn | 14-day trial, annual discount, show value through debtor recovery |

### 10.5 Open questions

- [ ] Which dealer is the pilot, with how many shops, staff and devices in stock?
- [ ] Which payment gateway, SMS provider and WhatsApp provider?
- [ ] Which provider verifies NIN and BVN, and who pays per check (SELL-5)?
- [ ] Data retention period and what happens to data after a tenant cancels (to be discussed, needs legal advice).
- [ ] Final subscription prices (recommended prices above are a starting point).

Resolved in v0.2: product name is d-scims; credit customers can pay online or through staff-recorded payments; no IMEI blacklist check; seller verification uses NIN, BVN and a statement of account; SCIMS reuse is inferred from scims.app and confirmed in the first assessment.
