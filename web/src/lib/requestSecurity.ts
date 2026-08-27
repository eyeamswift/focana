import { SITE_ORIGIN } from './siteOrigin';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

function normalizeOrigin(rawOrigin?: string | null) {
  if (!rawOrigin) return null;

  try {
    return new URL(rawOrigin).origin;
  } catch {
    return null;
  }
}

function addTrustedOrigin(origins: Set<string>, rawOrigin?: string | null) {
  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return;

  origins.add(origin);

  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return;

    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      origins.add(url.origin);
      return;
    }

    if (url.hostname.split('.').length >= 2) {
      url.hostname = `www.${url.hostname}`;
      origins.add(url.origin);
    }
  } catch {
    // Ignore malformed origins and keep the normalized one only.
  }
}

function isLoopbackOrigin(origin: string) {
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function isTrustedOrigin(request: Request) {
  const requestOrigin = normalizeOrigin(request.url);
  const submittedOrigin = normalizeOrigin(request.headers.get('origin'));

  if (!submittedOrigin) {
    return false;
  }

  if (isLoopbackOrigin(submittedOrigin)) {
    return true;
  }

  const trustedOrigins = new Set<string>();
  addTrustedOrigin(trustedOrigins, requestOrigin);
  addTrustedOrigin(trustedOrigins, SITE_ORIGIN);

  return trustedOrigins.has(submittedOrigin);
}

export function hasJsonContentType(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.toLowerCase().startsWith('application/json');
}
