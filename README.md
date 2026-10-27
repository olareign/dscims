# d-scims

Phone dealer inventory, sales, credit ledger and device provenance for Nigerian dealers. An installable PWA on a multi-tenant NestJS + Next.js stack, structured like KudiBooks.

Product scope lives in [`docs/PRD.md`](./docs/PRD.md) (v0.2). Requirement IDs in code comments (for example `INV-7`, `SALE-1`) refer to that file.

## Structure

```
apps/
  web/      Next.js 16 PWA (Tailwind 4, Phosphor icons)
  api/      NestJS 12 modular monolith (TypeORM + PostgreSQL + BullMQ)
packages/
  shared/   Zod schemas, roles, API types, date/paging helpers, IMEI and kobo helpers shared by web and api (built to dist/)
docs/       PRD, engineering handbook, data model, status tracker, demo spec
```

## Getting started

```bash
docker compose up -d                  # Postgres :5456, Redis :6381
cp apps/api/.env.example apps/api/.env
# Set JWT_SECRET and FIELD_ENCRYPTION_KEY to the output of: openssl rand -hex 32
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev                              # builds shared, then runs both apps via Turborepo

# one-time: create a platform admin, then sign in at /platform/login and create a dealer
PLATFORM_ADMIN_PASSWORD='<12+ characters>' pnpm --filter api platform-admin ops@example.com "Ops Team"
```

- API: http://localhost:3006 (Swagger docs at `/docs`, health at `/health`)
- Web: http://localhost:3001

Ports are offset from KudiBooks (3005/3000/5455/6380) so both can run side by side.

## Verification

```bash
pnpm lint
pnpm build
pnpm test            # shared unit tests + API suites (API needs Postgres up)
```

The API test runner creates a disposable `dscims_test_*` database and drops it afterward; it never touches the application database.

## Where to read next

1. [`docs/IMPLEMENTATION-PLAN.md`](./docs/IMPLEMENTATION-PLAN.md): phases and the design, approve, build, test, deploy cycle.
2. [`docs/ENGINEERING-HANDBOOK.md`](./docs/ENGINEERING-HANDBOOK.md): conventions that matter.
3. [`docs/DEPLOY.md`](./docs/DEPLOY.md): Vercel and Render setup.
4. [`docs/IMPLEMENTATION.md`](./docs/IMPLEMENTATION.md): status of every PRD requirement.
5. [`docs/DECISIONS.md`](./docs/DECISIONS.md): scaffold decisions and open questions.
