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
| fileName    | string | Yes      | Max 255; extension must match `contentType` (e.g. `.png` for `image/png`, `.jpg` or `.jpeg` for `image/jpeg`, `.webp` for `image/webp`) |
| contentType | string | Yes      | One of: `image/png`, `image/jpeg`, `image/webp` |

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

**Error codes:** `4010` — invalid email or password; `4031` — email not verified (only when `REQUIRE_EMAIL_VERIFIED_FOR_LOGIN=true`).

---

### POST /api/v1/auth/refresh

Exchange a valid **refresh token** for a fresh access token and a **rotated** refresh token (so an active session never hits the refresh-token expiry). Stateless — the refresh token is validated by signature + `purpose: REFRESH`, then the access token is rebuilt from the current user so dealer/agent/admin claims stay in sync.

**Auth:** None (the refresh token is the credential; send it in the body, not the `Authorization` header).

**Request body:** `refreshToken` (string, required).

```json
{ "refreshToken": "eyJhbGciOiJIUzI1NiIs..." }
```

**Response (200):** `data` = `{ "token": "<new access token>", "refreshToken": "<rotated refresh token>" }`. The client should replace both stored tokens.

**Error codes:** `4017` — invalid or expired refresh token (bad signature, expired, wrong `purpose`, or unknown user). Note an **access** token is rejected here (wrong `purpose`), and a **refresh** token is rejected by `authenticate` on normal API routes (**`4015`**).

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

**Error codes:** `4006` — invalid or expired signup OTP; `4007` — invalid or expired password-reset OTP; `4004` — user missing after verification (rare).

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

**Error codes:** `4005` — invalid/expired challenge; `4011` — passkey not found; `4012` — verification failed; `5001` — user not found after verification.

---

## Using the JWT

For protected endpoints, send the token in the header:

```
Authorization: Bearer <token>
```

Token payload includes `sub` (userId), `email`, `role`, **`dealerId`** (UUID or `null` — the dealer linked in `dealer_wise_user`, if any), **`agentId`** (UUID or `null` — the agent linked in `agent_wise_user`; a user is linked to at most one of dealer/agent), **`isSuperAdmin`** (boolean — from `User.isSuperAdmin`; the only privilege signal since `role` is always `USER`), and **`purpose`** (`ACCESS`). Password-reset tokens omit these. After a user’s dealer/agent assignment or admin flag changes, they must sign in again (or refresh) so the access token picks up the new claims.

**Access + refresh tokens.** Login/verify-otp/passkey return an **access token** (`purpose: ACCESS`, `JWT_ACCESS_EXPIRES_IN`, default `1h`) and a **refresh token** (`purpose: REFRESH`, `JWT_REFRESH_EXPIRES_IN`, default `30d`). Send the access token as `Authorization: Bearer`; on a `401`, exchange the refresh token at **`POST /auth/refresh`** for a new access token + rotated refresh token, then retry — the user stays logged in. `authenticate` accepts only `ACCESS` tokens (a `REFRESH` or `PASSWORD_RESET` token is rejected with **`4015`**); `/auth/refresh` accepts only `REFRESH` tokens (**`4017`** otherwise).

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

### POST /api/v1/rto-services

Create a new RTO service. `orderRank` is assigned server-side (max existing + 1).

**Auth:** Bearer token required.

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

Master list for grouping uploads (e.g. RC, insurance). Same patterns as RTO Services: JWT on all routes, auto `orderRank` on create (max existing + 1), `PUT .../order` to reorder. **List is not paginated.**

Per-dealer flags and ordering use **Dealer-wise upload categories** (see below).

**Auth:** Bearer token required on all endpoints below.

### Model (Prisma `UploadCategory`)

- `categoryId` (UUID, PK)
- `categoryName` (string, max 255, **required**, **unique**)
- `orderRank` (integer, assigned on create as **max(`orderRank`) + 1**)
- `bothSide` (boolean, default `false`)
- `createdAt` / `updatedAt`

---

### POST /api/v1/upload-categories

**Request body:** `categoryName` (string, required), `bothSide` (boolean, required). `orderRank` is server-assigned.

**Error codes:** `4097` — category name already exists.

---

### GET /api/v1/upload-categories

Full list, ordered by `orderRank` ascending.

---

### GET /api/v1/upload-categories/:id

**Path:** `id` = `categoryId` (UUID). **Error codes:** `4051` — not found.

---

### PATCH /api/v1/upload-categories/:id

Body: `categoryName`, `bothSide` (both required). **Error codes:** `4051`, `4097`.

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
- `createdAt`, `updatedAt`

**Response shape:** Rows include nested `user` (`userId`, `userName`, `emailId`, `mobileNo` only; no password).

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

## Dealers

CRUD for dealers. All fields are required. `emailId`, `mobileNo`, and `whatsappNo` are unique. `isSubscribe` defaults to `false` on create.

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
- `createdAt` / `updatedAt` (timestamps, managed by DB)

---

### POST /api/v1/dealers

Create a new dealer. **Automatically creates three default dealer statuses** for this dealer: "TO-DO" (blue, rank 1), "In Progress" (Yellow, rank 2), and "Complete" (green, rank 3).

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

### DELETE /api/v1/dealers/:id

Delete a dealer by ID.

**Auth:** Bearer token required.

**Error codes:** `4043` — dealer not found.

---

## Dealer Statuses

Dealer statuses are **managed per dealer**. **statusName is unique per dealer** (not globally). **statusRank is per dealer** and is determined by the order of the `statusData` array in the sync API (1, 2, 3, …). Creating a dealer automatically adds three default statuses (TO-DO, In Progress, Complete).

**Auth:** All dealer status endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Model

- `statusId` (UUID, PK)
- `dealerId` (UUID, **required**, FK to Dealer; cascade delete)
- `statusName` (string, **required**; **unique per dealer**)
- `colour` (string, **required**, max 50; not unique)
- `statusRank` (integer, **required**, per-dealer display order)
- `createdAt` / `updatedAt` (timestamps, managed by DB)

---

### POST /api/v1/dealer-statuses

Sync all statuses for a dealer in a single request. This endpoint **creates, updates, deletes, and reorders** statuses for the specified dealer.

**Auth:** Bearer token required.

**Request body:** `statusData` (array) is required. **`dealerId` is optional** — from JWT for normal users; **`ADMIN` must send `dealerId`**.

```json
{
  "statusData": [
    {
      "statusId": "e49e3b84-2071-4358-8caf-949f19acd8c9",
      "statusName": "TO-DO",
      "colour": "blue"
    },
    {
      "statusId": "38ca593f-5e2c-4404-ae52-9a1b9c32950d",
      "statusName": "In Progress",
      "colour": "Yellow"
    },
    {
      "statusId": "07aa546f-cb40-4881-8809-d5bf15c91974",
      "statusName": "Complete",
      "colour": "green"
    },
    {
      "statusName": "Pending",
      "colour": "Red"
    }
  ]
}
```

- If `statusId` is present and belongs to this dealer: update `statusName`, `colour`, and assign `statusRank` based on array order.
- If `statusId` is omitted: create a new status for this dealer with the given `statusName`, `colour`, and `statusRank`.
- Any existing status for this dealer **not present** in `statusData` is **deleted**.
- The order of `statusData` defines `statusRank` (1, 2, 3, …).

**Response (200):** `data` is the final array of statuses for that dealer, ordered by `statusRank`.

**Error codes:** `4097` — status name already exists for this dealer; `4221` — no statuses provided; `4222` — duplicate statusName in payload; `4032`–`4033`, `4226` — dealer scope.

---

### PUT /api/v1/dealer-statuses/order

Update `statusRank` for multiple statuses for a dealer in one request. This endpoint only changes the order (ranks); it does not create, delete, or rename statuses.

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
- Only the provided statuses are reordered; other statuses for the dealer keep their existing `statusRank`.

**Response (200):** `data` is the full array of statuses for that dealer, ordered by updated `statusRank`.

**Error codes:** `4221` — no statuses provided; `4223` — one or more statuses do not belong to this dealer; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/dealer-statuses

Get all statuses for the **dealer in the JWT**, ordered by `statusRank`. No query parameters.

**Auth:** Bearer token required.

**Error codes:** `4033` / `4226` — missing dealer context for your role.

---

### GET /api/v1/dealer-statuses/:dealerId

Get all statuses for a dealer, ordered by `statusRank`. For non-`ADMIN`, **`:dealerId` must match the JWT `dealerId`**.

**Auth:** Bearer token required.

**Error codes:** `4032` — path dealer does not match session; otherwise returns empty array if the dealer has no statuses.

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
- `events[]` — the caller's **OWN** timeline (full detail), ordered by process date ascending (nulls last), then `BUY` before `SELL`. Each: `{ kind: 'BUY' | 'SELL', date, counterpartyName, counterpartyMobile, counterpartyAddress, amount, currency, processId }`. A **BUY** is emitted when the process has a SELLER (amount = `purchasePrice`, or `null` = "not recorded"); a **SELL** when it has a BUYER (amount = `salePrice`, or `null`). Two events can share a `processId` (a process with both a seller and buyer).
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
      { "kind": "BUY",  "date": "2026-06-28T15:07:00.413Z", "counterpartyName": "Old Owner", "counterpartyMobile": "9111111111", "counterpartyAddress": null, "amount": 50000, "currency": "INR", "processId": "…" },
      { "kind": "SELL", "date": "2026-06-28T15:07:00.413Z", "counterpartyName": "New Buyer", "counterpartyMobile": "9222222222", "counterpartyAddress": null, "amount": 65000, "currency": "INR", "processId": "…" }
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

Vehicle processes store a process record (vehicle + dealer + status + date) and its associated persons (buyer/seller) in one workflow.

**Auth:** All vehicle process endpoints require a valid JWT. Send it in the header: `Authorization: Bearer <token>`.

### Model (simplified)

- `processId` (UUID, PK)
- `vehicleId` (UUID, required by API)
- `dealerId` (UUID, required by API)
- `status` (string, required by API)
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
- `status` is set to **`Pending`**.
- **`persons`** (optional): omit the field, send `[]`, or omit entries to create **no** `Person` rows. If you send one or more person objects (same shape as **`POST /api/v1/vehicle-processes`** — `personName`, `mobileNumber`, `personType` `SELLER` | `BUYER`, optional `address`), they are created with the process in one transaction. **At most one SELLER and one BUYER** per process.
- **Prices** (optional): `purchasePrice` (what the dealer paid the SELLER) and `salePrice` (what the BUYER paid) — positive, ≤2 decimals, stored `Decimal(14,2)`; plus `priceCurrency` (default `INR`). **Cross-field invariant:** `purchasePrice` requires a SELLER and `salePrice` requires a BUYER, else **422 `4220`**. Prices live on the dealer-scoped process (private per dealer) and feed **`GET /vehicles/history`**.
- **`uploadPhotos`** (optional): omit or `[]` to skip. Each item: `{ category, imageName }` (same fields as **`POST /api/v1/process-upload-photos`**, without `processId` — assigned automatically).
- **`processReferences`** (optional): omit or `[]` to skip. Each item: `{ referenceId, referenceType }` where `referenceType` is `BUY` (buyer reference) or `SELL` (seller reference). `referenceId` must exist in **`dealer_references`** and belong to the dealer when scoped. At most one row per `referenceType` per request.
- `processDate` defaults to **now** if omitted; otherwise send an ISO-8601 string.

**Auth:** Bearer token required.

**Request body:** Same fields as **`POST /api/v1/vehicles`** (`registrationNumber` required; other vehicle fields optional/nullable), plus optional `processDate` (ISO string), plus optional **`dealerId`** (required for **`ADMIN`**), plus optional **`persons`**, **`uploadPhotos`**, **`processReferences`** (arrays, may be empty).

**Example:**

```json
{
  "registrationNumber": "MH12AB1234",
  "vehicleType": "Car",
  "make": "Maruti",
  "model": "Swift",
  "processDate": "2026-04-05T12:00:00.000Z",
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

**Response (201):** `data` = `{ vehicle, process, vehicleCreated, vehicleUpdated, uploadPhotos, processReferences }` where `process` includes `persons`, `processUploadPhotos`, and `processReferences`; top-level `uploadPhotos` / `processReferences` mirror the nested arrays for convenience.

**Error codes:** `4043` — dealer not found; `4057` — dealer reference not found; `4035` — reference not in dealer scope; `4100`–`4102` — vehicle uniqueness conflicts on create/update; `4032`–`4033`, `4226` — dealer scope; `4227` — invalid `processDate`; `4228` — duplicate `referenceType` in `processReferences`.

---

### POST /api/v1/vehicle-processes

Create a vehicle process and its persons in **one request**.

**Auth:** Bearer token required.

**Request body:** `vehicleId`, `status`, `processDate`, `persons` required. **`dealerId` optional** — from JWT for normal users; **`ADMIN` must send `dealerId`**.

```json
{
  "vehicleId": "uuid",
  "status": "TO-DO",
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

**Response (201):** created process including `persons[]`.

**Error codes:** `4047` — vehicle not found; `4043` — dealer not found; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/vehicle-processes

List vehicle processes (paginated). Each item includes `persons[]`.

**Auth:** Bearer token required.

**Query params:** `page`, `limit` (optional).

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
  "status": "Pending",
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
      "photoUrl": "http://localhost:4002/uploads/abc-uuid.png"
    }
  ]
}
```

- **`owner`** — first `SELLER` person on the process, or `null`.
- **`buyer`** — first `BUYER` person, or `null`.
- **`references.seller` / `references.buyer`** — linked `dealer_references` by `referenceType` `SELL` / `BUY`, or `null`.
- **`photos`** — rows from `process_upload_photo` and `process_upload_image`. `photoUrl` is built from stored file keys using the request host (same rules as upload `publicUrl`); full URLs stored in DB are returned unchanged.

**Error codes:** `4050` — vehicle process not found; `4034` — wrong dealer.

---

### PATCH /api/v1/vehicle-processes/:id

Update a vehicle process and its persons in **one request**. Persons are replaced with the provided array. **`dealerId` in body** follows the same JWT / `ADMIN` rules as POST.

> **Full-replace semantics — carry prices forward.** This PATCH is a full replace: `persons` are replaced, and **any omitted `purchasePrice` / `salePrice` is set to `null`**. A client changing only the status must re-send the existing `persons` **and** prices, or they are wiped. The same single-seller/single-buyer and price-requires-counterparty invariants as `start` apply (**422 `4220`**).

**Auth:** Bearer token required.

**Error codes:** `4050` — vehicle process not found; `4047` — vehicle not found; `4043` — dealer not found; `4034`; `4032`–`4033`, `4226`; `4220` — price/person invariant violation.

---

### DELETE /api/v1/vehicle-processes/:id

Delete a vehicle process by ID (persons are deleted automatically via cascade).

**Auth:** Bearer token required.

**Error codes:** `4050` — vehicle process not found; `4034`.

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

### POST /api/v1/persons

**Body:** `processId` (UUID), `personName`, `mobileNumber`, `personType`, optional `address` (string or `null`). Optional **`dealerId`** in body for **`ADMIN`** only.

**Error codes:** `4050` — vehicle process not found; `4034` — process not in your dealer; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/persons?processId=

**Query:** `processId` (UUID, required). Optional **`dealerId`** for **`ADMIN`**.

**Response:** `data` is an array of persons, ordered by `createdAt` ascending.

**Error codes:** `4050`, `4034`, `4032`–`4033`, `4226`.

---

### GET /api/v1/persons/:id

**Path:** `id` = `personId`. Optional query **`dealerId`** for **`ADMIN`**.

**Error codes:** `4055` — person not found; `4034`; `4032`–`4033`, `4226`.

---

### PATCH /api/v1/persons/:id

**Body:** `personName`, `mobileNumber`, `personType`, optional `address`. Optional query **`dealerId`** for **`ADMIN`**.

**Error codes:** `4055`, `4034`, `4032`–`4033`, `4226`.

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
| `created_at` / `updated_at` | `createdAt` / `updatedAt` |

All columns are **required** (non-null).

---

### POST /api/v1/process-upload-photos

**Body:** `processId`, `category`, `imageName` (strings, max 255). Optional **`dealerId`** for **`ADMIN`**.

**Error codes:** `4050`, `4034`, `4032`–`4033`, `4226`.

---

### POST /api/v1/process-upload-photos/bulk

**Body:** `items` — non-empty array of `{ processId, category, imageName }`. Each `processId` is checked against the same dealer scope. Optional **`dealerId`** for **`ADMIN`**.

**Response (201):** `data` = `{ items: [ ...created rows ] }`.

**Error codes:** same as single create if any item’s process is invalid or forbidden.

---

### GET /api/v1/process-upload-photos?processId=

**Query:** `processId` (required). Optional **`dealerId`** for **`ADMIN`**.

**Response:** `data` is an array ordered by `createdAt` ascending.

---

### GET /api/v1/process-upload-photos/:id

**Path:** `id` = `processUploadPhotoId`. Optional **`dealerId`** query for **`ADMIN`**.

**Error codes:** `4056` — not found; `4034`; `4032`–`4033`, `4226`.

---

### PATCH /api/v1/process-upload-photos/:id

**Body:** `category`, `imageName` (both required). Optional **`dealerId`** query for **`ADMIN`**.

**Error codes:** `4056`, `4034`, `4032`–`4033`, `4226`.

---

### DELETE /api/v1/process-upload-photos/:id

Optional **`dealerId`** query for **`ADMIN`**.

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
| `created_at` / `updated_at` | `createdAt` / `updatedAt` |

---

### POST /api/v1/process-tasks

**Body:** `processId`, `taskName`, `taskDate` (ISO string), optional `assignUserId` (UUID or `null`), optional `status` (string, max 50; defaults to `To-Do` — e.g. `To-Do` / `In Progress` / `Done`). Optional **`dealerId`** for **`ADMIN`**.

**Error codes:** `4050`, `4034`, `4045` — assignee user not found; `4032`–`4033`, `4226`; `4229` — invalid `taskDate`.

---

### GET /api/v1/process-tasks?processId=

**Query:** `processId` (required). Optional **`dealerId`** for **`ADMIN`**.

**Response:** `data` is an array ordered by `taskDate`, then `createdAt`.

---

### GET /api/v1/process-tasks/:id

**Path:** `id` = `processTaskId`. Optional **`dealerId`** query for **`ADMIN`**.

**Error codes:** `4057` — not found; `4034`; `4032`–`4033`, `4226`.

---

### PATCH /api/v1/process-tasks/:id

**Body:** `taskName`, `taskDate`, optional `assignUserId` (UUID or `null` to clear), optional `status` (string, max 50). Optional **`dealerId`** query for **`ADMIN`**.

**Error codes:** `4057`, `4034`, `4045`, `4229`, `4032`–`4033`, `4226`.

---

### DELETE /api/v1/process-tasks/:id

Optional **`dealerId`** query for **`ADMIN`**.

**Error codes:** `4057`, `4034`, `4032`–`4033`, `4226`.

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

Sync endpoints follow the same pattern as **Dealer Statuses**: send the full list for a scope; rows with an id are updated, rows without id are created, and **rows missing from the payload are deleted** (cascades to children / permissions). **`sortOrder` is not sent by the client** — it is set from the **array index** (0-based) on each sync.

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

CRUD for agents. `firmName`, `agentName`, and `displayName` are **required**; contact/address fields are optional. `emailId`, `mobileNo`, and `whatsappNo` are **unique when provided** (multiple agents may omit them). `isSubscribe` defaults to `false` on create.

**Auth:** Bearer JWT required on all endpoints. These are **dealer/admin-facing** (not agent-scoped).

### Model (Prisma `Agent`, table `agents`)

- `agentId` (UUID, PK)
- `firmName`, `agentName`, `displayName` (required strings, max 255)
- `address` (text, nullable), `city` / `state` (nullable, max 100), `pincode` (nullable, max 10)
- `mobileNo` (nullable, max 20; **unique** when set)
- `emailId` (nullable, valid email, max 255; **unique** when set)
- `whatsappNo` (nullable, max 20; **unique** when set)
- `isSubscribe` (boolean, default `false`)
- `createdAt` / `updatedAt` (timestamps)

---

### POST /api/v1/agents

Create a new agent.

**Auth:** Bearer token required.

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

### GET /api/v1/agents/:id

Get a single agent by ID.

**Auth:** Bearer token required.

**Path params:** `id` = `agentId` (UUID).

**Error codes:** `4044` — agent not found.

---

### PATCH /api/v1/agents/:id

Update an existing agent. Same body fields as create, but **`isSubscribe` is required**. Uniqueness for `emailId` / `mobileNo` / `whatsappNo` is enforced against other agents.

**Auth:** Bearer token required.

**Error codes:** `4044` — agent not found; `4094` — email already registered; `4095` — WhatsApp number already registered; `4096` — mobile number already registered.

---

### DELETE /api/v1/agents/:id

Delete an agent by ID.

**Auth:** Bearer token required.

**Response (200):** `data` is `{}`.

**Error codes:** `4044` — agent not found.

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

Per-agent kanban statuses for RTO work (mirror **Dealer Statuses**). **`statusName` is unique per agent.** **`statusRank` is per agent** and is determined by the order of the `statusData` array in the sync API (1, 2, 3, …). **Agent-scoped** — the agent is resolved from the JWT (or explicit `agentId` for `ADMIN`).

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

Sync all statuses for an agent in a single request. This endpoint **creates, updates, deletes, and reorders** statuses for the agent (same semantics as dealer status sync).

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

## Dealer–Agent Grants

A **dealer** granting agent-site access to an **agent** (`dealer_agent`, unique per `(dealerId, agentId)`). **Dealer-scoped** — the dealer is resolved from the JWT (or explicit `dealerId` for `ADMIN`). Grants carry a `status` (`ACTIVE` / `REVOKED`) and a `source` (`DEALER_GRANT` / `CONNECT`). Only **ACTIVE `DEALER_GRANT`** rows count against the dealer's `maxAgents` cap; `CONNECT` grants (created by placeholder→real connection) are excluded.

**Auth:** Bearer JWT required.

### Model (Prisma `DealerAgent`, table `dealer_agent`)

- `dealerAgentId` (UUID, PK; column `dealer_agent_id`)
- `dealerId`, `agentId` (FKs; **unique together**)
- `status` — `ACTIVE` | `REVOKED` (default `ACTIVE`)
- `source` — `DEALER_GRANT` | `CONNECT` (default `DEALER_GRANT`)
- `createdAt`, `updatedAt`

---

### POST /api/v1/dealer-agents

Grant agent-site access to an agent for the calling dealer. Upserts an **ACTIVE `DEALER_GRANT`** (re-activating a previously revoked row). Granting is **not blocked** when over the cap — `capInfo.overCap` only surfaces the condition for the UI.

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
    "capInfo": { "maxAgents": 2, "used": 1, "overCap": false }
  }
}
```

**Error codes:** `4044` — agent not found; `4032`–`4033`, `4226` — dealer scope.

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
    "capInfo": { "maxAgents": 2, "used": 1, "overCap": false }
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

Assign a vehicle process + RTO service to a granted agent. **Dealer-scoped.** The process must belong to the dealer, the dealer must hold a live (`ACTIVE`) grant for the agent, and the service must exist. The new assignment's kanban column defaults to the agent's lowest-ranked status (or `null`). `assignedByUserId` is taken from the authenticated user.

**Auth:** Bearer token required.

**Request body:**

| Field     | Type   | Required | Validation |
|-----------|--------|----------|------------|
| processId | string | Yes      | UUID (vehicle process owned by the dealer) |
| agentId   | string | Yes      | UUID (a granted agent) |
| serviceId | string | Yes      | UUID (RTO service) |
| note      | string | No       | Max 2000 |

```json
{
  "processId": "uuid-process",
  "agentId": "uuid-agent",
  "serviceId": "uuid-service",
  "note": "Please complete name transfer."
}
```

**Response (201):** `data` is the created assignment with nested `agent` (`agentId`, `firmName`, `agentName`, `displayName`), `service` (`serviceId`, `serviceName`, `shortName`), and `agentStatus` (`statusId`, `statusName`, `colour`) or `null`.

**Error codes:** `4040` — vehicle process or RTO service not found; `4034` — process belongs to another dealer; `4228` — grant the agent access before assigning; `4090` — duplicate assignment (same process + agent + service); `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/process-assignments?processId=

List the **non-cancelled** assignments for a vehicle process (oldest first). **Dealer-scoped** — the process must belong to the calling dealer.

**Auth:** Bearer token required.

**Query params:** `processId` (UUID, required).

**Response (200):** `data` is an array of assignments (same nested shape as create).

**Error codes:** `4040` — process not found; `4034` — process belongs to another dealer; `4032`–`4033`, `4226` — dealer scope.

---

### DELETE /api/v1/process-assignments/:id

Cancel a single assignment (sets `status = CANCELLED`). **Dealer-scoped** — the assignment must belong to the calling dealer.

**Auth:** Bearer token required.

**Path params:** `id` = `assignmentId` (UUID).

**Response (200):** `data` is the updated (cancelled) assignment row.

**Error codes:** `4040` — assignment not found; `4034` — assignment belongs to another dealer; `4032`–`4033`, `4226` — dealer scope.

---

### GET /api/v1/process-assignments/agent

List the **caller agent's** non-cancelled assignments (newest first), optionally filtered to one source dealer. **Agent-scoped** — agent resolved from the JWT.

**Auth:** Bearer token required.

**Query params:** `dealerId` (UUID, optional — narrow to one source dealer).

**Response (200):** `data` is an array; each item carries `service`, `agentStatus` (or `null`), and `process` (`processId`, `vehicle.registrationNumber`, and `dealer` summary `{ dealerId, firmName, dealerName, isPlaceholder }`).

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

Connect a placeholder dealer to a **real subscribed dealer**. Sets `connectedDealerId` and creates/reactivates a `CONNECT` grant so the agent gains access to the real dealer.

**Auth:** Bearer token required.

**Path params:** `id` = placeholder `dealerId` (UUID).

**Request body:** `realDealerId` (UUID, required — target real dealer).

```json
{ "realDealerId": "uuid-real-dealer" }
```

**Response (200):** `data` is the updated placeholder dealer with its `connectedDealer` summary.

**Error codes:** `4040` — placeholder or target dealer not found; `4037` — not an owned placeholder; `4098` — cannot connect: target is not a subscribed real dealer; `4035` — not linked to an agent.

---

### POST /api/v1/placeholder-dealers/:id/disconnect

Disconnect a placeholder dealer from its real dealer. Clears `connectedDealerId` and revokes the `CONNECT` grant when one was present.

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
| assignmentId   | string | No       | UUID — links the entry to a process assignment |

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

**Error codes:** `4054` — no active dealer↔agent relationship (posting blocked); `4057` — agent caller's placeholder dealer is not connected to a real dealer; `4040` — dealer (counterparty) not found; `4059` — token is not a dealer or agent account; `4220` — validation (bad UUID, non-positive or >2dp amount, invalid `direction`).

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

Upload a single image and analyze it with Gemini. The model is configurable via `GEMINI_MODEL` (default: `gemini-3-flash-preview`).

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

Upload a single image of an Indian identity document (Aadhaar, PAN, Driving Licence, Voter ID, Passport, etc.) and extract name/address fields with Gemini. Uses the same `GEMINI_MODEL` as analyze-image.

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

