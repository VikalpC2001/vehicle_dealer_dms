import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './config/prisma';
import app from './app';
import { purgeExpiredBinProcesses, purgeOrphanRootUploads } from './services/vehicle-process.service';

/** One day in milliseconds — the interval between recycle-bin purge sweeps. */
const BIN_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** One day in milliseconds — the interval between orphaned-flat-upload sweeps. */
const ORPHAN_UPLOAD_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Runs one recycle-bin purge sweep. `purgeExpiredBinProcesses` never rejects (it logs + resolves to 0),
 * but the extra `.catch` keeps the floating promise self-contained so a failure only logs.
 */
const runBinPurgeSweep = (): void => {
  void purgeExpiredBinProcesses()
    .then((count) => {
      if (count > 0) {
        logger.info(`Recycle-bin sweep purged ${count} expired vehicle process(es)`);
      }
    })
    .catch((err) => logger.error('Recycle-bin purge sweep failed', err));
};

/**
 * Runs one orphaned-flat-upload sweep. `purgeOrphanRootUploads` never rejects (it logs + resolves to 0),
 * but the extra `.catch` keeps the floating promise self-contained so a failure only logs.
 */
const runOrphanUploadSweep = (): void => {
  void purgeOrphanRootUploads()
    .then((count) => {
      if (count > 0) {
        logger.info(`Orphan-upload sweep deleted ${count} unreferenced flat upload file(s)`);
      }
    })
    .catch((err) => logger.error('Orphan-upload sweep failed', err));
};

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connection established');

    const server = app.listen(config.PORT, () => {
      logger.info(
        `Server running in ${config.NODE_ENV} mode on http://localhost:${config.PORT}${config.API_PREFIX}`,
      );
    });

    let shuttingDown = false;
    // While shutting down, every response closes its connection, so keep-alive connections (e.g. from
    // the nginx proxy) end after their current request instead of keeping the old process busy.
    server.prependListener('request', (_req, res) => {
      if (shuttingDown) res.setHeader('Connection', 'close');
    });
    const shutdown = (signal: string): void => {
      if (shuttingDown) {
        logger.warn(`${signal} received again — exiting now`);
        process.exit(1);
      }
      shuttingDown = true;
      logger.info(`${signal} received — shutting down gracefully`);

      // Requests still running after the grace period are cut off. Docker sends SIGKILL once its own
      // stop timeout passes, so SHUTDOWN_TIMEOUT_MS must stay below it.
      const forceExit = setTimeout(() => {
        logger.error('Graceful shutdown timed out — exiting with requests still open');
        process.exit(1);
      }, config.SHUTDOWN_TIMEOUT_MS);
      forceExit.unref();

      // Stop accepting new connections; `close` calls back once open requests have finished.
      server.close((err) => {
        void prisma
          .$disconnect()
          .catch((disconnectError: unknown) =>
            logger.error('Database disconnect failed during shutdown', disconnectError),
          )
          .finally(() => {
            logger.info('HTTP server and database connection closed');
            process.exit(err ? 1 : 0);
          });
      });
      // Idle keep-alive connections would otherwise hold `close` open until they time out; connections
      // that are busy now become idle after their response, so keep closing them as they do.
      server.closeIdleConnections();
      setInterval(() => server.closeIdleConnections(), 1000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Recycle-bin auto-purge: sweep once on startup, then daily. Bin views also purge lazily, so this
    // is a convenience. `.unref()` lets the process exit during shutdown without waiting on the timer.
    runBinPurgeSweep();
    setInterval(runBinPurgeSweep, BIN_PURGE_INTERVAL_MS).unref();

    // Orphaned-flat-upload auto-sweep: delete bare `{uuid}.{ext}` files left in the uploads root that are
    // past the retention window and unreferenced by any DB row. Sweep once on startup, then daily.
    // `.unref()` lets the process exit during shutdown without waiting on the timer.
    runOrphanUploadSweep();
    setInterval(runOrphanUploadSweep, ORPHAN_UPLOAD_SWEEP_INTERVAL_MS).unref();
  } catch (error) {
    logger.error('Failed to start server', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

void startServer();
