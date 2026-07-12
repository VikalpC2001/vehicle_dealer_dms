import os from 'node:os';
import type { Request } from 'express';
import { config } from '../config';

/**
 * Returns true if the hostname is loopback (localhost / 127.0.0.1 / ::1).
 */
const isLoopbackHostname = (hostname: string): boolean => {
  const h = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
};

/**
 * Picks the best non-internal IPv4 for LAN clients: prefers `192.168.*`, then `10.*`,
 * then other ranges (e.g. puts typical Docker `172.16–31.*` later).
 */
const getPreferredLanIPv4 = (): string | undefined => {
  const override = config.LAN_IPV4_OVERRIDE?.trim();
  if (override) {
    return override;
  }

  const candidates: string[] = [];
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    if (!addrs) {
      continue;
    }
    for (const a of addrs) {
      const fam = a.family as string | number;
      const isV4 = fam === 'IPv4' || fam === 4;
      if (isV4 && !a.internal) {
        candidates.push(a.address);
      }
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }

  const score = (ip: string): number => {
    if (ip.startsWith('192.168.')) {
      return 0;
    }
    if (ip.startsWith('10.')) {
      return 1;
    }
    if (ip.startsWith('172.')) {
      const second = Number(ip.split('.')[1]);
      if (!Number.isNaN(second) && second >= 16 && second <= 31) {
        return 4;
      }
      return 2;
    }
    return 3;
  };

  candidates.sort((x, y) => score(x) - score(y));
  return candidates[0];
};

/**
 * If the origin uses a loopback host, rewrites it to use the machine LAN IPv4 (same port).
 */
const replaceLoopbackWithLanIp = (origin: string): string => {
  if (!config.UPLOAD_REPLACE_LOOPBACK_WITH_LAN_IP) {
    return origin.replace(/\/$/, '');
  }

  let url: URL;
  try {
    const normalized = /^[a-z][a-z0-9+.-]*:\/\//i.test(origin) ? origin : `http://${origin}`;
    url = new URL(normalized);
  } catch {
    return origin.replace(/\/$/, '');
  }

  if (!isLoopbackHostname(url.hostname)) {
    return origin.replace(/\/$/, '');
  }

  const lan = getPreferredLanIPv4();
  if (!lan) {
    return origin.replace(/\/$/, '');
  }

  url.hostname = lan;
  if (!url.port && config.PORT) {
    url.port = String(config.PORT);
  }

  return url.origin.replace(/\/$/, '');
};

/**
 * Builds the public HTTP origin (`protocol://host[:port]`) for links returned to the client.
 * Uses reverse-proxy headers when present, otherwise `Host` and `req.protocol` (set
 * `trust proxy` in Express when behind a proxy so `protocol` reflects `X-Forwarded-Proto`).
 *
 * Falls back to {@link config.BASE_URL} when no host is available.
 *
 * @param req - Current Express request.
 */
export const resolvePublicOrigin = (req: Request): string => {
  const fallback = config.BASE_URL.replace(/\/$/, '');

  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');
  }

  const host = req.get('host');
  if (host) {
    return `${req.protocol}://${host}`.replace(/\/$/, '');
  }

  return fallback;
};

/**
 * Resolves the origin used in upload `uploadUrl` / `publicUrl` responses.
 * Honors `UPLOAD_PUBLIC_URLS_FROM_BASE_URL_ONLY`, then rewrites loopback to LAN IPv4 when enabled.
 *
 * @param req - Current Express request.
 */
export const resolveUploadPublicOrigin = (req: Request): string => {
  const base =
    config.UPLOAD_PUBLIC_URLS_FROM_BASE_URL_ONLY === true
      ? config.BASE_URL.replace(/\/$/, '')
      : resolvePublicOrigin(req);
  return replaceLoopbackWithLanIp(base);
};
