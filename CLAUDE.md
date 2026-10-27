# d-scims

Read `docs/ENGINEERING-HANDBOOK.md` first, then `docs/PRD.md` for the requirement you are building. Update `docs/IMPLEMENTATION.md` when a requirement ships.

- Monorepo: pnpm + Turborepo. `apps/api` (NestJS 12, ESM, TypeORM), `apps/web` (Next.js 16), `packages/shared`.
- `apps/web` follows `apps/web/AGENTS.md`: this Next.js has breaking changes, read `node_modules/next/dist/docs/` before using an API.
- Simplicity is a requirement (PRD section 2). Do not add features from Phase 2 or 3 unless asked.
- Money is integer kobo. IMEI validation is `isValidImei` from `@dscims/shared`. Roles come from `@dscims/shared`, never re-declared.
- Every tenant table extends `TenantScopedEntity`; every query filters by `tenantId`.
- New behaviour ships with tests; tenant-isolation is tested per module.
- Conventional Commits. No AI attribution in commits, branches or PRs.
