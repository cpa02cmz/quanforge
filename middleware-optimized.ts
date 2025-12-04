import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Enhanced security headers for edge deployment
  response.headers.set('X-Edge-Optimized', 'true');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Region-based caching and optimization
  const region = request.geo?.region || request.headers.get('x-vercel-ip-country') || 'unknown';
  response.headers.set('X-Edge-Region', region);
  
  // Edge caching hints
  const url = request.nextUrl;
  if (url.pathname.startsWith('/api/')) {
    // API routes - shorter cache for dynamic content
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=120');
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    // Static assets - long cache
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  // Performance monitoring headers
  response.headers.set('X-Response-Time', Date.now().toString());
  
  // Security enhancements
  const userAgent = request.headers.get('user-agent') || '';
  if (userAgent.includes('bot') || userAgent.includes('crawler')) {
    response.headers.set('X-Bot-Detected', 'true');
  }
  
  // Rate limiting hints for edge functions
  const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  response.headers.set('X-Client-ID', Buffer.from(clientIP).toString('base64').slice(0, 16));
  
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'
  ]
};