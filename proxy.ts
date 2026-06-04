import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/jwt';
import { isBlacklisted } from '@/lib/blacklist';

const JWT_SECRET = process.env.JWT_SECRET;

// Suspicious scraper user agents keywords
const BOT_USER_AGENTS = [
  'curl', 'wget', 'python', 'scrapy', 'headless', 'puppeteer', 'playwright',
  'selenium', 'httpclient', 'libwww', 'axios', 'postman', 'insomnia',
  'scraper', 'crawler', 'spider', 'got', 'node-fetch', 'superagent'
];

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // 1. Scraper Block by User-Agent
  const userAgent = (request.headers.get('user-agent') || '').toLowerCase();
  const isSuspiciousAgent = BOT_USER_AGENTS.some(bot => userAgent.includes(bot));
  
  if (isSuspiciousAgent) {
    // Silently return 404
    return new NextResponse('Not Found', { status: 404 });
  }

  // 2. IP Blacklist check at routing level
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  
  if (await isBlacklisted(ipAddress)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // 3. Admin Area Guard (/admin/*)
  if (url.pathname.startsWith('/admin')) {
    if (!JWT_SECRET) {
      // Configuration error, return 404 to obfuscate
      return new NextResponse('Not Found', { status: 404 });
    }

    const accessToken = request.cookies.get('access_token')?.value;

    if (!accessToken) {
      // Check if it's a client-side prefetch request. Return 204 to prevent red console errors.
      const isPrefetch =
        request.headers.get('x-middleware-prefetch') === '1' ||
        request.headers.get('next-router-prefetch') === '1' ||
        request.headers.get('purpose') === 'prefetch';

      if (isPrefetch) {
        return new NextResponse(null, { status: 204 });
      }

      // If refresh token exists, redirect to login page (login will refresh it or verify password)
      const refreshToken = request.cookies.get('refresh_token')?.value;
      if (refreshToken) {
        url.pathname = '/login';
        return NextResponse.redirect(url);
      }
      
      // If no session exists, return 404 to completely hide admin routes
      return new NextResponse('Not Found', { status: 404 });
    }

    // Verify JWT access token
    const payload = await verifyJWT(accessToken, JWT_SECRET);
    if (!payload || payload.sub !== 'admin') {
      // Check if prefetch to prevent console errors
      const isPrefetch =
        request.headers.get('x-middleware-prefetch') === '1' ||
        request.headers.get('next-router-prefetch') === '1' ||
        request.headers.get('purpose') === 'prefetch';

      if (isPrefetch) {
        return new NextResponse(null, { status: 204 });
      }

      // If signature is invalid or expired, clear cookies and return 404
      const response = new NextResponse('Not Found', { status: 404 });
      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/auth/refresh'],
};
