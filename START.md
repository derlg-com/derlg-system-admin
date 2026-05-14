# 🚀 DerLg System Admin — Quick Start Guide

> **For beginners.** This guide will get the full stack running on your machine in minutes.

---

## 📋 What You Need First

Make sure these are installed on your computer:

| Tool | Purpose | Check Command |
|------|---------|---------------|
| **Node.js** (v20+) | Runs JavaScript code | `node --version` |
| **npm** (v9+) | Package manager | `npm --version` |
| **Docker** | Runs Redis & MinIO | `docker --version` |
| **Docker Compose** | Manages containers | `docker compose version` |

> 💡 **Don't have them?** Install [Node.js](https://nodejs.org) (comes with npm) and [Docker Desktop](https://www.docker.com/products/docker-desktop/).

---

## 🗂️ Project Structure

```
derlg-system-admin/
├── backend_admin/      ← NestJS API (port 5001)
├── frontend_admin/     ← Next.js app (port 5000)
├── docker-compose.yml  ← Redis + MinIO config
├── start.sh            ← One-click start (optional)
└── START.md            ← You are here!
```

---

## ⚡ Fastest Way: One-Command Start

If you just want everything running **right now**:

```bash
# 1. Go to project folder
cd derlg-system-admin

# 2. Run the startup script
./start.sh
```

Done! Wait ~10 seconds, then open [http://localhost:5000](http://localhost:5000).

---

## 🐢 Manual Way: Step-by-Step

Use this if you want to understand what each part does.

### Step 1 — Start Docker Containers

These are your local databases (Redis + MinIO):

```bash
cd derlg-system-admin
docker compose up -d
```

**Verify they're running:**
```bash
docker ps
```

You should see:
- `derlg-redis` → port **6379**
- `derlg-minio` → ports **9000** (API) and **9001** (web console)

---

### Step 2 — Start the Backend

The backend is the API server. It connects to Supabase (PostgreSQL), Redis, and MinIO.

```bash
cd backend_admin

# Install packages (first time only)
npm install

# Build the code
npm run build

# Start the server
node dist/src/main
```

**Verify it's working:**
```bash
curl http://localhost:5001/v1/health
```

You should see a JSON response with all services green ✅.

> 📝 The backend runs on **port 5001**.

---

### Step 3 — Start the Frontend

The frontend is the web dashboard you see in your browser.

Open a **new terminal window** (keep the backend running):

```bash
cd frontend_admin

# Install packages (first time only)
npm install

# Start the dev server
npm run dev
```

**Open your browser:**
👉 [http://localhost:5000](http://localhost:5000)

> 📝 The frontend runs on **port 5000**.

---

## ✅ How to Know It's Working

| Check | What to do | Expected Result |
|-------|-----------|-----------------|
| Docker | `docker ps` | `derlg-redis` and `derlg-minio` show "healthy" |
| Backend | `curl http://localhost:5001/v1/health` | JSON with `"success": true` |
| Frontend | Open browser → `http://localhost:5000` | See "DerLg Admin Panel" login page |
| MinIO UI | Open browser → `http://localhost:9001` | MinIO login screen |

---

## 🛑 How to Stop Everything

### Option A — The Easy Way
```bash
./stop.sh
```

### Option B — Manual Way

**Stop the frontend:** Press `Ctrl + C` in the frontend terminal.

**Stop the backend:** Press `Ctrl + C` in the backend terminal.

**Stop Docker:**
```bash
docker compose down
```

---

## 🔧 Common Issues

### "Port 5000 is already in use"
Something else is using port 5000. Find and stop it:
```bash
lsof -i :5000
# Then kill the process ID shown
```

### "Port 5001 is already in use"
Same fix:
```bash
lsof -i :5001
# Then kill the process ID shown
```

### "Docker command not found"
Make sure Docker Desktop is running before you start.

### "npm install fails"
Make sure your Node.js version is 20 or higher:
```bash
node --version
```

### Backend shows "Prisma connection failed"
The `.env` file in `backend_admin/` should already have the correct Supabase URL. Don't change it unless you know what you're doing.

---

## 📡 Service Ports Quick Reference

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `http://localhost:5000` | Admin dashboard UI |
| Backend API | `http://localhost:5001/v1` | API endpoints |
| Redis | `localhost:6379` | Caching / real-time |
| MinIO API | `localhost:9000` | File storage API |
| MinIO Console | `http://localhost:9001` | File storage web UI |

---

## 🆘 Still Stuck?

1. Check the logs:
   - Backend: `cat logs/backend.log`
   - Frontend: `cat logs/frontend.log`
2. Make sure Docker is running
3. Try `./stop.sh` then `./start.sh` again

---

Happy coding! 🎉
