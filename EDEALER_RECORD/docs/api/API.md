# EDealer API Reference

Base URL: `http://localhost:4002` (or your `PORT`). All API routes are prefixed with `/api/v1`.

## Response envelope

- **Success:** `{ "statusCode": number, "message": string, "data": T }`
- **Error:** `{ "success": false, "statusCode": number, "code": number, "message": string, "errors"?: Record<string, string[]>, "stack"?: string }`  
  `stack` is only present in development.

---

## Upload (signed-URL style, local storage)

Two-step flow compatible with future S3/GCS presigned URLs: (1) obtain `uploadUrl` and `fileKey`, (2) `PUT` raw bytes to `uploadUrl`, (3) read the file at `publicUrl`.  
Resolved origin: request `Host` (and `X-Forwarded-*` when `TRUST_PROXY=true`), or `BASE_URL` if `UPLOAD_PUBLIC_URLS_FROM_BASE_URL_ONLY=true`. If the host is **localhost / 127.0.0.1**, it is rewritten to the server’s **LAN IPv4** by default (`UPLOAD_REPLACE_LOOPBACK_WITH_LAN_IP=true`), so Postman/`localhost` callers still get URLs phones can use. Set `LAN_IPV4_OVERRIDE` to pin the address, or disable replacement with `UPLOAD_REPLACE_LOOPBACK_WITH_LAN_IP=false`.

**Auth:** None (simulates a pre-signed upload URL).

### POST /api/v1/upload/generate

**Request body (JSON):**

| Field        | Type   | Required | Validation |
|-------------|--------|----------|------------|
| fileName    | string | Yes      | Max 255; extension must match `contentType` (`.png`, `.jpg`/`.jpeg`, `.webp`, or `.pdf`) |
| contentType | string | Yes      | One of: `image/png`, `image/jpeg`, `image/webp`, `application/pdf` (the raw `PUT` also byte-verifies the magic header) |

**Response (201):**

```json
{
  "statusCode": 201,
  "message": "Upload URL created",
  "data": {
    "uploadUrl": "http://localhost:4002/api/v1/upload/file/xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx.png",
    "fileKey": "xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx.png",
    "publicUrl": "http://localhost:4002/uploads/xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx.png"
  }
}
```

**Errors:** `4150` unsupported MIME; `4007` filename/extension mismatch; validation `4220`.

> **Per-process folders.** Uploads are created with a **flat** `fileKey` (`<uuid>.<ext>`) because the process/vehicle are not known yet. When the file is later attached to a process (via `POST /vehicle-processes/start`'s `uploadPhotos[]`, or the `process-upload-photos` endpoints), the server **moves it into a per-process folder** `"{registrationNumber}_{processId}/<uuid>.<ext>"` and stores that folder-scoped key in `process_upload_photo.image_name`. The public URL/serving is unchanged (`/uploads/<key>` serves nested paths). Existing flat keys continue to resolve.

### PUT /api/v1/upload/file/:fileKey

**Request:** Raw binary body (not `multipart/form-data`). Header `Content-Type` must be one of the allowed image MIME types and must match the actual file bytes (magic-byte check).

**Limits:** Max 5 MB.

**Response (201):**

```json
{
  "statusCode": 201,
  "message": "File uploaded",
  "data": {
    "publicUrl": "http://localhost:4002/uploads/xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx.png"
  }
}
```

**Errors:** `4008` invalid `fileKey`; `4009` empty body; `4010` bytes do not match declared type; `4011` body not raw buffer; `4091` file already exists; `4130` too large; `4150` unsupported MIME.

### GET /uploads/:fileKey

Served by Express static middleware from `UPLOAD_DIR` (not under `/api/v1`). Same host as `publicUrl`.

---

## Health

### GET /api/v1/health

Health-check for load balancers and monitoring.

**Auth:** None.

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2025-03-15T12:00:00.000Z"
}
```

---

## Auth

Frontend guides: [`docs/frontend/AUTH_FRONTEND_FLOW.md`](../frontend/AUTH_FRONTEND_FLOW.md) (login/register/JWT). Email verification & forgot/reset: [`docs/frontend/EMAIL_VERIFICATION_AND_PASSWORD_RESET.md`](../frontend/EMAIL_VERIFICATION_AND_PASSWORD_RESET.md).

### POST /api/v1/auth/register

Create a new user account (password-based).

**Auth:** None.

**Request body:**

| Field     | Type   | Required | Validation              |
|----------|--------|----------|--------------------------|
| email    | string | Yes      | Valid email              |
| password | string | Yes      | Min 8 characters         |
| userName | string | No       | Min 1 if present         |
| mobileNo | string | No       | Max 20                   |
| gender   | string | No       | Max 50                   |

**Example:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "userName": "John Doe",
  "mobileNo": "+919876543210",
  "gender": "male"
}
```

**Response (201):**

No access token is returned until the user verifies their email with `POST /auth/verify-otp` (`purpose: SIGNUP_EMAIL_VERIFICATION`).

```json
{
  "statusCode": 201,
  "message": "Account created. Enter the verification code sent to your email.",
  "data": {
    "user": {
      "userId": "uuid",
      "emailId": "user@example.com",
      "userName": "John Doe",
      "mobileNo": "+919876543210",
      "gender": "male",
      "emailVerified": false
    }
  }
}
```

After signup, a **6-digit OTP** is sent to the email (SMTP or server log when `SMTP_HOST` is empty). OTP lifetime: `OTP_EXPIRES_MINUTES` (default 15).

**Error codes:** `4091` — email already exists.

---

### POST /api/v1/auth/login

Authenticate with email and password. Returns JWT and user info.

**Auth:** None.

**Request body:**

| Field    | Type   | Required |
|----------|--------|----------|
| email    | string | Yes      |
| password | string | Yes      |

**Example:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):** `data.user` includes `dealerId` from `DealerWiseUser` and `agentId` from `AgentWiseUser` (each `null` if not linked; a user has at most one of the two), plus `isSuperAdmin` from `User.isSuperAdmin`. These three drive the frontend's role routing: `isSuperAdmin` → Super-Admin panel, else `dealerId` → dealer app, else `agentId` → agent app, else no workspace.

```json
{
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "userId": "uuid",
      "emailId": "user@example.com",
      "userName": "John Doe",
      "emailVerified": true,
      "dealerId": "99c609b0-a99b-4d66-9011-003c4dba83fe",
      "agentId": null,
      "isSuperAdmin": false
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

`token` is the short-lived **access token** (`JWT_ACCESS_EXPIRES_IN`, default `1h`); `refreshToken` is the long-lived **refresh token** (`JWT_REFRESH_EXPIRES_IN`, default `30d`). Store both; when the access token expires, exchange the refresh token at **`POST /auth/refresh`** rather than forcing a re-login. Passkey login and signup OTP-verification return the same `token` + `refreshToken` pair.

**Error codes:** `4010` — invalid email or password; `4031` — email not verified (only when `REQUIRE_EMAIL_VERIFIED_FOR_LOGIN=true`); `4022` (**403**) — the user's dealer/agent firm is **paused** by the super-admin (`isActive: false`), message `Your account access has been paused. Please contact the super admin.` — no token is issued (see **Paused firms** under [Using the JWT](#using-the-jwt)).

---

### POST /api/v1/auth/refresh

Exchange a valid **refresh token** for a fresh access token and a **rotated** refresh token (so an active session never hits the refresh-token expiry). Stateless — the refresh token is validated by signature + `purpose: REFRESH`, then the access token is rebuilt from the current user so dealer/agent/admin claims stay in sync.

**Auth:** None (the refresh token is the credential; send it in the body, not the `Authorization` header).

**Request body:** `refreshToken` (string, required).

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIs..." }
```

**Response (200):** `data` = `{ "token": "<new access token>", "refreshToken": "<rotated refresh token>" }`. The client should replace both stored tokens.

**Error codes:** `4017` — invalid or expired refresh token (bad signature, expired, wrong `purpose`, or unknown user). Note an **access** token is rejected here (wrong `purpose`), and a **refresh** token is rejected by `authenticate` on normal API routes (**`4015`**). `4022` (**403**) — the refresh token is valid but the user's dealer/agent firm is **paused**; no new tokens are issued, so the client must sign the user out instead of retrying.

---

### POST /api/v1/auth/verify-otp

Verify a **6-digit OTP** for signup email verification or for the password-reset flow.

**Auth:** None.

**Request body:**

| Field   | Type   | Required | Notes |
|---------|--------|----------|--------|
| email   | string | Yes      | Account email |
| otp     | string | Yes      | Exactly 6 digits |
| purpose | string | Yes      | `SIGNUP_EMAIL_VERIFICATION` or `PASSWORD_RESET` |

**Signup (`SIGNUP_EMAIL_VERIFICATION`):** On success, sets `emailVerified: true` and returns a normal **access JWT** (`purpose: ACCESS`) plus user.

**Password reset (`PASSWORD_RESET`):** On success, returns a short-lived **`resetToken`** JWT (`purpose: PASSWORD_RESET`, expiry `JWT_PASSWORD_RESET_EXPIRES_IN`, default `15m`). Use it only as `Authorization: Bearer <resetToken>` on `POST /auth/reset-password`.

**Response (200) — signup:**

```json
{
  "statusCode": 200,
  "message": "Email verified successfully",
  "data": {
    "user": { "userId": "uuid", "emailId": "user@example.com", "userName": "John Doe", "emailVerified": true, "mobileNo": "...", "gender": null, "dealerId": null },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Response (200) — password reset step 1:**

```json
{
  "statusCode": 200,
  "message": "Code verified. Send Authorization: Bearer resetToken to reset-password.",
  "data": { "resetToken": "eyJhbGciOiJIUzI1NiIs..." }
}
```

**Error codes:** `4006` — invalid or expired signup OTP; `4007` — invalid or expired password-reset OTP; `4004` — user missing after verification (rare); `4022` (**403**, signup purpose only) — the user's dealer/agent firm is **paused**, so no access token is issued.

---

### POST /api/v1/auth/resend-otp

Re-send OTP for signup or password reset. Response is always generic (no email enumeration).

**Auth:** None.

**Request body:** `{ "email": "user@example.com", "purpose": "SIGNUP_EMAIL_VERIFICATION" | "PASSWORD_RESET" }`

**Response (200):** Generic success message; `data` is `{}`.

---

### POST /api/v1/auth/forgot-password

Request a password reset **OTP** (same response whether or not the email exists).

**Auth:** None.

**Request body:** `{ "email": "user@example.com" }`

**Response (200):** Generic success message; `data` is `{}`.

---

### POST /api/v1/auth/reset-password

Set a new password after verifying the password-reset OTP. Requires the **`resetToken`** from `verify-otp` with `purpose: PASSWORD_RESET`.

**Auth:** `Authorization: Bearer <resetToken>` (JWT with `purpose: PASSWORD_RESET`). Do not send the reset token in the JSON body.

**Request body:**

| Field    | Type   | Required |
|----------|--------|----------|
| password | string | Yes (min 8) |

**Response (200):** Success message; `data` is `{}`.

**Error codes:** `4016` — missing or invalid reset session; validation errors for weak password.

---

### POST /api/v1/auth/passkey/register/options

Get WebAuthn registration options to add a passkey to the current user. Call this after the user is logged in (e.g. from account/security settings).

**Auth:** Bearer token required. `userId` in body must match the JWT `sub`.

**Request body:**

| Field  | Type   | Required | Validation |
|--------|--------|----------|------------|
| userId | string | Yes      | UUID       |

**Example:**

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Passkey registration options",
  "data": {
    "options": {
      "rp": { "name": "EDealer", "id": "localhost" },
      "user": { "id": "...", "name": "user@example.com", "displayName": "user@example.com" },
      "challenge": "base64url...",
      "pubKeyCredParams": [...]
    }
  }
}
```

**Error codes:** `4041` — user not found; `4030` — userId does not match authenticated user.

---

### POST /api/v1/auth/passkey/register/verify

Verify the WebAuthn registration response and store the new passkey. Call after the client has run `navigator.credentials.create(options)` and obtained the credential.

**Auth:** Bearer token required.

**Request body:**

| Field      | Type   | Required | Description                                  |
|-----------|--------|----------|----------------------------------------------|
| userId    | string | Yes      | UUID of the user (must match JWT sub)         |
| credential| object | Yes      | WebAuthn registration response (from browser) |

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Passkey registered successfully",
  "data": {}
}
```

**Error codes:** `4002` — invalid/expired challenge; `4003` — verification failed; `4030` — userId does not match authenticated user.

---

### POST /api/v1/auth/passkey/login/options

Get WebAuthn authentication options for passkey login. No prior auth required.

**Auth:** None.

**Request body:**

| Field | Type   | Required |
|-------|--------|----------|
| email | string | Yes      | Valid email |

**Example:**

```json
{
  "email": "user@example.com"
}
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Passkey authentication options",
  "data": {
    "options": {
      "challenge": "base64url...",
      "allowCredentials": [...],
      "rpId": "localhost"
    }
  }
}
```

**Error codes:** `4041` — user not found; `4004` — no passkeys registered for this account.

---

### POST /api/v1/auth/passkey/login/verify

Verify the WebAuthn authentication response and return JWT and user. Call after the client has run `navigator.credentials.get(options)` and obtained the credential.

**Auth:** None.

**Request body:**

| Field      | Type   | Required | Description                                   |
|-----------|--------|----------|-----------------------------------------------|
| credential| object | Yes      | WebAuthn authentication response (from browser)|

**Response (200):** Same `data.user` shape as password login (`emailVerified`, `dealerId`, `agentId`, `isSuperAdmin`).

```json
{
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "userId": "uuid",
      "emailId": "user@example.com",
      "userName": "John Doe",
      "emailVerified": true,
      "dealerId": null,
      "agentId": null,
      "isSuperAdmin": false
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error codes:** `4005` — invalid/expired challenge; `4011` — passkey not found; `4012` — verification failed; `5001` — user not found after verification; `4022` (**403**) — the user's dealer/agent firm is **paused** by the super-admin (same as password login; no token is issued).

---

## Using the JWT

For protected endpoints, send the token in the header:

```
Authorization: Bearer <token>
```

Token payload includes `sub` (userId), `email`, `role`, **`dealerId`** (UUID or `null` — the dealer linked in `dealer_wise_user`, if any), **`agentId`** (UUID or `null` — the agent linked in `agent_wise_user`; a user is linked to at most one of dealer/agent), **`isSuperAdmin`** (boolean — from `User.isSuperAdmin`; the only privilege signal since `role` is always `USER`), and **`purpose`** (`ACCESS`). Password-reset tokens omit these. After a user’s dealer/agent assignment or admin flag changes, they must sign in again (or refresh) so the access token picks up the new claims.

**Access + refresh tokens.** Login/verify-otp/passkey return an **access token** (`purpose: ACCESS`, `JWT_ACCESS_EXPIRES_IN`, default `1h`) and a **refresh token** (`purpose: REFRESH`, `JWT_REFRESH_EXPIRES_IN`, default `30d`). Send the access token as `Authorization: Bearer`; on a `401`, exchange the refresh token at **`POST /auth/refresh`** for a new access token + rotated refresh token, then retry — the user stays logged in. `authenticate` accepts only `ACCESS` tokens (a `REFRESH` or `PASSWORD_RESET` token is rejected with **`4015`**); `/auth/refresh` accepts only `REFRESH` tokens (**`4017`** otherwise).

**Paused firms (`403` / `4022`).** A super-admin can pause a dealer or agent firm (`isActive: false`, see `PATCH /dealers/:id/access` and `PATCH /agents/:id/access`). While paused:

- **Sign-in is refused** — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/passkey/login/verify` and signup `POST /auth/verify-otp` return **403 `4022`** for every login user of that firm.
- **Live sessions are rejected** — `authenticate` returns **403 `4022`** on **every** route it guards, **including `GET /auth/me`** (unlike the `4021` approval gate there is no `/auth` exemption). This is a live lookup of the firm linked to the token's `dealerId` / `agentId` claim (cached in-process for ~5 seconds), not a JWT claim, so the pause applies on the user's next request rather than after the access token expires.

The error body is the normal envelope: `{ "success": false, "statusCode": 403, "code": 4022, "message": "Your account access has been paused. Please contact the super admin." }`. It is a **403, not a 401** — clients must not try to refresh; they clear the stored session and show the message. Super-admin tokens and users with no firm link are never blocked. A pause does **not** cascade across firms (an agent holding a grant on a paused dealer keeps working). Resuming restores access — users simply sign in again.

### Dealer-scoped requests

For **non-`ADMIN`** users, these endpoints resolve the active dealer from the JWT **`dealerId`** claim. You may omit `dealerId` from query, path, or body; if you send it, it **must** match the token or the API returns **403** / **`4032`**.

- **`4033`** — account not linked to a dealer (`dealerId` is null in the token).
- **`4034`** — resource belongs to another dealer (single-resource reads/updates/deletes).
- **`4226`** — role `ADMIN` must supply `dealerId` explicitly where the route needs a dealer context.

**`ADMIN`** users do not use the token’s `dealerId` for these flows; they must pass `dealerId` in the request (query, body, or path as documented per route).

---

## RTO Services

Simple master data for RTO-related services (e.g. Registration, NOC, Hypothecation, Address Change).

**Auth:** All RTO service endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Model

From Prisma `RtoService` model:

- `serviceId` (UUID, PK)
- `serviceName` (string, max 255, **required**, **unique**)
- `shortName` (string, max 50, **required**, **unique**)
- `orderRank` (integer; on **create**, set to **max existing `orderRank` + 1**, or **1** if the table is empty; used for display/sort order)
- `createdAt` / `updatedAt` (timestamps, managed by DB)

Duplicate `serviceName` or `shortName` is not allowed on create or update.

---

> **Super-admin only for writes.** `POST`, `PATCH /:id`, `PUT /order`, and `DELETE /:id` require a super-admin token (`4038` otherwise). The **list/get** endpoints stay available to any authenticated user (dealers list services to assign to agents).

### POST /api/v1/rto-services

Create a new RTO service. `orderRank` is assigned server-side (max existing + 1). **Super-admin only** (`4038`).

**Auth:** Bearer token required (super-admin).

**Request body:**

| Field       | Type   | Required | Validation             |
|------------|--------|----------|------------------------|
| serviceName| string | Yes      | Min 1, max 255 chars; must be unique |
| shortName  | string | Yes      | Min 1, max 50 chars; must be unique  |

**Example:**

```json
{
  "serviceName": "Registration Transfer",
  "shortName": "REG"
}
```

**Response (201):**

```json
{
  "statusCode": 201,
  "message": "RTO service created",
  "data": {
    "serviceId": "uuid",
    "serviceName": "Registration Transfer",
    "shortName": "REG",
    "createdAt": "2025-03-15T12:00:00.000Z",
    "updatedAt": "2025-03-15T12:00:00.000Z"
  }
}
```

---

### GET /api/v1/rto-services

List RTO services (paginated).

**Auth:** Bearer token required.

**Query params:**

| Param | Type   | Required | Description                      |
|-------|--------|----------|----------------------------------|
| page  | number | No       | 1-based page index (default 1)  |
| limit | number | No       | Items per page (default 10, max 100) |

**Example:** `/api/v1/rto-services?page=1&limit=10`

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "RTO services retrieved",
  "data": {
    "data": [
      {
        "serviceId": "uuid",
        "serviceName": "Registration Transfer",
        "shortName": "REG",
        "createdAt": "2025-03-15T12:00:00.000Z",
        "updatedAt": "2025-03-15T12:00:00.000Z"
      }
    ],
    "meta": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

---

### GET /api/v1/rto-services/:id

Get a single RTO service by ID.

**Auth:** Bearer token required.

**Path params:**

| Param | Type   | Required | Validation           |
|-------|--------|----------|----------------------|
| id    | string | Yes      | UUID (serviceId)     |

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "RTO service retrieved",
  "data": {
    "serviceId": "uuid",
    "serviceName": "Registration Transfer",
    "shortName": "REG",
    "createdAt": "2025-03-15T12:00:00.000Z",
    "updatedAt": "2025-03-15T12:00:00.000Z"
  }
}
```

**Error codes:** `4042` — RTO service not found; `4092` — service name already exists; `4093` — short name already exists.

---

### PATCH /api/v1/rto-services/:id

Update an existing RTO service.

**Auth:** Bearer token required.

**Path params:**

| Param | Type   | Required |
|-------|--------|----------|
| id    | string | Yes      |

**Request body:** Both fields are required; values must be unique (no other row may use the same serviceName or shortName).

| Field       | Type   | Required | Validation            |
|------------|--------|----------|-----------------------|
| serviceName| string | Yes      | Min 1, max 255 chars; must be unique |
| shortName  | string | Yes      | Min 1, max 50 chars; must be unique |

**Example:**

```json
{
  "serviceName": "Registration Transfer Updated",
  "shortName": "REG-UPD"
}
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "RTO service updated",
  "data": {
    "serviceId": "uuid",
    "serviceName": "Registration Transfer Updated",
    "shortName": "REG-UPD",
    "createdAt": "2025-03-15T12:00:00.000Z",
    "updatedAt": "2025-03-15T13:00:00.000Z"
  }
}
```

**Error codes:** `4042` — RTO service not found; `4092` — service name already exists; `4093` — short name already exists.

---

### PUT /api/v1/rto-services/order

Update `orderRank` for multiple RTO services in one request. Only `orderRank` is updated; `serviceName` and `shortName` in the body are optional (e.g. for client reference) and are not written to the database.

**Auth:** Bearer token required.

**Request body:** Array of objects. Each object must include `serviceId` and `orderRank`; `serviceName` and `shortName` are optional.

| Field       | Type   | Required | Validation                                      |
|------------|--------|----------|-------------------------------------------------|
| serviceId  | string | Yes      | UUID (must match an existing RTO service)       |
| orderRank  | number | Yes      | Non-negative integer                             |
| serviceName| string | No       | Ignored on update (optional for client use)     |
| shortName  | string | No       | Ignored on update (optional for client use)     |

Duplicate `serviceId` in the array is not allowed.

**Example:**

```json
[
  {
    "serviceId": "85976904-58b3-4d47-a19c-8fc37863eee3",
    "serviceName": "Transfer Of Ownership",
    "shortName": "TO",
    "orderRank": 1
  },
  {
    "serviceId": "5a490966-1931-4313-b053-e5713d014fdc",
    "serviceName": "Renewal Of Registration",
    "shortName": "RRF",
    "orderRank": 2
  },
  {
    "serviceId": "a08b34a3-0863-4754-8220-434633c24c39",
    "serviceName": "Hypothecation Addition",
    "shortName": "HPA",
    "orderRank": 3
  }
]
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Order ranks updated",
  "data": [
    {
      "serviceId": "85976904-58b3-4d47-a19c-8fc37863eee3",
      "serviceName": "Transfer Of Ownership",
      "shortName": "TO",
      "orderRank": 1,
      "createdAt": "2025-03-15T12:00:00.000Z",
      "updatedAt": "2025-03-15T14:00:00.000Z"
    },
    { "..." }
  ]
}
```

**Error codes:** `4042` — one or more RTO services not found (invalid serviceId).

---

### DELETE /api/v1/rto-services/:id

Delete an RTO service by ID.

**Auth:** Bearer token required.

**Path params:**

| Param | Type   | Required |
|-------|--------|----------|
| id    | string | Yes      |

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "RTO service deleted",
  "data": {}
}
```

**Error codes:** `4042` — RTO service not found; `4092` — service name already exists; `4093` — short name already exists.

---

## Upload categories

Master list of document types for uploads (e.g. RC, insurance, Buyer ID). Auto `orderRank` on create (max existing + 1), `PUT .../order` to reorder. **List is not paginated.** **Writes (POST/PATCH/DELETE/order) are super-admin only** (`4038`); GET is available to any authenticated user (dealers/agents read the catalog).

Per-dealer/agent flags and ordering use **Dealer-wise / Agent-wise upload categories** (see below). The **`processApi` (extraction API) is set here on the master** and inherited by dealers/agents — the create-process wizard reads it (via the per-tenant list, which returns the master's `processApi`) to auto-fill from an uploaded image; dealers/agents no longer set their own.

**Auth:** Bearer token required on all endpoints below (writes additionally require super-admin).

### Model (Prisma `UploadCategory`)

- `categoryId` (UUID, PK)
- `categoryName` (string, max 255, **required**, **unique**)
- `orderRank` (integer, assigned on create as **max(`orderRank`) + 1**)
- `bothSide` (boolean, default `false`)
- `processApi` (string, max 512, nullable) — OCR extraction endpoint (super-admin-managed)
- `createdAt` / `updatedAt`

---

### POST /api/v1/upload-categories

**Super-admin.** **Request body:** `categoryName` (string, required), `bothSide` (boolean, required), `processApi` (string ≤512, optional/nullable). `orderRank` is server-assigned.

**Error codes:** `4097` — category name already exists; `4038` — non-super-admin.

---

### GET /api/v1/upload-categories

Full list, ordered by `orderRank` ascending.

---

### GET /api/v1/upload-categories/:id

**Path:** `id` = `categoryId` (UUID). **Error codes:** `4051` — not found.

---

### PATCH /api/v1/upload-categories/:id

**Super-admin.** Body: `categoryName`, `bothSide` (both required), `processApi` (optional/nullable). **Error codes:** `4051`, `4097`, `4038`.

---

### PUT /api/v1/upload-categories/order

Body: JSON array of `{ "categoryId", "orderRank" }` (optional `categoryName` ignored). Duplicate `categoryId` not allowed.

**Error codes:** `4051` — one or more ids not found.

---

### DELETE /api/v1/upload-categories/:id

**Error codes:** `4051` — not found.

---

## Dealer-wise upload categories

Links a **dealer** to a global **upload category** with per-dealer `orderRank`, optional `processApi`, and booleans `isRequired`, `isProcess`, `isViewInStep`. **`uploadCategoryId` is unique per `dealerId`** (same global category cannot be linked twice to one dealer).

**Auth:** Bearer JWT required.

**Response shapes**

- **GET `?dealerId=`**, **GET `/view-in-step?dealerId=`**, and **PUT `.../order`:** `data` is `{ "dealerId": "<uuid>", "uploadCategory": [ ... ] }`. Each array element: `dwucId`, `categoryId`, `categoryName`, `orderRank` (dealer-wise), `isRequired`, `processApi`, `isProcess`, `isViewInStep`.
- **GET `:id`, POST, PATCH:** `data` is `{ "dwucId", "dealerId", "uploadCategory": { "categoryId", "categoryName", "orderRank", ... } }` (nested object, not an array).

Timestamps and global-only fields (e.g. master `orderRank`, `bothSide`) are not included in API responses for this resource.

### Model (Prisma `DealerWiseUploadCategory`, table `dealer_wise_upload_category`)

- `dwucId` (UUID, PK; column `dwuc_id`)
- `dealerId`, `uploadCategoryId` (FKs; **unique together**)
- `processApi` (optional string, max 512)
- `orderRank` (integer; on create = max for that dealer + 1)
- `isRequired`, `isProcess`, `isViewInStep` (booleans)
- `createdAt`, `updatedAt`

---

### POST /api/v1/dealer-wise-upload-categories

**Body:** `uploadCategoryId` (UUID), `processApi` (optional string or `null`; omit, empty string, or `null` stores no URL), `isRequired`, `isProcess`, `isViewInStep` (booleans). **`dealerId` is optional** — omitted for normal users (taken from JWT); **`ADMIN` must send `dealerId`**.

**Error codes:** `4043` — dealer not found; `4051` — upload category not found; `4098` — category already linked for this dealer; `4032`–`4033`, `4226` — see **Dealer-scoped requests** (under *Using the JWT*).

---

### GET /api/v1/dealer-wise-upload-categories

**Query:** `dealerId` (UUID, **optional** for users with a dealer claim; **required** for `ADMIN`). **Response `data`:** `{ dealerId, uploadCategory: [ { dwucId, categoryId, categoryName, orderRank, isRequired, processApi, isProcess, isViewInStep }, ... ] }`, ordered by `orderRank`, no pagination.

**Error codes:** `4043` — dealer not found; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-wise-upload-categories/view-in-step

Same as **list**, but **`uploadCategory` includes only rows where `isViewInStep` is `true`**, still ordered by `orderRank`. Each array item also includes **`bothSide`** (boolean) from the master `UploadCategory`.

**Response `data`:** `{ dealerId, uploadCategory: [ { dwucId, categoryId, categoryName, orderRank, isRequired, processApi, isProcess, isViewInStep, bothSide }, ... ] }`

**Query:** `dealerId` (optional for non-admin; same rules as list).

**Error codes:** `4043` — dealer not found; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-wise-upload-categories/:id

**Path:** `id` = `dwucId`. **Error codes:** `4052` — link not found; `4034` — link belongs to another dealer.

---

### PATCH /api/v1/dealer-wise-upload-categories/:id

Body: `uploadCategoryId`, `processApi` (optional string or `null`), `isRequired`, `isProcess`, `isViewInStep`. Cannot change `dealerId`.

**Error codes:** `4052`, `4051`, `4098`, `4034`.

---

### PUT /api/v1/dealer-wise-upload-categories/order

**Body:** `{ "items": [ { "dwucId", "orderRank" }, ... ] }`. Optional **`dealerId`** for `ADMIN` only; otherwise taken from JWT. Every `dwucId` must belong to that dealer. Duplicate `dwucId` in `items` is not allowed.

**Response:** Same `data` shape as list — `{ dealerId, uploadCategory: [ ... ] }`, ordered by `orderRank`.

**Error codes:** `4043` — dealer not found; `4225` — one or more `dwucId` values are not linked to this dealer; `4032`–`4033`, `4226` — dealer scope.

---

### DELETE /api/v1/dealer-wise-upload-categories/:id

**Error codes:** `4052` — not found; `4034` — wrong dealer.

---

## Dealer-wise users

Links a **user** to **exactly one dealer** across the system: **`userId` is unique** in `dealer_wise_user` (a user cannot be linked to two dealers). Dealer-scoped RBAC roles remain on **`UserRole`** / **`Role`** separately if you assign them there.

**Auth:** Bearer JWT required.

### Model (Prisma `DealerWiseUser`, table `dealer_wise_user`)

- `dwuId` (UUID, PK)
- `userId` (FK to `User`, **globally unique** in this table), `dealerId` (FK to `Dealer`)
- `isOwner` (bool, default `false`) — the account that **registered** the dealership is the OWNER (full access, sole role manager). Employees added via `with-user` stay `false`.
- `roleId` (FK to `DealerRole`, nullable, `onDelete: SetNull`) — the assigned dealer role. `null` = the read-only default (`processes.view`). See **Dealer Roles & Permissions** below.
- `createdAt`, `updatedAt`

**Response shape:** Rows include nested `user` (`userId`, `userName`, `emailId`, `mobileNo` only; no password) plus `isOwner` and `roleId`.

---

### POST /api/v1/dealer-wise-users

**Body:** `userId` (UUID). **`dealerId` optional** — from JWT for normal users; **`ADMIN` must send `dealerId`**.

**Error codes:** `4043` — dealer not found; `4045` — user not found; `4106` — user already linked to a dealer; `4032`–`4033`, `4226` — dealer scope.

---

### POST /api/v1/dealer-wise-users/with-user

Creates a **brand-new user** and links them to the dealer in one call, so a dealer can add an employee/sub-user who can log in immediately. The user is created with `emailVerified = true` and a bcrypt-hashed password.

**Body:** `userName` (string), `emailId` (valid email), `mobileNo` (string), `password` (min 8 chars). **`dealerId` optional** — from JWT for normal users; **`ADMIN` must send `dealerId`**.

**Response (201):** the created assignment row with nested `user` (`userId`, `userName`, `emailId`, `mobileNo`).

**Error codes:** `4043` — dealer not found; `4091` — email already exists; `4106` — user already linked to a dealer; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-wise-users

**Query:** `dealerId` (UUID, optional for non-admin; **required** for `ADMIN`). Array of assignments, ordered by `createdAt` ascending, no pagination.

**Error codes:** `4043` — dealer not found; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-wise-users/:id

**Path:** `id` = `dwuId`. **Error codes:** `4053` — assignment not found; `4034` — wrong dealer.

---

### PATCH /api/v1/dealer-wise-users/:id

**Body:** `userId` (UUID; replaces the linked user). `dealerId` is not changed.

**Error codes:** `4053`, `4045`, `4106`, `4034`.

---

### DELETE /api/v1/dealer-wise-users/:id

**Error codes:** `4053` — not found; `4034` — wrong dealer.

---

## Dealer Roles & Permissions

A per-dealer **fixed-capability** access model (NOT the generic `Module`/`Page`/`PageAction` RBAC tables — those stay dormant for the dealer app). A `DealerRole` holds a subset of a **curated capability catalog** (stable string keys). Access is resolved **fresh per request** (a role change takes effect without re-login):

- **super-admin** or the dealership **OWNER** (`DealerWiseUser.isOwner`) → **all** capabilities.
- an employee **with** a `roleId` → that role's `capabilities`.
- an employee **without** a role → the read-only default `['processes.view']`.
- anyone else (agent / unlinked) → no dealer capabilities.

The access token carries a convenience `isDealerOwner` claim (dealer users only; `false` otherwise). The authoritative check is always the fresh resolver, exposed as `GET /dealer-roles/me` and the `requireCapability(cap)` route guard.

**Auth:** Bearer JWT required on all routes.

### Model (Prisma `DealerRole`, table `dealer_role`)

- `roleId` (UUID, PK), `dealerId` (FK to `Dealer`)
- `roleName` (string, **unique per dealer** — `@@unique([dealerId, roleName])`)
- `capabilities` (`text[]`, capability keys from the catalog below)
- `createdAt`, `updatedAt`

**Capability catalog** (returned by `GET /dealer-roles/capabilities`), grouped for the FE checklist:

| Group | Key | Label |
|-------|-----|-------|
| Vehicle Processes | `processes.view` | View processes |
| Vehicle Processes | `processes.manage` | Create & edit processes/deal/persons/documents |
| Tasks & Board | `tasks.viewAll` | See ALL tasks on the board (else only own) |
| Tasks & Board | `tasks.manage` | Create, edit, assign & move tasks |
| Configuration | `taskStatuses.manage` | Manage task-board statuses |
| Configuration | `jobTemplates.manage` | Manage job templates |
| Configuration | `references.manage` | Manage references |
| Configuration | `documents.manage` | Manage document/upload config |
| People | `employees.manage` | Add & remove employees |
| People | `roles.manage` | Manage roles & permissions |
| Agents & Money | `agents.manage` | Manage agents |
| Agents & Money | `ledger.view` | View khata/ledger |

---

### GET /api/v1/dealer-roles/capabilities

Returns the capability catalog for the FE checklist. **Any authenticated dealer user.**

**Response (200):** `{ "capabilities": [ { "key", "label", "group" }, ... ] }`.

---

### GET /api/v1/dealer-roles/me

Returns the caller's effective capabilities, resolved fresh. **Any authenticated dealer user.**

**Response (200):** `{ "isOwner": boolean, "capabilities": string[] }`.

---

### GET /api/v1/dealer-roles

Lists the caller's dealer roles (newest first) with member counts. **Gated by `roles.manage`** (the OWNER passes since the OWNER holds every capability).

**Query:** `dealerId` (UUID, optional) — normal dealer users use the JWT; a super-admin must pass it.

**Response (200):** array of `{ roleId, dealerId, roleName, capabilities, memberCount, createdAt, updatedAt }`.

**Error codes:** `4067` — lacks `roles.manage`; `4032`/`4033`/`4039`/`4226` — dealer scope.

---

### POST /api/v1/dealer-roles

Creates a role for the caller's dealer. **Gated by `roles.manage`.**

**Body:** `roleName` (string, 1–255), `capabilities` (string[] of catalog keys; may be empty; de-duplicated). `dealerId` (UUID, optional — super-admin only).

**Response (201):** the created role.

**Error codes:** `4220` — invalid body / unknown capability key (Zod enum); `4068` — unknown capability key (service guard); `4090` — duplicate `roleName` for the dealer; `4067` — lacks `roles.manage`; `4032`/`4033`/`4039`/`4226` — dealer scope.

---

### PATCH /api/v1/dealer-roles/:id

Updates a role owned by the caller's dealer. **Gated by `roles.manage`.**

**Path:** `id` = `roleId`. **Body:** `roleName?` and/or `capabilities?` (at least one required).

**Response (200):** the updated role.

**Error codes:** `4220` — invalid body; `4068` — unknown capability key; `4090` — duplicate `roleName`; `4040` — role not found; `4034` — wrong dealer; `4067` — lacks `roles.manage`.

---

### DELETE /api/v1/dealer-roles/:id

Deletes a role owned by the caller's dealer. Members keep their link but drop to the read-only default (`roleId` → `null` via `onDelete: SetNull`). **Gated by `roles.manage`.**

**Path:** `id` = `roleId`.

**Response (200):** `{}`.

**Error codes:** `4040` — role not found; `4034` — wrong dealer; `4067` — lacks `roles.manage`.

---

### POST /api/v1/dealer-roles/assign

Assigns a role to an employee, or clears it (`roleId: null` → read-only default). Both the user and the role must belong to the caller's dealer. **Gated by `roles.manage`.**

**Body:** `userId` (UUID), `roleId` (UUID **or `null`**). `dealerId` (UUID, optional — super-admin only).

**Response (200):** the updated `DealerWiseUser` row (with nested `user`, `isOwner`, `roleId`).

**Error codes:** `4034` — user not a member of your dealer; `4040` — role not found for your dealer; `4067` — lacks `roles.manage`; `4032`/`4033`/`4039`/`4226` — dealer scope.

---

## Dealers

CRUD for dealers. All fields are required. `emailId`, `mobileNo`, and `whatsappNo` are unique. `isSubscribe` defaults to `false` on create. `isActive` (the super-admin access switch) defaults to `true` and is **not** accepted by create/update — it changes only through `PATCH /dealers/:id/access`.

**Auth:** All dealer endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

**Access control (data isolation).** There is no separate ADMIN role (every token is `USER`); the privilege signal is the JWT **`isSuperAdmin`** claim (from `User.isSuperAdmin`):
- A **dealer** token (has `dealerId`, not admin) may only `GET`/`PATCH` **their own** dealer (`:id` must equal their `dealerId`, else **403 `4034`**), and **cannot** change `isSubscribe` (preserved server-side). `GET` list, `POST`, and `DELETE` are forbidden (**403 `4038`**).
- An **agent** or any other non-admin token is denied on all `/dealers` routes (**403 `4034`**/`4038`).
- A **super-admin** token (`isSuperAdmin: true`, no dealer/agent link) is unrestricted — used by the Super-Admin panel.

### Model

From Prisma `Dealer` model:

- `dealerId` (UUID, PK)
- `firmName`, `dealerName`, `address`, `city`, `state`, `pincode` (required)
- `mobileNo` (required, **unique**)
- `emailId` (required, **unique**)
- `displayName`, `whatsappNo` (required, **whatsappNo unique**)
- `isSubscribe` (boolean, required, default `false`)
- `isActive` (boolean, default `true`) — super-admin access switch; `false` = **paused** (the dealer's login users cannot sign in and live sessions get `403` / `4022`). Returned on every dealer row; read-only except via `PATCH /dealers/:id/access`.
- `createdAt` / `updatedAt` (timestamps, managed by DB)

---

### POST /api/v1/dealers

Create a new dealer.

**Auth:** Bearer token required.

**Request body:** All fields required except `isSubscribe` (optional, default `false`).

| Field       | Type    | Required | Validation                    |
|------------|---------|----------|-------------------------------|
| firmName   | string  | Yes      | Min 1, max 255                 |
| dealerName | string  | Yes      | Min 1, max 255                 |
| address    | string  | Yes      | Min 1                          |
| city       | string  | Yes      | Min 1, max 100                 |
| state      | string  | Yes      | Min 1, max 100                 |
| pincode    | string  | Yes      | Min 1, max 10                  |
| mobileNo   | string  | Yes      | Min 1, max 20; must be unique  |
| emailId    | string  | Yes      | Valid email; must be unique   |
| displayName| string  | Yes      | Min 1, max 255                 |
| whatsappNo | string  | Yes      | Min 1, max 20; must be unique  |
| isSubscribe| boolean | No       | Default `false`                |

**Response (201):** `data` is the created dealer (includes `dealerId`, timestamps).

**Error codes:** `4094` — email already registered; `4095` — WhatsApp number already registered; `4096` — mobile number already registered.

---

### GET /api/v1/dealers

List dealers (paginated).

**Auth:** Bearer token required.

**Query params:** `page` (optional), `limit` (optional, default 10, max 100).

**Response (200):** `data.data` = array of dealers; `data.meta` = `{ total, page, limit, totalPages }`.

---

### GET /api/v1/dealers/:id

Get a single dealer by ID.

**Auth:** Bearer token required.

**Error codes:** `4043` — dealer not found.

---

### PATCH /api/v1/dealers/:id

Update an existing dealer. All body fields required (including `isSubscribe`).

**Auth:** Bearer token required.

**Error codes:** `4043` — dealer not found; `4094` — email already registered; `4095` — WhatsApp number already registered; `4096` — mobile number already registered.

---

### PATCH /api/v1/dealers/:id/agent-slots

**Super-admin only.** Set or raise a dealer's active-agent slot limit (`maxAgents`) — the manual "addon" grant today, and the single **reusable seam** a future self-serve addon purchase will call. Rejects a target below the dealer's current usage (`4232`).

**Auth:** Bearer token required; caller must be super-admin (`4038` otherwise).

**Path params:** `id` = `dealerId` (UUID).

**Request body:** exactly **one** of:

- `maxAgents` (int ≥ 0) — set the cap to an absolute value, or
- `deltaSlots` (int ≥ 1) — add this many slots to the current cap.

```json
{ "maxAgents": 3 }
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Agent slots updated",
  "data": { "dealerId": "uuid", "maxAgents": 3, "used": 2 }
}
```

**Error codes:** `4038` — not a super-admin; `4043` — dealer not found; `4232` — target below current active usage; `4220` — neither/both of `maxAgents`/`deltaSlots` provided.

---

### PATCH /api/v1/dealers/:id/subscription

**Super-admin only.** Toggle a dealer's subscription (`isSubscribe`). A subscribed dealer gets the dealer site and can be a **connect target** for agents.

**Auth:** Bearer token required; super-admin (`4038` otherwise). **Path params:** `id` = `dealerId`. **Request body:** `isSubscribe` (boolean, required).

```json
{ "isSubscribe": true }
```

**Response (200):** `data` is `{ id, isSubscribe }`. **Error codes:** `4038` — not a super-admin; `4043` — dealer not found.

---

### PATCH /api/v1/dealers/:id/access

**Super-admin only.** Pause or resume a dealer's access (`isActive`). `false` = **paused**: none of the dealer's login users can sign in, and every user already signed in is rejected with **403 `4022`** on their next request (see **Paused firms** under [Using the JWT](#using-the-jwt)). `true` = resumed (users sign in again). Separate from `isSubscribe` (capability) and `approvalStatus` (registration approval) — neither is touched. Does not cascade to agents holding a grant on this dealer; inert for placeholder dealers (no login).

**Auth:** Bearer token required; super-admin (`4038` otherwise). **Path params:** `id` = `dealerId`. **Request body:** `isActive` (boolean, required).

```json
{ "isActive": false }
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Dealer access updated",
  "data": { "id": "uuid", "isActive": false }
}
```

**Error codes:** `4038` — not a super-admin; `4043` — dealer not found; `4220` — invalid `id` / missing or non-boolean `isActive`.

---

### DELETE /api/v1/dealers/:id

Delete a dealer by ID.

**Auth:** Bearer token required.

**Error codes:** `4043` — dealer not found.

---

## Dealer Task Statuses

Per-dealer **task-board columns** (Jira-like task statuses). **statusName is unique per dealer** (not globally). **statusRank is per dealer** and is determined by the order of the `statusData` array in the sync API (1, 2, 3, …). Each column carries an `isDone` flag marking terminal columns (moving a task into a done column sets its `completedAt`).

**Auth:** All dealer task status endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Model

- `statusId` (UUID, PK)
- `dealerId` (UUID, **required**, FK to Dealer; cascade delete)
- `statusName` (string, **required**; **unique per dealer**)
- `colour` (string, **required**, max 50; not unique)
- `statusRank` (integer, **required**, per-dealer display order)
- `isDone` (boolean, default `false`; marks terminal/done columns)
- `createdAt` / `updatedAt` (timestamps, managed by DB)

---

### POST /api/v1/dealer-task-statuses

Sync all task statuses for a dealer in a single request. This endpoint **creates, updates, deletes, and reorders** task statuses for the specified dealer.

**Auth:** Bearer token required.

**Request body:** `statusData` (array) is required. **`dealerId` is optional** — from JWT for normal users; **`ADMIN` must send `dealerId`**.

```json
{
  "statusData": [
    {
      "statusId": "e49e3b84-2071-4358-8caf-949f19acd8c9",
      "statusName": "TO-DO",
      "colour": "blue",
      "isDone": false
    },
    {
      "statusName": "In Progress",
      "colour": "Yellow",
      "isDone": false
    },
    {
      "statusName": "Complete",
      "colour": "green",
      "isDone": true
    }
  ]
}
```

- If `statusId` is present and belongs to this dealer: update `statusName`, `colour`, `isDone`, and assign `statusRank` based on array order.
- If `statusId` is omitted: create a new task status for this dealer with the given `statusName`, `colour`, `isDone` (default `false`), and `statusRank`.
- Any existing task status for this dealer **not present** in `statusData` is **deleted**.
- The order of `statusData` defines `statusRank` (1, 2, 3, …).

**Response (200):** `data` is the final array of task statuses for that dealer, ordered by `statusRank`. Each item includes `statusId`, `dealerId`, `statusName`, `colour`, `statusRank`, `isDone`, `createdAt`, `updatedAt`.

**Error codes:** `4221` — no statuses provided; `4222` — duplicate statusName in payload; `4090` — duplicate statusName conflict at the database (P2002); `4032`–`4033`, `4226` — dealer scope.

---

### PUT /api/v1/dealer-task-statuses/order

Update `statusRank` for multiple task statuses for a dealer in one request. This endpoint only changes the order (ranks); it does not create, delete, rename, or change `isDone`.

**Auth:** Bearer token required.

**Request body:** **`dealerId` optional** (JWT for normal users; **`ADMIN` required**). `items` required.

```json
{
  "items": [
    { "statusId": "uuid-1", "statusRank": 1 },
    { "statusId": "uuid-2", "statusRank": 2 }
  ]
}
```

- All `statusId`s must belong to the given dealer.
- Only the provided task statuses are reordered; other statuses for the dealer keep their existing `statusRank`.

**Response (200):** `data` is the full array of task statuses for that dealer, ordered by updated `statusRank`.

**Error codes:** `4221` — no statuses provided; `4223` — one or more statuses do not belong to this dealer; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-task-statuses

Get all task statuses for the **dealer in the JWT**, ordered by `statusRank`. No query parameters.

**Auth:** Bearer token required.

**Response (200):** `data` is an array of task statuses (each with `statusId`, `dealerId`, `statusName`, `colour`, `statusRank`, `isDone`, `createdAt`, `updatedAt`).

**Error codes:** `4033` / `4226` — missing dealer context for your role.

---

### GET /api/v1/dealer-task-statuses/:dealerId

Get all task statuses for a dealer, ordered by `statusRank`. For non-`ADMIN`, **`:dealerId` must match the JWT `dealerId`**.

**Auth:** Bearer token required.

**Error codes:** `4032` — path dealer does not match session; otherwise returns empty array if the dealer has no task statuses.

---

## Dealer Task Templates

Per-dealer **predefined job/task catalog** (e.g. "PUC", "Insurance", "Name transfer") picked when creating a task. `templateName` is **required** and must be **unique per dealer** (but not globally). Templates always belong to a dealer.

**Auth:** All dealer task template endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Model

From Prisma `DealerTaskTemplate` model:

- `templateId` (UUID, PK)
- `dealerId` (UUID, **required**, FK to Dealer; cascade delete)
- `templateName` (string, **required**, max 255; unique per dealer)
- `createdAt` / `updatedAt` (timestamps, managed by DB)

---

### POST /api/v1/dealer-task-templates

Create a new dealer task template.

**Auth:** Bearer token required.

**Request body:**

| Field        | Type   | Required | Validation                          |
|--------------|--------|----------|-------------------------------------|
| dealerId     | string | No       | From JWT for normal users; **required for `ADMIN`** |
| templateName | string | Yes      | Min 1, max 255; unique per dealer   |

**Response (201):** `data` is the created dealer task template (includes `templateId`, `dealerId`, `templateName`, `createdAt`, `updatedAt`).

**Error codes:** `4090` — template name already exists for this dealer; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-task-templates

List dealer task templates **for a specific dealer** (paginated), ordered by `templateName` ascending.

**Auth:** Bearer token required.

**Query params:**

| Param    | Type   | Required | Description                                 |
|----------|--------|----------|---------------------------------------------|
| page     | number | No       | 1-based page index (default 1)             |
| limit    | number | No       | Items per page (default 10, max 100)       |
| dealerId | string | No       | From JWT when omitted; **`ADMIN` must pass `dealerId`** |

**Response (200):** `data.data` = array of task templates for the given dealer; `data.meta` = `{ total, page, limit, totalPages }`.

**Error codes:** `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-task-templates/:id

Get a single dealer task template by ID.

**Auth:** Bearer token required.

**Error codes:** `4066` — dealer task template not found; `4034` — wrong dealer.

---

### PATCH /api/v1/dealer-task-templates/:id

Update an existing dealer task template. Only `templateName` can be updated.

**Auth:** Bearer token required.

**Request body:**

| Field        | Type   | Required | Validation                        |
|--------------|--------|----------|-----------------------------------|
| templateName | string | Yes      | Min 1, max 255; unique per dealer |

**Response (200):** `data` is the updated dealer task template.

**Error codes:** `4066` — dealer task template not found; `4090` — template name already exists for this dealer; `4034` — wrong dealer.

---

### DELETE /api/v1/dealer-task-templates/:id

Delete a dealer task template by ID.

**Auth:** Bearer token required.

**Response (200):** `data` is `{}`.

**Error codes:** `4066` — dealer task template not found; `4034` — wrong dealer.

---

## Dealer Tags

Per-dealer **Finder-style tag master** (coloured labels). A `VehicleProcess` can carry **multiple** tags via the `ProcessTag` join. `tagName` is **required** and must be **unique per dealer** (`@@unique([dealerId, tagName])`). `colour` is an optional swatch.

**Auth:** All dealer tag endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`. Scope is **agent-aware** — dealers use their own token dealer; agents/super-admin pass an explicit `dealerId` (query on GET, body on POST) for a dealer they manage.

### Model

From Prisma `DealerTag` model:

- `tagId` (UUID, PK)
- `dealerId` (UUID, **required**, FK to Dealer; cascade delete)
- `tagName` (string, **required**, max 255; unique per dealer)
- `colour` (string, optional, max 50)
- `createdAt` / `updatedAt` (timestamps, managed by DB)

---

### GET /api/v1/dealer-tags

List the resolved dealer's tags, ordered by `tagName` ascending. Returns a plain array (not paginated).

**Auth:** Bearer token required.

**Query params:**

| Param    | Type   | Required | Description                                                        |
|----------|--------|----------|--------------------------------------------------------------------|
| dealerId | string | No       | From JWT for a dealer; **agents/super-admin pass a managed dealer** |

**Response (200):** `data` = array of tags (`tagId`, `dealerId`, `tagName`, `colour`, `createdAt`, `updatedAt`).

**Error codes:** `4032` — dealerId does not match your session; `4033` — account not linked to a dealer/agent; `4039` — agent does not manage this dealer; `4226` — dealerId required for this role.

---

### POST /api/v1/dealer-tags

Create a new tag for the resolved dealer.

**Auth:** Bearer token required.

**Request body:**

| Field    | Type   | Required | Validation                                              |
|----------|--------|----------|--------------------------------------------------------|
| dealerId | string | No       | From JWT for a dealer; **agents/super-admin must pass a managed dealer** |
| tagName  | string | Yes      | Trimmed, min 1, max 255; unique per dealer             |
| colour   | string | No       | Trimmed, max 50                                        |

**Response (201):** `data` is the created tag.

**Error codes:** `4090` — duplicate `tagName` for this dealer (Prisma P2002); `4032`/`4033`/`4039`/`4226` — dealer scope.

---

### PATCH /api/v1/dealer-tags/:id

Update a tag's `tagName` and/or `colour`. The tag is loaded first and its `dealerId` is checked against the caller's managed dealer.

**Auth:** Bearer token required.

**Request body:**

| Field   | Type   | Required | Validation                                  |
|---------|--------|----------|---------------------------------------------|
| tagName | string | No       | Trimmed, min 1, max 255; unique per dealer  |
| colour  | string | No       | Trimmed, max 50                             |

**Response (200):** `data` is the updated tag.

**Error codes:** `4069` — dealer tag not found; `4090` — duplicate `tagName` for this dealer; `4034` — wrong dealer; `4039` — agent does not manage this dealer.

---

### DELETE /api/v1/dealer-tags/:id

Delete a tag by ID. Its `ProcessTag` join rows cascade automatically. The tag is loaded first and its `dealerId` is checked against the caller's managed dealer.

**Auth:** Bearer token required.

**Response (200):** `data` is `{}`.

**Error codes:** `4069` — dealer tag not found; `4034` — wrong dealer; `4039` — agent does not manage this dealer.

---

## Dealer References

Dealer references store contact/reference information per dealer. `referenceName` and `referenceNumber` are **required** and must be **unique per dealer** (but not globally).

**Auth:** All dealer reference endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Model

From Prisma `DealerReference` model:

- `referenceId` (UUID, PK)
- `dealerId` (UUID, optional FK to Dealer; this API requires a dealerId)
- `referenceName` (string, **required**, max 255; unique per dealer)
- `referenceNumber` (string, **required**, max 20; unique per dealer)
- `createdAt` / `updatedAt` (timestamps, managed by DB)

---

### POST /api/v1/dealer-references

Create a new dealer reference.

**Auth:** Bearer token required.

**Request body:**

| Field          | Type   | Required | Validation                          |
|----------------|--------|----------|-------------------------------------|
| dealerId       | string | No       | From JWT for normal users; **required for `ADMIN`** |
| referenceName  | string | Yes      | Min 1, max 255; unique per dealer   |
| referenceNumber| string | Yes      | Min 1, max 20; unique per dealer    |

**Response (201):** `data` is the created dealer reference (includes `referenceId`, timestamps).

**Error codes:** `4098` — reference name already exists for this dealer; `4099` — reference number already exists for this dealer; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-references

List dealer references **for a specific dealer** (paginated).

**Auth:** Bearer token required.

**Query params:**

| Param    | Type   | Required | Description                                 |
|----------|--------|----------|---------------------------------------------|
| page     | number | No       | 1-based page index (default 1)             |
| limit    | number | No       | Items per page (default 10, max 100)       |
| dealerId | string | No       | From JWT when omitted; **`ADMIN` must pass `dealerId`** |

**Response (200):** `data.data` = array of references for the given dealer; `data.meta` = `{ total, page, limit, totalPages }`.

**Error codes:** `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-references/ddl

List all dealer references for a dealer **without pagination** (dropdown / select). Sorted by `referenceName` ascending.

**Auth:** Bearer token required.

**Query params:**

| Param    | Type   | Required | Description                                 |
|----------|--------|----------|---------------------------------------------|
| dealerId | string | No       | From JWT when omitted; **`ADMIN` must pass `dealerId`** |

**Response (200):** `data` is an array of:

```json
[
  {
    "referenceId": "uuid",
    "referenceName": "John Doe",
    "referenceNumber": "+911234567890"
  }
]
```

**Error codes:** `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-references/:id

Get a single dealer reference by ID.

**Auth:** Bearer token required.

**Error codes:** `4046` — dealer reference not found; `4034` — wrong dealer.

---

### PATCH /api/v1/dealer-references/:id

Update an existing dealer reference. Only `referenceName` and `referenceNumber` can be updated.

**Auth:** Bearer token required.

**Error codes:** `4046` — dealer reference not found; `4098` — reference name already exists for this dealer; `4099` — reference number already exists for this dealer; `4034`.

---

### DELETE /api/v1/dealer-references/:id

Delete a dealer reference by ID.

**Auth:** Bearer token required.

**Error codes:** `4046` — dealer reference not found; `4034`.

---

## Vehicles

Vehicle master data. Each vehicle is uniquely identified by its `vehicleId`. **registrationNumber** is required and unique. **chassisNumber** and **engineNumber** are unique **when not null** (multiple vehicles may omit them). Other detail fields may be omitted (`null`).

**Auth:** All vehicle endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Model

From Prisma `Vehicle` model:

- `vehicleId` (UUID, PK)
- `registrationNumber` (string, **required**, max 50; **unique**)
- `chassisNumber` (string **or null**, max 100; **unique** when set)
- `engineNumber` (string **or null**, max 100; **unique** when set)
- `vehicleType` (string **or null**, max 50)
- `make` (string **or null**, max 100)
- `model` (string **or null**, max 100)
- `registrationDate` (date **or null**; stored as `Date` in DB)
- `manufactureMonth` (int **or null**, 1–12 when set)
- `manufactureYear` (int **or null** when set)
- `createdAt` / `updatedAt` (timestamps, managed by DB)

---

### POST /api/v1/vehicles

Create a new vehicle.

**Auth:** Bearer token required.

**Request body:**

| Field              | Type           | Required | Validation |
|--------------------|----------------|----------|------------|
| registrationNumber | string         | Yes      | Min 1, max 50; **must be unique** |
| chassisNumber      | string \| null | No       | Max 100; empty/`null` omitted; **must be unique** if set |
| engineNumber       | string \| null | No       | Max 100; empty/`null` omitted; **must be unique** if set |
| vehicleType        | string \| null | No       | Max 50; empty/`null` → `null` |
| make               | string \| null | No       | Max 100 |
| model              | string \| null | No       | Max 100 |
| registrationDate   | string \| null | No       | Date string (e.g. `2026-03-15`) or `null` |
| manufactureMonth   | number \| null | No       | Integer 1–12 or `null` |
| manufactureYear    | number \| null | No       | Integer 1900–3000 or `null` |

**Response (201):** `data` is the created vehicle (includes `vehicleId`, timestamps).

**Error codes:** `4100` — registration number already exists; `4101` — chassis number already exists; `4102` — engine number already exists.

---

### GET /api/v1/vehicles

List vehicles (paginated).

**Auth:** Bearer token required.

**Query params:**

| Param | Type   | Required | Description                      |
|-------|--------|----------|----------------------------------|
| page  | number | No       | 1-based page index (default 1)  |
| limit | number | No       | Items per page (default 10, max 100) |

**Response (200):** `data.data` = array of vehicles; `data.meta` = `{ total, page, limit, totalPages }`.

---

### GET /api/v1/vehicles/history

Per-vehicle **buy/sell history** for the caller's own dealership, plus an anonymized cross-dealer "changed hands" signal. Resolves the vehicle by (normalized) registration number and requires the caller to have handled it (**≥1 own process**), else **404** — so this is **not** a cross-dealer existence oracle.

**Auth:** Bearer token required. **Dealer-scoped:** the dealer is taken from the JWT `dealerId`. Super-admin / agent tokens (no `dealerId`) get **403 `4033`**.

> Registered **before** `/:id` so `history` is not captured as a vehicle id.

**Query params:**

| Param              | Type   | Required | Description                                                                            |
|--------------------|--------|----------|----------------------------------------------------------------------------------------|
| registrationNumber | string | Yes      | Reg number (1–50 chars). Normalized server-side (uppercased, spaces/hyphens stripped). |

**Response (200):** `data` =
- `vehicle` — non-sensitive spec header: `vehicleId`, `registrationNumber`, `make`, `model`, `chassisNumber`, `engineNumber`, `manufactureYear`.
- `events[]` — the caller's **OWN** timeline (full detail), ordered by process date ascending (nulls last), then `BUY` before `SELL`. Each: `{ kind: 'BUY' | 'SELL', date, counterpartyName, counterpartyMobile, counterpartyAddress, amount, currency, processId, referenceName }`. A **BUY** is emitted when the process has a SELLER (amount = `purchasePrice`, or `null` = "not recorded"); a **SELL** when it has a BUYER (amount = `salePrice`, or `null`). Two events can share a `processId` (a process with both a seller and buyer). `referenceName` is the referrer for that side of the deal — a **BUY** carries the process's `SELL`-type reference, a **SELL** carries its `BUY`-type reference — and is `null` for a direct deal (shown as "Self" in the UI).
- `summary` — own data only: `{ processCount, grossMarginTotal, expenseTotal, netProfitTotal, currency }`. `grossMarginTotal` sums `salePrice − purchasePrice` over processes where **both** prices exist (Decimal math, no float drift), else `null`. `expenseTotal` sums all of the caller's `ProcessExpense` amounts for the vehicle (always a number, `0` if none). `netProfitTotal` = `grossMarginTotal − expenseTotal`, or `null` when there is no gross margin.
- `market` — **anonymized, across all dealers**: `{ changedHands, dealersInvolved }`. Coarse, non-attributable counts **only** — no price, no customer PII, no dealer identity, and **no transaction dates** (a cross-dealer year range was intentionally omitted, since `min/max processDate` over all dealers would leak a competitor's transaction timing to a caller who handled the vehicle).

**Visibility contract:** a dealer sees their **own** prices/customers/dates in full; the platform-wide signal is redacted to how many times the vehicle changed hands, how many dealerships were involved, and a year range.

```json
{
  "statusCode": 200,
  "message": "Vehicle history retrieved",
  "data": {
    "vehicle": { "vehicleId": "…", "registrationNumber": "GJ03BR9195", "make": "Maruti", "model": "Swift", "chassisNumber": null, "engineNumber": null, "manufactureYear": 2019 },
    "events": [
      { "kind": "BUY",  "date": "2026-06-28T15:07:00.413Z", "counterpartyName": "Old Owner", "counterpartyMobile": "9111111111", "counterpartyAddress": null, "amount": 50000, "currency": "INR", "processId": "…", "referenceName": "Ramesh Broker" },
      { "kind": "SELL", "date": "2026-06-28T15:07:00.413Z", "counterpartyName": "New Buyer", "counterpartyMobile": "9222222222", "counterpartyAddress": null, "amount": 65000, "currency": "INR", "processId": "…", "referenceName": null }
    ],
    "summary": { "processCount": 2, "grossMarginTotal": 15000, "expenseTotal": 5000.5, "netProfitTotal": 9999.5, "currency": "INR" },
    "market": { "changedHands": 2, "dealersInvolved": 1 }
  }
}
```

**Error codes:** `4047` — vehicle not found, or not handled by your dealership; `4033` — your account is not linked to a dealer.

---

### GET /api/v1/vehicles/:id

Get a single vehicle by ID.

**Auth:** Bearer token required.

**Error codes:** `4047` — vehicle not found.

---

### PATCH /api/v1/vehicles/:id

Update an existing vehicle. Same body fields as create (nullable fields may be `null`). Uniqueness rules for `registrationNumber` and non-null `chassisNumber` / `engineNumber` are enforced as in create.

**Auth:** Bearer token required.

**Error codes:** `4047` — vehicle not found; `4100` — registration number already exists; `4101` — chassis number already exists; `4102` — engine number already exists.

---

### DELETE /api/v1/vehicles/:id

Delete a vehicle by ID.

**Auth:** Bearer token required.

**Error codes:** `4047` — vehicle not found.

---

## States

Master data for Indian states (or any state list). `stateName` is **unique**.

**Auth:** All state endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Model

- `stateId` (UUID, PK)
- `stateName` (string, **required**, max 255; **unique**)
- `creationDate` / `modificationDate` (timestamps, managed by DB)

---

### POST /api/v1/states

Create a state.

**Auth:** Bearer token required.

**Request body:** `{ "stateName": "Maharashtra" }`

**Response (201):** created state.

**Error codes:** `4103` — state name already exists.

---

### GET /api/v1/states

List states (paginated).

**Auth:** Bearer token required.

**Query params:** `page`, `limit` (optional).

---

### GET /api/v1/states/ddl

List all states for dropdown (no pagination). Sorted by `stateName` ascending.

**Auth:** Bearer token required.

**Response (200):** `data` is an array of:

```json
[
  { "stateId": "uuid", "stateName": "Maharashtra" }
]
```

---

### GET /api/v1/states/:id

Get a state by ID.

**Auth:** Bearer token required.

**Error codes:** `4048` — state not found.

---

### PATCH /api/v1/states/:id

Update a state.

**Auth:** Bearer token required.

**Error codes:** `4048` — state not found; `4103` — state name already exists.

---

### DELETE /api/v1/states/:id

Delete a state by ID. (Deletes its cities due to cascade.)

**Auth:** Bearer token required.

**Error codes:** `4048` — state not found.

---

## Cities

Master data for cities. `cityName` is **unique per state** (not global).

**Auth:** All city endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Model

- `cityId` (UUID, PK)
- `stateId` (UUID, **required**, FK to State; cascade delete)
- `cityName` (string, **required**, max 255; **unique per state**)
- `creationDate` / `modificationDate` (timestamps, managed by DB)

---

### POST /api/v1/cities

Create a city for a state.

**Auth:** Bearer token required.

**Request body:** `{ "stateId": "<uuid>", "cityName": "Mumbai" }`

**Error codes:** `4048` — state not found; `4104` — city name already exists for this state.

---

### GET /api/v1/cities

List cities (paginated). Optionally filter by state.

**Auth:** Bearer token required.

**Query params:** `page`, `limit` (optional), `stateId` (optional UUID).

---

### GET /api/v1/cities/ddl/:stateId

List all cities for dropdown for a specific state (no pagination). Sorted by `cityName` ascending.

**Auth:** Bearer token required.

**Path params:** `stateId` (UUID).

**Response (200):** `data` is an array of:

```json
[
  { "cityId": "uuid", "stateId": "uuid", "cityName": "Mumbai" }
]
```

**Error codes:** `4048` — state not found.

---

### GET /api/v1/cities/:id

Get a city by ID.

**Auth:** Bearer token required.

**Error codes:** `4049` — city not found.

---

## Vehicle Processes

Vehicle processes store a process record (vehicle + dealer + date) and its associated persons (buyer/seller) in one workflow.

**Auth:** All vehicle process endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

**Managed-dealer scope (dealer *or* agent):** these endpoints (and the process children — `/persons`, `/process-tasks`, `/process-expenses`, `/process-upload-photos`) resolve the target dealer via the unified **managed-dealer** scope:
- **Dealer** caller → their own token `dealerId` (an explicit `dealerId` must match, else `4032`).
- **Agent** caller → must pass an explicit `dealerId` (body on writes, `?dealerId=` on reads) they **manage**: a placeholder they own, or a real dealer with an ACTIVE `DealerAgent` grant. Not managed → `4039`. Creating/starting a process for an **owned placeholder** additionally requires the agent's **own subscription** (`Agent.isSubscribe`), else `4020` (402); a **granted real dealer** is covered by the dealer's subscription (no agent-subscription needed).
- **Super-admin** → optional `?dealerId=` to narrow; sees all otherwise.

### Model (simplified)

- `processId` (UUID, PK)
- `vehicleId` (UUID, required by API)
- `dealerId` (UUID, required by API)
- `processDate` (timestamp, required by API)
- `persons[]` (array of persons created for this process)

Person rules:

- `address` can be `null`
- All other person fields are required: `personName`, `mobileNumber`, `personType`

---

### POST /api/v1/vehicle-processes/start

Starts a workflow: **upserts** a **Vehicle** by `registrationNumber`, then creates a **VehicleProcess** for the dealer in the JWT.

**Vehicle upsert**

- If no row exists for `registrationNumber`, a new vehicle is created (same uniqueness rules as `POST /vehicles` for chassis/engine when provided).
- If a row exists and any compared field differs (`chassisNumber`, `engineNumber`, `vehicleType`, `make`, `model`, `registrationDate`, `manufactureMonth`, `manufactureYear`), the vehicle is updated (same rules as `PATCH /vehicles/:id`).
- If a row exists and all compared fields match, the vehicle row is left unchanged.

**Process**

- `dealerId` is taken from the access token. Optional **`dealerId` in the JSON body** is required for **`ADMIN`** (same pattern as other dealer-scoped routes); non-admin users must not send a conflicting `dealerId`.
- **`persons`** (optional): omit the field, send `[]`, or omit entries to create **no** `Person` rows. If you send one or more person objects (same shape as **`POST /api/v1/vehicle-processes`** — `personName`, `mobileNumber`, `personType` `SELLER` | `BUYER`, optional `address`), they are created with the process in one transaction. **At most one SELLER and one BUYER** per process.
- **Prices** (optional): `purchasePrice` (what the dealer paid the SELLER) and `salePrice` (what the BUYER paid) — non-negative, ≤2 decimals, stored `Decimal(14,2)`; plus `priceCurrency` (default `INR`). Prices are **independent** of the persons — either may be recorded whether or not a seller/buyer person is present. They live on the dealer-scoped process (private per dealer) and feed **`GET /vehicles/history`**.
- **`uploadPhotos`** (optional): omit or `[]` to skip. Each item: `{ category, imageName }` (same fields as **`POST /api/v1/process-upload-photos`**, without `processId` — assigned automatically).
- **`processReferences`** (optional): omit or `[]` to skip. Each item: `{ referenceId, referenceType }` where `referenceType` is `BUY` (buyer reference) or `SELL` (seller reference). `referenceId` must exist in **`dealer_references`** and belong to the dealer when scoped. At most one row per `referenceType` per request.
- **`status`** (optional): the process's initial fixed lifecycle status — one of `SOLD` / `COMPLETE` / `SCRAP`, or omit/`null` for **OPEN** (default). When a terminal status is chosen at creation, the "at most one open process per vehicle per dealer" invariant does **not** apply, so `4113` is never raised for a non-OPEN create.
- **`dealNumber`** (optional): a human-facing deal/reference number (free-text, trimmed, ≤100 chars). Omit, `null`, or blank to leave it unset.
- `processDate` defaults to **now** if omitted; otherwise send an ISO-8601 string.

**Auth:** Bearer token required.

**Request body:** Same fields as **`POST /api/v1/vehicles`** (`registrationNumber` required; other vehicle fields optional/nullable), plus optional `processDate` (ISO string), plus optional **`dealerId`** (required for **`ADMIN`**), plus optional **`persons`**, **`uploadPhotos`**, **`processReferences`** (arrays, may be empty), plus optional **`status`** (`SOLD` | `COMPLETE` | `SCRAP` | `null`, default `null` = OPEN) and **`dealNumber`** (string, ≤100).

**Example:**

```json
{
  "registrationNumber": "MH12AB1234",
  "vehicleType": "Car",
  "make": "Maruti",
  "model": "Swift",
  "processDate": "2026-04-05T12:00:00.000Z",
  "status": "SOLD",
  "dealNumber": "DEAL-2026-0042",
  "persons": [
    {
      "personName": "John Seller",
      "mobileNumber": "+919999999999",
      "personType": "SELLER"
    },
    {
      "personName": "Jane Buyer",
      "mobileNumber": "+918888888888",
      "personType": "BUYER"
    }
  ],
  "uploadPhotos": [
    { "category": "RC Front", "imageName": "rc-front.png" },
    { "category": "RC Back", "imageName": "rc-back.png" }
  ],
  "processReferences": [
    { "referenceId": "uuid-seller-ref", "referenceType": "SELL" },
    { "referenceId": "uuid-buyer-ref", "referenceType": "BUY" }
  ]
}
```

**Response (201):** `data` = `{ vehicle, process, vehicleCreated, vehicleUpdated, uploadPhotos, processReferences }` where `process` includes `persons`, `processUploadPhotos`, and `processReferences` (and carries the `status` and `dealNumber` set on it); top-level `uploadPhotos` / `processReferences` mirror the nested arrays for convenience. The new process is created with the **chosen status** (default **OPEN**, `status: null`) and the optional `dealNumber`.

**Error codes:** `4043` — dealer not found; `4057` — dealer reference not found; `4035` — reference not in dealer scope; `4100`–`4102` — vehicle uniqueness conflicts on create/update; `4032`–`4033`, `4226` — dealer scope; `4227` — invalid `processDate`; `4228` — duplicate `referenceType` in `processReferences`; **`4113`** — an **OPEN** (status-less) process already exists for this vehicle under this dealer (set its status first — at most one open process per vehicle per dealer). This fires **only for an OPEN create** (`status` omitted/`null`); a `SOLD`/`COMPLETE`/`SCRAP` create is never blocked by an existing open process. **`4114`** — a `SOLD` create must include a buyer (a `persons` entry with `personType: "BUYER"`). When created `SOLD`, `soldDate` is stamped to the chosen `processDate`.

---

### POST /api/v1/vehicle-processes

Create a vehicle process and its persons in **one request**.

**Auth:** Bearer token required.

**Request body:** `vehicleId`, `processDate`, `persons` required. **`dealerId` optional** — from JWT for normal users; **`ADMIN` must send `dealerId`**.

```json
{
  "vehicleId": "uuid",
  "processDate": "2026-03-15T10:30:00.000Z",
  "persons": [
    {
      "personName": "John Seller",
      "address": null,
      "mobileNumber": "+919999999999",
      "personType": "SELLER"
    },
    {
      "personName": "Jane Buyer",
      "address": "Somewhere, City",
      "mobileNumber": "+918888888888",
      "personType": "BUYER"
    }
  ]
}
```

**Response (201):** created process including `persons[]`. The process is created **OPEN** (`status: null`).

**Error codes:** `4047` — vehicle not found; `4043` — dealer not found; `4032`–`4033`, `4226` — dealer scope; **`4113`** — an **OPEN** (status-less) process already exists for this vehicle under this dealer (set its status first — at most one open process per vehicle per dealer).

---

### GET /api/v1/vehicle-processes

List vehicle processes (paginated). Each item includes `persons[]`, `vehicle`, `tags[]` (`[{ tagId, tagName, colour }]`, ordered by `tagName`), the process **`status`** (`"SOLD"` | `"COMPLETE"` | `"SCRAP"` | `null`, where `null` = OPEN), and **`starredPhotoUrl`** — the resolved public URL of the process's starred (primary/profile) vehicle photo, or `null` when none. **Soft-deleted (binned) processes are excluded** — see `GET /vehicle-processes/bin`.

**Auth:** Bearer token required.

**Query params:** `page`, `limit` (optional). Optional **`search`** — free-text filter over the vehicle's registration number (matched space/punctuation-insensitively, since numbers are stored normalized) and any linked person's name (case-insensitive). Optional **`tagId`** (uuid) — narrows the list to processes carrying that tag (server-side, so pagination totals stay correct). Optional **`status`** — one of `SOLD` | `COMPLETE` | `SCRAP` | `OPEN`; `OPEN` matches status-less (open) processes, a terminal value matches that status exactly. Optional **`dateFrom`** / **`dateTo`** (ISO 8601 datetimes) — inclusive `processDate` range (used by the dashboard date-range picker); either bound may be given alone. `search`, `tagId`, `status`, and the date range are AND-ed. Agents pass `dealerId` (a dealer they manage) to scope the list.

---

### GET /api/v1/vehicle-processes/agent-board

The **caller agent's own** (agent-created) processes for the agent board — every process on a placeholder dealer the agent owns, each carrying its **agent-kanban status**, vehicle registration, source dealer summary, and tags. Non-agent callers receive an empty list. Pairs with `GET /process-assignments/agent` (dealer-assigned work) to build the unified agent board.

**Auth:** Bearer token required (agent).

**Response (200):** `data` is an array of:

```json
{
  "processId": "uuid",
  "agentStatusId": "uuid | null",
  "agentStatus": { "statusId": "uuid", "statusName": "To-Do", "colour": "#2563EB" },
  "vehicle": { "registrationNumber": "MH12AB1234" },
  "dealer": { "dealerId": "uuid", "firmName": "Placeholder Motors" },
  "tags": [{ "tagId": "uuid", "tagName": "Urgent", "colour": "#EF4444" }],
  "createdAt": "2026-07-26T12:00:00.000Z"
}
```

- **`agentStatus`** is `null` until a status is set; new agent-created processes default to the agent's lowest-ranked status.
- **`tags`** — the process's `DealerTag`s via the `ProcessTag` join, `[{ tagId, tagName, colour }]` ordered by `tagName` (`[]` when none).

---

### GET /api/v1/vehicle-processes/export

Export the caller's vehicle processes over a `processDate` range as an **Excel workbook** or **PDF**, including only the selected sections. **Streams a binary file** (an `attachment` with `Content-Disposition`) — this endpoint does **not** use the JSON `sendSuccess` envelope. Scope is resolved exactly like `GET /vehicle-processes`: a **dealer** exports their own processes; an **agent** passes `dealerId` (a dealer they manage); a **super-admin** passes `dealerId` (required) or omits it for all.

**Auth:** Bearer token required.

**Query params:**

| Param | Type | Notes |
|-------|------|-------|
| `format` | `"excel"` \| `"pdf"` | **Required.** |
| `dateFrom` | ISO datetime | Inclusive lower bound on the date field. Optional. |
| `dateTo` | ISO datetime | Inclusive upper bound on the date field. Optional. |
| `dateField` | `"processDate"` \| `"soldDate"` | Which date column the range filters on (default `processDate`). `soldDate` naturally excludes never-sold processes. |
| `statuses` | string | Comma-separated lifecycle statuses to include: `OPEN,SOLD,COMPLETE,SCRAP` (`OPEN` = status-less). Unknown tokens ignored; **empty/absent or all four = every status**. Multi-select is OR-ed. |
| `sections` | string | Comma-separated subset of `vehicle,persons,deal,amount,documents,vehicleImages`. Unknown tokens are ignored; **empty/absent = all sections**. |
| `dealerId` | uuid | Managed-dealer passthrough (agent/super-admin); ignored for a dealer caller. |

- **Default range:** when **both** `dateFrom` and `dateTo` are omitted, the **current month** is exported.
- **Firm letterhead:** the caller dealer's firm name, address (`Address, City, State - Pincode`) and mobile appear at the TOP of both the PDF and each Excel sheet; the PDF additionally repeats `firm · mobile` (left) + `Page N` (right) in the footer of every page (Excel carries the same as a print footer). All firm fields are blank for a super-admin all-dealers export.
- **Sections → content:** `vehicle` (reg no, make/model, mfg, reg date, chassis, engine, type); `persons` (active seller & buyer name + mobile); `deal` (deal number, status, process/sold dates, seller/buyer references); `amount` (purchase, sale, Σ expenses, computed profit); `documents` (DOCUMENT-kind images, embedded); `vehicleImages` (VEHICLE-kind photos, embedded). A leading **Reg No** column is always present.
- **Excel:** a SINGLE `Vehicle Processes` sheet, **one row per process** — all selected scalar details as columns (incl. seller/buyer addresses), plus `Documents` / `Vehicle Photos` column groups with each image embedded in its own column (side by side) in that row. Firm letterhead on top, frozen header, zebra rows.
- **PDF:** portrait A4. Firm letterhead on page 1, then one card per process: header (registration, make | model, status), the selected detail groups, and its documents and photos together. A process is kept in one piece — if it does not fit in what is left of a page it starts on a new page. Only a process taller than a whole page runs over; its overflow page is labelled `<registration> — continued`. Photo captions are a single line (cut with an ellipsis).
- Stored images are WebP and are transcoded to JPEG (via `sharp`) for embedding; PDFs and unreadable files are skipped. At most **500** processes are exported; response headers `X-Export-Count` and `X-Export-Truncated` report the count and whether the range exceeded the cap.

**Response (200):** the file bytes. Headers: `Content-Type` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` or `application/pdf`), `Content-Disposition: attachment; filename="vehicle-processes_YYYYMMDD.{xlsx|pdf}"`, `Content-Length`, `X-Export-Count`, `X-Export-Truncated`.

**Error codes:** `4220` — invalid query (e.g. missing/invalid `format`); `4032`/`4033`/`4039`/`4226` — dealer-scope resolution failures (same as the list endpoint).

---

### GET /api/v1/vehicle-processes/:id

Get a vehicle process by ID (includes `persons[]`).

**Auth:** Bearer token required.

**Error codes:** `4050` — vehicle process not found; `4034` — wrong dealer.

---

### GET /api/v1/vehicle-processes/:id/details

Returns **vehicle**, **owner** (seller), **buyer**, **references**, and **photos with URLs** in one response for a given `processId`.

**Auth:** Bearer token required.

**Path:** `id` = `processId`.

**Response (200):** `data` shape:

```json
{
  "processId": "uuid",
  "vehicleId": "uuid",
  "dealerId": "uuid",
  "agentStatusId": "uuid | null",
  "status": "SOLD | COMPLETE | SCRAP | null",
  "dealNumber": "DEAL-2026-0042 | null",
  "soldDate": "2026-10-04T12:00:00.000Z | null",
  "buyerChangedAt": "2026-10-04T12:00:00.000Z | null",
  "trackingNumber": "IND123456789 | null",
  "receipt": {
    "imageName": "MH12AB1234_<processId>/<uuid>.pdf",
    "photoUrl": "http://localhost:4002/uploads/MH12AB1234_<processId>/<uuid>.pdf",
    "uploadedAt": "2026-07-28T12:00:00.000Z"
  },
  "processDate": "2026-04-05T12:00:00.000Z",
  "vehicle": {
    "vehicleId": "uuid",
    "registrationNumber": "MH12AB1234",
    "chassisNumber": null,
    "engineNumber": null,
    "vehicleType": "Car",
    "make": "Maruti",
    "model": "Swift",
    "registrationDate": "2020-01-15T00:00:00.000Z",
    "manufactureMonth": 6,
    "manufactureYear": 2019
  },
  "owner": {
    "personId": "uuid",
    "personName": "John Seller",
    "address": null,
    "mobileNumber": "+919999999999"
  },
  "buyer": {
    "personId": "uuid",
    "personName": "Jane Buyer",
    "address": "City",
    "mobileNumber": "+918888888888"
  },
  "references": {
    "seller": {
      "processReferenceId": "uuid",
      "referenceId": "uuid",
      "referenceName": "Agent A",
      "referenceNumber": "+911111111111",
      "referenceType": "SELL"
    },
    "buyer": {
      "processReferenceId": "uuid",
      "referenceId": "uuid",
      "referenceName": "Agent B",
      "referenceNumber": "+912222222222",
      "referenceType": "BUY"
    }
  },
  "photos": [
    {
      "processUploadPhotoId": "uuid",
      "processUploadImageId": null,
      "category": "RC Front",
      "imageName": "abc-uuid.png",
      "photoUrl": "http://localhost:4002/uploads/abc-uuid.png",
      "kind": "DOCUMENT",
      "isStarred": false
    }
  ],
  "vehiclePhotos": [
    {
      "processUploadPhotoId": "uuid",
      "processUploadImageId": null,
      "category": "Vehicle Photo",
      "imageName": "MH12AB1234_<processId>/veh-uuid.jpg",
      "photoUrl": "http://localhost:4002/uploads/MH12AB1234_<processId>/veh-uuid.jpg",
      "kind": "VEHICLE",
      "isStarred": true
    }
  ],
  "tags": [
    { "tagId": "uuid", "tagName": "Urgent", "colour": "#EF4444" }
  ]
}
```

- **`status`** — the process's fixed lifecycle status: `SOLD` / `COMPLETE` / `SCRAP`, or `null` (OPEN, unset).
- **`dealNumber`** — the optional human-facing deal/reference number captured at creation, or `null`.
- **`soldDate`** — timestamp the process was first marked `SOLD` (preserved through a later `COMPLETE`), or `null` until sold.
- **`buyerChangedAt`** — timestamp the active buyer was last replaced via change-buyer, or `null` if never changed.
- **`createdAt`** — when the process row was created (used by the client to detect creation-time seller/buyer for the party-date display). The persons list (`GET /persons`) likewise now returns each person's `createdAt`.
- **`owner`** — first `SELLER` person on the process, or `null`.
- **`buyer`** — first `BUYER` person, or `null`.
- **`references.seller` / `references.buyer`** — linked `dealer_references` by `referenceType` `SELL` / `BUY`, or `null`.
- **`photos`** — document photos: `DOCUMENT`-kind rows from `process_upload_photo` (cancelled-buyer IDs excluded) **plus** all legacy `process_upload_image` rows (always `kind: "DOCUMENT"`). `photoUrl` is built from stored file keys using the request host (same rules as upload `publicUrl`); full URLs stored in DB are returned unchanged. Fields are backward-compatible with older clients; `kind` is additive.
- **`vehiclePhotos`** — `VEHICLE`-kind rows from `process_upload_photo` only, oldest first, capped at 5 per process (see `POST /process-upload-photos`). Same item shape as `photos`. Each carries **`isStarred`** — exactly one is `true` when the process has any vehicle photo (the primary/profile photo). Document rows in `photos` are always `isStarred: false`.
- **`tags`** — the process's `DealerTag`s via the `ProcessTag` join, ordered by `tagName` (`[]` when none).

**Error codes:** `4050` — vehicle process not found; `4034` — wrong dealer.

---

### PATCH /api/v1/vehicle-processes/:id

Update a vehicle process in **one request**. **`dealerId` in body** follows the same JWT / `ADMIN` rules as POST.

> **`persons` is optional.** Person management (add/edit/delete, and change-buyer) lives in the [`/persons`](#persons) endpoints. **Omit `persons`** for a price-only update and the process's persons are left untouched — including any `CANCELLED` buyers kept for history. When `persons` **is** provided it is a full replace (must be non-empty; the same single-seller/single-buyer invariant as `start` applies — **422 `4220`**). ⚠️ Do **not** re-send `persons` just to change other fields: a `CANCELLED` buyer re-sent alongside the active one trips the one-buyer rule.

> **Prices are carried forward, not persons.** Any omitted `purchasePrice` / `salePrice` is still set to `null`, so a price-only update must re-send the prices to preserve them (prices are independent of persons).

**Auth:** Bearer token required.

**Error codes:** `4050` — vehicle process not found; `4047` — vehicle not found; `4043` — dealer not found; `4034`; `4032`–`4033`, `4226`; `4220` — price/person invariant violation.

---

### PATCH /api/v1/vehicle-processes/:id/agent-status

Move an **agent-created** process into one of the owning agent's kanban columns on the agent board. Updates `agentStatusId` only. Authorized via managed-dealer scope (the process must be on a placeholder the caller manages) and the target status must belong to that placeholder's owner agent.

**Auth:** Bearer token required (agent / super-admin).

**Path:** `id` = `processId`.

**Body:**

```json
{ "agentStatusId": "uuid" }
```

**Response (200):** the updated process (`persons[]` included).

**Error codes:** `4050` — process not found; `4034`/`4039`/`4033` — not authorized for the dealer; `4226` — process not linked to a dealer; `4234` — process has no agent board, or the status is not the agent's; `4220` — invalid body.

---

### PATCH /api/v1/vehicle-processes/:id/receipt

The **agent working the process** uploads (or replaces) the **RTO receipt** — a PDF or image the RTO issues for the process. **Agent-only** (the assigned/managing agent, or super-admin); the **dealer can only download** it (it appears as `receipt` in the process details). The file is first uploaded flat via `POST /upload/generate` + `PUT`, then attached here (the server moves it into the process's folder).

**Auth:** Bearer (agent working the process, or super-admin).

**Body:** `{ "imageName": "<flat upload fileKey>" }`

**Response (200):** the updated process.

**Error codes:** `4050` — process not found; `4063` — not the agent working this process; `4220` — invalid body.

---

### DELETE /api/v1/vehicle-processes/:id/receipt

Removes the RTO receipt (the stored file is left on disk). Agent-only (+ super-admin).

**Error codes:** `4050`; `4063`.

---

### PATCH /api/v1/vehicle-processes/:id/tracking

The agent sets (or clears) the **RC-book post/courier tracking number** after dispatch — a single optional text field. Agent-only (+ super-admin); the dealer reads it (as `trackingNumber` in the details) to track the RC book. A blank value clears it.

**Auth:** Bearer (agent working the process, or super-admin).

**Body:** `{ "trackingNumber": "IND123456789" }` (blank/empty clears it)

**Response (200):** the updated process.

**Error codes:** `4050` — process not found; `4063` — not the agent working this process; `4220` — invalid body.

---

### PATCH /api/v1/vehicle-processes/:id/status

Set or clear a process's **fixed lifecycle status** (`SOLD` / `COMPLETE` / `SCRAP`, or `null` = OPEN). The caller must manage the process's dealer (agent-aware scope). Setting a terminal value is always allowed **except `SOLD`, which requires an active `BUYER` person** on the process (else `4114`). The first time a process becomes `SOLD`, its **`soldDate`** is stamped (preserved through a later `COMPLETE`, but **cleared** when reopened to OPEN or set to `SCRAP`). Sending `null` **reopens** the process and is rejected when **another** OPEN process already exists for the same vehicle under the same dealer (the "at most one open process per vehicle per dealer" invariant).

**Auth:** Bearer token required (dealer owner, managing agent, or super-admin — agent-aware scope).

**Path:** `id` = `processId`.

**Request body:**

| Field    | Type              | Required | Validation                                                       |
|----------|-------------------|----------|------------------------------------------------------------------|
| dealerId | string            | No       | Optional for agents/super-admin; must match the process's dealer |
| status   | string \| null    | Yes      | One of `SOLD` / `COMPLETE` / `SCRAP`, or `null` to reopen (OPEN) |

```json
{ "status": "SOLD" }
```

**Response (200):** the updated process (`persons[]` included), reflecting the new `status`.

**Error codes:** `4050` — vehicle process not found; `4034` — wrong dealer; `4039` — agent does not manage this dealer; `4033` — account not linked to a dealer/agent; **`4113`** — cannot reopen: another OPEN process already exists for this vehicle under this dealer; **`4114`** — cannot mark `SOLD`: the process has no active buyer (add one first); `4220` — invalid body.

---

### PATCH /api/v1/vehicle-processes/:id/sold-date

Edit the recorded **sold date** of a process that has already been marked `SOLD`. The caller must manage the process's dealer (agent-aware scope).

**Auth:** Bearer token required (dealer owner, managing agent, or super-admin — agent-aware scope).

**Path:** `id` = `processId`.

**Request body:**

| Field    | Type           | Required | Validation                                                        |
|----------|----------------|----------|-------------------------------------------------------------------|
| dealerId | string         | No       | Optional for agents/super-admin; must match the process's dealer  |
| soldDate | string (date)  | Yes      | ISO date or datetime string (coerced to a timestamp)              |

```json
{ "soldDate": "2026-10-01" }
```

**Response (200):** the updated process (`persons[]` included), reflecting the new `soldDate`.

**Error codes:** `4050` — vehicle process not found; `4034` — wrong dealer; `4039` — agent does not manage this dealer; `4033` — account not linked to a dealer/agent; **`4115`** — the process has not been marked `SOLD` yet (nothing to edit); `4220` — invalid body.

---

### PUT /api/v1/vehicle-processes/:id/tags

Full-replace the process's tags (Finder-style labels). The caller must manage the process's dealer; **every** `tagId` must belong to that same dealer. An **empty** `tagIds` clears all tags. The set is applied atomically (delete-all then insert). Duplicate ids in the request are de-duplicated.

**Auth:** Bearer token required (dealer owner, managing agent, or super-admin — agent-aware scope).

**Path:** `id` = `processId`.

**Request body:**

| Field    | Type     | Required | Validation                                             |
|----------|----------|----------|--------------------------------------------------------|
| dealerId | string   | No       | Optional for agents/super-admin; must match the process's dealer |
| tagIds   | string[] | Yes      | Array of tag UUIDs; may be empty to clear all tags     |

**Response (200):** `data` = the process's resulting tags, `[{ tagId, tagName, colour }]` ordered by `tagName`.

**Error codes:** `4050` — vehicle process not found; `4235` — one or more tags do not belong to this dealer; `4034` — wrong dealer; `4039` — agent does not manage this dealer; `4226` — process not linked to a dealer; `4220` — invalid body.

---

### DELETE /api/v1/vehicle-processes/:id

**Soft delete** — moves the vehicle process to the **recycle bin** (sets `deletedAt`) instead of removing it. The whole process is immediately hidden from every active read (lists, dashboard counts, per-vehicle history, agent board, task board/history, agent assignment lists, detail/`GET :id`), but **all its children (persons, documents, photos, tasks, expenses, tags, references, comments, assignments) stay in the DB and return intact on restore**. A binned process is **permanently purged (hard cascade delete) 7 days after deletion** — automatically (daily server sweep + a lazy purge whenever the bin is viewed); the purge also best-effort deletes each purged process's `uploads/{registration}_{processId}/` folder so no images are left orphaned on disk. A process already in the bin returns `4050`.

**Auth:** Bearer token required (dealer owner, managing agent, or super-admin — agent-aware scope).

**Response (200):** `{ "message": "Vehicle process moved to recycle bin", "data": {} }`.

**Error codes:** `4050` — vehicle process not found (or already binned); `4034` — wrong dealer; `4039` — agent does not manage this dealer.

---

### GET /api/v1/vehicle-processes/bin

List the **recycle bin** — soft-deleted (binned) processes for the caller's scope, paginated, newest deletion first. Viewing the bin first **lazily purges** any processes binned more than 7 days ago. Scope is resolved exactly like `GET /vehicle-processes`: a **dealer** sees their own bin; an **agent** passes `dealerId` (a dealer they manage); a **super-admin** sees all (or one dealer via `?dealerId`).

**Auth:** Bearer token required.

**Query params:** `page`, `limit` (optional); `dealerId` (uuid, optional — agent/super-admin scope passthrough).

**Response (200):** paginated; `data.data` is an array of:

```json
{
  "processId": "uuid",
  "registrationNumber": "MH12AB1234 | null",
  "ownerName": "Ramesh Kumar | null",
  "deletedAt": "2026-09-26T12:00:00.000Z",
  "purgeAt": "2026-10-03T12:00:00.000Z",
  "daysLeft": 7
}
```

- **`ownerName`** — the process's ACTIVE seller (falls back to the first person), or `null`.
- **`purgeAt`** = `deletedAt` + 7 days; **`daysLeft`** = whole days until purge, clamped at `0`.

**Error codes:** `4039` — agent does not manage this dealer; `4226` — agent/super-admin missing `dealerId`; `4220` — invalid query.

---

### GET /api/v1/vehicle-processes/agent-bin

The **caller agent's own recycle bin** — soft-deleted (binned) processes across **all** placeholder dealers the agent owns (`dealer.isPlaceholder && dealer.ownerAgentId === agent`), paginated, newest deletion first. The agent-global counterpart of `GET /vehicle-processes/bin` (mirrors `GET /vehicle-processes/agent-board`). Viewing first **lazily purges** any processes binned more than 7 days ago. **Non-agent callers receive an empty paginated result.**

**Auth:** Bearer token required (agent).

**Query params:** `page`, `limit` (optional).

**Response (200):** paginated; `data.data` is an array of the **same item shape as `GET /vehicle-processes/bin`**:

```json
{
  "processId": "uuid",
  "registrationNumber": "MH12AB1234 | null",
  "ownerName": "Ramesh Kumar | null",
  "deletedAt": "2026-09-26T12:00:00.000Z",
  "purgeAt": "2026-10-03T12:00:00.000Z",
  "daysLeft": 7
}
```

- **`ownerName`** — the process's ACTIVE seller (falls back to the first person), or `null`.
- **`purgeAt`** = `deletedAt` + 7 days; **`daysLeft`** = whole days until purge, clamped at `0`.
- Restore / permanent-delete a binned process via `POST /vehicle-processes/:id/restore` and `DELETE /vehicle-processes/:id/permanent` (they already work by `processId` for an agent's owned placeholder dealer).

**Error codes:** `4220` — invalid query.

---

### POST /api/v1/vehicle-processes/:id/restore

**Restore** a soft-deleted process from the recycle bin (clears `deletedAt`). Its untouched children reappear whole across every active read. No-op if the process is already active.

**Auth:** Bearer token required (dealer owner, managing agent, or super-admin — agent-aware scope).

**Path:** `id` = `processId`.

**Response (200):** `data` = the restored process (with `persons[]`).

**Error codes:** `4050` — vehicle process not found; `4034` — wrong dealer; `4039` — agent does not manage this dealer.

---

### DELETE /api/v1/vehicle-processes/:id/permanent

**Permanently** hard-delete a process and cascade-delete **all** its children immediately — whether the process is active or already binned. Irreversible. After the DB delete, the process's whole per-process upload folder (`uploads/{registration}_{processId}/`) and every image under it are **best-effort recursively deleted** so nothing is left orphaned on disk (a missing/undeletable folder never fails the delete). The 7-day auto-purge does the same folder cleanup for each purged process.

**Auth:** Bearer token required (dealer owner, managing agent, or super-admin — agent-aware scope).

**Path:** `id` = `processId`.

**Response (200):** `{ "message": "Vehicle process permanently deleted", "data": {} }`.

**Error codes:** `4050` — vehicle process not found; `4034` — wrong dealer; `4039` — agent does not manage this dealer.

---

### POST /api/v1/vehicle-processes/bin/restore

**Bulk-restore** soft-deleted processes from the recycle bin (multi-select). Two-pass for safety: every id is authorized first (fail-fast — if any is missing or not the caller's dealer, nothing is changed), then each is restored.

**Auth:** Bearer token required (dealer owner, managing agent, or super-admin — agent-aware scope).

**Body:** `{ "processIds": string[] }` — 1–100 process UUIDs.

**Response (200):** `{ "message": "Vehicle processes restored", "data": { "count": 3 } }`.

**Error codes:** `4220` — invalid body (empty / >100 / non-UUID); `4050` — a process not found; `4034` — wrong dealer; `4039` — agent does not manage this dealer.

---

### POST /api/v1/vehicle-processes/bin/permanent-delete

**Bulk permanently** hard-delete processes (multi-select) — cascade-deletes all children and best-effort deletes each process's upload folder (as `DELETE :id/permanent` does). Two-pass for safety: every id is authorized first (fail-fast — if any is missing or unauthorized, nothing is deleted), then each is permanently deleted.

**Auth:** Bearer token required (dealer owner, managing agent, or super-admin — agent-aware scope).

**Body:** `{ "processIds": string[] }` — 1–100 process UUIDs.

**Response (200):** `{ "message": "Vehicle processes permanently deleted", "data": { "count": 3 } }`.

**Error codes:** `4220` — invalid body (empty / >100 / non-UUID); `4050` — a process not found; `4034` — wrong dealer; `4039` — agent does not manage this dealer.

---

### GET /api/v1/vehicle-processes/:id/comments

The **shared comment thread** for a process (oldest first). Both the dealer owner and the agent (assigned or managing) read the same thread, so agent comments appear on the dealer's assigned process and vice-versa.

**Auth:** Bearer token required. Authorized for the dealer owner, the managing/assigned agent, or super-admin (see `assertCanAccessProcess`).

**Path:** `id` = `processId`.

**Response (200):** `data` is an array of:

```json
{
  "commentId": "uuid",
  "processId": "uuid",
  "authorUserId": "uuid | null",
  "authorName": "Asha Dealer",
  "authorRole": "DEALER | AGENT | ADMIN",
  "body": "Please upload the RC scan.",
  "createdAt": "2026-07-26T12:00:00.000Z",
  "updatedAt": "2026-07-26T12:00:00.000Z"
}
```

**Error codes:** `4050` — process not found; `4034`/`4039`/`4033` — not authorized for this process.

---

### POST /api/v1/vehicle-processes/:id/comments

Post a comment to a process's shared thread. `authorUserId` and `authorRole` are derived from the token (not the body).

**Auth:** Bearer token required (same access rule as the GET above).

**Path:** `id` = `processId`.

**Body:**

```json
{ "body": "Uploaded — please review." }
```

**Response (201):** the created comment (same shape as the GET items).

**Error codes:** `4050` — process not found; `4034`/`4039`/`4033` — not authorized; `4220` — empty/too-long body.

---

### PATCH /api/v1/vehicle-processes/:id/comments/:commentId

Edit a comment's body. **Author-only** — you may edit only your own comment (editing another's content would misrepresent authorship). `updatedAt` advances; clients show "(edited)" when it is meaningfully later than `createdAt`.

**Auth:** Bearer token required (same process access rule as the thread GET).

**Body:** `{ "body": "Updated text." }`

**Response (200):** the updated comment.

**Error codes:** `4050` — process not found; `4040` — comment not found (or not on this process); `4034`/`4039`/`4033` — no process access; `4062` — not the author; `4220` — empty/too-long body.

---

### DELETE /api/v1/vehicle-processes/:id/comments/:commentId

Delete a comment. The **author** may delete their own; a **super-admin** may delete any (moderation).

**Auth:** Bearer token required (same process access rule as the thread GET).

**Response (200):** `data: {}`.

**Error codes:** `4050` — process not found; `4040` — comment not found (or not on this process); `4034`/`4039`/`4033` — no process access; `4062` — not the author and not super-admin.

---

## Persons

Buyer/seller rows linked to a **vehicle process** (`processId`). All routes are **dealer-scoped**: the parent `vehicle_process.dealer_id` must match the JWT dealer (or the explicit `dealerId` for **`ADMIN`**).

**Auth:** Bearer JWT required.

### Model (Prisma `Person`, table `persons`)

- `personId` (UUID, PK)
- `processId` (UUID, FK → `vehicle_process`, cascade delete)
- `personName`, `mobileNumber` (required strings)
- `address` (optional text)
- `personType` — `SELLER` | `BUYER`
- `createdAt`, `updatedAt`

---

> **One active buyer.** A process may have only ONE `ACTIVE` buyer. Adding a second buyer returns `4064` — replace the buyer via `POST /persons/change-buyer` instead, which CANCELs the current buyer (kept for history) and adds the new one. Dealers and managing agents can both do this.

### POST /api/v1/persons

**Body:** `processId` (UUID), `personName`, `mobileNumber`, `personType`, optional `address` (string or `null`), optional **`idImageName`** (the flat upload `fileKey` of the person's ID photo). Optional **`dealerId`** in body (agent passes a managed dealer; **`ADMIN`** any).

When `idImageName` is provided it is relocated into the process folder and stored as a `ProcessUploadPhoto` linked to the new person (category `'Buyer ID'` / `'Seller ID'`), so it appears in the process's Documents while the person is active.

**Error codes:** `4050` — vehicle process not found; `4034` — process not in your dealer; `4064` — an active buyer already exists (use change-buyer); `4008` — invalid file key; `4032`–`4033`, `4226`/`4039` — dealer/agent scope.

---

### POST /api/v1/persons/change-buyer

Replaces the process's active buyer: the current `ACTIVE` buyer is set to `CANCELLED` (kept for history, with their ID photo linked to them), and a new `ACTIVE` buyer is created. Optionally attaches the new buyer's ID photo (uploaded flat first, then relocated into the process folder and linked to the new buyer). Atomic.

**Body:** `processId` (UUID), `personName`, `mobileNumber`, optional `address`, optional `buyerIdImageName` (the flat upload `fileKey`). Optional **`dealerId`** (agent managed / ADMIN).

**Response (201):** the new buyer.

**Error codes:** `4050` — process not found; `4034`/`4039`/`4032`–`4033`/`4226` — scope; `4220` — invalid body.

---

### GET /api/v1/persons?processId=

**Query:** `processId` (UUID, required). Optional **`dealerId`** for agent/ADMIN.

**Response:** `data` is an array of persons ordered by `createdAt`, each `{ personId, personName, address, mobileNumber, personType, status ('ACTIVE'|'CANCELLED'), idPhotos: [{ processUploadPhotoId, category, imageName, photoUrl }] }`. `idPhotos` are the ID-proof docs linked to that person (used to show a cancelled buyer's ID under them).

**Error codes:** `4050`, `4034`, `4032`–`4033`, `4226`.

---

### GET /api/v1/persons/:id

**Path:** `id` = `personId`. Optional query **`dealerId`** for **`ADMIN`**.

**Error codes:** `4055` — person not found; `4034`; `4032`–`4033`, `4226`.

---

### PATCH /api/v1/persons/:id

**Body:** `personName`, `mobileNumber`, `personType`, optional `address`, optional **`idImageName`** (the flat upload `fileKey` of a new ID photo). Optional query **`dealerId`** for **`ADMIN`**.

When `idImageName` is provided it **replaces** the person's linked ID photo(s) (relocated into the process folder, stored as a `ProcessUploadPhoto` linked to the person).

**Error codes:** `4055`, `4034`, `4008` — invalid file key; `4032`–`4033`, `4226`.

---

### DELETE /api/v1/persons/:id

Optional query **`dealerId`** for **`ADMIN`**.

**Error codes:** `4055`, `4034`, `4032`–`4033`, `4226`.

---

## Process Expenses

Dealer-scoped costs booked against a vehicle process (RTO fee, repair, commission, …). They feed **net profit** = `salePrice − purchasePrice − Σ(amount)`, surfaced per-process on the detail page and aggregated in `GET /vehicles/history` (`summary.expenseTotal` / `summary.netProfitTotal`). Private per dealer (they live on the process, never on the global `Vehicle`). Cascade-deleted with the process.

**Auth:** All endpoints require a valid JWT. Every operation is scoped to the caller's dealer via the parent process — a caller may only touch expenses on a process their dealer owns.

### Model

- `expenseId` (UUID, PK)
- `processId` (UUID, FK to `VehicleProcess`; cascade delete)
- `label` (string, **required**, max 255) — e.g. "RTO name-transfer fee"
- `amount` (number, **required**, positive, ≤2 decimals, stored `Decimal(14,2)`)
- `category` (string, optional, max 50; `null` when blank) — e.g. "Registration"
- `createdAt`, `updatedAt`

### GET /api/v1/process-expenses?processId=

Lists a process's expenses, oldest first. **Query:** `processId` (UUID, required), `dealerId` (optional; **`ADMIN`** only).

**Error codes:** `4050` — process not found; `4034` — process not owned by your dealer; `4033`/`4226` — dealer scope.

### POST /api/v1/process-expenses

Books an expense. **Body:** `processId` (UUID), `label`, `amount`, `category?`; optional `dealerId` (**`ADMIN`** only). **Response (201):** the created expense.

**Error codes:** `4050`, `4034`, `4033`/`4226`; `4220` — validation (label/amount rules).

### GET /api/v1/process-expenses/:id

A single expense the caller owns. **Error codes:** `4060` — expense not found; `4050`/`4034` — parent process not found / not owned.

### PATCH /api/v1/process-expenses/:id

Updates `label` / `amount` / `category`. **Error codes:** `4060`, `4050`, `4034`, `4033`/`4226`, `4220`.

### DELETE /api/v1/process-expenses/:id

Deletes an expense. **Error codes:** `4060`, `4050`, `4034`.

---

## Process upload photos

Stores **category** and **image name** per vehicle process (no file URL in this table — use your storage flow separately if needed). Same **dealer scope** as persons: the parent `vehicle_process` must belong to the JWT dealer (or explicit `dealerId` for **`ADMIN`**).

**Auth:** Bearer JWT required.

### Model (Prisma `ProcessUploadPhoto`, table `process_upload_photo`)

| Column (DB) | API field |
|-------------|-----------|
| `process_upload_photo_id` | `processUploadPhotoId` |
| `process_id` | `processId` |
| `category` | `category` |
| `image_name` | `imageName` |
| `kind` | `kind` (`DOCUMENT` \| `VEHICLE`, default `DOCUMENT`) |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` |

All columns are **required** (non-null). `kind` distinguishes document scans (`DOCUMENT`) from free-form "Vehicle Photos" (`VEHICLE`, capped at 5 per process).

---

### POST /api/v1/process-upload-photos

**Body:** `processId`, `category`, `imageName` (strings, max 255), and optional **`kind`** (`DOCUMENT` | `VEHICLE`, default `DOCUMENT`). Optional **`dealerId`** for **`ADMIN`**.

The freshly-uploaded flat `imageName` key is **relocated into the process folder** `"{registrationNumber}_{processId}/<uuid>.<ext>"` and the stored key is that folder-scoped value. When **`kind: "VEHICLE"`**, the process may hold **at most 5** vehicle photos — creating a 6th returns **409 `4114`**. The **first** vehicle photo on a process is **auto-starred** (becomes the primary/profile photo, `isStarred: true`); a process holds **at most one** starred vehicle photo.

**Error codes:** `4050`, `4034`, `4032`–`4033`, `4226`; `4114` — vehicle photo cap (max 5) reached.

---

### POST /api/v1/process-upload-photos/bulk

**Body:** `items` — non-empty array of `{ processId, category, imageName }`. Each `processId` is checked against the same dealer scope. Optional **`dealerId`** for **`ADMIN`**. Bulk items are always `kind: "DOCUMENT"` (use the single create for vehicle photos).

**Response (201):** `data` = `{ items: [ ...created rows ] }`.

**Error codes:** same as single create if any item’s process is invalid or forbidden.

---

### GET /api/v1/process-upload-photos?processId=

**Query:** `processId` (required). Optional **`dealerId`** for **`ADMIN`**.

**Response:** `data` is an array (each row includes `kind` and `isStarred`) ordered by `createdAt` ascending.

---

### GET /api/v1/process-upload-photos/:id

**Path:** `id` = `processUploadPhotoId`. Optional **`dealerId`** query for **`ADMIN`**.

**Error codes:** `4056` — not found; `4034`; `4032`–`4033`, `4226`.

---

### PATCH /api/v1/process-upload-photos/:id

**Body:** `category`, `imageName` (both required). Optional **`dealerId`** query for **`ADMIN`**.

Replaces the photo. When `imageName` is a **new** flat upload key (different from the stored one), the new file is relocated into the process folder and, after the row is updated, the **old file's bytes are removed** (best-effort). When `imageName` equals the stored key, this is a **category-only** update. **`kind` is immutable** and cannot be changed here.

**Error codes:** `4056`, `4034`, `4032`–`4033`, `4226`.

---

### PATCH /api/v1/process-upload-photos/:id/star

**Path:** `id` = `processUploadPhotoId`. No body. Optional **`dealerId`** query for **`ADMIN`**.

Marks a **`VEHICLE`-kind** photo as the process's **starred** (primary/profile) photo. Atomically clears the star on every other vehicle photo of the same process, so a process always holds **at most one** starred photo. Only vehicle photos can be starred — starring a `DOCUMENT` row returns **409 `4115`**.

**Response:** `data` = the updated photo row (`isStarred: true`).

**Error codes:** `4056` — not found; `4115` — only vehicle photos can be starred; `4034`, `4032`–`4033`, `4226`.

---

### DELETE /api/v1/process-upload-photos/:id

Deletes the row **and** best-effort removes the underlying file (unless another row still references the same image key). Optional **`dealerId`** query for **`ADMIN`**. If the deleted row was the **starred** vehicle photo, the **oldest remaining** vehicle photo on the process is **auto-promoted** to starred (so a process with any vehicle photos always keeps exactly one primary).

**Error codes:** `4056`, `4034`, `4032`–`4033`, `4226`.

---

## Process tasks

Tasks tied to a **vehicle process**. **Dealer scope** matches other process resources (JWT dealer, or explicit `dealerId` for **`ADMIN`**). **`assignUserId`** is optional (`null` or omitted = unassigned); when set, it must be an existing `users.user_id`.

**Auth:** Bearer JWT required.

### Model (Prisma `ProcessTask`, table `process_task`)

| Column (DB) | API field |
|-------------|-----------|
| `process_task_id` | `processTaskId` |
| `process_id` | `processId` |
| `task_name` | `taskName` (required) |
| `task_date` | `taskDate` (ISO timestamp) |
| `assign_user_id` | `assignUserId` (nullable UUID) |
| `status` | `status` (string, max 50; defaults to `To-Do`) |
| `completed_at` | `completedAt` (nullable ISO timestamp) — server-managed |
| `created_at` / `updated_at` | `createdAt` / `updatedAt` |

**`completedAt` (server-managed):** On every **create** and **update**, after the new `status` is resolved, the server checks whether that status is a **done** column for the task's dealer (a `DealerTaskStatus` with matching `statusName` and `isDone: true`). If it **is** a done status, `completedAt` is stamped `now()` the first time the task enters done and preserved on later edits while it stays done; if it is **not** a done status, `completedAt` is cleared to `null`. A dealer with no done column configured (e.g. a managed placeholder dealer) never stamps `completedAt`.

---

### POST /api/v1/process-tasks

**Body:** `processId`, `taskName`, `taskDate` (ISO string), optional `assignUserId` (UUID or `null`), optional `status` (string, max 50; defaults to `To-Do` — e.g. `To-Do` / `In Progress` / `Done`). Optional **`dealerId`** for **`ADMIN`**.

`completedAt` is set automatically when the initial `status` is a done column for the dealer (see above).

**Error codes:** `4050`, `4034`, `4045` — assignee user not found; `4032`–`4033`, `4226`; `4229` — invalid `taskDate`.

---

### GET /api/v1/process-tasks?processId=

**Query:** `processId` (required). Optional **`dealerId`** for **`ADMIN`**.

**Response:** `data` is an array ordered by `taskDate`, then `createdAt`.

---

### GET /api/v1/process-tasks/board

Dealer-wide **task board** (Jira-like) across all of the dealer's vehicle processes. Returns open tasks plus tasks completed within the **last 15 days** (tasks whose `completedAt` is older than 15 days are excluded).

**Query (all optional):**
- `dealerId` — target dealer for **`ADMIN`** / a managing **agent** (managed-dealer scope).
- `assignUserId` (UUID) — filter to one assignee.
- `mine` (boolean, `true`/`false`) — when `true`, filter to the caller (`assignUserId` = the caller's user id); overrides `assignUserId`.
- `status` (string) — filter to one task-board column.

**Response:** `data` is an array ordered by `createdAt` **descending** (last-created task first); each item:

| Field | Notes |
|-------|-------|
| `processTaskId` | task UUID |
| `taskName` | |
| `taskDate` | ISO timestamp |
| `status` | task-board column |
| `completedAt` | ISO timestamp or `null` |
| `assignUserId` | UUID or `null` |
| `assignUserName` | assignee's name or `null` |
| `processId` | parent vehicle process UUID |
| `vehicleRegistrationNumber` | registration of the process's vehicle or `null` |
| `tags` | the process's tags, `[{ tagId, tagName, colour }]` ordered by `tagName` (`[]` when none) |

**Error codes:** `4032`–`4033`, `4226`, `4039`.

---

### GET /api/v1/process-tasks/history

Dealer-wide **completed-task history** across all of the dealer's vehicle processes — **all-time** (not the 15-day board window), **paginated**, newest completion first. Only tasks with a non-null `completedAt` are returned.

**Query (all optional):**
- `dealerId` — target dealer for **`ADMIN`** / a managing **agent** (managed-dealer scope).
- `assignUserId` (UUID) — filter to one assignee.
- `mine` (boolean, `true`/`false`) — when `true`, filter to the caller (`assignUserId` = the caller's user id); overrides `assignUserId`.
- `page`, `limit` — pagination (`page` ≥ 1, `limit` 1–100, default 10).

**Employee scoping:** a non-owner dealer user without the `tasks.viewAll` capability is forced to `mine=true` (sees only their own completed tasks), regardless of the client-sent `mine`. Owner, agent, and super-admin callers are unaffected.

**Response (200, paginated):** `data.data` is an array ordered by `completedAt` DESC, with `data.meta` = `{ total, page, limit, totalPages }`. Each item uses the board card shape:

| Field | Notes |
|-------|-------|
| `processTaskId` | task UUID |
| `taskName` | |
| `taskDate` | ISO timestamp |
| `status` | task-board column |
| `completedAt` | ISO timestamp (never `null` here) |
| `assignUserId` | UUID or `null` |
| `assignUserName` | assignee's name or `null` |
| `processId` | parent vehicle process UUID |
| `vehicleRegistrationNumber` | registration of the process's vehicle or `null` |
| `tags` | the process's tags, `[{ tagId, tagName, colour }]` ordered by `tagName` (`[]` when none) |

**Error codes:** `4032`–`4033`, `4226`, `4039`.

---

### GET /api/v1/process-tasks/:id

**Path:** `id` = `processTaskId`. Optional **`dealerId`** query for **`ADMIN`**.

**Error codes:** `4057` — not found; `4034`; `4032`–`4033`, `4226`.

---

### PATCH /api/v1/process-tasks/:id

**Body:** `taskName`, `taskDate`, optional `assignUserId` (UUID or `null` to clear), optional `status` (string, max 50). Optional **`dealerId`** query for **`ADMIN`**.

`completedAt` is recomputed from the new `status`: stamped (kept if already set) when moving into a done column, cleared to `null` otherwise (see above).

**Error codes:** `4057`, `4034`, `4045`, `4229`, `4032`–`4033`, `4226`.

---

### DELETE /api/v1/process-tasks/:id

Optional **`dealerId`** query for **`ADMIN`**.

**Error codes:** `4057`, `4034`, `4032`–`4033`, `4226`.

---

### GET /api/v1/process-tasks/:id/comments

The **shared comment thread** for a task (oldest first) — the per-task equivalent of the process comment thread. The dealer's team (owner + employees) and the managing agent read and post to the same thread.

**Auth:** Bearer token required. Access is resolved via the **managed-dealer** scope on the task's process: the task's `process.dealerId` must match the resolved dealer (`getProcessTaskById`).

**Path:** `id` = `processTaskId`.

**Query:** optional **`dealerId`** — target dealer for **`ADMIN`** / a managing **agent** (managed-dealer scope).

**Response (200):** `data` is an array of:

```json
{
  "commentId": "uuid",
  "processTaskId": "uuid",
  "authorUserId": "uuid | null",
  "authorName": "Asha Dealer",
  "authorRole": "DEALER | AGENT | ADMIN",
  "body": "Waiting on the RC scan.",
  "createdAt": "2026-07-26T12:00:00.000Z",
  "updatedAt": "2026-07-26T12:00:00.000Z"
}
```

**Error codes:** `4057` — task not found; `4034`/`4039`/`4033`/`4032` — not authorized for this task; `4226` — missing `dealerId` (agent / super-admin).

---

### POST /api/v1/process-tasks/:id/comments

Post a comment to a task's shared thread. `authorUserId` and `authorRole` are derived from the token (not the body).

**Auth:** Bearer token required (same access rule as the GET above).

**Path:** `id` = `processTaskId`. **Query:** optional **`dealerId`**.

**Body:**

```json
{ "body": "Uploaded — please review." }
```

**Response (201):** the created comment (same shape as the GET items).

**Error codes:** `4057` — task not found; `4034`/`4039`/`4033`/`4032` — not authorized; `4226`; `4220` — empty/too-long body.

---

### PATCH /api/v1/process-tasks/:id/comments/:commentId

Edit a comment's body. **Author-only** — you may edit only your own comment. `updatedAt` advances; clients show "(edited)" when it is meaningfully later than `createdAt`.

**Auth:** Bearer token required (same task access rule as the thread GET).

**Path:** `id` = `processTaskId`, `commentId` = comment UUID. **Query:** optional **`dealerId`**.

**Body:** `{ "body": "Updated text." }`

**Response (200):** the updated comment.

**Error codes:** `4057` — task not found; `4040` — comment not found (or not on this task); `4034`/`4039`/`4033`/`4032` — no task access; `4062` — not the author; `4226`; `4220` — empty/too-long body.

---

### DELETE /api/v1/process-tasks/:id/comments/:commentId

Delete a comment. The **author** may delete their own; a **super-admin** may delete any (moderation).

**Auth:** Bearer token required (same task access rule as the thread GET).

**Path:** `id` = `processTaskId`, `commentId` = comment UUID. **Query:** optional **`dealerId`**.

**Response (200):** `data: {}`.

**Error codes:** `4057` — task not found; `4040` — comment not found (or not on this task); `4034`/`4039`/`4033`/`4032` — no task access; `4062` — not the author and not super-admin; `4226`.

---

### PATCH /api/v1/cities/:id

Update a city name.

**Auth:** Bearer token required.

**Error codes:** `4049` — city not found; `4104` — city name already exists for this state.

---

### DELETE /api/v1/cities/:id

Delete a city by ID.

**Auth:** Bearer token required.

**Error codes:** `4049` — city not found.

---

## Roles (RBAC)

Tenant-scoped roles. **`roleName` is unique per `typeId`** (composite unique in DB). All create/update body fields are required.

**Auth:** Bearer token required for all endpoints below.

### POST /api/v1/roles

**Request body (JSON):**

| Field     | Type   | Required | Notes                          |
|----------|--------|----------|--------------------------------|
| roleName | string | Yes      | Max 255; unique per `typeId`   |
| roleType | string | Yes      | `DEALER` or `AGENT`            |
| typeId   | uuid   | Yes      | Dealer id or agent id (tenant) |

**Response (201):** `data` is the created role (`roleId`, `roleName`, `roleType`, `typeId`, `createdAt`, `updatedAt`).

**Error codes:** `4091` — same `roleName` already exists for this `typeId`.

---

### GET /api/v1/roles

List roles for one tenant.

**Query params:**

| Param    | Type   | Required | Notes                    |
|----------|--------|----------|--------------------------|
| typeId   | uuid   | Yes      | Tenant to list roles for |
| roleType | string | No       | `DEALER` or `AGENT` filter |
| page     | number | No       | Pagination               |
| limit    | number | No       | Pagination               |

**Response (200):** `data` is `{ data: Role[], meta: PaginationMeta }`.

---

### GET /api/v1/roles/:id

**Path params:** `id` — role UUID.

**Error codes:** `4041` — role not found.

---

### PATCH /api/v1/roles/:id

Full update; **body** same shape as POST (all fields required).

**Error codes:** `4041` — not found; `4091` — duplicate name for target `(typeId, roleName)`.

---

### DELETE /api/v1/roles/:id

**Error codes:** `4041` — role not found.

---

## RBAC navigation (modules, pages, actions)

Sync endpoints follow the same pattern as **Dealer Task Statuses**: send the full list for a scope; rows with an id are updated, rows without id are created, and **rows missing from the payload are deleted** (cascades to children / permissions). **`sortOrder` is not sent by the client** — it is set from the **array index** (0-based) on each sync.

**Auth:** Bearer token required for all endpoints in this section.

### GET /api/v1/rbac/catalog

Returns all modules for one app surface with nested pages and actions, ordered by `sortOrder`.

**Query params:**

| Param       | Type   | Required | Notes        |
|------------|--------|----------|--------------|
| moduleType | string | Yes      | `DEALER` or `AGENT` |

**Response (200):** `data` is an array of modules; each module has `pages[]`, each page has `actions[]`.

---

### POST /api/v1/rbac/modules/sync

Replaces **all modules** for the given `moduleType`. Modules not included in `modules` are **deleted** (pages and actions under them cascade).

**Request body:**

| Field       | Type   | Required | Notes |
|------------|--------|----------|--------|
| moduleType | string | Yes      | `DEALER` or `AGENT` |
| modules    | array  | Yes      | Min length 1 |

Each item:

| Field       | Type   | Required | Notes |
|------------|--------|----------|--------|
| moduleId   | uuid   | No       | If present → update; if absent → create |
| moduleName | string | Yes      | Unique per `moduleType` (`@@unique([moduleType, moduleName])`) |
| description| string | No       | Nullable |

**Response (200):** `data` is the resulting `Module[]` after sync.

**Error codes:** `4221` — empty array; `4222` — duplicate `moduleName` in payload; `4042` — `moduleId` not found; `4008` — id not for this `moduleType`; `4092` — unique constraint (name conflict).

---

### POST /api/v1/rbac/pages/sync

Replaces **all pages** under one module.

**Request body:**

| Field    | Type | Required | Notes |
|---------|------|----------|--------|
| moduleId   | uuid   | Yes | Target module |
| pages      | array  | Yes | Can be empty (deletes all pages) |

Each item:

| Field       | Type   | Required | Notes |
|------------|--------|----------|--------|
| pageId     | uuid   | No       | If present → update; if absent → create |
| pageName   | string | Yes      | |
| slug       | string | Yes      | Unique per `moduleId` (URL-safe slug) |
| description| string | No       | Nullable |

**Response (200):** `data` is `Page[]`.

**Error codes:** `4223` — duplicate `slug` in payload; `4042` — module not found; `4043` / `4009` — page id invalid or wrong module; `4093` — slug conflict.

---

### POST /api/v1/rbac/page-actions/sync

Replaces **all actions** under one page.

**Request body:**

| Field     | Type   | Required | Notes |
|----------|--------|----------|--------|
| pageId   | uuid   | Yes | Target page |
| actions  | array  | Yes | Can be empty (deletes all actions) |

Each item:

| Field       | Type   | Required | Notes |
|------------|--------|----------|--------|
| actionId   | uuid   | No       | If present → update; if absent → create |
| actionName | string | Yes      | Unique per `pageId` (e.g. `VIEW`, `CREATE`) |
| label      | string | No       | Nullable |

**Response (200):** `data` is `PageAction[]`.

**Error codes:** `4224` — duplicate `actionName` in payload; `4043` — page not found; `4044` / `4013` — action id invalid or wrong page; `4094` — name conflict.

---

## Agent platform (Phase 4)

The agent platform mirrors the dealer side: **agents** are first-class tenants (`Agent`), users are linked to an agent via `agent_wise_user`, agents have their own kanban statuses, dealers grant agents access to their work, dealers assign a vehicle process + RTO service to a granted agent, and agents can keep name-only **placeholder dealers** that may later be connected to a real subscribed dealer.

### Agent scope (`agentId`) — how it resolves

Several agent-facing endpoints resolve the active agent from the JWT, the same way dealer-scoped routes resolve `dealerId`. Resolution rules (from `src/utils/agent-scope.ts`):

- **Non-`ADMIN`** callers use the **`agentId`** claim on the access token. You may omit `agentId` from the path/query/body; if you send it, it **must** match the token.
- **`ADMIN`** callers have no token `agentId` and **must** pass `agentId` explicitly where the route accepts it.

Agent-scope error codes:

- **`4035`** — your account is not linked to an agent (`agentId` is null in the token).
- **`4036`** — the explicit `agentId` does not match your session.
- **`4037`** — no access to this resource (it belongs to a different agent).
- **`4226`** — `ADMIN` must supply an explicit `agentId` for this route.

**Dealer-facing vs agent-facing:** `/agents*` and `/dealer-agents` are **dealer/admin-facing** (dealer scope via `dealerId`); `/agent-statuses`, `/agent-wise-users`, `/process-assignments/agent*`, and `/placeholder-dealers` are **agent-scoped** (resolve the agent from the token). `/process-assignments` (POST, GET `?processId=`, DELETE `/:id`) is dealer-scoped.

---

## Agents

CRUD for agents. `firmName`, `agentName`, and `displayName` are **required**; contact/address fields are optional. `emailId`, `mobileNo`, and `whatsappNo` are **unique when provided** (multiple agents may omit them). `isSubscribe` defaults to `false` on create. `isActive` (the super-admin access switch) defaults to `true` and is **not** accepted by create/update/`me` — it changes only through `PATCH /agents/:id/access`.

**Auth:** Bearer JWT required on all endpoints. These are **dealer/admin-facing** (not agent-scoped).

### Model (Prisma `Agent`, table `agents`)

- `agentId` (UUID, PK)
- `firmName`, `agentName`, `displayName` (required strings, max 255)
- `address` (text, nullable), `city` / `state` (nullable, max 100), `pincode` (nullable, max 10)
- `mobileNo` (nullable, max 20; **unique** when set)
- `emailId` (nullable, valid email, max 255; **unique** when set)
- `whatsappNo` (nullable, max 20; **unique** when set)
- `isSubscribe` (boolean, default `false`)
- `isActive` (boolean, default `true`) — super-admin access switch; `false` = **paused** (the agent's login users cannot sign in and live sessions get `403` / `4022`). Returned on every agent row; read-only except via `PATCH /agents/:id/access`.
- `createdAt` / `updatedAt` (timestamps)

---

> **Super-admin only.** Agent **management** routes — `POST /agents`, `POST /agents/with-user`, `PATCH /agents/:id`, `DELETE /agents/:id` — require a super-admin token (`4038` otherwise). An **agent edits their own profile via `/agents/me`** (above); a **dealer** manages agent relationships via `/dealer-agents/*`.

### POST /api/v1/agents

Create a new agent. **Super-admin only** (`4038`).

**Auth:** Bearer token required (super-admin).

**Request body:**

| Field       | Type           | Required | Validation |
|-------------|----------------|----------|------------|
| firmName    | string         | Yes      | Min 1, max 255 |
| agentName   | string         | Yes      | Min 1, max 255 |
| displayName | string         | Yes      | Min 1, max 255 |
| address     | string \| null | No       | — |
| city        | string \| null | No       | Max 100 |
| state       | string \| null | No       | Max 100 |
| pincode     | string \| null | No       | Max 10 |
| mobileNo    | string \| null | No       | Max 20; **unique** when set |
| emailId     | string \| null | No       | Valid email, max 255; **unique** when set |
| whatsappNo  | string \| null | No       | Max 20; **unique** when set |
| isSubscribe | boolean        | No       | Default `false` |

**Example:**

```json
{
  "firmName": "Speedy RTO Services",
  "agentName": "Ramesh Agent",
  "displayName": "Speedy RTO",
  "city": "Pune",
  "state": "Maharashtra",
  "mobileNo": "9876500000",
  "emailId": "agent@example.com",
  "whatsappNo": "9876500000"
}
```

**Response (201):** `data` is the created agent (includes `agentId`, timestamps).

**Error codes:** `4094` — email already registered for another agent; `4095` — WhatsApp number already registered; `4096` — mobile number already registered.

---

### POST /api/v1/agents/with-user

Create a **brand-new verified user** and link them to an agent in one call (super-admin onboarding of an agent owner). The user is created with `emailVerified = true` and a bcrypt-hashed password. **Unscoped** like `POST /agents` — `agentId` comes from the body.

**Auth:** Bearer token required.

**Request body:**

| Field    | Type   | Required | Validation |
|----------|--------|----------|------------|
| agentId  | string | Yes      | UUID (existing agent) |
| userName | string | Yes      | Min 1 (trimmed) |
| emailId  | string | Yes      | Valid email (trimmed, lowercased) |
| mobileNo | string | Yes      | Min 1 (trimmed) |
| password | string | Yes      | Min 8 characters |

**Response (201):** `data` is the created assignment row with nested safe `user` (`userId`, `userName`, `emailId`, `mobileNo`).

**Error codes:** `4044` — agent not found; `4091` — an account with this email already exists; `4106` — user already linked to an agent.

---

### GET /api/v1/agents

List agents (paginated).

**Auth:** Bearer token required.

**Query params:** `page` (optional), `limit` (optional, default 10, max 100).

**Response (200):** `data.data` = array of agents; `data.meta` = `{ total, page, limit, totalPages }`.

---

### GET /api/v1/agents/me

Returns the **caller agent's own** profile, resolved from the token (no path id). For an agent to view their own record in Settings → Profile.

**Auth:** Bearer token required (must be an agent).

**Error codes:** `4035` — the token is not linked to an agent; `4044` — agent not found.

---

### PATCH /api/v1/agents/me

The agent edits **their own** profile. Same body fields as create **except `isSubscribe`**, which is never accepted here and is preserved server-side (only a super-admin may change it via the subscription route). Uniqueness for `emailId` / `mobileNo` / `whatsappNo` is enforced against other agents.

**Auth:** Bearer token required (must be an agent).

**Body:** `{ firmName, agentName, displayName, address?, city?, state?, pincode?, mobileNo?, emailId?, whatsappNo? }`

**Error codes:** `4035` — not linked to an agent; `4044` — agent not found; `4094`/`4095`/`4096` — email / WhatsApp / mobile already registered to another agent; `4220` — invalid body.

---

### GET /api/v1/agents/:id

Get a single agent by ID.

**Auth:** Bearer token required.

**Path params:** `id` = `agentId` (UUID).

**Error codes:** `4044` — agent not found.

---

### PATCH /api/v1/agents/:id

Update an existing agent. **Super-admin only** (`4038`) — an agent edits their own via `PATCH /agents/me`. Same body fields as create, but **`isSubscribe` is required**. Uniqueness for `emailId` / `mobileNo` / `whatsappNo` is enforced against other agents.

**Auth:** Bearer token required (super-admin).

**Error codes:** `4038` — not a super-admin; `4044` — agent not found; `4094` — email already registered; `4095` — WhatsApp number already registered; `4096` — mobile number already registered.

---

### PATCH /api/v1/agents/:id/subscription

**Super-admin only.** Toggle an agent's subscription (`isSubscribe`). A subscribed agent can independently manage their own placeholder dealers' vehicle/RTO data + ledger (see the managed-dealer scope under **Vehicle Processes**).

**Auth:** Bearer token required; super-admin (`4038` otherwise). **Path params:** `id` = `agentId`. **Request body:** `isSubscribe` (boolean, required).

```json
{ "isSubscribe": true }
```

**Response (200):** `data` is `{ id, isSubscribe }`. **Error codes:** `4038` — not a super-admin; `4044` — agent not found.

---

### PATCH /api/v1/agents/:id/access

**Super-admin only.** Pause or resume an agent's access (`isActive`). `false` = **paused**: none of the agent's login users can sign in, and every user already signed in is rejected with **403 `4022`** on their next request (see **Paused firms** under [Using the JWT](#using-the-jwt)). `true` = resumed (users sign in again). Separate from `isSubscribe` (capability) and `approvalStatus` (registration approval) — neither is touched. Does not affect the dealers this agent works for.

**Auth:** Bearer token required; super-admin (`4038` otherwise). **Path params:** `id` = `agentId`. **Request body:** `isActive` (boolean, required).

```json
{ "isActive": false }
```

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Agent access updated",
  "data": { "id": "uuid", "isActive": false }
}
```

**Error codes:** `4038` — not a super-admin; `4044` — agent not found; `4220` — invalid `id` / missing or non-boolean `isActive`.

---

### DELETE /api/v1/agents/:id

Delete an agent by ID. **Super-admin only** (`4038`).

**Auth:** Bearer token required (super-admin).

**Response (200):** `data` is `{}`.

**Error codes:** `4038` — not a super-admin; `4044` — agent not found.

---

## Agent users

Links a **user** to **exactly one agent** across the system: **`userId` is globally unique** in `agent_wise_user`. **Agent-scoped** — the agent is resolved from the JWT (or explicit `agentId` for `ADMIN`).

**Auth:** Bearer JWT required.

### Model (Prisma `AgentWiseUser`, table `agent_wise_user`)

- `awuId` (UUID, PK; column `awu_id`)
- `userId` (FK to `User`, **globally unique** in this table), `agentId` (FK to `Agent`)
- `createdAt`, `updatedAt`

**Response shape:** rows include nested `user` (`userId`, `userName`, `emailId`, `mobileNo` only; no password).

---

### POST /api/v1/agent-wise-users

Link an existing user to the agent. Enforces the cross-persona rule: a user already linked to a **dealer** cannot be linked to an agent.

**Body:** `userId` (UUID, required). **`agentId` optional** — from JWT for non-admin; **`ADMIN` must send `agentId`**.

**Response (201):** the created assignment row with nested `user`.

**Error codes:** `4044` — agent not found; `4045` — user not found; `4106` — user already linked to an agent; `4097` — user already linked to a dealer (the other persona); `4035`–`4036`, `4226` — agent scope.

---

### POST /api/v1/agent-wise-users/with-user

Create a **brand-new verified user** and link them to the agent in one call (so an agent can add a staff sub-user who can log in immediately). The user is created with `emailVerified = true` and a bcrypt-hashed password.

**Body:** `userName`, `emailId` (valid email), `mobileNo`, `password` (min 8). **`agentId` optional** — from JWT for non-admin; **`ADMIN` must send `agentId`**.

**Response (201):** the created assignment row with nested `user`.

**Error codes:** `4044` — agent not found; `4091` — email already exists; `4106` — user already linked to an agent; `4035`–`4036`, `4226` — agent scope.

---

### GET /api/v1/agent-wise-users

**Query:** `agentId` (UUID, optional for non-admin; **required** for `ADMIN`). Array of assignments, ordered by `createdAt` ascending, no pagination.

**Error codes:** `4044` — agent not found; `4035`–`4036`, `4226` — agent scope.

---

### GET /api/v1/agent-wise-users/:id

**Path:** `id` = `awuId`. The row's `agentId` must match the caller's agent (admins bypass).

**Error codes:** `4053` — assignment not found; `4037` — assignment belongs to another agent; `4035` — not linked to an agent.

---

### PATCH /api/v1/agent-wise-users/:id

**Body:** `userId` (UUID; replaces the linked user). `agentId` is not changed.

**Error codes:** `4053` — assignment not found; `4045` — user not found; `4106` — user already linked to an agent; `4037`, `4035`.

---

### DELETE /api/v1/agent-wise-users/:id

**Path:** `id` = `awuId`.

**Response (200):** `data` is `{}`.

**Error codes:** `4053` — assignment not found; `4037`, `4035`.

---

## Agent Statuses

Per-agent kanban statuses for RTO work (mirror **Dealer Task Statuses**). **`statusName` is unique per agent.** **`statusRank` is per agent** and is determined by the order of the `statusData` array in the sync API (1, 2, 3, …). **Agent-scoped** — the agent is resolved from the JWT (or explicit `agentId` for `ADMIN`).

**Auth:** Bearer JWT required.

### Model (Prisma `AgentStatus`, table `agent_status`)

- `statusId` (UUID, PK)
- `agentId` (UUID, FK to Agent; cascade delete)
- `statusName` (string, max 255, **required**; **unique per agent**)
- `colour` (string, max 50, nullable)
- `statusRank` (integer, per-agent display order)
- `createdAt` / `updatedAt`

---

### POST /api/v1/agent-statuses

Sync all statuses for an agent in a single request. This endpoint **creates, updates, deletes, and reorders** statuses for the agent (same semantics as dealer task status sync).

**Auth:** Bearer token required.

**Request body:** `statusData` (array, min 1) is required. **`agentId` optional** — from JWT for non-admin; **`ADMIN` must send `agentId`**.

Each `statusData` item: `statusId` (UUID, optional — present → update, absent → create), `statusName` (string, min 1, max 255, required), `colour` (string, min 1, max 50, required).

```json
{
  "statusData": [
    { "statusId": "uuid-1", "statusName": "To-Do", "colour": "blue" },
    { "statusName": "In Progress", "colour": "yellow" },
    { "statusName": "Done", "colour": "green" }
  ]
}
```

- Items with a `statusId` belonging to this agent are updated; items without `statusId` are created.
- Any existing status for this agent **not present** in `statusData` is **deleted**.
- The array order defines `statusRank` (1, 2, 3, …).

**Response (200):** `data` is the final array of statuses for that agent, ordered by `statusRank`.

**Error codes:** `4221` — empty `statusData`; `4222` — duplicate `statusName` in payload; `4035`–`4036`, `4226` — agent scope.

---

### PUT /api/v1/agent-statuses/order

Update `statusRank` for multiple statuses for an agent in one request. Only reorders; does not create, delete, or rename.

**Auth:** Bearer token required.

**Request body:** `items` (array, min 1) required; each item `{ statusId (UUID), statusRank (non-negative integer) }`. Duplicate `statusId` is not allowed. **`agentId` optional** (JWT for non-admin; **`ADMIN` required**).

```json
{
  "items": [
    { "statusId": "uuid-1", "statusRank": 1 },
    { "statusId": "uuid-2", "statusRank": 2 }
  ]
}
```

**Response (200):** `data` is the full array of statuses for that agent, ordered by updated `statusRank`.

**Error codes:** `4221` — empty `items`; `4223` — one or more statuses do not belong to this agent; `4035`–`4036`, `4226` — agent scope.

---

### GET /api/v1/agent-statuses

Get all statuses for the **agent in the JWT**, ordered by `statusRank`. No query parameters (non-admin).

**Auth:** Bearer token required.

**Error codes:** `4035` / `4226` — missing agent context for your role.

---

### GET /api/v1/agent-statuses/:agentId

Get all statuses for an agent, ordered by `statusRank`. For non-`ADMIN`, **`:agentId` must match the JWT `agentId`**.

**Auth:** Bearer token required.

**Path params:** `agentId` (UUID).

**Error codes:** `4036` — path agent does not match session; `4035` — not linked to an agent; `4226` — `ADMIN` must pass `agentId`. Returns an empty array if the agent has no statuses.

---

## Agent-wise upload categories

The **agent** equivalent of **Dealer-wise upload categories**: an agent's own selection of which document categories their create-process wizard collects (mirrors `dealer-wise-upload-categories`, agent-scoped). Links a global `UploadCategory` to the agent with per-link flags + order. **Process photos still store the category NAME string** (`ProcessUploadPhoto.category`) — these links only drive the wizard checklist and optional `processApi` extraction.

**Model (`AgentWiseUploadCategory`, table `agent_wise_upload_category`):** `awucId` (PK), `agentId`, `uploadCategoryId`, `processApi?`, `orderRank`, `isRequired`, `isProcess`, `isViewInStep`, timestamps; `@@unique([agentId, uploadCategoryId])`.

**Auth:** Bearer JWT required. **Agent-scoped** — the agent is resolved from the JWT (or explicit `agentId` for `ADMIN`).

Endpoints (identical shapes to the dealer-wise slice, with `awucId`/`agentId` in place of `dwucId`/`dealerId`; `/order` and `/view-in-step` are declared before `/:id`):

| Method / path | Purpose |
|---|---|
| `POST /api/v1/agent-wise-upload-categories` | Link a global category to the agent. Body `{ agentId?, uploadCategoryId, processApi?, isRequired, isProcess, isViewInStep }`; `orderRank` auto = max+1. Duplicate `(agentId, uploadCategoryId)` → `4098`. |
| `GET /api/v1/agent-wise-upload-categories?agentId=` | Full list → `{ agentId, uploadCategory: [{ awucId, categoryId, categoryName, orderRank, isRequired, processApi, isProcess, isViewInStep }] }`. |
| `GET /api/v1/agent-wise-upload-categories/view-in-step?agentId=` | Only `isViewInStep=true` (wizard checklist); entries also include master `bothSide`. |
| `PUT /api/v1/agent-wise-upload-categories/order` | Body `{ agentId?, items: [{ awucId, orderRank }] }`; every `awucId` must belong to the agent (`4225`). |
| `GET /api/v1/agent-wise-upload-categories/:id` · `PATCH /:id` · `DELETE /:id` | Get / full-replace update / delete by `awucId`. |

**Error codes:** `4044` — agent not found; `4052` — link not found; `4098` — category already linked to this agent; `4225` — a link in `/order` doesn't belong to the agent; `4035`–`4037`, `4226` — agent scope.

---

## Dealer–Agent Grants

A **dealer** granting agent-site access to an **agent** (`dealer_agent`, unique per `(dealerId, agentId)`). **Dealer-scoped** — the dealer is resolved from the JWT (or explicit `dealerId` for `ADMIN`). Grants carry a `status` (`ACTIVE` / `REVOKED`) and a `source` (`DEALER_GRANT` / `CONNECT`). Only **ACTIVE `DEALER_GRANT`** rows count against the dealer's `maxAgents` cap; `CONNECT` grants (created by placeholder→real connection) are excluded.

The cap is **enforced**: any action that newly consumes a slot (a fresh grant, an invitation acceptance, a switch's replacement grant) fails with **`4231`** when `used >= maxAgents`. `capInfo` carries `hasFreeSlot` (`used < maxAgents`) to drive the UI. A super-admin raises a dealer's cap via [`PATCH /api/v1/dealers/:id/agent-slots`](#patch-apiv1dealersidagent-slots) (the reusable "raise slots" seam a future self-serve addon reuses).

**Auth:** Bearer JWT required.

### Model (Prisma `DealerAgent`, table `dealer_agent`)

- `dealerAgentId` (UUID, PK; column `dealer_agent_id`)
- `dealerId`, `agentId` (FKs; **unique together**)
- `status` — `ACTIVE` | `REVOKED` (default `ACTIVE`)
- `source` — `DEALER_GRANT` | `CONNECT` (default `DEALER_GRANT`)
- `createdAt`, `updatedAt`

---

### POST /api/v1/dealer-agents

Grant agent-site access to an agent for the calling dealer. Upserts an **ACTIVE `DEALER_GRANT`** (re-activating a previously revoked row). The cap is **enforced** (`4231`) when the grant would newly consume a slot; re-granting an agent that is already an ACTIVE `DEALER_GRANT` is idempotent and never blocked.

**Auth:** Bearer token required.

**Request body:** `agentId` (UUID, required). Dealer is resolved from the JWT (`ADMIN` resolves via token rules in dealer-scope).

```json
{ "agentId": "uuid-agent" }
```

**Response (201):** `data` is `{ grant, capInfo }`:

```json
{
  "statusCode": 201,
  "message": "Agent access granted",
  "data": {
    "grant": {
      "dealerAgentId": "uuid",
      "dealerId": "uuid",
      "agentId": "uuid",
      "status": "ACTIVE",
      "source": "DEALER_GRANT",
      "createdAt": "2026-06-28T10:00:00.000Z",
      "updatedAt": "2026-06-28T10:00:00.000Z"
    },
    "capInfo": { "maxAgents": 2, "used": 1, "overCap": false, "hasFreeSlot": true }
  }
}
```

**Error codes:** `4044` — agent not found; `4231` — agent cap reached (no free slot); `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-agents/search

Search agents the calling dealer could grant (partial, case-insensitive match on email / mobile / whatsapp / agentName / firmName / displayName), **excluding** agents already an ACTIVE grant of the caller. Backs the dealer's "Add agent" search box.

**Auth:** Bearer token required.

**Query params:** `q` (string, **min 2 chars**, required).

**Response (200):** `data` is an array of compact agent summaries (`agentId`, `firmName`, `agentName`, `displayName`, `mobileNo`, `emailId`), capped at 10, newest first.

```json
{
  "statusCode": 200,
  "message": "Agent search results",
  "data": [
    { "agentId": "uuid", "firmName": "Speedy RTO Services", "agentName": "Ramesh Agent", "displayName": "Speedy RTO", "mobileNo": "9876500000", "emailId": "agent@example.com" }
  ]
}
```

**Error codes:** `4220` — `q` shorter than 2 chars; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-agents/switch-preview

Preview what a switch off an agent would touch: the agent's **OPEN** assignments (which will be auto-completed) and the current khata **balance** (which can be settled or kept). See [`POST /switch`](#post-apiv1dealer-agentsswitch).

**Auth:** Bearer token required.

**Query params:** `oldAgentId` (UUID, required) — must be a current ACTIVE grant of the caller.

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Switch preview",
  "data": {
    "agentId": "uuid-old-agent",
    "openAssignmentCount": 1,
    "openAssignments": [
      {
        "assignmentId": "uuid",
        "status": "OPEN",
        "service": { "serviceId": "uuid", "serviceName": "Name Transfer", "shortName": "NT" },
        "process": { "processId": "uuid", "vehicle": { "registrationNumber": "MH12AB1234" } }
      }
    ],
    "balance": "5900",
    "hasBalance": true
  }
}
```

`balance` is a dealer-perspective Decimal string (positive = dealer owes the agent).

**Error codes:** `4040` — the agent is not an active grant of the dealer; `4032`–`4033`, `4226` — dealer scope.

---

### POST /api/v1/dealer-agents/switch

Atomically switch the dealer **off** an agent (optionally **onto** a replacement) in one transaction: **(1)** if `settleDecision = SETTLE` and the balance ≠ 0, post a balancing `"Settlement on agent switch"` ledger entry (history preserved — nothing deleted); **(2)** mark every OPEN assignment for the pair `COMPLETED`; **(3)** revoke the old grant; **(4)** if `newAgentId` is given, grant it — after the revoke, so the freed slot counts against the cap. The plain `DELETE /:id` remains for a raw revoke; this is the guided flow.

**Auth:** Bearer token required.

**Request body:**

- `oldAgentId` (UUID, required) — the current ACTIVE-granted agent.
- `newAgentId` (UUID, optional) — replacement agent; omit to just deactivate. Must differ from `oldAgentId`.
- `settleDecision` — `SETTLE` | `KEEP` (required). `KEEP` leaves the balance on the ledger.
- `settleAmount` (number > 0, optional) — caps a **partial** settlement; blank settles the full balance.

```json
{ "oldAgentId": "uuid-old", "newAgentId": "uuid-new", "settleDecision": "SETTLE" }
```

**Response (200):** `data` is `{ oldGrant, newGrant, completedCount, settledEntry }` — `oldGrant` (now `REVOKED`), `newGrant` (the new ACTIVE grant or `null`), `completedCount` (assignments completed), and `settledEntry` (a flattened `{ ledgerEntryId, direction, amount, balanceAfter, description }` or `null`).

```json
{
  "statusCode": 200,
  "message": "Agent switched",
  "data": {
    "oldGrant": { "dealerAgentId": "uuid", "status": "REVOKED", "source": "DEALER_GRANT" },
    "newGrant": { "dealerAgentId": "uuid", "status": "ACTIVE", "source": "DEALER_GRANT" },
    "completedCount": 1,
    "settledEntry": { "ledgerEntryId": "uuid", "direction": "DEBIT", "amount": 5900, "balanceAfter": 0, "description": "Settlement on agent switch" }
  }
}
```

**Error codes:** `4000` — replacement equals the old agent; `4040` — old grant not ACTIVE; `4044` — replacement agent not found; `4233` — replacement is already an ACTIVE grant; `4231` — cap reached after the switch; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-agents

List the calling dealer's **ACTIVE** grants (newest first), each with a compact agent summary, plus the dealer's cap usage.

**Auth:** Bearer token required.

**Response (200):** `data` is `{ items, capInfo }` where each `items[]` element is a grant with nested `agent` (`agentId`, `firmName`, `agentName`, `displayName`, `mobileNo`, `emailId`):

```json
{
  "statusCode": 200,
  "message": "Dealer agent grants retrieved",
  "data": {
    "items": [
      {
        "dealerAgentId": "uuid",
        "dealerId": "uuid",
        "agentId": "uuid",
        "status": "ACTIVE",
        "source": "DEALER_GRANT",
        "createdAt": "2026-06-28T10:00:00.000Z",
        "updatedAt": "2026-06-28T10:00:00.000Z",
        "agent": {
          "agentId": "uuid",
          "firmName": "Speedy RTO Services",
          "agentName": "Ramesh Agent",
          "displayName": "Speedy RTO",
          "mobileNo": "9876500000",
          "emailId": "agent@example.com"
        }
      }
    ],
    "capInfo": { "maxAgents": 2, "used": 1, "overCap": false, "hasFreeSlot": true }
  }
}
```

**Error codes:** `4032`–`4033`, `4226` — dealer scope.

---

### DELETE /api/v1/dealer-agents/:id

Revoke a grant (sets `status = REVOKED`). The grant must belong to the calling dealer.

**Auth:** Bearer token required.

**Path params:** `id` = `dealerAgentId` (UUID).

**Response (200):** `data` is the updated (revoked) grant row.

**Error codes:** `4040` — grant not found; `4034` — grant belongs to another dealer; `4032`–`4033`, `4226` — dealer scope.

---

## Agent Invitations

A **dealer** invites a **brand-new agent** by email. A single-use onboarding link is emailed (its random token stored **hashed**, like `EmailOtp`); the agent opens the link, fills out their profile, and — on submit — an agent account + verified login is created and (cap permitting) auto-granted to the inviting dealer, logging the new agent straight in. The `AgentInvitation` row is retained (listable / resendable / cancellable) and its `status` tracks the lifecycle.

The **management** endpoints (create/list/resend/cancel) require a dealer JWT; the **accept** endpoints under `/accept/:token` are **public** (no auth) and back the onboarding page.

### Model (Prisma `AgentInvitation`, table `agent_invitation`)

- `invitationId` (UUID, PK; column `invitation_id`)
- `dealerId` (FK) · `agentName` · `emailId` · `mobileNo?`
- `tokenHash` (sha256 hex of the link token — the raw token is never stored/returned except the dev `inviteLink`)
- `status` — `PENDING` | `ACCEPTED` | `EXPIRED` | `CANCELLED` (default `PENDING`)
- `expiresAt` (7 days from issue) · `acceptedAt?` · `createdByUserId?`
- `createdAt`, `updatedAt`

---

### POST /api/v1/agent-invitations

Invite a new agent by email. Enforces the dealer's agent cap (`4231`); rejects an email/mobile that already belongs to an agent (`4112` — steer to search + grant) or another account (`4091`). Creates a PENDING row and emails the onboarding link `${FRONTEND_URL}/agent-onboarding/<token>`.

**Auth:** Bearer token required (dealer scope).

**Request body:** `agentName` (string, required), `emailId` (email, required), `mobileNo` (string, optional).

**Response (201):** `data` is the created invitation (without `tokenHash`). In **non-production** the response also includes `inviteLink` (the full onboarding URL) to ease testing.

```json
{
  "statusCode": 201,
  "message": "Invitation sent",
  "data": {
    "invitationId": "uuid",
    "dealerId": "uuid",
    "agentName": "Ramesh Kumar",
    "emailId": "ramesh@example.com",
    "mobileNo": "9876500000",
    "status": "PENDING",
    "expiresAt": "2026-07-25T10:00:00.000Z",
    "acceptedAt": null,
    "createdByUserId": "uuid",
    "createdAt": "2026-07-18T10:00:00.000Z",
    "updatedAt": "2026-07-18T10:00:00.000Z",
    "inviteLink": "http://localhost:5173/agent-onboarding/<token>"
  }
}
```

**Error codes:** `4231` — agent cap reached; `4112` — email/mobile already an agent (grant instead); `4091` — email already an account; `4043` — dealer not found; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/agent-invitations

List the calling dealer's **PENDING** invitations (newest first). `data` is an array of invitations (without `tokenHash`).

**Auth:** Bearer token required (dealer scope).

---

### POST /api/v1/agent-invitations/:id/resend

Regenerate the token + expiry of a PENDING invitation and re-send the email. `data` is the updated invitation (with the dev `inviteLink` in non-production).

**Auth:** Bearer token required (dealer scope).

**Error codes:** `4061` — invitation not found; `4034` — belongs to another dealer; `4110` — no longer pending; `4043` — dealer not found.

---

### DELETE /api/v1/agent-invitations/:id

Cancel a PENDING invitation (soft — the row is retained as `CANCELLED`). `data` is the updated invitation.

**Auth:** Bearer token required (dealer scope).

**Error codes:** `4061` — invitation not found; `4034` — belongs to another dealer; `4110` — no longer pending.

---

### GET /api/v1/agent-invitations/accept/:token  (public)

Validate an invitation token and return the onboarding **prefill**. An expired-but-still-pending invitation is auto-marked `EXPIRED`. **No auth.**

**Response (200):**

```json
{
  "statusCode": 200,
  "message": "Invitation valid",
  "data": { "agentName": "Ramesh Kumar", "emailId": "ramesh@example.com", "mobileNo": "9876500000", "dealerName": "Demo Motors" }
}
```

**Error codes:** `4061` — unknown token; `4110` — already used/cancelled; `4111` — expired.

---

### POST /api/v1/agent-invitations/accept/:token  (public)

Complete onboarding: atomically create the agent (+ seeded kanban statuses), a **verified** login user, and the agent↔user link; grant the agent to the inviting dealer **if a cap slot is free** (else the account is created but ungranted — `granted: false`, dealer activates later); mark the invitation `ACCEPTED`; and return a login bundle so the new agent is signed straight in. The invited **email is taken from the invitation** server-side (never from the body). **No auth.**

**Request body:** `firmName`, `agentName`, `displayName`, `mobileNo`, `password` (min 8) — all required; `address`, `city`, `state`, `pincode`, `whatsappNo` optional.

**Response (201):** `data` is `{ token, refreshToken, granted, user }` (`user` carries `agentId`, `dealerId: null`, `isSuperAdmin: false` → resolves to the `agent` role).

```json
{
  "statusCode": 201,
  "message": "Welcome aboard",
  "data": {
    "token": "jwt-access",
    "refreshToken": "jwt-refresh",
    "granted": true,
    "user": { "userId": "uuid", "emailId": "ramesh@example.com", "userName": "Ramesh Kumar", "emailVerified": true, "dealerId": null, "agentId": "uuid", "isSuperAdmin": false }
  }
}
```

**Error codes:** `4061` — unknown token; `4110` — already used/cancelled; `4111` — expired; `4091` — email already an account (race with another signup).

---

## Process Assignments

A **dealer** assigns a **vehicle process + chosen RTO service** to a granted **agent**; the agent works it through their own kanban statuses. The dealer-facing endpoints are **dealer-scoped**; the `/agent*` endpoints and `PATCH /:id/agent-status` are **agent-scoped** (the assignment must belong to the caller agent).

**Auth:** Bearer JWT required.

### Model (Prisma `ProcessAssignment`, table `process_assignment`)

- `assignmentId` (UUID, PK)
- `processId`, `dealerId`, `agentId`, `serviceId` (FKs)
- `agentStatusId` (nullable; the agent's kanban column)
- `status` — `OPEN` | `COMPLETED` | `CANCELLED` (default `OPEN`)
- `note` (text, nullable), `assignedByUserId` (nullable)
- `createdAt`, `updatedAt`
- **Unique** per `(processId, agentId, serviceId)` — a duplicate surfaces as `4090`.

---

### POST /api/v1/process-assignments

Assign a vehicle process + **one or more** RTO services to a granted agent — **one assignment row is created per service**, all in one transaction. **Dealer-scoped.** The process must belong to the dealer, the dealer must hold a live (`ACTIVE`) grant for the agent, and every requested service must exist. Each new assignment's kanban column defaults to the agent's lowest-ranked status (or `null`). `assignedByUserId` is taken from the authenticated user.

**Auth:** Bearer token required.

**Request body:**

| Field      | Type     | Required | Validation |
|------------|----------|----------|------------|
| processId  | string   | Yes      | UUID (vehicle process owned by the dealer) |
| agentId    | string   | Yes      | UUID (a granted agent) |
| serviceIds | string[] | Yes      | 1–50 unique UUIDs (RTO services) |
| note       | string   | No       | Max 2000 (instructions for the agent) |
| cost       | number   | No       | Positive, ≤2 decimals, ≤ `Decimal(14,2)` — money owed to the agent, applied **per service** |
| costDate   | string   | No       | ISO date — the ledger entry's book date (defaults to now) |
| costNote   | string   | No       | Max 2000 — the ledger entry's description (defaults to `"Agent cost"`) |

When `cost > 0`, a khata `CREDIT` ledger entry (dealer owes the agent) is posted **atomically per created service**, linked to each new assignment via `assignmentId`.

The `(processId, agentId, serviceId)` triple is unique. Services **already actively assigned** to that agent for the process are **skipped** (returned in `skippedServiceIds`); a triple whose assignment was previously **CANCELLED** is transparently **reactivated** (same `assignmentId`; its `createdAt` becomes the time of the re-assignment and any cost left from its earlier life is reversed). If **every** requested service is already live, `4230` is returned.

```json
{
  "processId": "uuid-process",
  "agentId": "uuid-agent",
  "serviceIds": ["uuid-service-1", "uuid-service-2"],
  "note": "Please complete name transfer + insurance.",
  "cost": 5000,
  "costDate": "2026-07-10T00:00:00.000Z",
  "costNote": "RTO job fee"
}
```

**Response (201):** `data` is `{ "created": [...], "skippedServiceIds": [...] }`, where each `created` item is an assignment with nested `agent` (`agentId`, `firmName`, `agentName`, `displayName`), `service` (`serviceId`, `serviceName`, `shortName`), and `agentStatus` (`statusId`, `statusName`, `colour`) or `null`. `skippedServiceIds` lists services that were already assigned.

**Error codes:** `4040` — vehicle process or an RTO service not found; `4034` — process belongs to another dealer; `4228` — grant the agent access before assigning; `4230` — all requested services are already assigned to this agent (edit those assignments instead); `4220` — invalid body (`serviceIds` empty / invalid `cost`); `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/process-assignments?processId=

List the **non-cancelled** assignments for a vehicle process (oldest first). **Dealer-scoped** — the process must belong to the calling dealer.

**Auth:** Bearer token required.

**Query params:** `processId` (UUID, required).

**Response (200):** `data` is an array of assignments (same nested shape as create, **including `cost`** — the current live ledger cost per assignment, or `null`). The cost is the latest live `CREDIT` linked to the assignment that the **dealer side posted in the assignment's own dealer↔agent book**; an entry in any other book, or a credit the agent posted against the job, is never shown here (it stays an ordinary ledger entry).

**Error codes:** `4040` — process not found; `4034` — process belongs to another dealer; `4032`–`4033`, `4226` — dealer scope.

---

### PATCH /api/v1/process-assignments/:id/cost

Set / change / remove the **agent cost** recorded in the ledger for an assignment. **Dealer-scoped** — the assignment must belong to the calling dealer. Because the ledger is append-only, editing behaves as follows:

- Changing the **amount** posts a ledger **reversal + a new entry** (history preserved; every row's `balanceAfter` stays consistent).
- Editing **only the date/description** updates the entry **in place** (no balance impact).
- `cost: null` **removes** the cost (reverses the current entry); no active grant is required, so historical costs remain editable after a revoke/switch.

**Auth:** Bearer token required.

**Path params:** `id` = `assignmentId` (UUID).

**Request body:**

| Field    | Type          | Required | Meaning |
|----------|---------------|----------|---------|
| cost     | number \| null | No       | Positive to set the amount · `null` to remove · omitted to keep the amount (edit only date/note) |
| costDate | string        | No       | ISO date — set the entry's book date |
| costNote | string        | No       | Max 2000 — set the entry's description |

```json
{ "cost": 4000, "costDate": "2026-07-10T00:00:00.000Z" }
```

**Response (200):** `data` is the resulting live cost `{ ledgerEntryId, amount, entryDate, description }`, or `null` when the cost was removed / none exists.

**Error codes:** `4040` — assignment not found; `4034` — assignment belongs to another dealer; `4220` — invalid `cost`; `4032`–`4033`, `4226` — dealer scope.

---

### DELETE /api/v1/process-assignments/:id

Cancel a single assignment (sets `status = CANCELLED`). **Dealer-scoped** — the assignment must belong to the calling dealer.

**Auth:** Bearer token required.

**Path params:** `id` = `assignmentId` (UUID).

**Response (200):** `data` is the updated (cancelled) assignment row.

**Error codes:** `4040` — assignment not found; `4034` — assignment belongs to another dealer; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/process-assignments/by-agent/:agentId

List the work the **calling dealer** has assigned to **one agent**, paginated, newest first — one row per assignment (a process + one RTO service). Each row carries the RTO service, the **agent's own kanban status**, the live ledger **cost**, and a summary of the source vehicle process. **Dealer-scoped** — dealer resolved from the JWT. `CANCELLED` assignments and assignments whose process is in the recycle bin are left out. The dealer must have (or have had) a grant with the agent; it still works after the grant is revoked, so past work stays visible.

**Auth:** Bearer token required.

**Path params:** `agentId` (UUID).

**Query params:**

| Param | Type | Notes |
|---|---|---|
| `page`, `limit` | whole number ≥ 1, optional | Default `1` / `10`. A `limit` above `100` is accepted and capped at `100`; `page` may not exceed `1000000`. Fractions, `0` and negatives are rejected (`4220`). |
| `search` | string, optional (≤100) | Matches the vehicle **registration number** (spaces/punctuation ignored), **make**, **model**, or the **service** name / short name. Case-insensitive. With several words, a row also matches when **every word** matches one of those fields (`maruti swift` = make + model); only the first **6 distinct words** are used for this rule. `%` and `_` are searched literally. |
| `agentStatusId` | UUID or `none`, optional | Only assignments in that agent status; `none` = assignments the agent has not put in any status yet. |

**Response (200):** paginated; `data.data` is an array of:

```json
{
  "assignmentId": "uuid",
  "processId": "uuid",
  "dealerId": "uuid",
  "agentId": "uuid",
  "serviceId": "uuid",
  "agentStatusId": "uuid | null",
  "status": "OPEN | COMPLETED",
  "note": "string | null",
  "assignedByUserId": "uuid | null",
  "createdAt": "2026-10-13T09:00:00.000Z",
  "updatedAt": "2026-10-13T09:00:00.000Z",
  "service": { "serviceId": "uuid", "serviceName": "Name transfer", "shortName": "TO" },
  "agentStatus": { "statusId": "uuid", "statusName": "In RTO", "colour": "#F59E0B" },
  "cost": { "ledgerEntryId": "uuid", "amount": 1500, "entryDate": "2026-10-13T09:00:00.000Z", "description": "Agent cost" },
  "process": {
    "processId": "uuid",
    "status": "SOLD | COMPLETE | SCRAP | null",
    "dealNumber": "D-101 | null",
    "processDate": "2026-10-01T00:00:00.000Z | null",
    "trackingNumber": "EK123456789IN | null",
    "hasReceipt": true,
    "vehicle": { "registrationNumber": "GJ05AB1234", "make": "Maruti", "model": "Swift", "manufactureYear": 2019 },
    "tags": [{ "tagId": "uuid", "tagName": "Priority", "colour": "#ef4444" }]
  }
}
```

- **`agentStatus`** — the agent's own status for this job, or `null` when the agent has not set one.
- **`cost`** — the current live ledger cost of the assignment (same rule as `GET /process-assignments?processId=`), or `null`. Only a **dealer-posted** entry in the assignment's **own** dealer↔agent book counts.
- **`process.status`** — the dealer's lifecycle status; `null` = open.
- **`process.trackingNumber`** / **`process.hasReceipt`** — the RC-book tracking number the agent entered and whether the agent has uploaded an RTO receipt. The receipt file itself comes from `GET /vehicle-processes/:id/details`.
- **`process.tags`** — ordered by `tagName`, `[]` when none. `process.vehicle` is `null` when the process has no vehicle.
- Rows are ordered by `createdAt` descending, then `assignmentId`, so pages never overlap. `createdAt` is the date the work was assigned; a job that was cancelled and assigned again carries the date of the **re-assignment**.

**Error codes:** `4044` — the dealer has never granted that agent (also an unknown agent id); `4220` — invalid `agentId`, `agentStatusId`, `page`, `limit` or `search` (over 100 characters, or containing a NUL byte); `4032`–`4033`, `4226` — dealer scope (an agent or dealer-less token is refused).

---

### GET /api/v1/process-assignments/by-agent/:agentId/summary

Totals for **all** the work the calling dealer has assigned to one agent — the same rows as the list above, but independent of its `search` / `agentStatusId` / page. **Dealer-scoped.**

**Auth:** Bearer token required.

**Path params:** `agentId` (UUID).

**Response (200):**

```json
{
  "agent": { "agentId": "uuid", "firmName": "Fast RTO Services", "agentName": "Ramesh Patel", "displayName": "Fast RTO", "mobileNo": "9876543210", "emailId": "fast@rto.dev" },
  "grantStatus": "ACTIVE | REVOKED",
  "totals": { "assignments": 23, "processes": 12, "costedAssignments": 16, "totalCost": 34500.5 },
  "byStatus": [
    { "statusId": "uuid", "statusName": "Docs received", "colour": "#2563EB", "count": 6 },
    { "statusId": "uuid", "statusName": "In RTO", "colour": "#F59E0B", "count": 6 },
    { "statusId": null, "statusName": "No status", "colour": null, "count": 5 }
  ]
}
```

- **`totals.assignments`** — live assignments; **`processes`** — distinct vehicle processes among them; **`costedAssignments`** — how many carry a live cost; **`totalCost`** — the sum of those costs (always equals the sum of the list rows' `cost.amount`).
- **`byStatus`** — every one of the agent's statuses in the agent's board order (**zero counts included**), followed by a `statusId: null` "No status" entry **only when** some assignment has no status. Its counts add up to `totals.assignments`.
- **`grantStatus`** — whether the dealer's grant to the agent is still live.

**Error codes:** `4044` — the dealer has never granted that agent; `4220` — invalid `agentId`; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/process-assignments/agent

List the **caller agent's** non-cancelled assignments (newest first), optionally filtered to one source dealer. **Agent-scoped** — agent resolved from the JWT.

**Auth:** Bearer token required.

**Query params:** `dealerId` (UUID, optional — narrow to one source dealer).

**Response (200):** `data` is an array; each item carries `service`, `agentStatus` (or `null`), and `process` (`processId`, `vehicle.registrationNumber`, `dealer` summary `{ dealerId, firmName, dealerName, isPlaceholder }`, and `tags` — `[{ tagId, tagName, colour }]` ordered by `tagName`, `[]` when none).

**Error codes:** `4035`–`4036`, `4226` — agent scope.

---

### GET /api/v1/process-assignments/:id/details

Return the assignment, the **full vehicle-process detail** (same shape as `GET /vehicle-processes/:id/details` — vehicle, owner, buyer, references, photos with URLs), and the source dealer summary. **Agent-scoped** — the assignment must belong to the caller agent.

**Auth:** Bearer token required.

**Path params:** `id` = `assignmentId` (UUID).

**Response (200):** `data` is `{ assignment, process, dealer }` where `assignment` carries `service` + `agentStatus`, `process` is the full process-detail DTO, and `dealer` is the source dealer summary (or `null`).

**Error codes:** `4040` — assignment not found; `4037` — assignment belongs to another agent; `4035` — not linked to an agent.

---

### PATCH /api/v1/process-assignments/:id/agent-status

Move the caller agent's assignment into one of the agent's own kanban statuses. **Agent-scoped** — the assignment must belong to the caller agent, and the target status must belong to the same agent. Does not change the coarse `status`.

**Auth:** Bearer token required.

**Path params:** `id` = `assignmentId` (UUID).

**Request body:** `agentStatusId` (UUID, required).

```json
{ "agentStatusId": "uuid-status" }
```

**Response (200):** `data` is the updated assignment with nested `service` + `agentStatus`.

**Error codes:** `4040` — assignment not found; `4037` — assignment belongs to another agent; `4229` — invalid status for this agent (status not owned by the agent); `4035`–`4036`, `4226` — agent scope.

---

## Placeholder Dealers

Name-only **placeholder dealers** owned by an agent (`Dealer` rows with `isPlaceholder = true`, no contact/address, no login). An agent uses them to track work for a dealer that has not yet subscribed, and can later **connect** a placeholder to a real subscribed dealer (which grants the agent a `CONNECT` grant on that dealer). **Agent-scoped** — the agent is resolved from the JWT (or explicit `agentId` for `ADMIN`); every row must be owned by the calling agent.

**Auth:** Bearer JWT required.

### Model (Prisma `Dealer`, placeholder rows)

- `dealerId` (UUID, PK)
- `firmName`, `dealerName`, `displayName` (`dealerName` / `displayName` default to `firmName` when omitted on create)
- `isPlaceholder` = `true`, `ownerAgentId` = the calling agent
- `connectedDealerId` (nullable; the real dealer this placeholder is connected to)
- contact/address fields are `null`
- `createdAt`, `updatedAt`

**Response shape:** rows include nested `connectedDealer` (`dealerId`, `firmName`, `dealerName`) or `null`.

---

### POST /api/v1/placeholder-dealers

Create a name-only placeholder dealer owned by the calling agent.

**Auth:** Bearer token required.

**Request body:**

| Field       | Type   | Required | Validation |
|-------------|--------|----------|------------|
| firmName    | string | Yes      | Min 1, max 255 |
| dealerName  | string | No       | Min 1, max 255 (defaults to `firmName`) |
| displayName | string | No       | Min 1, max 255 (defaults to `firmName`) |

```json
{ "firmName": "Walk-in Dealer A" }
```

**Response (201):** `data` is the created placeholder dealer row.

**Error codes:** `4035`–`4036`, `4226` — agent scope.

---

### GET /api/v1/placeholder-dealers

List all placeholder dealers owned by the calling agent (newest first), each with its `connectedDealer` summary (or `null`). No pagination.

**Auth:** Bearer token required.

**Response (200):** `data` is an array of placeholder dealers (with nested `connectedDealer`).

**Error codes:** `4035`–`4036`, `4226` — agent scope.

---

### PATCH /api/v1/placeholder-dealers/:id

Update the name fields of a placeholder dealer owned by the calling agent. All body fields optional.

**Auth:** Bearer token required.

**Path params:** `id` = placeholder `dealerId` (UUID).

**Request body:** `firmName`, `dealerName`, `displayName` (each optional, min 1, max 255).

**Response (200):** `data` is the updated placeholder dealer (with `connectedDealer`).

**Error codes:** `4040` — placeholder not found; `4037` — not an owned placeholder; `4035` — not linked to an agent.

---

### DELETE /api/v1/placeholder-dealers/:id

Delete a placeholder dealer owned by the calling agent. **Blocked** when the placeholder has any vehicle processes attached.

**Auth:** Bearer token required.

**Path params:** `id` = placeholder `dealerId` (UUID).

**Response (200):** `data` is the deleted dealer row.

**Error codes:** `4040` — placeholder not found; `4037` — not an owned placeholder; `4093` — cannot delete a placeholder with processes; `4035` — not linked to an agent.

---

### POST /api/v1/placeholder-dealers/:id/connect

Connect a placeholder to a **real subscribed dealer** AND **migrate** everything the agent managed under the placeholder onto that real dealer — atomically. In one transaction it re-points the placeholder's `VehicleProcess`, `ProcessAssignment`, `ProcessReference`, and `DealerReference` rows to the real dealer (process children ride along via `processId`), **merges the placeholder's khata** into the real dealer's account (moves the `LedgerEntry` rows tagged with `sourceDealerId = placeholderId`, recomputes the account's running balance/totals, drops the emptied placeholder account), then creates/reactivates the `CONNECT` grant and sets `connectedDealerId`. Both the real dealer (on their own login) and the agent (via the CONNECT grant) then see the same data on the dealer's name.

**Auth:** Bearer token required (agent; must own the placeholder).

**Path params:** `id` = placeholder `dealerId` (UUID). **Request body:** `realDealerId` (UUID, required).

```json
{ "realDealerId": "uuid-real-dealer" }
```

**Response (200):** `data` is `{ placeholder (with connectedDealer), migratedProcesses, migratedAssignments, ledgerEntriesMerged }`.

**Error codes:** `4040` — placeholder or target not found; `4037` — not an owned placeholder; `4098` — target is not a subscribed real dealer; `4035` — not linked to an agent.

---

### POST /api/v1/placeholder-dealers/:id/connect-admin

**Super-admin only.** Same connect + migration as above, but for **any** agent's placeholder (uses the placeholder's owner as the agent). Body/response identical to `/connect`.

**Error codes:** `4038` — not a super-admin; `4040` — placeholder/target not found; `4226` — the row is not an agent placeholder; `4098` — target is not a subscribed real dealer.

---

### POST /api/v1/placeholder-dealers/:id/disconnect

Disconnect a placeholder dealer from its real dealer. Clears `connectedDealerId` and revokes the `CONNECT` grant when one was present. **Migrated data stays with the real dealer** (disconnect does not un-migrate — the placeholder is left empty).

**Auth:** Bearer token required.

**Path params:** `id` = placeholder `dealerId` (UUID).

**Response (200):** `data` is the updated placeholder dealer (`connectedDealer` now `null`).

**Error codes:** `4040` — placeholder not found; `4037` — not an owned placeholder; `4035` — not linked to an agent.

---

## Khata / Ledger (Phase 5)

A shared double-party ledger ("khata book") between a **dealer** and an **agent** that tracks money owed between them. Each dealer↔agent pair has at most one **khata account** (running balance + totals) and an append-only stream of **ledger entries**.

**Auth:** All khata endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Dual-persona (read the caller from the token)

This slice is **dual-persona**: the controller derives the caller's side from the access token — an **agent token** ⇒ the agent side, a **dealer token** ⇒ the dealer side. You never pass your own id. **`counterpartyId` is the other party's id:** for a **dealer** caller it is the **agent's** id; for an **agent** caller it is the **dealer's** id. A token that is neither a dealer nor an agent account is rejected with **`4059`**.

### Sign convention (the key contract)

`balance` and every entry's `balanceAfter`/`amount` are returned as **numbers** (not strings), in a **single signed, dealer-perspective** number that **both** sides see (the agent UI shows the same number, relabeled):

- **`balance > 0` ⇒ the dealer owes the agent** that amount.
- **`balance < 0` ⇒ the agent owes the dealer** that amount.
- **`balance === 0` ⇒ the pair is settled** (nothing outstanding).

Direction semantics, dealer-perspective:

- **`CREDIT`** raises what the dealer owes the agent (`balance += amount`).
- **`DEBIT`** lowers what the dealer owes the agent (`balance -= amount`).

Other invariants:

- **Settlement** is a normal balancing entry that drives `balance` toward `0` (a positive balance settles via a `DEBIT`, a negative balance via a `CREDIT`); the entry's `description` is `"Settlement"`.
- **Reversal** never hard-deletes the original — it posts an **opposite-direction counter-entry** (`reversesEntryId` set, `description` = `"Reversal of entry <id>"`) and stamps the original `isReversed: true`.
- Per-write rule: an **`ACTIVE` dealer↔agent grant is required to post** (entry, reversal, or settle) — otherwise **`4054`**. **Reads (accounts list, statement) do not require a grant.**
- For an **agent** posting against a **placeholder dealer**, the placeholder must first be connected to a real dealer (else **`4057`**); the entry is recorded against the connected real dealer with the placeholder id kept as `sourceDealerId` provenance.
- Amounts are positive, `> 0`, at most **2 decimal places**, within `Decimal(14,2)` (max `999999999999.99`).

### Model (simplified)

`KhataAccount` (per dealer↔agent pair):

- `khataAccountId` (UUID, PK)
- `dealerId`, `agentId` (UUIDs)
- `balance`, `totalCredit`, `totalDebit` (numbers; signed `balance`, dealer-perspective)
- `createdAt` / `updatedAt`

`LedgerEntry` (one per posting):

- `ledgerEntryId` (UUID, PK)
- `dealerId`, `agentId` (UUIDs)
- `direction` (`CREDIT` | `DEBIT`)
- `amount` (number `> 0`), `balanceAfter` (signed number — the account balance snapshot after this entry)
- `description` (string or `null`)
- `entryDate` (timestamp), `seq` (number — monotonic per pair; statement is ordered newest-first)
- `postedByRole` (`DEALER` | `AGENT`), `postedByUserId` (UUID or `null`)
- `assignmentId` (UUID or `null`), `sourceDealerId` (UUID or `null` — placeholder provenance)
- `reversesEntryId` (UUID or `null` — set on a reversal entry), `isReversed` (boolean — set on the original once reversed)
- `createdAt`

---

### GET /api/v1/khata/accounts

List the **caller's** khata accounts (a dealer caller → one per agent; an agent caller → one per dealer), newest-updated first (paginated). Each account carries a `counterparty` summary of the other party.

**Auth:** Bearer token required. Persona from the token (see **Dual-persona**).

**Query params:**

| Param | Type   | Required | Description                          |
|-------|--------|----------|--------------------------------------|
| page  | number | No       | 1-based page index (default 1)       |
| limit | number | No       | Items per page (default 10, max 100) |

**Response (200):** `data.data` = array of accounts; `data.meta` = `{ total, page, limit, totalPages }`. For a **dealer** caller, `counterparty` is the agent (`agentId`, `firmName`, `agentName`, `displayName`); for an **agent** caller, it is the dealer (`dealerId`, `firmName`, `dealerName`, `displayName`).

```json
{
  "statusCode": 200,
  "message": "Khata accounts retrieved",
  "data": {
    "data": [
      {
        "khataAccountId": "uuid",
        "dealerId": "uuid-dealer",
        "agentId": "uuid-agent",
        "balance": 1500,
        "totalCredit": 4500,
        "totalDebit": 3000,
        "counterparty": {
          "agentId": "uuid-agent",
          "firmName": "Speedy RTO Services",
          "agentName": "Ramesh Agent",
          "displayName": "Speedy RTO"
        },
        "createdAt": "2026-06-01T10:00:00.000Z",
        "updatedAt": "2026-06-20T09:30:00.000Z"
      }
    ],
    "meta": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

**Error codes:** `4059` — token is not a dealer or agent account.

---

### GET /api/v1/khata/accounts/:counterpartyId/statement

Return the running-balance statement (account summary + ledger entries, newest first) for one dealer↔agent pair. **Reads do not require an active grant.**

**Auth:** Bearer token required. Persona from the token.

**Path params:**

| Param          | Type   | Required | Description |
|----------------|--------|----------|-------------|
| counterpartyId | string | Yes      | UUID — the other party's id (agent id for a dealer caller; dealer id for an agent caller) |

**Query params:** `page` (optional), `limit` (optional, default 10, max 100).

**Response (200):** `data` = `{ account, entries, meta }`. `account` is the signed account summary (`balance`, `totalCredit`, `totalDebit`, `khataAccountId`, `dealerId`, `agentId`, `updatedAt`) or **`null`** if no entries have ever been posted for this pair. `entries` is the page of ledger entries ordered by `seq` descending.

```json
{
  "statusCode": 200,
  "message": "Khata statement retrieved",
  "data": {
    "account": {
      "khataAccountId": "uuid",
      "dealerId": "uuid-dealer",
      "agentId": "uuid-agent",
      "balance": 1500,
      "totalCredit": 4500,
      "totalDebit": 3000,
      "updatedAt": "2026-06-20T09:30:00.000Z"
    },
    "entries": [
      {
        "ledgerEntryId": "uuid-entry-2",
        "dealerId": "uuid-dealer",
        "agentId": "uuid-agent",
        "direction": "DEBIT",
        "amount": 3000,
        "balanceAfter": 1500,
        "description": "Part payment received",
        "entryDate": "2026-06-20T09:30:00.000Z",
        "seq": 2,
        "postedByRole": "DEALER",
        "postedByUserId": "uuid-user",
        "assignmentId": null,
        "sourceDealerId": null,
        "reversesEntryId": null,
        "isReversed": false,
        "createdAt": "2026-06-20T09:30:00.000Z"
      },
      {
        "ledgerEntryId": "uuid-entry-1",
        "dealerId": "uuid-dealer",
        "agentId": "uuid-agent",
        "direction": "CREDIT",
        "amount": 4500,
        "balanceAfter": 4500,
        "description": "RTO charges for MH12AB1234",
        "entryDate": "2026-06-18T11:00:00.000Z",
        "seq": 1,
        "postedByRole": "AGENT",
        "postedByUserId": "uuid-user",
        "assignmentId": "uuid-assignment",
        "sourceDealerId": null,
        "reversesEntryId": null,
        "isReversed": false,
        "createdAt": "2026-06-18T11:00:00.000Z"
      }
    ],
    "meta": { "total": 2, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

**Error codes:** `4059` — token is not a dealer or agent account; `4220` — invalid `counterpartyId` (not a UUID).

---

### POST /api/v1/khata/entries

Post a single credit/debit entry to the pair (caller + counterparty). Resolves the pair, asserts an `ACTIVE` grant, then writes the entry and updates the account atomically.

**Auth:** Bearer token required. Persona from the token.

**Request body:**

| Field          | Type   | Required | Validation |
|----------------|--------|----------|------------|
| counterpartyId | string | Yes      | UUID — the other party's id |
| direction      | string | Yes      | `CREDIT` or `DEBIT` (see **Sign convention**) |
| amount         | number | Yes      | `> 0`, at most 2 decimal places, ≤ `999999999999.99` |
| description    | string | No       | Trimmed, max 2000 chars |
| assignmentId   | string | No       | UUID — links the entry to a process assignment. The assignment must belong to **this same** dealer↔agent pair, otherwise `4236` |

**Example:**

```json
{
  "counterpartyId": "uuid-agent",
  "direction": "CREDIT",
  "amount": 4500,
  "description": "RTO charges for MH12AB1234",
  "assignmentId": "uuid-assignment"
}
```

**Response (201):** `data` = `{ account, entry }` — the updated account summary and the new ledger entry (same shapes as the statement above).

```json
{
  "statusCode": 201,
  "message": "Ledger entry posted",
  "data": {
    "account": {
      "khataAccountId": "uuid",
      "dealerId": "uuid-dealer",
      "agentId": "uuid-agent",
      "balance": 4500,
      "totalCredit": 4500,
      "totalDebit": 0,
      "updatedAt": "2026-06-18T11:00:00.000Z"
    },
    "entry": {
      "ledgerEntryId": "uuid-entry-1",
      "dealerId": "uuid-dealer",
      "agentId": "uuid-agent",
      "direction": "CREDIT",
      "amount": 4500,
      "balanceAfter": 4500,
      "description": "RTO charges for MH12AB1234",
      "entryDate": "2026-06-18T11:00:00.000Z",
      "seq": 1,
      "postedByRole": "DEALER",
      "postedByUserId": "uuid-user",
      "assignmentId": "uuid-assignment",
      "sourceDealerId": null,
      "reversesEntryId": null,
      "isReversed": false,
      "createdAt": "2026-06-18T11:00:00.000Z"
    }
  }
}
```

**Error codes:** `4054` — no active dealer↔agent relationship (posting blocked); `4057` — agent caller's placeholder dealer is not connected to a real dealer; `4040` — dealer (counterparty) not found; `4236` — `assignmentId` does not belong to this dealer↔agent pair (an unknown id gets the same answer); `4059` — token is not a dealer or agent account; `4220` — validation (bad UUID, non-positive or >2dp amount, invalid `direction`).

---

### POST /api/v1/khata/entries/:id/reverse

Reverse a ledger entry the caller is a party to. Posts an **opposite-direction** counter-entry and stamps the original `isReversed: true` (the original is never hard-deleted). Either side of the pair may reverse a shared entry. Requires an `ACTIVE` grant.

**Auth:** Bearer token required. Persona from the token.

**Path params:**

| Param | Type   | Required | Validation |
|-------|--------|----------|------------|
| id    | string | Yes      | UUID — `ledgerEntryId` of the entry to reverse |

**Response (200):** `data` = `{ account, entry }` where `entry` is the **reversal** entry (its `reversesEntryId` points at the original; `description` = `"Reversal of entry <id>"`).

```json
{
  "statusCode": 200,
  "message": "Ledger entry reversed",
  "data": {
    "account": {
      "khataAccountId": "uuid",
      "dealerId": "uuid-dealer",
      "agentId": "uuid-agent",
      "balance": 0,
      "totalCredit": 4500,
      "totalDebit": 4500,
      "updatedAt": "2026-06-19T08:00:00.000Z"
    },
    "entry": {
      "ledgerEntryId": "uuid-entry-reversal",
      "dealerId": "uuid-dealer",
      "agentId": "uuid-agent",
      "direction": "DEBIT",
      "amount": 4500,
      "balanceAfter": 0,
      "description": "Reversal of entry uuid-entry-1",
      "entryDate": "2026-06-19T08:00:00.000Z",
      "seq": 2,
      "postedByRole": "DEALER",
      "postedByUserId": "uuid-user",
      "assignmentId": null,
      "sourceDealerId": null,
      "reversesEntryId": "uuid-entry-1",
      "isReversed": false,
      "createdAt": "2026-06-19T08:00:00.000Z"
    }
  }
}
```

**Error codes:** `4040` — entry not found; `4037` — caller is not a party to this entry; `4055` — entry already reversed; `4056` — cannot reverse a reversal entry; `4054` — no active dealer↔agent relationship; `4059` — token is not a dealer or agent account; `4220` — invalid `id` (not a UUID).

---

### POST /api/v1/khata/accounts/:counterpartyId/settle

Settle the pair by posting a balancing entry that drives `balance` toward `0`. Omit `amount` for a **full** settle; send a smaller `amount` for a **partial** settle (capped at the outstanding magnitude). The settle amount is computed inside a locked transaction from the current balance, so concurrent posts cannot desync it. Requires an `ACTIVE` grant.

**Auth:** Bearer token required. Persona from the token.

**Path params:**

| Param          | Type   | Required | Validation |
|----------------|--------|----------|------------|
| counterpartyId | string | Yes      | UUID — the other party's id |

**Request body:**

| Field  | Type   | Required | Validation |
|--------|--------|----------|------------|
| amount | number | No       | `> 0`, ≤ 2 decimal places, ≤ `999999999999.99`. Omit for a full settle; capped at the outstanding balance |

**Example (partial settle):**

```json
{ "amount": 500 }
```

**Response (200):** `data` = `{ account, entry }` — the updated account summary and the balancing entry (`description` = `"Settlement"`). A full settle leaves `balance: 0`.

```json
{
  "statusCode": 200,
  "message": "Khata settled",
  "data": {
    "account": {
      "khataAccountId": "uuid",
      "dealerId": "uuid-dealer",
      "agentId": "uuid-agent",
      "balance": 1000,
      "totalCredit": 4500,
      "totalDebit": 3500,
      "updatedAt": "2026-06-21T07:00:00.000Z"
    },
    "entry": {
      "ledgerEntryId": "uuid-entry-settle",
      "dealerId": "uuid-dealer",
      "agentId": "uuid-agent",
      "direction": "DEBIT",
      "amount": 500,
      "balanceAfter": 1000,
      "description": "Settlement",
      "entryDate": "2026-06-21T07:00:00.000Z",
      "seq": 3,
      "postedByRole": "DEALER",
      "postedByUserId": "uuid-user",
      "assignmentId": null,
      "sourceDealerId": null,
      "reversesEntryId": null,
      "isReversed": false,
      "createdAt": "2026-06-21T07:00:00.000Z"
    }
  }
}
```

**Error codes:** `4058` — account is already settled (balance is zero, nothing to settle); `4054` — no active dealer↔agent relationship; `4057` — agent caller's placeholder dealer is not connected to a real dealer; `4040` — no khata account / dealer not found; `4059` — token is not a dealer or agent account; `4220` — validation (bad UUID or amount).

---

## AI

### POST /api/v1/ai/analyze-image

Upload a single RC image. The backend sends the image **directly to Gemini vision**, which returns structured JSON in one call (thinking disabled for cost/latency). The model is configurable via `GEMINI_MODEL`.

**Auth:** None.

**Content-Type:** `multipart/form-data`

**Form-data fields:**

- `image` (file, required): image to analyze.

**Success response (200):**

`data` has `vehicleInfo` and `ownerInfo`. `ownerInfo.fullName` is a single space-separated string. For individual owners, RC-style forms often use a line like **Son/Wife/Daughter of** — use the owner’s name first, then the name after that header (parent name) if present, then surname, e.g. `Vikalp Dipakkumar Chavda`. `address` omits city, state, and pincode (those are in their own keys).

```json
{
  "success": true,
  "data": {
    "vehicleInfo": {
      "vehicleNo": "GJ03EH9098",
      "chassisNo": "MBLJF16EDCGA07285",
      "engineNo": "JF16EBCGA06004",
      "registrationDate": "09-Feb-2012",
      "manufactureMonth": 1,
      "manufactureYear": 2012,
      "vehicleType": "SCOOTER/MOPED",
      "make": "HERO HONDA MOTORS LTD",
      "model": "PLEASURE"
    },
    "ownerInfo": {
      "fullName": "Vikalp Dipakkumar Chavda",
      "address": "Street, area, landmark",
      "city": "Ahmedabad",
      "state": "Gujarat",
      "pincode": "380015"
    }
  }
}
```

**Error responses:**

- `4002` — image file is missing (`image` field not provided).
- `4004` — uploaded file is not an image.
- `4005` — more than one file uploaded (only one image allowed).
- `4290` — Gemini quota/rate limit exceeded.
- `5020` — Gemini API call failed.
- `5021` — Gemini response was not valid JSON after sanitization.

### POST /api/v1/ai/analyze-id-proof

Upload a single image of an Indian identity document (Aadhaar, PAN, Driving Licence, Voter ID, Passport, etc.) and extract name/address fields. Same pipeline as analyze-image (image sent directly to Gemini vision).

**Auth:** None.

**Content-Type:** `multipart/form-data`

**Form-data fields:**

- `image` (file, required): ID proof image to analyze.

**Success response (200):**

`data` contains flat identity fields. `address` omits city, state, and pincode (those are separate keys). `state` is preferably a 2-letter code when visible (e.g. `GJ`).

```json
{
  "success": true,
  "data": {
    "fullName": "DHARMESHBHAI NAGINBHAI GONDALIYA",
    "address": "RAMNATHPARA 20 B MAHADEV TEMPLE MAIN ROAD",
    "city": "Rajkot",
    "state": "GJ",
    "pincode": "360003"
  }
}
```

**Error responses:**

- `4002` — image file is missing (`image` field not provided).
- `4004` — uploaded file is not an image.
- `4005` — more than one file uploaded (only one image allowed).
- `4290` — Gemini quota/rate limit exceeded.
- `5020` — Gemini API call failed.
- `5021` — Gemini response was not valid JSON after sanitization.


---
## Registrations (public self-registration → super-admin approval)

Self-service signup for dealers/agents. A visitor registers (choosing dealer or agent and setting their own password); the account is created **PENDING** with the login email **unverified**, and a signup OTP is emailed. They verify the email (`POST /auth/verify-otp`, which signs them in) and land on a **pending-approval** screen. A super-admin **approves** (unlocks access; a dealer is also marked subscribed) or **rejects** (blocks access, with a reason). Firms created by a super-admin or via an agent invitation are `APPROVED` by default, so only self-registrations are gated.

> **Access gate.** While a linked dealer/agent firm is `PENDING`/`REJECTED`, its token is accepted only on `/auth/*` routes (e.g. `/auth/me`, logout); every other authenticated route returns **403 `4021`**. The token carries `approvalStatus`; `GET /auth/me` returns the fresh (DB-read) value so the pending screen can detect approval, then refresh the token.
>
> **Paused firms are a separate, stricter gate.** If the super-admin has paused the firm (`isActive: false`), every authenticated route returns **403 `4022`** — with **no `/auth` exemption** (`GET /auth/me` included) — and it is checked **before** the `4021` gate. See **Paused firms** under [Using the JWT](#using-the-jwt).

### POST /api/v1/registrations

**Public.** Create a self-registration. Provisions the dealer/agent firm (`PENDING`) + login user (email unverified) + link, then emails a signup OTP.

Body: `registerAs` (`DEALER`|`AGENT`, req), `applicantName` (req), `firmName` (req), `emailId` (req), `mobileNo` (req), `password` (req, min 8), `whatsappNo?`, `address?`, `city?`, `state?`, `pincode?`.

Success `201`: `{ emailId, registerAs }`. Then verify via `POST /auth/verify-otp` (`purpose: SIGNUP_EMAIL_VERIFICATION`). Errors: `4091` (email already an account), `4220`.

### GET /api/v1/auth/me

**Auth (any).** Returns `{ user: { userId, emailId, userName, emailVerified, dealerId, agentId, isSuperAdmin, approvalStatus, approvalReason } }` with a fresh approval state. Allowed even for a pending/rejected firm — but **not** for a paused one: it returns **403 `4022`** like every other authenticated route, which is what lets a signed-in tab polling this endpoint detect a pause.

### GET /api/v1/registrations

**Super-admin.** Paginated registration requests (merged dealers + agents), default `PENDING`+`REJECTED`, newest first. Query: `page?`, `limit?`, `status?` (`PENDING`|`APPROVED`|`REJECTED`). Each item: `{ kind: 'dealer'|'agent', id, firmName, applicantName, emailId, mobileNo, approvalStatus, approvalReason, createdAt }`. Errors: `4038`.

### POST /api/v1/registrations/:kind/:id/approve

**Super-admin.** Approve a registration (`kind` = `dealer`|`agent`): sets `APPROVED`, clears the reason (a dealer is also marked subscribed), emails the applicant. Errors: `4065` not found, `4038`.

### POST /api/v1/registrations/:kind/:id/reject

**Super-admin.** Reject a registration with an optional reason (emailed). Body: `{ reason? }`. Sets `REJECTED`. Errors: `4065`, `4038`.
