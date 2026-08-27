# DerLg System Admin — Agent Router

> **READ THIS FIRST.**

## Project Identity

The admin panel for the DerLg Cambodia travel platform.

**This directory is frontend-only.** The admin API used to live here as a second
NestJS service (`backend_admin/`, port 5001) pointed at its own remote Supabase
project. It has been merged into the main backend and that directory is deleted.

| Layer | Where it lives now |
|-------|--------------------|
| Admin UI | `derlg-system-admin/frontend_admin/` (Next.js 16 + React 19 + Tailwind v4) |
| Admin API | **`backend/src/modules/admin/`** — served at `/v1/admin/*` |
| Telegram driver bot | **`backend/src/modules/telegram/`** — `/v1/telegram/*` |
| Object storage | **`backend/src/modules/storage/`** — `/v1/admin/storage/*` |
| Database | the same local Postgres the public site uses; one `backend/prisma/schema.prisma` |
| Real-time | Redis pub/sub → socket.io gateway at `/v1/admin/ws` |
| Language | English only (the Telegram bot is EN/ZH/KM for drivers) |

## Agent Routing

| Working on… | Read this |
|---|---|
| Admin API endpoints, guards, services, Prisma | `backend/AGENTS.md`, then `backend/src/modules/admin/` |
| Telegram bot, driver PIN auth, broadcasts, queues | `backend/AGENTS.md`, then `backend/src/modules/telegram/` |
| Admin pages, components, Tailwind, Zustand, React Query | `frontend_admin/AGENTS.md` |
| How the merge was done and why | `backend/docs/admin-merge/` |

## Shared Conventions

### API
- Prefix `/v1/admin/*`. Controllers declare `@Controller('admin/...')` — **without**
  a `v1/` segment, because `backend/src/main.ts` already calls
  `setGlobalPrefix('v1')`. Including it produces `/v1/v1/admin/...`, which is how
  13 of the original 18 controllers ended up unreachable.
- Envelope `{ success, data, message, error }`, applied globally by
  `TransformInterceptor`. The frontend axios interceptor unwraps it.
- Wire format is **camelCase**, matching the rest of the backend.
- Pagination `?page=1&limit=20` → `{ data, meta: { page, limit, total, totalPages } }`.

### Auth
One auth system, shared with the public site:
- Sign in via `POST /v1/auth/login` against `users.password_hash` (bcrypt).
  There is no admin-specific credential store, and nothing reads Supabase's
  `auth.users` table any more.
- Access token: JWT, 15 min, signed with `JWT_ACCESS_SECRET`.
- Refresh token: JWT in Redis at `session:{userId}:{tokenId}`, delivered as the
  `derlg_refresh` httpOnly `SameSite=Strict` cookie.
  There is **no `users.token_version` column** — an earlier version of this file
  claimed logout increments one. Logout deletes the Redis session key instead.
- `GET /v1/auth/me` returns the user plus `adminRole` and `permissions`.
- Authorisation is three global guards registered in `common.module.ts`:
  `JwtAuthGuard` → `RolesGuard` → `AdminRoleGuard`. Controllers opt into the
  third with `@AdminRoles(...)`, which checks `admin_users` (cached in Redis for
  5 minutes). `SUPER_ADMIN` bypasses every role check.
- **A controller without `@AdminRoles()` is not admin-protected.** The guard
  passes such routes straight through, so any authenticated customer can reach
  them.

### Role matrix
The sidebar in `frontend_admin/components/admin/AdminSidebar.tsx` mirrors the
`@AdminRoles(...)` decorators one-for-one. Change the backend first, then the
sidebar, or the UI will offer links that answer 403.

| Route | Roles |
|---|---|
| `/v1/admin/dashboard` | all four |
| `/v1/admin/bookings`, `/customers` | SUPPORT_AGENT, OPERATIONS_MANAGER, SUPER_ADMIN |
| `/v1/admin/drivers`, `/vehicles`, `/maintenance`, `/assignments` | FLEET_MANAGER, OPERATIONS_MANAGER, SUPER_ADMIN |
| `/v1/admin/hotels`, `/guides`, `/emergency`, `/discounts`, `/student-verifications`, `/analytics`, `/loyalty`, `/ai-sessions`, `/telegram` | OPERATIONS_MANAGER, SUPER_ADMIN |
| `/v1/admin/users`, `/audit-logs`, export/backup | SUPER_ADMIN |

### Audit logging
`AuditInterceptor` is applied at class level to every admin controller and writes
one `audit_logs` row per POST/PATCH/PUT/DELETE, recording the admin, action,
resource, redacted changed fields, IP and user agent.

### MinIO
Self-hosted in Docker (`derlg-minio`), not a cloud service. The backend issues
presigned URLs; the browser never holds MinIO credentials. Buckets are
allowlisted (`tours`, `vehicles`, `hotels`, `rooms`, `guides`, `verifications`,
`exports`) and object keys are checked for path traversal.

### Real-time
```
Telegram bot / admin API / queue worker
        → Redis publish
        → AdminGateway (socket.io, /v1/admin/ws)
        → admin browsers, filtered by role
```
The gateway authenticates the JWT during `handleConnection` and requires an
active `admin_users` grant. Emergency alerts carry live GPS and go only to
OPERATIONS_MANAGER and SUPER_ADMIN.

## Running it

```bash
# From the repo root — starts backend, web, AI agent and the admin panel
./run-all.sh
./run-all.sh admin     # admin panel only (needs the backend running)
```

| Service | URL |
|---|---|
| Admin panel | http://localhost:4010 |
| Backend API | http://localhost:4007/v1 |
| Public site | http://localhost:4008 |

Sign in with the seeded accounts from `backend/prisma/seeds/12-admin-users.ts`
(`admin@derlg.demo`, `ops@`, `fleet@`, `support@`). The password comes from
`SEED_ADMIN_PASSWORD`, with a development-only fallback.

## Rules

1. **The admin API is part of `backend/`.** Do not recreate a second service.
2. **One schema.** All models live in `backend/prisma/schema.prisma`.
3. **Never run `prisma migrate dev`** here; write the SQL and use `migrate deploy`.
4. **Every new endpoint** needs `@AdminRoles()`, `@Throttle()` and a validated DTO.
5. **Read `backend/docs/admin-merge/`** before changing ported code — it records
   which behaviours were deliberately altered and why.
