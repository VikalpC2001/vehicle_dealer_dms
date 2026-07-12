import nodemailer from 'nodemailer';
import { config } from '../config';
import { logUnknownError, logger } from '../utils/logger';

/**
 * Picks TLS mode from port so we never mix implicit TLS with STARTTLS (avoids
 * OpenSSL `wrong version number` on Gmail and similar hosts).
 *
 * - **465** — TLS from first byte (`secure: true`).
 * - **587** — plain connect, then STARTTLS (`secure: false`, `requireTLS: true`).
 * - Other ports — use `SMTP_SECURE` from env.
 */
function buildSmtpTransportOptions(): {
  host: string;
  port: number;
  secure: boolean;
  requireTLS?: boolean;
  auth?: { user: string; pass: string };
} {
  const port = config.SMTP_PORT;
  const auth =
    config.SMTP_USER && config.SMTP_PASS
      ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
      : undefined;

  if (port === 465) {
    return {
      host: config.SMTP_HOST,
      port,
      secure: true,
      auth,
    };
  }

  if (port === 587) {
    return {
      host: config.SMTP_HOST,
      port,
      secure: false,
      requireTLS: true,
      auth,
    };
  }

  return {
    host: config.SMTP_HOST,
    port,
    secure: config.SMTP_SECURE,
    auth,
  };
}

/**
 * Sends an email via SMTP when configured; otherwise logs the content (development).
 *
 * @param params - Recipient, subject, and body.
 */
export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const { to, subject, text, html } = params;

  if (!config.SMTP_HOST) {
    logger.info('[email] SMTP not configured — would send email', {
      to,
      subject,
      preview: text.slice(0, 200),
    });
    return;
  }

  const transporter = nodemailer.createTransport(buildSmtpTransportOptions());

  try {
    await transporter.sendMail({
      from: config.EMAIL_FROM,
      to,
      subject,
      text,
      html: html ?? text,
    });
  } catch (err: unknown) {
    logUnknownError(
      `SMTP send failed (host=${config.SMTP_HOST}, port=${String(config.SMTP_PORT)})`,
      err,
    );
    throw err;
  }
}
