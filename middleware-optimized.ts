import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Enhanced security headers for edge deployment
  response.headers.set('X-Edge-Optimized', 'true');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  response.headers.set('X-Download-Options', 'noopen');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('X-Edge-Version', '3.0.0');
  response.headers.set('X-Powered-By', 'QuantForge-AI-Edge');
  
  // Region-based caching and optimization
  const region = request.geo?.region || request.headers.get('x-vercel-ip-country') || 'unknown';
  response.headers.set('X-Edge-Region', region);
  
  // Edge caching hints with enhanced strategy
  const url = request.nextUrl;
  if (url.pathname.startsWith('/api/')) {
    // API routes - intelligent caching based on endpoint
    if (url.pathname.includes('/edge-metrics') || url.pathname.includes('/health')) {
      response.headers.set('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=120');
      response.headers.set('X-Edge-Cache-Tag', 'api-metrics');
    } else if (url.pathname.includes('/robots') || url.pathname.includes('/strategies')) {
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=300');
      response.headers.set('X-Edge-Cache-Tag', 'api-data');
    } else {
      response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=600');
      response.headers.set('X-Edge-Cache-Tag', 'api-general');
    }
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|avif|woff|woff2|ttf|eot)$/)) {
    // Static assets - long cache with edge optimization
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('X-Edge-Cache-Tag', 'static-asset');
    // Add Vary Accept-Encoding for better compression
    response.headers.set('Vary', 'Accept-Encoding');
  } else if (url.pathname === '/' || url.pathname.includes('/dashboard') || url.pathname.includes('/generator')) {
    // Critical pages - shorter cache for dynamic content
    response.headers.set('Cache-Control', 'public, max-age=180, s-maxage=600, stale-while-revalidate=180');
    response.headers.set('X-Edge-Cache-Tag', 'critical-page');
  } else {
    // Other pages - moderate cache
    response.headers.set('Cache-Control', 'public, max-age=900, s-maxage=3600, stale-while-revalidate=900');
    response.headers.set('X-Edge-Cache-Tag', 'page');
  }
  
  // Performance monitoring headers
  const responseTime = Date.now();
  response.headers.set('X-Response-Time', responseTime.toString());
  response.headers.set('X-Edge-Timestamp', new Date().toISOString());
  response.headers.set('X-Edge-Version', '2.0.0');
  
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