import 'dotenv/config';
import { z } from 'zod';

/**
 * A true/false environment flag: `true`/`false`, `1`/`0`, `yes`/`no` or `on`/`off` (any case).
 * Empty or missing takes `defaultValue`. (`z.coerce.boolean()` read the string "false" as `true`.)
 */
const envFlag = (
  defaultValue: boolean,
): z.ZodEffects<z.ZodOptional<z.ZodString>, boolean, string | undefined> =>
  z
    .string()
    .optional()
    .transform((value, ctx): boolean => {
      const v = (value ?? '').trim().toLowerCase();
      if (v === '') return defaultValue;
      if (['true', '1', 'yes', 'on'].includes(v)) return true;
      if (['false', '0', 'no', 'off'].includes(v)) return false;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expected true or false' });
      return z.NEVER;
    });

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
  REQUIRE_EMAIL_VERIFIED_FOR_LOGIN: envFlag(true),
  /** Optional SMTP. If `SMTP_HOST` is empty, emails are logged only (dev). */
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_SECURE: envFlag(false),
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
  UPLOAD_PUBLIC_URLS_FROM_BASE_URL_ONLY: envFlag(false),
  /**
   * When true (default), if the resolved origin host is localhost / 127.0.0.1, replace it with
   * this machine's LAN IPv4 so phones on the same Wi‑Fi can open the URLs.
   */
  UPLOAD_REPLACE_LOOPBACK_WITH_LAN_IP: envFlag(true),
  /** If set, used as the LAN IPv4 in upload URLs when replacing loopback (skips auto-detection). */
  LAN_IPV4_OVERRIDE: z.string().optional().default(''),
  /**
   * Express `trust proxy` — which proxies may set `X-Forwarded-*` (client IP, protocol, host).
   * `false` (default) trusts none; a whole number trusts that many proxy hops in front of the app
   * (behind one nginx: `1`); `true` trusts every hop (only safe when nothing but your own proxy can
   * reach the app); anything else is passed to Express as a comma-separated list of trusted
   * addresses / subnets (e.g. `loopback, 172.16.0.0/12`).
   */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value): boolean | number | string => {
      const v = (value ?? '').trim();
      const lower = v.toLowerCase();
      if (v === '' || ['false', '0', 'no', 'off'].includes(lower)) return false;
      if (['true', 'yes', 'on'].includes(lower)) return true;
      if (/^\d+$/.test(v)) return Number(v);
      return v;
    }),
  /**
   * Cross-Origin-Resource-Policy sent with files under `/uploads`. The web app shows them from its
   * own host; in production that is a sibling host of the API (dcarjt.com → api.dcarjt.com), which
   * the `same-origin` default from Helmet would make browsers refuse. `same-site` allows the app's
   * own site only; use `cross-origin` if the web app runs on a different registrable domain.
   */
  UPLOAD_CROSS_ORIGIN_RESOURCE_POLICY: z
    .enum(['same-origin', 'same-site', 'cross-origin'])
    .default('same-site'),
  /** Winston level. Default: `warn` in production, `debug` otherwise. */
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).optional(),
  /**
   * In production, also write `logs/error.log` and `logs/combined.log` (default `true`). Set
   * `false` in containers: logs then go to stdout only, where Docker rotates them.
   */
  LOG_TO_FILES: envFlag(true),
  /**
   * On SIGTERM/SIGINT, how long open requests may run before the process is stopped anyway.
   * Keep it below the container stop timeout (Docker sends SIGKILL after it).
   */
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).default(25000),
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
