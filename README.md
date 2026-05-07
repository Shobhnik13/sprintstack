# Project Management Platform — Swiggy SDE-1 Assignment

A Jira-like project management backend built with **Bun + TypeScript + Express + PostgreSQL + Redis + BullMQ + Socket.IO**.

---

## Features

### Core Modules
- **Auth** — Register, login with HttpOnly JWT cookie, logout
- **Workspaces** — Create workspaces, invite members, manage roles (owner / admin / member / viewer)
- **Projects** — Create projects with a unique key (e.g. `APP`), configurable workflow per project
- **Workflow Engine** — Custom statuses, configurable transitions, transition conditions (`field_required`, `field_value`), automatic actions (`assign_user`, `set_field`, `send_notification`)
- **Issues** — Full CRUD, subtasks via `parent_id`, soft delete, priority, labels, story points, watchers
- **Sprints** — Create, start, complete with carry-over logic and velocity calculation
- **Comments** — Threaded replies, `@{uuid}` mention parsing, soft delete
- **Activity Feed** — Per-project audit trail of every mutation, cursor paginated
- **Notifications** — Per-user inbox (mentions, comments, status changes), mark read / mark all read
- **Search** — PostgreSQL full-text search with GIN index, `websearch_to_tsquery`, `ts_rank` ranking, structured filters (status, assignee, priority, type)

### Reliability & Concurrency
- **Optimistic locking** on issues — `version` column, `409 Conflict` with `currentVersion` on stale write
- **Pessimistic locking** on workflow transitions and issue number generation — `SELECT ... FOR UPDATE`
- **Sprint completion is atomic** — single DB transaction with row lock

### Real-time
- **WebSocket** via Socket.IO — JWT auth on handshake, per-project rooms
- **Presence** — who's online per project (Redis SADD/EXPIRE, 30s TTL, 20s heartbeat)
- **Replay buffer** — last 100 events per project in Redis sorted set; clients reconnecting with `lastEventTimestamp` get missed events without a full reload
- **Fan-out** — services publish to Redis pub/sub (`ws:*`), WebSocket nodes broadcast to rooms — horizontally scalable

### Performance
- **Redis cache-aside** — board grouped by status (30s TTL), workflow definition (5min TTL), invalidated on mutation
- **Cursor pagination** — keyset pagination on `(created_at, id)` on all list endpoints — O(log n) vs OFFSET O(n)
- **BullMQ async workers** — activity logging and notification delivery are fire-and-forget, keeping API response times fast
- **Composite indexes** — `(project_id, status_id)`, `(project_id, sprint_id)`, `assignee_id`, `parent_id`, `(recipient_id, read_at, created_at)`

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
| Auth | JWT (HttpOnly cookie) |

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

Raw OpenAPI spec (YAML):

```
http://localhost:3000/docs.yaml
```

---

## Key API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register user |
| `POST` | `/api/auth/login` | Login — sets JWT cookie |
| `POST` | `/api/workspaces` | Create workspace |
| `POST` | `/api/workspaces/:id/members` | Add member |
| `POST` | `/api/workspaces/:workspaceId/projects` | Create project |
| `GET` | `/api/projects/:id/board` | Kanban board grouped by status |
| `GET` | `/api/projects/:id/workflow` | Workflow statuses and transitions |
| `POST` | `/api/projects/:id/issues` | Create issue |
| `PATCH` | `/api/issues/:id` | Update issue (requires `version` for optimistic lock) |
| `POST` | `/api/issues/:id/transitions` | Transition issue status |
| `POST` | `/api/issues/:id/comments` | Add comment (supports `@{uuid}` mentions) |
| `POST` | `/api/sprints/:id/complete` | Complete sprint with carry-over |
| `GET` | `/api/projects/:id/activity` | Project activity feed |
| `GET` | `/api/users/me/notifications` | Notification inbox |
| `GET` | `/api/search?q=` | Full-text search across issues |

---

## WebSocket

Connect with Socket.IO using your JWT token:

```js
const socket = io("http://localhost:3000", {
  auth: { token: "<jwt>" }
});

// Subscribe to a project room
socket.emit("subscribe", { room: "project:<uuid>", lastEventTimestamp: Date.now() });

// Send heartbeat every 20s to keep presence alive
setInterval(() => socket.emit("heartbeat", { room: "project:<uuid>" }), 20000);

// Listen for real-time events
socket.on("event", (event) => console.log(event));

// On reconnect, missed events are replayed automatically
socket.on("replay", (events) => console.log("missed:", events));
```

Event types: `issue_created`, `issue_updated`, `comment_added`, `sprint_started`, `sprint_completed`

---

## Project Structure

```
.
├── server.ts               # Entry point — Express app, workers, WebSocket
├── controllers/            # HTTP handlers (thin — delegate to services)
├── services/               # Business logic, DB queries, cache, queue calls
├── routes/                 # Express routers
├── middleware/             # authenticate, validate, errorHandler
├── workers/                # BullMQ consumers (activity, notification)
├── ws/                     # Socket.IO server, presence, replay, publisher
├── db/
│   ├── schema/             # Drizzle table definitions (16 tables)
│   ├── migrations/         # Generated SQL migrations
│   └── seed.ts             # Development seed data
├── utils/                  # asyncWrapper, cache, pagination, queues, redis, jwt
├── types/                  # AppError, AuthRequest
├── openapi.yaml            # Full OpenAPI 3.0 spec
└── qa.md                   # Design decisions, locking, scale, trade-offs
```

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
