# Demo tenant spec ("Demo Phones")

Implements DEMO-1 to DEMO-5. Owned by `apps/api/src/demo`. The seed script does not exist yet; build it as a Nest command that uses the real services, so the demo exercises the real rules.

## Behaviour

- One-tap entry from the landing page and login screen; no signup. Lands as demo Owner within 5 seconds.
- Role switcher: Owner, Manager, Sales staff (DEMO-3).
- Guided walkthrough, five skippable steps, reopenable from the help menu: buy, sell, credit and payment, return, evidence pack (DEMO-4).
- Resets every 24 hours (BullMQ repeatable job) and on demand. Runs only against a database ending in `_demo`.
- SMS, WhatsApp and payments are switched off at the provider layer. Fictitious data only (DEMO-5).

## Seed data (DEMO-2)

| Area | Content |
|---|---|
| Devices | About 40 across every condition and every status; one `flagged` with a Police case and reference number; one with a Certificate of ownership (document, number, issuing authority) |
| Sellers | 5, with NIN, BVN, shop address, photo and statement placeholders (fictitious values) |
| Customers | 6 |
| Sales | Cash, transfer, POS and split sales; credit sales with partial payments; one overdue debtor |
| Returns | One completed return with a return receipt |
| Documents | Issued receipts with QR codes; a ready evidence pack for the flagged device |
| Users | Owner, Manager, Sales staff with one-tap sign-in tokens valid only for the demo tenant |

## Acceptance

Every flow in PRD section 6 can be tried end to end on the sample data. After a reset, counts match this table.
