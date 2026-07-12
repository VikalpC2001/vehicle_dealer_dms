# Email verification & password reset — frontend guide (OTP)

This document describes how to integrate **signup OTP verification**, **resend OTP**, **forgot password**, and **reset password** with the EDealer API. Flows use **6-digit OTPs** sent by email (no magic links).

**Related:** base auth (register/login/JWT) — [`AUTH_FRONTEND_FLOW.md`](./AUTH_FRONTEND_FLOW.md). Full API details — [`docs/api/API.md`](../api/API.md).

---

## Environment (backend)

| Variable | Purpose |
|----------|---------|
| `OTP_EXPIRES_MINUTES` | OTP validity window (default **15**). |
| `JWT_PASSWORD_RESET_EXPIRES_IN` | Lifetime of the JWT returned after **`verify-otp`** with `purpose: PASSWORD_RESET` (default **15m**). Use as `Authorization: Bearer` on **`reset-password`** only. |
| `SMTP_*`, `EMAIL_FROM` | If `SMTP_HOST` is set, emails are sent via SMTP; otherwise the server **logs** the message (dev). |
| `REQUIRE_EMAIL_VERIFIED_FOR_LOGIN` | If `true` (default), `POST /auth/login` and passkey login return **403** with code **4031** until the user verifies email via OTP. |

---

## 1. Signup email verification (OTP)

### After registration

1. `POST /api/v1/auth/register` returns **`data.user`** only (no access token). `emailVerified` is `false`.
2. The backend emails a **6-digit OTP** (or logs it in development).

### OTP screen

Collect the 6-digit code from the user and call:

`POST /api/v1/auth/verify-otp`

**Body (JSON):**

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "purpose": "SIGNUP_EMAIL_VERIFICATION"
}
```

**Success (200):** `data.token` (normal access JWT) and `data.user` with `emailVerified: true`. Store the token like after login.

**Error:** `4006` — invalid or expired OTP (offer “Resend code”).

### Resend signup OTP

`POST /api/v1/auth/resend-otp`

```json
{
  "email": "user@example.com",
  "purpose": "SIGNUP_EMAIL_VERIFICATION"
}
```

**Always** show the same success message (no enumeration).

### Login gating

- If `REQUIRE_EMAIL_VERIFIED_FOR_LOGIN` is **true**, login returns **403** / **4031** until verification is complete. Direct users to the OTP screen and resend.

---

## 2. Forgot / reset password (OTP + reset JWT)

### Step A — request reset OTP

`POST /api/v1/auth/forgot-password`

```json
{
  "email": "user@example.com"
}
```

**Always** show one neutral success message.

### Step B — verify OTP

`POST /api/v1/auth/verify-otp`

```json
{
  "email": "user@example.com",
  "otp": "123456",
  "purpose": "PASSWORD_RESET"
}
```

**Success (200):** `data.resetToken` — a JWT with `purpose: PASSWORD_RESET`. **Keep it in memory** for the next step only; do not treat it as a normal session token.

**Error:** `4007` — invalid or expired OTP.

### Step C — new password

`POST /api/v1/auth/reset-password`

**Headers:** `Authorization: Bearer <resetToken>`

**Body:**

```json
{
  "password": "newSecurePassword123"
}
```

**Success (200):** navigate to login. The reset token must not be used on other routes.

**Error:** `4016` — missing or invalid reset session.

### Resend reset OTP

`POST /api/v1/auth/resend-otp`

```json
{
  "email": "user@example.com",
  "purpose": "PASSWORD_RESET"
}
```

---

## 3. Route checklist (SPA)

| Screen | Action |
|--------|--------|
| After register | Navigate to **enter OTP** (same email as signup). |
| Verify signup | `POST /auth/verify-otp` with `SIGNUP_EMAIL_VERIFICATION`. |
| Forgot password | Email → `POST /auth/forgot-password` → OTP screen → `verify-otp` (`PASSWORD_RESET`) → new password → `reset-password` with Bearer `resetToken`. |

---

## 4. Security notes

- Do not log OTPs or JWTs in production client analytics.
- OTP rows are **removed** after successful verification.
- Normal **`authenticate`** middleware rejects **`PASSWORD_RESET`** JWTs; use them only on **`reset-password`**.

---

## 5. Flutter (GetX) — short implementation prompt

```text
Implement OTP signup verification and password reset using GetX and Dio.

After register: no token in response; show OTP screen for the same email.
POST /api/v1/auth/verify-otp with purpose SIGNUP_EMAIL_VERIFICATION → save data.token.

Forgot password: POST forgot-password → OTP screen → verify-otp with PASSWORD_RESET → save data.resetToken → POST reset-password with Authorization: Bearer resetToken and body { password } only.

Resend: POST /api/v1/auth/resend-otp with email + purpose.

Handle 4006 (signup OTP), 4007 (reset OTP), 4031 (login without verify when REQUIRE_EMAIL_VERIFIED_FOR_LOGIN=true).
```
