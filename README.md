# Reminder Platform

Offline-first broadcast reminder system. An administrator publishes global reminder
definitions and every installed desktop app can download and run them locally.

## Prerequisites

- Docker Engine with Docker Compose v2
- Optional for host-side development: Python 3.11

## Start the Phase 1 stack

```bash
cp .env.example .env
# Outside throwaway local development, replace POSTGRES_PASSWORD.
docker compose up --build -d
docker compose ps
curl http://localhost:8000/health/live
curl http://localhost:8000/health/ready
```

Development diagnostic ports are `8003` (reminders), `5432` (PostgreSQL), and `6379` (Redis).
Client applications should use only the gateway on
port `8000`. Swagger is available at `http://localhost:8000/docs` outside production.

Public reminder management is available at `/api/v1/reminders`. Daily and monthly definitions
apply to all installations. There are no accounts, member assignments, or login tokens. Each
desktop stores definitions in SQLite and keeps its own completion and snooze state.
Users can also create, edit, pause, and delete personal daily/monthly reminders entirely
offline in the desktop app. These remain private to that computer and survive server updates.
Monthly **Remind me later** postpones until tomorrow at the scheduled local time; daily
reminders snooze for 10 minutes.

The no-login admin dashboard is available at `http://localhost:3000`. It contains the global
reminder dashboard and reminder management. Run its standalone checks with:

```bash
cd apps/admin-web
npm ci
npm run lint
npm test
npm run build
```

The Tauri 2 client lives in `apps/desktop`. It provides local SQLite scheduling, native
notifications, manual updates, system-tray behavior, and autostart.

Stop containers without deleting data:

```bash
docker compose down
```

To deliberately remove local database/Redis state, use `docker compose down --volumes`.
That command is destructive and should never be used against a valued environment.

## Verification

Validate Compose, execute tests, and lint each independently deployable image:

```bash
docker compose config --quiet
make test
make lint
```

For a full boot smoke test:

```bash
docker compose up --build -d --wait
docker compose ps
docker compose logs reminder-service api-gateway
```

Read [architecture decisions](docs/architecture.md) and the
[implementation plan](docs/implementation-plan.md) before adding domain behavior.

## Configuration

Configuration is environment-only and typed with Pydantic Settings. `.env.example` documents
safe development defaults but `.env` is ignored. PostgreSQL uses a persistent named volume;
Redis uses AOF persistence for local resilience. All application logs are JSON and every HTTP
response includes or propagates `X-Request-ID`.

## Database changes

The initialization script creates only service-owned schemas. Beginning in Phase 2, Alembic
is the sole mechanism for table/schema changes; applications will never call `create_all()`.
