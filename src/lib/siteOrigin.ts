const DEFAULT_SITE_ORIGIN = 'https://focana.app';

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

export function buildSiteUrl(
  pathname: string,
  params?: Record<string, string | null | undefined>
) {
  const url = new URL(pathname, SITE_ORIGIN);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  return url;
}
