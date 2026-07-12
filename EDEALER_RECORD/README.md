# role-base-node

Industry-standard Node.js backend built with TypeScript, Express, and Prisma following a clean layered architecture.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Language | TypeScript 5 |
| Framework | Express 4 |
| ORM | Prisma 5 |
| Validation | Zod |
| Auth | JWT (jsonwebtoken) |
| Logging | Winston |
| Security | Helmet, CORS, bcryptjs |

---

## Folder Structure

```
src/
├── config/          # Environment validation (Zod) and Prisma singleton
├── controllers/     # Route handlers — parse request, call service, send response
├── middlewares/     # Auth, role-based access, validation, error handling
├── repositories/    # Data access layer — all Prisma queries live here
├── routes/          # Express Router definitions — wire up controllers + middleware
├── schemas/         # Zod schemas for request validation and inferred TS types
├── services/        # Business logic — orchestrates repositories
├── types/           # Shared TypeScript interfaces and Express augmentation
├── utils/           # logger, AppError, asyncHandler, apiResponse, jwt, pagination
├── app.ts           # Express application factory (middleware + routes)
└── server.ts        # Entry point — DB connect, listen, graceful shutdown
prisma/
└── schema.prisma    # Database schema (User, Profile, Post + Role/Status enums)
```

### Request Lifecycle

```
Request → Route → validate() → authenticate() → authorize() → Controller → Service → Repository → Prisma → DB
                                                                          ↓
Response ←────────────────────────────────────────── sendSuccess() / sendPaginated()
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in values
cp .env.example .env

# 3. Push schema to database and generate Prisma client
npm run prisma:push
npm run prisma:generate

# 4. Start development server
npm run dev
```

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with hot-reload via tsx |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run lint` | Lint source files with ESLint |
| `npm run format` | Format source files with Prettier |
| `npm run prisma:generate` | Re-generate Prisma client after schema changes |
| `npm run prisma:migrate` | Create and apply a new migration |
| `npm run prisma:studio` | Open Prisma Studio |

---

## API Endpoints

### Auth

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | `{ email, password, ... }` | Register; sends signup OTP (no access JWT until `verify-otp`) |
| `POST` | `/api/v1/auth/verify-otp` | `{ email, otp, purpose }` | Verify signup or password-reset OTP |
| `POST` | `/api/v1/auth/resend-otp` | `{ email, purpose }` | Resend OTP |
| `POST` | `/api/v1/auth/forgot-password` | `{ email }` | Send password-reset OTP |
| `POST` | `/api/v1/auth/reset-password` | `{ password }` + Bearer `resetToken` | Set new password after OTP |
| `POST` | `/api/v1/auth/login` | `{ email, password }` | Login and receive JWT (may require verified email) |

### RBAC navigation (requires JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/rbac/catalog?moduleType=DEALER` | Modules → pages → actions tree |
| `POST` | `/api/v1/rbac/modules/sync` | Full sync modules for `DEALER` / `AGENT` |
| `POST` | `/api/v1/rbac/pages/sync` | Full sync pages under a module |
| `POST` | `/api/v1/rbac/page-actions/sync` | Full sync actions under a page |

### Users (requires `Authorization: Bearer <token>`)

| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Any | Get own profile |
| `GET` | `/api/v1/users` | ADMIN | List all users (paginated) |
| `GET` | `/api/v1/users/:id` | ADMIN | Get user by ID |
| `PATCH` | `/api/v1/users/:id` | ADMIN | Update user |
| `DELETE` | `/api/v1/users/:id` | ADMIN | Delete user |

### Posts

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/posts` | Public | List published posts (paginated) |
| `GET` | `/api/v1/posts/:id` | Public | Get post by ID |
| `POST` | `/api/v1/posts` | Required | Create a post |
| `PATCH` | `/api/v1/posts/:id` | Required (owner) | Update own post |
| `DELETE` | `/api/v1/posts/:id` | Required (owner) | Delete own post |

### Pagination

Append `?page=1&limit=10` to any list endpoint.

---

## Response Envelope

### Success

```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": { ... }
}
```

### Paginated

```json
{
  "success": true,
  "message": "Posts retrieved successfully",
  "data": {
    "data": [ ... ],
    "meta": { "total": 100, "page": 1, "limit": 10, "totalPages": 10 }
  }
}
```

### Error

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "body.email": ["Invalid email address"]
  }
}
```

---

## Architecture Decisions

- **Repository pattern** — all Prisma calls are isolated in `repositories/`. Services never import Prisma directly, making it trivial to swap the database layer or mock it in tests.
- **Service layer** — business logic lives in `services/`. Controllers stay thin; they only parse input and delegate.
- **Zod schemas** — schemas are the single source of truth for both runtime validation and TypeScript types via `z.infer`.
- **Global Express augmentation** — `req.user` is added to the Express `Request` interface via module augmentation in `src/types/index.ts`, so it is available in every controller without type casting.
- **AppError** — a custom error class carries an HTTP status code. All layers throw `AppError`; the global error middleware handles it uniformly.
- **asyncHandler** — eliminates try/catch boilerplate from every controller by forwarding promise rejections to `next`.
