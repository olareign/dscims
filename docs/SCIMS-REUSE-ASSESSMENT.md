# SCIMS reuse assessment (stage 0 task, 2 to 3 days)

PRD 9.1 infers SCIMS capabilities from scims.app. This scaffold was built standalone from KudiBooks' structure, with no SCIMS code available. Fill in the decision column after reading the SCIMS codebase. Options: **reuse** (shared package), **copy** (adapt), **rebuild**.

| SCIMS capability | d-scims use | SCIMS code location | Decision | Notes |
|---|---|---|---|---|
| Touch-friendly POS, multiple payment methods | One-screen sale (SALE-1) | | | IMEI-based items need a per-unit line |
| Branded receipts, WhatsApp receipts | DOC-1, DOC-2, DOC-5 | | | Needs gap-free numbers and QR verification |
| Dashboard and reports | REP-1 to REP-6 | | | |
| Inventory and supplier management | Inventory base; suppliers become Sellers | | | Sellers need NIN/BVN/statement |
| Multi-store management | Shops, INV-10 | | | |
| Offline sales with sync | PWA-3 | | | Must hold conflicts for review, never overwrite |
| Plans, 14-day trial, billing | PLAT-2 to PLAT-4 | | | |
| Industry templates | Phone-dealer template, demo data | | | |
| Staff limits per plan | Plan limits | | | |

Also record: auth model, tenancy approach (does it use RLS?), ORM, and any licence or ownership constraints on sharing code between products.
