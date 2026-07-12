import { createLogger, format, transports } from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors, json } = format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `[${String(timestamp)}] ${level}: ${String(message)}\n${String(stack)}`
      : `[${String(timestamp)}] ${level}: ${String(message)}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

/**
 * Application-wide logger instance backed by Winston.
 *
 * Outputs human-readable colorized logs in development and structured
 * JSON logs in production.
 */
export const logger = createLogger({
  level: config.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: config.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new transports.Console(),
    ...(config.NODE_ENV === 'production'
      ? [
          new transports.File({ filename: 'logs/error.log', level: 'error' }),
          new transports.File({ filename: 'logs/combined.log' }),
        ]
      : []),
  ],
  exitOnError: false,
});

/**
 * Logs an unknown error with message and stack. Use this instead of `logger.error(msg, { err })`
 * because the dev printf format does not print arbitrary metadata objects.
 *
 * @param context - Short description (e.g. "Failed to resend signup OTP").
 * @param err - Caught value from `catch`.
 */
export function logUnknownError(context: string, err: unknown): void {
  if (err instanceof Error) {
    logger.error(`${context}: ${err.message}${err.stack ? `\n${err.stack}` : ''}`);
    return;
  }
  logger.error(`${context}: ${String(err)}`);
}
