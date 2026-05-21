# SprintStack

SprintStack is an open-source template for building project management platforms. The repository is now split into two clear parts:

- `backend/` - Bun, TypeScript, Express, PostgreSQL, Redis, BullMQ, Socket.IO, Drizzle, and OpenAPI.
- `landing/` - a static HTML landing page for the open-source template.

The backend includes workspaces, projects, issues, sprints, workflows, comments, activity feeds, notifications, search, and real-time presence.

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

## Repository Structure

```text
.
|-- backend/
|   |-- controllers/      HTTP request handlers
|   |-- db/               Drizzle schema, migrations, and seed data
|   |-- middleware/       Auth, validation, and error handling middleware
|   |-- routes/           Express route registration
|   |-- services/         Business logic
|   |-- utils/            Shared helpers for cache, queues, pagination, and JWT
|   |-- workers/          BullMQ workers for async jobs
|   |-- ws/               WebSocket server, presence, publishing, and replay
|   |-- openapi.*         API specification
|   |-- package.json      Backend scripts and dependencies
|   `-- docker-compose.yml
|-- landing/
|   `-- index.html        Static landing page
|-- LICENSE
`-- README.md
```

## Backend Stack

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

## Run The Backend Locally

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Docker](https://www.docker.com) and Docker Compose

### 1. Enter the backend folder

```bash
cd backend
```

### 2. Install dependencies

```bash
bun install
```

### 3. Start PostgreSQL and Redis

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` and Redis on `localhost:6379`.

### 4. Configure environment

Create `backend/.env` from the example file:

```bash
cp .env.example .env
```

Default local values:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sprintstack_pm
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3000
NODE_ENV=development
```

### 5. Run migrations

```bash
bun run db:migrate
```

### 6. Seed the database

```bash
bun run db:seed
```

The seed script creates a demo workspace with users, projects, workflows, sprints, sample issues, comments, activity, and notifications.

Demo users:

| Email | Password |
|---|---|
| `alice@example.com` | `password123` |
| `bob@example.com` | `password123` |

### 7. Start the API

```bash
bun run dev
```

The API starts at:

```text
http://localhost:3000
```

Swagger UI is available at:

```text
http://localhost:3000/docs
```

Log in with `alice@example.com` / `password123` via `POST /api/auth/login` first. Login sets the JWT cookie used by protected endpoints.

## Backend Scripts

Run these from `backend/`:

```bash
bun run dev          # Start with hot reload
bun run start        # Start without hot reload
bun run db:generate  # Generate migrations from schema changes
bun run db:migrate   # Apply migrations
bun run db:seed      # Seed development data
bun run db:studio    # Open Drizzle Studio
```

## Landing Page

The landing page is a static HTML file:

```text
landing/index.html
```

You can open it directly in a browser, or publish the `landing/` folder with any static hosting provider.

## License

MIT
