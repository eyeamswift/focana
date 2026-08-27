import { defineMiddleware } from 'astro:middleware';

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "base-uri 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; upgrade-insecure-requests",
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();

  for (const [headerName, headerValue] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(headerName, headerValue);
  }

  return response;
});
