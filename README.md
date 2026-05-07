# Project Management Platform — Swiggy SDE-1 Assignment

A Jira-like project management backend built with **Bun + TypeScript + Express + PostgreSQL + Redis + BullMQ + Socket.IO**.

---
## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Framework | Express 5 |
| Database | PostgreSQL 16 |
| ORM | Drizzle ORM |
| Cache / Pub-Sub | Redis (ioredis) |
| Job Queue | BullMQ |
| WebSocket | Socket.IO |
| Validation | Zod |

---

## Running Locally

### Prerequisites
- [Bun](https://bun.sh) >= 1.0
- [Docker](https://www.docker.com) and Docker Compose

---

### Step 1 — Install dependencies

```bash
bun install
```

### Step 2 — Start PostgreSQL and Redis

```bash
docker-compose up -d
```

Starts PostgreSQL on `localhost:5432` and Redis on `localhost:6379`.  
The app itself runs natively via Bun (Step 6) — not inside Docker.

### Step 3 — Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/swiggy
REDIS_URL=redis://localhost:6379
JWT_SECRET=supersecretkey
PORT=3000
```

### Step 4 — Run migrations

```bash
bun run db:migrate
```

Creates all 16 tables in the database.

### Step 5 — Seed the database

```bash
bun run db:seed
```

This populates the DB with ready-to-use test data:

| Resource | Details |
|---|---|
| Users | `alice@example.com` and `bob@example.com` — password: `password123` |
| Workspace | **Acme Engineering** (both users are members) |
| Project | **Consumer App** (`APP`) with default workflow |
| Workflow | Todo → In Progress → In Review → Done (with transitions) |
| Sprint | **Sprint 1** — active |
| Issues | 5 issues across different types, statuses, and assignees |
| Comments | 2 comments on the first issue (one with `@mention`) |

### Step 6 — Start the server

```bash
bun run dev
```

Server starts at `http://localhost:3000` with hot reload.

### Step 7 — Explore the API

Open Swagger UI in your browser:

```
http://localhost:3000/docs
```

Log in with `alice@example.com` / `password123` via `POST /api/auth/login` first — this sets the JWT cookie that all subsequent requests use. Every endpoint in the Swagger UI will then work authenticated.

---

## Available Scripts

```bash
bun run dev          # Start with hot reload
bun run start        # Start without hot reload
bun run db:generate  # Generate migrations from schema changes
bun run db:migrate   # Apply migrations
bun run db:seed      # Seed development data
bun run db:studio    # Open Drizzle Studio (DB GUI)
```
