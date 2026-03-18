const DEFAULT_SITE_ORIGIN = 'https://focana.app';
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0']);

function normalizeSiteOrigin(rawOrigin?: string) {
  if (!rawOrigin) return DEFAULT_SITE_ORIGIN;

  try {
    return new URL(rawOrigin).origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}

export const SITE_ORIGIN = normalizeSiteOrigin(
  import.meta.env.PUBLIC_SITE_URL || import.meta.env.SITE || DEFAULT_SITE_ORIGIN
);

function isLoopbackOrigin(rawOrigin?: string) {
  if (!rawOrigin) return true;

  try {
    return LOOPBACK_HOSTNAMES.has(new URL(rawOrigin).hostname);
  } catch {
    return true;
  }
}

export function resolveSiteOrigin(runtimeOrigin?: string) {
  if (runtimeOrigin && !isLoopbackOrigin(runtimeOrigin)) {
    return normalizeSiteOrigin(runtimeOrigin);
  }

  return SITE_ORIGIN;
}

export function buildSiteUrl(
  pathname: string,
  params?: Record<string, string | null | undefined>,
  runtimeOrigin?: string
) {
  const url = new URL(pathname, resolveSiteOrigin(runtimeOrigin));

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  return url;
}
