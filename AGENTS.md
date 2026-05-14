# DerLg System Admin — Agent Router

> **READ THIS FIRST.** This file routes you. Do not write code until you've read the AGENTS.md for your domain.

## Project Identity

DerLg Cambodia travel booking platform admin panel. Full-stack app:
- **Frontend**: Next.js 16 + React 19 + Tailwind v4 (`frontend_admin/`)
- **Backend**: NestJS 11 + Prisma 5 + Supabase PostgreSQL (`backend_admin/`)
- **Real-time**: Redis pub/sub + WebSocket
- **Telegram Bot**: node-telegram-bot-api as NestJS module (inside backend)
- **Object Storage**: MinIO (`derlg-minio`) self-hosted in Docker
- **Language**: English only

## Agent Routing

| If the user asks you to work on... | Read this first | Task file |
|-----------------------------------|-----------------|-----------|
| Database schema, Prisma, NestJS APIs, auth guards, admin endpoints, WebSocket gateway, Redis, Bull queues, exports, backups, audit logging | `backend_admin/AGENTS.md` | `docs/tasks/kimi_task_backend.md` |
| Next.js pages, React components, Tailwind UI, shadcn/ui, Zustand, React Query, forms, charts, maps, WebSocket hook | `frontend_admin/AGENTS.md` | `docs/tasks/kimi_task_frontend.md` |
| Telegram Bot, driver PIN auth, `/online`/`/offline` commands, trip assignments, broadcast messaging, bot commands | `backend_admin/AGENTS.md` | `docs/tasks/kimi_task_telegram.md` |
| Architecture docs, specs, README, project-wide docs | `CLAUDE.md` | — |

## Shared Conventions (All Domains)

### API Response Envelope
Every API response follows `{ success, data, message, error }`. The frontend Axios interceptor unwraps this automatically — frontend code receives `data` directly.

### Auth Model
- Access token: JWT 15min in memory
- Refresh token: 7 days in `httpOnly Secure SameSite=Strict` cookie
- Logout increments `users.token_version` → invalidates all tokens
- Admin roles: `SUPER_ADMIN`, `OPERATIONS_MANAGER`, `FLEET_MANAGER`, `SUPPORT_AGENT`
- Two-layer guard: `AdminGuard` (JWT role check) + `AdminRoleGuard` (`admin_users.admin_role`)

### Environment Variables
Shared env vars live in `.env` at project root and each sub-project. See `backend_admin/.env.example` and `frontend_admin/.env.example`.

### Task Files (Source of Truth)
All pending work is documented here. Do not guess scope — read the task file:
- `docs/tasks/kimi_task_backend.md` — 23 backend tasks
- `docs/tasks/kimi_task_frontend.md` — 21 frontend tasks
- `docs/tasks/kimi_task_telegram.md` — 15 Telegram bot tasks

### MinIO (Object Storage)
Self-hosted in Docker (`container_name: derlg-minio`). Not a third-party cloud service. Backend generates presigned URLs; frontend never talks directly to MinIO. Used for: tour images, vehicle photos, hotel images, student verification docs, export files.

### Real-Time Architecture
```
Telegram Bot → POST /v1/telegram/* → NestJS → Redis.publish() → AdminGateway (WebSocket) → Admin UI
```
All real-time events flow through Redis pub/sub. The WebSocket gateway broadcasts to connected admin clients by role.

## Rules

1. **Read your domain's AGENTS.md before writing any code.**
2. **Read the relevant task file before starting work.** Task files define scope, acceptance criteria, and file structure.
3. **Follow existing conventions.** Do not introduce new patterns without checking the domain AGENTS.md.
4. **Minimal changes.** Implement exactly what the task specifies. No extra features.
5. **Update task files.** Mark completed tasks `[ ]` → `[x]` when done.
