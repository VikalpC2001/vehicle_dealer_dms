import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4002),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('1h'),
  /** Expiry for the JWT issued after OTP verification for password reset (Bearer on reset-password). */
  JWT_PASSWORD_RESET_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  /** OTP validity window in minutes (signup + forgot-password flows). */
  OTP_EXPIRES_MINUTES: z.coerce.number().min(1).max(1440).default(15),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),
  ALLOWED_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((origin) => origin.trim())),
  WEBAUTHN_RP_ID: z.string().min(1).default('localhost'),
  WEBAUTHN_RP_ORIGIN: z.string().url().default('http://localhost:4002'),
  GEMINI_API_KEY: z.string().min(1),
  /**
   * Gemini vision model used to extract RC / ID fields directly from the image. A lite model is cheapest;
   * a flash model gives more accuracy. Thinking is disabled at call time to keep cost + latency low.
   */
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash-lite'),
  /** Base URL of the frontend app (optional deep links / marketing). */
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  /** If true, password and passkey login are rejected until `emailVerified` is true. */
  REQUIRE_EMAIL_VERIFIED_FOR_LOGIN: z.coerce.boolean().default(true),
  /** Optional SMTP. If `SMTP_HOST` is empty, emails are logged only (dev). */
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().min(1).default('noreply@edealer.local'),
  /** Product name shown in emails (header, footer, subjects). */
  APP_NAME: z.string().trim().min(1).default('E-Dealer'),
  /** Public origin for absolute URLs (upload URLs, static file links). No trailing slash. */
  BASE_URL: z.string().url().default('http://localhost:4002'),
  /**
   * When false (default), `uploadUrl` / `publicUrl` use the incoming request host (e.g. LAN IP).
   * When true, always use `BASE_URL` (stricter / fixed canonical URLs in production).
   */
  UPLOAD_PUBLIC_URLS_FROM_BASE_URL_ONLY: z.coerce.boolean().default(false),
  /**
   * When true (default), if the resolved origin host is localhost / 127.0.0.1, replace it with
   * this machine's LAN IPv4 so phones on the same Wi‑Fi can open the URLs.
   */
  UPLOAD_REPLACE_LOOPBACK_WITH_LAN_IP: z.coerce.boolean().default(true),
  /** If set, used as the LAN IPv4 in upload URLs when replacing loopback (skips auto-detection). */
  LAN_IPV4_OVERRIDE: z.string().optional().default(''),
  /** When true, Express `trust proxy` is enabled (`X-Forwarded-*` respected for protocol/host). */
  TRUST_PROXY: z.coerce.boolean().default(false),
  /** Directory under process.cwd() where uploaded files are stored (local storage). */
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  /**
   * Retention window (hours) for the orphaned-flat-upload sweep: a bare `{uuid}.{ext}` file sitting in
   * the uploads root is only deleted once it is this many hours old AND unreferenced by any DB row. Keeps
   * a fresh two-step upload that is still mid-attach from being swept.
   */
  ORPHAN_UPLOAD_RETENTION_HOURS: z.coerce.number().min(1).default(24),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/** Validated and typed application configuration derived from environment variables. */
export const config = parsed.data;

/** Type of {@link config} for dependency injection (e.g. storage providers). */
export type AppConfig = typeof config;
