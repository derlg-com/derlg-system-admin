# Backend Agent Guide

> **You are working on the NestJS backend.** Read this before writing any backend code.

## Domain Identity

`backend_admin/` — NestJS 11 API for the DerLg System Admin Panel. Serves all `/v1/admin/*` endpoints, Telegram webhooks, WebSocket gateway, and Redis pub/sub messaging.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 11 |
| Language | TypeScript 5 (strict) |
| ORM | Prisma 5 |
| Database | PostgreSQL (Supabase) |
| Cache / Pub-Sub | Redis (Upstash) |
| Queue | Bull (Redis-backed) |
| Object Storage | MinIO (`derlg-minio`, Docker-hosted) |
| Auth | Passport JWT + custom guards |
| WebSocket | `@nestjs/websockets` + `socket.io` |
| Telegram | `node-telegram-bot-api` |
| Testing | Jest + supertest |

> **Language**: All admin APIs, bot commands, and responses are in **English only**. No i18n framework is used.

## Project Structure

```
backend_admin/
├── prisma/
│   └── schema.prisma           # 7 admin tables + enums (currently empty)
├── src/
│   ├── admin/                  # 13 controllers + 16 services + DTOs + guards
│   ├── telegram/               # Telegram bot module (webhook, commands, handlers)
│   ├── storage/                # MinIO presigned URL service
│   ├── common/                 # Decorators, interceptors, filters, pipes
│   ├── app.module.ts           # Root module — import admin, telegram, storage
│   └── main.ts                 # Bootstrap + global pipes + CORS
└── test/                       # E2E tests
```

## Coding Conventions

### Modules
One feature = one folder under `src/admin/` with `{feature}.controller.ts` + `{feature}.service.ts` + DTOs. Import into `AdminModule`. Register `AdminModule`, `TelegramModule`, `StorageModule` in `AppModule`.

### Prisma
- Models use `snake_case` field names in schema, PascalCase model names.
- Admin-specific models: `drivers`, `driver_assignments`, `vehicle_maintenance`, `admin_users`, `support_tickets`, `broadcast_messages`, `backups`.
- Enums: `DriverStatus`, `MaintStatus`, `AdminRole`.
- Always run `npx prisma migrate dev` after schema changes.
- Use `prisma.$transaction()` for multi-step mutations (driver assignment, booking cancellation).

### API Conventions
- Prefix: `/v1/admin`
- Auth header: `Authorization: Bearer <JWT>`
- Response envelope: `{ success: boolean, data: T, message?: string, error?: string }`
- Pagination: `?page=1&limit=20` → `{ data: T[], meta: { page, limit, total, totalPages } }`
- Filtering: query params (e.g., `?status=AVAILABLE&search=`)
- Sorting: `?sortBy=created_at&order=desc`
- Validation: Zod via `zod-validation-pipe` or class-validator DTOs

### Guards
Apply `@UseGuards(AdminGuard, AdminRoleGuard)` + `@AdminRoles(...)` on every admin controller method. Never skip guards on mutation endpoints.

### Audit Logging
Every `POST`, `PATCH`, `DELETE` in the admin module must be intercepted by `AuditLogInterceptor`. It logs: `admin_user_id`, `action_type`, `affected_resource_id`, `resource_type`, `changed_fields` (JSON diff), `timestamp`.

### Redis Channels
| Channel | Purpose |
|---------|---------|
| `driver_status_changed:{id}` | Driver goes online/offline/busy |
| `admin_events` | Booking created, payment received |
| `emergency_alerts` | SOS/MEDICAL/THEFT/LOST |
| `driver_assignments` | Driver assigned to booking |

### MinIO (Storage)
Backend generates presigned URLs. Frontend never talks to MinIO directly.
- `POST /v1/admin/storage/presigned-upload` — get PUT URL
- `POST /v1/admin/storage/presigned-download` — get GET URL
- `DELETE /v1/admin/storage/:bucket/:objectKey` — delete
- Buckets: `tours`, `vehicles`, `hotels`, `rooms`, `guides`, `verifications`, `exports`

### Testing
- Unit tests: Jest with mocked Prisma (`jest.mock('@nestjs/prisma')`)
- E2E tests: supertest against the running NestJS app
- Test critical paths: driver assignment, emergency response, broadcast delivery

## Task Files

### Backend Tasks
**`docs/tasks/kimi_task_backend.md`** — 23 tasks covering:
- B1: Prisma schema (7 tables + enums + indexes)
- B2–B19: 13 admin API modules (drivers, vehicles, maintenance, assignments, bookings, hotels, guides, emergency, customers, discounts, analytics, users, audit, export/backup, AI monitoring)
- B20: WebSocket gateway with JWT auth and role-based broadcasting
- B21: Redis pub/sub service
- B22–B23: Telegram webhook endpoints and bot module
- B24: Telegram broadcast API with Bull queue
- B25: Unit + integration tests

**Read this file before starting any backend task.** It defines file structure, acceptance criteria, and implementation order.

### Telegram Tasks
**`docs/tasks/kimi_task_telegram.md`** — 16 tasks covering:
- T1–T3: BotFather registration, NestJS module, webhook security
- T4–T5: `/start` registration with PIN, `/online`/`/offline`/`/status`
- T6–T7: Trip assignment notifications, active trip start/complete
- T8–T10: Trip history, earnings, live location, emergency, support
- T11: Admin broadcast messaging with Bull queue
- T13–T14: Message templates + WebSocket events
- T15: Testing and monitoring

**Note:** Telegram is implemented as a NestJS module inside `backend_admin/src/telegram/`. It is NOT a separate service.

## Rules

1. **Always read the task file first.** Do not implement without checking `docs/tasks/kimi_task_backend.md` or `docs/tasks/kimi_task_telegram.md`.
2. **Follow the file structure** defined in the architecture doc (`docs/architecture/admin-system-design.md` §5.5).
3. **Never expose raw Prisma queries** in controllers. All DB access goes through services.
4. **Always wrap mutations in transactions** when multiple tables are affected.
5. **Mark tasks complete** (`[ ]` → `[x]`) in the task file when done.
