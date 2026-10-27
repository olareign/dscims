# Decisions and open questions

## Scaffold decisions (2026-10-27)

| Decision | Choice | Why |
|---|---|---|
| Structure | Same as KudiBooks: pnpm + Turborepo, `apps/api`, `apps/web`, `packages/shared` | Requested; one mental model across Pacifylabs products |
| Package scope | `@dscims/shared`, DB `dscims_db`, containers `dscims_*` | Avoids clashing with KudiBooks' `ledger` identifiers |
| Ports | API 3006, web 3001, Postgres 5456, Redis 6381 | Run next to KudiBooks (3005, 3000, 5455, 6380) |
| SCIMS reuse | Standalone scaffold; assessment is a documented stage-0 task | No SCIMS code was available |
| Scaffold depth | Skeleton and empty modules; no entities or business logic | Chosen to keep the first review small |
| Web UI | Tailwind 4 + Phosphor icons, mobile-first | Matches KudiBooks; PWA-5 needs 360px layouts |
| Visual brand | Follows scims.app: navy `#0D1B4C`, system UI font, 12px radii | d-scims is a SCIMS product. Replaces the scaffold's placeholder teal when Phase 1 is implemented |
| Deploy | Web on Vercel; API, Postgres and Redis on Render | Chosen 2026-10-27 |
| Phase cycle | Design, approve, implement (API and web together), test, deploy, next phase | See IMPLEMENTATION-PLAN.md |
| Design canvas | Claude design canvas, phone-first plus desktop for admin screens | Phase 1 design: https://claude.ai/artifact/AY1Zbftw8zFe4Ye7T7z9Cu |
| Sign-in | Email and password only. Users are invited by email link. No phone number in auth (SMS reset removed) | Product owner decision, 2026-10-27 (design review). Changes PRD AUTH-2 |
| Shop location | Shop address can be prefilled from the device location, only after the user taps the button and allows it. Needs a reverse-geocoding provider | Design review 2026-10-27 |
| Time display | Every date and time shows day, month, year, hour with AM or PM, and WAT, for example `27 Oct 2026, 9:12 AM WAT`. Stored as UTC | Design review 2026-10-27 |
| Listings | Every list has search, filters, sort and pagination (rows per page on desktop, previous/next on phone) | Design review 2026-10-27 |
| Responsive | Phone under 700 px (tab bar, sheets), tablet 700 to 1099 px (icon rail), desktop 1100 px and up (sidebar) | Design review 2026-10-27 |
| Invites | New users and dealer owners get an email link (24 hours, single use) to set their own password. If the email provider fails, the owner is shown the link to share by hand | Phase 1 build |
| Email | `MAIL_PROVIDER`: Resend in development, SMTP in production, in-memory `fake` for tests. Production refuses `fake` and checks each provider's settings at start-up | Requested 2026-10-27, same pattern as the Àjọ API |
| Hosting (free plans) | Web on Vercel, API on Render free (Docker, migrations run before the server starts), database on Neon free (Frankfurt). No Redis yet: Phase 1 has no queues and Render allows one free Key Value per account | Requested 2026-10-27. Free plans sleep and have short backups; upgrade before real dealer data |
| Geocoder contact | `rolatzarza@gmail.com` in the geocoder User-Agent | Provided 2026-10-27, "for now" |
| Suspension | Read-only for `TENANT_GRACE_DAYS` (default 7), then locked | Default chosen in Phase 1; PRD left the length open. Change the env var, or tell me the number you want |
| Location lookup | Browser coordinates are turned into an address by the API using a Nominatim-compatible endpoint (default OpenStreetMap) | Phase 1 build. OSM is for light use; swap `GEOCODER_URL` for a paid provider as volume grows |
| Shared package | Built to `dist/` with `tsc` | Next's bundler cannot read the `.js`-suffixed TypeScript imports the API needs |
| Phase 1 design departures | Global search and the notification count were left out; the bell opens security activity | Nothing is searchable yet and there is no unread tracking |
| Jobs | BullMQ via `@nestjs/bullmq` | PRD 9.2. KudiBooks uses `@nestjs/schedule` instead |
| Files | S3-compatible via AWS SDK v3 with presigned URLs | PRD 9.2. KudiBooks uses Cloudinary |
| Money | Integer kobo | PRD section 7. KudiBooks uses decimal strings |
| Lint and tests | oxlint, vitest (API), eslint (web) | Same as KudiBooks |
| Left out of KudiBooks copy | MFA, SAML, social, Telegram, exceljs, csv-parse, pdfkit templates | Not in MVP scope; add when a requirement needs them. `pdfkit` and `qrcode` are kept for receipts |

## Open questions (from PRD 10.5)

- [ ] Pilot dealer: shops, staff, devices in stock?
- [ ] Payment gateway, SMS provider, WhatsApp provider?
- [ ] NIN/BVN verification provider and who pays per check (SELL-5)?
- [ ] Data retention period and post-cancellation handling (needs legal advice)?
- [ ] Final subscription prices?
- [ ] Reverse-geocoding provider for the shop location button (Google, Mapbox, or OpenStreetMap Nominatim)?
- [ ] Production domain for `NEXT_PUBLIC_SITE_URL` (currently `http://localhost:3001` in the Dockerfile and CI)?
- [ ] Brand assets: logo and icon files (colour now follows scims.app navy `#0D1B4C`)?
