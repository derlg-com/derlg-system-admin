#!/bin/bash
set -e

# ============================================================
# DerLg System Admin — Full Stack Startup Script
# ============================================================
# This script starts all required services:
#   1. Docker containers (Redis + MinIO)
#   2. Backend API (NestJS on port 5001)
#   3. Frontend Admin (Next.js on port 5000)
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend_admin"
FRONTEND_DIR="$ROOT_DIR/frontend_admin"

echo "════════════════════════════════════════════════════════════"
echo "  🚀 DerLg System Admin — Startup"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── 1. Start Docker containers ─────────────────────────────
echo "📦 Starting Docker containers (Redis + MinIO)..."
cd "$ROOT_DIR"
docker compose up -d
echo "   ✅ derlg-redis   → localhost:6379"
echo "   ✅ derlg-minio   → localhost:9000 (API) / 9001 (Console)"
echo ""

# ── 2. Wait for services to be ready ───────────────────────
echo "⏳ Waiting for services to be healthy..."
sleep 3

# ── 3. Build Backend ───────────────────────────────────────
echo "🔧 Building backend..."
cd "$BACKEND_DIR"
npm run build > /dev/null 2>&1
echo "   ✅ Backend built"
echo ""

# ── 4. Start Backend ───────────────────────────────────────
echo "🖥️  Starting backend (port 5001)..."
if lsof -i :5001 > /dev/null 2>&1; then
    echo "   ⚠️  Port 5001 already in use. Stopping existing process..."
    lsof -i :5001 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    sleep 1
fi
nohup node "$BACKEND_DIR/dist/src/main" > "$ROOT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "   ✅ Backend started (PID: $BACKEND_PID)"
echo "   📡 API URL: http://localhost:5001/v1"
echo "   📋 Logs:   $ROOT_DIR/logs/backend.log"
echo ""

# ── 5. Start Frontend ──────────────────────────────────────
echo "🎨 Starting frontend (port 5000)..."
cd "$FRONTEND_DIR"
if lsof -i :5000 > /dev/null 2>&1; then
    echo "   ⚠️  Port 5000 already in use. Stopping existing process..."
    lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null || true
    sleep 1
fi
nohup npm run dev > "$ROOT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "   ✅ Frontend started (PID: $FRONTEND_PID)"
echo "   🌐 URL:    http://localhost:5000"
echo "   📋 Logs:   $ROOT_DIR/logs/frontend.log"
echo ""

# ── 6. Save PIDs for shutdown ──────────────────────────────
mkdir -p "$ROOT_DIR/logs"
echo "$BACKEND_PID" > "$ROOT_DIR/logs/backend.pid"
echo "$FRONTEND_PID" > "$ROOT_DIR/logs/frontend.pid"

# ── 7. Wait and verify ─────────────────────────────────────
echo "⏳ Waiting for services to be ready..."
sleep 4

HEALTH_STATUS=$(curl -s http://localhost:5001/v1/health 2>/dev/null || echo "")
if [ -n "$HEALTH_STATUS" ]; then
    echo "════════════════════════════════════════════════════════════"
    echo "  ✅ All services are up and running!"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "  🌐 Frontend:     http://localhost:5000"
    echo "  📡 Backend API:  http://localhost:5001/v1"
    echo "  🗄️  PostgreSQL:  Supabase (Remote)"
    echo "  📦 Redis:        localhost:6379  (derlg-redis)"
    echo "  🪣 MinIO:        localhost:9000  (derlg-minio)"
    echo "  🪣 MinIO UI:     http://localhost:9001"
    echo ""
    echo "  📊 Health Check: curl http://localhost:5001/v1/health"
    echo ""
    echo "  🛑 To stop:      ./stop.sh"
    echo "════════════════════════════════════════════════════════════"
else
    echo "⚠️  Backend health check failed. Check logs:"
    echo "   Backend: $ROOT_DIR/logs/backend.log"
    echo "   Frontend: $ROOT_DIR/logs/frontend.log"
fi
