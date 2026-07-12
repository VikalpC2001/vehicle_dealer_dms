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

if (config.TRUST_PROXY) {
  app.set('trust proxy', true);
}

// ── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
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
app.use('/uploads', express.static(uploadDirAbsolute));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use(config.API_PREFIX, routes);

// ── Error handling (must be last) ─────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
