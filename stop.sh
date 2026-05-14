#!/bin/bash

# ============================================================
# DerLg System Admin — Shutdown Script
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOGS_DIR="$ROOT_DIR/logs"

echo "════════════════════════════════════════════════════════════"
echo "  🛑 DerLg System Admin — Shutdown"
echo "════════════════════════════════════════════════════════════"
echo ""

# ── Stop Backend ───────────────────────────────────────────
if [ -f "$LOGS_DIR/backend.pid" ]; then
    BACKEND_PID=$(cat "$LOGS_DIR/backend.pid")
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null && echo "  ✅ Backend stopped (PID: $BACKEND_PID)"
    else
        echo "  ⚠️  Backend was not running"
    fi
    rm -f "$LOGS_DIR/backend.pid"
else
    echo "  🔍 Stopping any backend on port 5001..."
    lsof -i :5001 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null && echo "  ✅ Backend stopped" || echo "  ⚠️  No backend found on port 5001"
fi

# ── Stop Frontend ──────────────────────────────────────────
if [ -f "$LOGS_DIR/frontend.pid" ]; then
    FRONTEND_PID=$(cat "$LOGS_DIR/frontend.pid")
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null && echo "  ✅ Frontend stopped (PID: $FRONTEND_PID)"
    else
        echo "  ⚠️  Frontend was not running"
    fi
    rm -f "$LOGS_DIR/frontend.pid"
else
    echo "  🔍 Stopping any frontend on port 5000..."
    lsof -i :5000 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null && echo "  ✅ Frontend stopped" || echo "  ⚠️  No frontend found on port 5000"
fi

# ── Stop Docker containers ─────────────────────────────────
echo "  📦 Stopping Docker containers..."
cd "$ROOT_DIR"
docker compose down > /dev/null 2>&1 && echo "  ✅ Docker containers stopped" || echo "  ⚠️  Docker containers were not running"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✅ All services stopped"
echo "════════════════════════════════════════════════════════════"
