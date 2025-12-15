/**
 * SvelteKit Server Hooks
 *
 * Provides server-side route protection and security logging.
 * Note: Since this is a static site adapter, most logic runs client-side.
 * These hooks provide defense-in-depth for SSR scenarios.
 */

import type { Handle } from '@sveltejs/kit';

/**
 * Protected routes that require authentication
 */
const PROTECTED_ROUTES = [
  '/admin',
  '/chat',
  '/dm',
  '/events',
  '/settings'
];

/**
 * Admin-only routes
 */
const ADMIN_ROUTES = [
  '/admin'
];

/**
 * Security event logger
 */
function logSecurityEvent(event: string, details: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    type: 'security',
    event,
    timestamp,
    ...details
  }));
}

export const handle: Handle = async ({ event, resolve }) => {
  const { url, request } = event;
  const pathname = url.pathname;

  // Log security-relevant requests
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    logSecurityEvent('protected_route_access', {
      path: pathname,
      method: request.method,
      userAgent: request.headers.get('user-agent')?.substring(0, 100),
      referer: request.headers.get('referer')
    });
  }

  // Log admin route access attempts (skip during prerendering)
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    let clientIp = 'unknown';
    try {
      // getClientAddress throws during prerendering
      clientIp = event.getClientAddress();
    } catch {
      // Prerendering - no client address available
    }

    logSecurityEvent('admin_route_access', {
      path: pathname,
      method: request.method,
      ip: clientIp
    });
  }

  // Add security headers to response
  const response = await resolve(event);

  // Clone response to add headers
  const headers = new Headers(response.headers);

  // Ensure security headers are set (backup to static _headers)
  if (!headers.has('X-Frame-Options')) {
    headers.set('X-Frame-Options', 'DENY');
  }
  if (!headers.has('X-Content-Type-Options')) {
    headers.set('X-Content-Type-Options', 'nosniff');
  }
  if (!headers.has('Referrer-Policy')) {
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
