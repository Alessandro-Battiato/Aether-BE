# GPTClone — Server

REST API backend for a ChatGPT-style clone. Built with Node.js, Express, Prisma, and OpenRouter.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v22, ESM |
| Language | TypeScript 6 |
| Framework | Express 4 |
| Database | PostgreSQL via Prisma 7 ORM |
| DB Adapter | `@prisma/adapter-pg` (Prisma 7 driver adapter) |
| AI | OpenRouter (OpenAI-compatible API) |
| Auth | JWT — httpOnly cookie + Bearer header |
| Validation | express-validator + Zod (env vars) |
| Testing | Vitest + Supertest |

## Prerequisites

- Node.js ≥ 20
- PostgreSQL (local instance or hosted)
- An [OpenRouter](https://openrouter.ai) API key

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in your values
cp .env.example .env

# 3. Run database migrations
npm run db:migrate

# 4. (Optional) Seed the database with a demo user
npm run db:seed

# 5. Start the development server
npm run dev
```

The server starts at `http://localhost:5000` by default.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | | `5000` | Port the server listens on |
| `NODE_ENV` | | `development` | `development`, `test`, or `production` |
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✓ | — | Secret for signing JWTs (min 16 chars) |
| `JWT_EXPIRES_IN` | | `7d` | JWT token lifetime |
| `OPENROUTER_API_KEY` | ✓ | — | OpenRouter API key |
| `OPENROUTER_BASE_URL` | | `https://openrouter.ai/api/v1` | OpenRouter base URL |
| `CLIENT_URL` | | `http://localhost:5173` | Frontend origin for CORS |

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with hot-reload via `tsx watch` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests and generate coverage report |
| `npm run test:unit` | Run only unit tests |
| `npm run test:integration` | Run only integration tests |
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:migrate:deploy` | Apply pending migrations (production) |
| `npm run db:migrate:test` | Apply migrations against the test database |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Seed the database with demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Drop and re-migrate the database |

## API Reference

All endpoints are prefixed with `/api/v1`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Register a new user |
| `POST` | `/auth/login` | — | Log in and receive a JWT |
| `POST` | `/auth/logout` | — | Clear the auth cookie |
| `GET` | `/auth/me` | ✓ | Return the authenticated user |

**Register body:**
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "mypassword",
  "passwordConfirm": "mypassword"
}
```

### Chats

All chat endpoints require authentication (`Authorization: Bearer <token>` or `token` cookie).

| Method | Path | Description |
|---|---|---|
| `GET` | `/chats` | List all chats for the authenticated user |
| `POST` | `/chats` | Create a new chat |
| `GET` | `/chats/:chatId` | Get a chat and its messages |
| `PATCH` | `/chats/:chatId` | Update chat title or model |
| `DELETE` | `/chats/:chatId` | Delete a chat |
| `POST` | `/chats/:chatId/messages` | Send a message (non-streaming) |
| `POST` | `/chats/:chatId/messages/stream` | Send a message (SSE streaming) |
| `GET` | `/chats/models` | List available AI models (paginated) |

**Models query params:** `?page=1&limit=20` (limit capped at 100)

**Streaming** uses Server-Sent Events. Events:
```
data: {"delta":"..."}        // incremental token
data: {"done":true,"messageId":"...","userMessageId":"..."}  // stream complete
```

## Project Structure

```
server.ts               # Entry point — starts the HTTP server
prisma.config.ts        # Prisma CLI configuration (datasource URL)
src/
  app.ts                # Express app setup (middleware, routes)
  config/env.ts         # Zod-validated environment variables
  lib/prisma.ts         # Prisma client singleton (driver adapter)
  types/express.d.ts    # Express Request augmentation (req.user)
  middleware/
    auth.ts             # JWT authentication middleware
    errorHandler.ts     # AppError class + global error handler
    validate.ts         # express-validator result middleware
  routes/               # Route definitions (validation chains)
  controllers/          # Request/response handling (thin layer)
  services/             # Business logic
    auth.service.ts
    chats.service.ts
    ai.service.ts       # OpenRouter integration + model pagination
prisma/
  schema.prisma         # Data models: User → Chat → Message
  migrations/           # Migration history
  seed.ts               # Demo data seed script
tests/
  setup.ts              # Vitest global setup (env vars, test DB)
  unit/services/        # Unit tests — Prisma and AI mocked
  integration/          # Integration tests — real test DB, AI mocked
```

## Testing

Unit tests mock Prisma and the AI service entirely — no database required:

```bash
npm run test:unit
```

Integration tests require a real PostgreSQL database. Set `TEST_DATABASE_URL` in `.env.test` and run migrations first:

```bash
npm run db:migrate:test
npm run test:integration
```

Coverage report (text summary + `coverage/` lcov output):

```bash
npm run test:coverage
```

## Data Model

```
User
  id, email, name, password, createdAt, updatedAt
  └── Chat[]
        id, title, model, userId, createdAt, updatedAt
        └── Message[]
              id, role (user|assistant|system), content, chatId, createdAt
```
