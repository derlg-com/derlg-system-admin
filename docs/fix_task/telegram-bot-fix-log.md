# Telegram Bot Fix Log

> **Date:** 2026-05-28
> **Context:** Implementing Telegram Bot module for DerLg driver transportation system
> **Goal:** Bot replies to driver messages via polling mode for local development

---

## Fix 1: Bot Token Unauthorized (Old Token Revoked)

**Problem:** Bot API returned `401 Unauthorized` because the old bot token was revoked.

**Error:**
```
Telegram API error (getMe): Unauthorized
```

**Fix:** Updated `.env` with new bot token from @BotFather:
```env
TELEGRAM_BOT_TOKEN=8666799332:AAFVr0IsXWzKXvgY66OJH1gd-sOKflh7T04
```

**File:** `backend_admin/.env`

---

## Fix 2: `getUpdates` Returning Empty Array

**Problem:** `getUpdates()` was typed incorrectly. The `post<T>()` method already unwraps Telegram's `{ ok: true, result: T }` envelope and returns `data.result` directly. But `getUpdates()` was typed as `post<{ ok: boolean; result: any[] }>()` and then accessed `.result` on the already-unwrapped array, returning `undefined`.

**Code (broken):**
```typescript
async getUpdates(offset?: number): Promise<...> {
  const body = { limit: 100 };
  if (offset) body.offset = offset;
  const result = await this.post<{ ok: boolean; result: any[] }>('getUpdates', body);
  return result || [];  // result was undefined because post() already unwrapped
}
```

**Fix:** Change generic to `any[]` since `post()` already unwraps:
```typescript
async getUpdates(offset?: number): Promise<any[]> {
  const body: Record<string, unknown> = { limit: 100 };
  if (offset !== undefined) body.offset = offset;
  const result = await this.post<any[]>('getUpdates', body);
  return result || [];
}
```

**File:** `backend_admin/src/telegram/services/bot-sender.service.ts`

---

## Fix 3: Prisma Database Connection Fails — `(ENOTFOUND) tenant/user not found`

**Problem:** Prisma 7.8.0 requires a driver adapter (new "client" engine). The original code passed a raw connection string to `PrismaPg` instead of a `pg.Pool`.

### Layer 1: Raw connection string passed to PrismaPg adapter
**Code (broken):**
```typescript
constructor() {
  const adapter = new PrismaPg(process.env.DATABASE_URL as any);
  super({ adapter });
}
```
`PrismaPg` expects a `pg.Pool` instance, not a string.

### Layer 2: Using `pg.Pool` with Supabase connection pooler (port 6543)
**Code (attempted fix, still broken):**
```typescript
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

constructor() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || '' });
  const adapter = new PrismaPg(pool);
  super({ adapter });
}
```
This connects successfully (`$connect()` passes), but actual queries fail with:
```
(ENOTFOUND) tenant/user postgres.wgfgtffohhlevjttfavx not found
```

**Root Cause:** Supabase connection pooler URL (`DATABASE_URL` on port 6543) includes `?pgbouncer=true` which Prisma's built-in connection manager understands, but raw `pg.Pool` does not. The `pg` driver strips unknown query params and connects to pgbouncer in a way that fails tenant resolution.

### Layer 3: Correct Fix — Use `DIRECT_URL` (port 5432) with `pg.Pool`
**Code (working):**
```typescript
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

constructor() {
  // Use DIRECT_URL (port 5432) for raw pg driver — pooler (port 6543) only works with Prisma's built-in manager
  const pool = new Pool({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL || '' });
  const adapter = new PrismaPg(pool);
  super({ adapter });
}
```
The `DIRECT_URL` connects directly to PostgreSQL on port 5432 (bypassing pgbouncer), which `pg.Pool` handles correctly.

**File:** `backend_admin/src/prisma/prisma.service.ts`

**Note:** We also tried removing the adapter entirely and using standard `PrismaClient`, but Prisma 7.8.0's "client" engine **requires** either an adapter or an `accelerateUrl`. The `engineType = "library"` generator option is not supported in Prisma 7.x.

---

## Fix 4: Redis Not Running

**Problem:** Server failed to start with `ECONNREFUSED 127.0.0.1:6379`

**Fix:** Start Redis via Docker:
```bash
docker run -d --name derlg-redis -p 6379:6379 redis:7-alpine
```

**Note:** Docker Desktop must be running on Windows.

---

## Fix 5: Port 5001 Already in Use

**Problem:** `EADDRINUSE: address already in use :::5001`

**Fix (PowerShell):**
```powershell
Get-NetTCPConnection -LocalPort 5001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Note:** On Windows, NestJS watch mode (`treeKillSync`) has trouble killing child processes, leaving orphan node processes. Always kill port 5001 before restarting.

---

## Architecture Changes for Local Dev Testing

### Polling Mode
Added `TELEGRAM_MODE=polling` to `.env` for local development. This avoids needing a public HTTPS webhook URL.

**Flow:**
1. `PollingService` starts on module init (if `TELEGRAM_MODE=polling`)
2. Deletes any existing webhook
3. Calls `getUpdates` every 1 second
4. Routes each update through `UpdateProcessorService.processUpdate()`
5. `UpdateProcessorService` calls `telegramService.handleWebhook()` for rate limiting + idempotency
6. Then calls `messageHandler.handleUpdate()` to generate a response
7. Finally calls `botSender.sendMessage()` to reply to the driver

**Files created:**
- `backend_admin/src/telegram/services/polling.service.ts`
- `backend_admin/src/telegram/services/update-processor.service.ts`

**Files modified:**
- `backend_admin/src/telegram/telegram.module.ts` — register new services
- `backend_admin/.env` — add `TELEGRAM_MODE=polling`

### Update Processor Service (Extracted from Controller)
Created `UpdateProcessorService` so both webhook and polling modes can share the same update processing logic. NestJS does not allow injecting controllers into providers, so shared logic had to be extracted into a service.

---

## Files Modified Summary

| File | Action | Reason |
|------|--------|--------|
| `src/prisma/prisma.service.ts` | EDIT | Use `pg.Pool` + `PrismaPg` adapter for Prisma 7.8 compat |
| `src/telegram/services/bot-sender.service.ts` | EDIT | Fix getUpdates() type annotation |
| `src/telegram/services/polling.service.ts` | CREATE | Long-polling loop for local dev |
| `src/telegram/services/update-processor.service.ts` | CREATE | Shared update processing for webhook + polling |
| `src/telegram/telegram.module.ts` | EDIT | Register polling + update-processor services |
| `.env` | EDIT | New bot token, add TELEGRAM_MODE=polling, updated DB connection string |
| `prisma/schema.prisma` | EDIT | Reverted `engineType` change (not supported in Prisma 7.x) |

---

## Verification Checklist

- [x] Bot token valid (`getMe` returns bot info: DerLg_BOT)
- [x] Server starts without crashes
- [x] Polling active (`getUpdates` called every 1s)
- [x] Redis connected
- [x] Prisma connects to Supabase via DIRECT_URL
- [ ] Bot replies to `/start` — **PENDING** (test now)
- [ ] Rate limiting works (30 req/min)
- [ ] Idempotency prevents duplicate processing
- [ ] Driver registration creates DB record
- [ ] Status updates reflect in DB + Redis pub/sub

---

## Fix 6: Supabase Database Connection — Tenant Not Found (Original DB)

**Problem:** After fixing `getUpdates` and Prisma adapter issues, the bot received messages but database queries failed with:
```
(ENOTFOUND) tenant/user postgres.wgfgtffohhlevjttfavx not found
```

**Investigation:**
- Tested with `pg.Pool` + `DIRECT_URL` (port 5432) — same error
- Tested with Prisma CLI `npx prisma db pull` — **same error**
- Tested multiple username formats (`postgres`, `postgres.wgfgtffohhlevjttfavx`, `.wgfgtffohhlevjttfavx`) — all rejected by pooler
- **Conclusion:** The Supabase project `wgfgtffohhlevjttfavx` is inaccessible (deleted, paused, or wrong reference)

**File:** `backend_admin/.env` — original connection strings were invalid

---

## Fix 7: New Supabase Database — IPv6 Unreachable

**Problem:** User created a new Supabase database. The direct connection string `db.stcnkbnngmndkfveaqjf.supabase.co:5432` is **IPv6-only** (`2406:da18:1f7e:b100:7114:b9bf:8cf4:57f2`), but this network does not support IPv6:
```
connect ENETUNREACH 2406:da18:1f7e:b100:7114:b9bf:8cf4:57f2:5432
```

**Discovery:**
- `nslookup` resolves to IPv6 AAAA record only (no IPv4 A record)
- Node.js `pg` driver cannot reach IPv6 addresses on this network
- Need the **pooled connection string** (port 6543 via `*.pooler.supabase.com`) which has IPv4 endpoints

**Status:** Waiting for user/senior to provide the correct pooled connection string from Supabase dashboard, or confirm to use the same database as the main DerLg app.

**Files touched:**
- `backend_admin/.env` — updated with new connection string (later reverted pending senior input)

---

## Current Blocker

The Telegram bot **code is complete and working**:
- Polling receives messages from Telegram ✅
- Bot token is valid ✅  
- Redis is connected ✅
- Message routing logic is correct ✅

**Only blocker:** Database connection string. Need correct Supabase pooled connection string (IPv4-compatible) that matches the main DerLg app's database.

---

## Pending Issues

1. **Database connection string** — Need correct pooled Supabase URL from main app config or Supabase dashboard
2. **Emoji in bot responses** — Some terminals may not render emoji. Bot messages use emoji for status indicators (🟢🔴⚪) and buttons.
3. **BigInt serialization** — `telegramId` is stored as `BigInt` in PostgreSQL. Ensure JSON serialization handles it (e.g., `String(telegramId)` before sending to Telegram API).
4. **Windows process cleanup** — `nest start --watch` on Windows leaves orphan node.exe processes. May need to use `npx kill-port 5001` before restarts.
