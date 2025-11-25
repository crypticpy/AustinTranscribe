/**
 * Next.js Middleware
 *
 * Handles routing and internationalization for the Meeting Transcriber app.
 * This is a minimal middleware since the app uses client-side locale management
 * via localStorage rather than URL-based routing.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware function
 * Adds security headers to all responses
 * Locale handling is done client-side via IntlProvider and localStorage
 */
export function middleware(request: NextRequest) {
  // Get the response
  const response = NextResponse.next();

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), display-capture=(self)');

  return response;
}

/**
 * Configure which routes use this middleware
 * Currently applies to all routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
