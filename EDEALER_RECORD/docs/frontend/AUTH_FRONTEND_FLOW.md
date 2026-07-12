# Auth API — frontend integration (overview)

Base URL: `{origin}{API_PREFIX}` (e.g. `http://localhost:4002/api/v1`).

**Success envelope:** `{ "statusCode", "message", "data" }`.

## Password flow

1. `POST /auth/register` → **no token** until OTP; show OTP screen and `data.user.emailVerified`.
2. `POST /auth/verify-otp` (`purpose: SIGNUP_EMAIL_VERIFICATION`) → then save `data.token`.
3. `POST /auth/login` → save `data.token`; handle `4031` if `REQUIRE_EMAIL_VERIFIED_FOR_LOGIN=true`.
4. Protected APIs: `Authorization: Bearer <token>`.

## Email verification & password reset

See **[EMAIL_VERIFICATION_AND_PASSWORD_RESET.md](./EMAIL_VERIFICATION_AND_PASSWORD_RESET.md)** for OTP verify, resend, forgot-password, reset-password, and Flutter prompt.

## Full reference

[`docs/api/API.md`](../api/API.md) — Auth section.
