// Edge-optimized middleware for Vercel deployment
// Simplified and focused on essential security and performance

import { NextRequest, NextResponse } from 'next/server';

// Essential security patterns only (optimized for edge performance)
const ESSENTIAL_SECURITY_PATTERNS = {
  sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b)/i,
  xss: /<script|javascript:|on\w+\s*=/i,
  pathTraversal: /\.\.\//g
};

// Rate limiting configuration (simplified)
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // per IP
  cleanupIntervalMs: 5 * 60 * 1000 // 5 minutes
};

// In-memory rate limit store (edge optimized)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Core security check (optimized for edge)
function performSecurityCheck(url: string, userAgent?: string): boolean {
  const urlLower = url.toLowerCase();
  
  // Check against essential patterns only
  for (const [name, pattern] of Object.entries(ESSENTIAL_SECURITY_PATTERNS)) {
    if (pattern.test(urlLower)) {
      return false;
    }
  }
  
  return true;
}

// Rate limiting check (simplified)
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_CONFIG.windowMs
    });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_CONFIG.maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

// Cleanup old rate limit entries
function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}

// Geographic optimization (simplified)
function getOptimalRegion(request: NextRequest): string {
  const country = request.geo?.country || 'US';
  const regionMap: Record<string, string> = {
    'US': 'iad1',
    'HK': 'hkg1',
    'SG': 'sin1',
    'DE': 'fra1',
    'GB': 'fra1',
    'JP': 'sin1',
    'AU': 'sin1',
    'BR': 'gru1'
  };
  
  return regionMap[country] || 'iad1';
}

// Cache optimization (edge-friendly)
function getCacheHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Cache-Control': 'public, max-age=300, s-maxage=1800, stale-while-revalidate=300'
  };
  
  // API routes get shorter cache
  if (url.startsWith('/api/')) {
    headers['Cache-Control'] = 'public, max-age=60, s-maxage=300, stale-while-revalidate=60';
  }
  
  // Static assets get longer cache
  if (url.includes('/assets/') || url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable';
  }
  
  return headers;
}

// Main middleware function
export function middleware(request: NextRequest): NextResponse {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const url = request.nextUrl.pathname + request.nextUrl.search;
  const userAgent = request.headers.get('user-agent') || '';
  
  // Security check
  if (!performSecurityCheck(url, userAgent)) {
    return new NextResponse('Security check failed', { status: 400 });
  }
  
  // Rate limiting
  if (!checkRateLimit(ip)) {
    return new NextResponse('Rate limit exceeded', { 
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Limit': RATE_LIMIT_CONFIG.maxRequests.toString(),
        'X-RateLimit-Remaining': '0'
      }
    });
  }
  
  // Cleanup rate limits periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    cleanupRateLimits();
  }
  
  // Get response
  const response = NextResponse.next();
  
  // Add optimized headers
  const cacheHeaders = getCacheHeaders(url);
  Object.entries(cacheHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  // Security headers (essential only)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Edge optimization headers
  response.headers.set('X-Edge-Region', getOptimalRegion(request));
  response.headers.set('X-Edge-Cache', 'MISS');
  response.headers.set('Vary', 'Accept-Encoding, Accept-Language');
  
  // Compression hint
  if (request.headers.get('accept-encoding')?.includes('br')) {
    response.headers.set('Content-Encoding', 'br');
  }
  
  return response;
}

// Configuration for middleware matching
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};