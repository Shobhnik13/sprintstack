# SprintStack

SprintStack is an open-source backend template for building project management platforms with workspaces, projects, issues, sprints, workflows, comments, activity feeds, notifications, search, and real-time presence.

It is built with **Bun + TypeScript + Express + PostgreSQL + Redis + BullMQ + Socket.IO**.

## Features

| Area | Included |
|---|---|
| Authentication | Email/password auth with HTTP-only JWT cookies |
| Workspaces | Workspace ownership, membership, and roles |
| Projects | Project records, workflow statuses, and workflow transitions |
| Issues | Issue CRUD, assignees, priorities, watchers, and status transitions |
| Sprints | Sprint lifecycle support with issue carry-over |
| Comments | Threaded issue comments with mention support |
| Activity | Project activity feed backed by queued workers |
| Notifications | Per-user notification inbox |
| Search | Full-text and structured issue search |
| Realtime | Socket.IO presence and event broadcasting |
| API Docs | OpenAPI spec served through Swagger UI |

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

## Running Locally

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://www.docker.com) and Docker Compose

### 1. Install dependencies

```bash
bun install
```

### 2. Start PostgreSQL and Redis

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` and Redis on `localhost:6379`.

### 3. Configure environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sprintstack_pm
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3000
NODE_ENV=development
```

You can also use `.env.example` as the starting point.

### 4. Run migrations

```bash
bun run db:migrate
```

### 5. Seed the database

```bash
bun run db:seed
```

The seed script creates a ready-to-use demo workspace with users, a project, workflow states, one active sprint, sample issues, comments, activity, and notifications.

Demo users:

| Email | Password |
|---|---|
| `alice@example.com` | `password123` |
| `bob@example.com` | `password123` |

### 6. Start the server

```bash
bun run dev
```

The API starts at `http://localhost:3000`.

### 7. Explore the API

Open Swagger UI:

```text
http://localhost:3000/docs
```

Log in with `alice@example.com` / `password123` via `POST /api/auth/login` first. Login sets the JWT cookie used by protected endpoints.

## Available Scripts

```bash
bun run dev          # Start with hot reload
bun run start        # Start without hot reload
bun run db:generate  # Generate migrations from schema changes
bun run db:migrate   # Apply migrations
bun run db:seed      # Seed development data
bun run db:studio    # Open Drizzle Studio
```

## Project Structure

```text
controllers/     HTTP request handlers
db/              Drizzle schema, migrations, and seed data
middleware/      Auth, validation, and error handling middleware
routes/          Express route registration
services/        Business logic
utils/           Shared helpers for cache, queues, pagination, and JWT
workers/         BullMQ workers for async jobs
ws/              WebSocket server, presence, publishing, and replay
openapi.*        API specification
```

## License

MIT
