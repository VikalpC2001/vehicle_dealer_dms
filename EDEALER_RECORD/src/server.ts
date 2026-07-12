import { config } from './config';
import { logger } from './utils/logger';
import { prisma } from './config/prisma';
import app from './app';

const startServer = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connection established');

    const server = app.listen(config.PORT, () => {
      logger.info(
        `Server running in ${config.NODE_ENV} mode on http://localhost:${config.PORT}${config.API_PREFIX}`,
      );
    });

    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database connection closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

void startServer();
