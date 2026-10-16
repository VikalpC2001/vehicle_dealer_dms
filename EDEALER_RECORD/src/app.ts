import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config';
import { logger } from './utils/logger';
import routes from './routes';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware';

const app = express();

// Which proxies may set X-Forwarded-* (see TRUST_PROXY): none unless configured.
if (config.TRUST_PROXY !== false) {
  app.set('trust proxy', config.TRUST_PROXY);
}

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    // Browsers may reuse a preflight answer for 10 minutes instead of asking before every call.
    maxAge: 600,
  }),
);

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(compression());

// ── HTTP request logging ──────────────────────────────────────────────────────
if (config.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
    }),
  );
}

// ── Static uploads (public read; same path shape as future CDN/object URL) ─────
const uploadDirAbsolute = path.resolve(process.cwd(), config.UPLOAD_DIR);
// The web app may embed uploaded files — PDFs in <iframe>/<object> — from its own origin, which in
// production differs from the API's (dcarjt.com vs api.dcarjt.com). Helmet's defaults allow framing
// by the API's own origin only.
const uploadsFrameAncestors = helmet.contentSecurityPolicy({
  directives: { frameAncestors: ["'self'", ...config.ALLOWED_ORIGINS] },
});
app.use(
  '/uploads',
  // Replaces Helmet's `same-origin` policy so the web app can show these files from its own host
  // (see UPLOAD_CROSS_ORIGIN_RESOURCE_POLICY), and drops X-Frame-Options (frame-ancestors decides).
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', config.UPLOAD_CROSS_ORIGIN_RESOURCE_POLICY);
    res.removeHeader('X-Frame-Options');
    next();
  },
  uploadsFrameAncestors,
  express.static(uploadDirAbsolute),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(config.API_PREFIX, routes);

// ── Error handling (must be last) ─────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
