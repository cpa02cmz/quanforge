/**
 * Edge Middleware for Vercel Deployment
 * Provides edge-level optimizations and security
 */

// This middleware will be processed by Vercel Edge Functions
export default function middleware(request: Request) {
  const response = new Response();
  const url = request.nextUrl;

  // Add edge-specific headers
  response.headers.set('x-edge-region', request.headers.get('x-vercel-region') || 'unknown');
  response.headers.set('x-edge-country', request.headers.get('x-vercel-ip-country') || 'unknown');
  response.headers.set('x-edge-city', request.headers.get('x-vercel-ip-city') || 'unknown');
  
  // Add security headers at edge
  response.headers.set('x-edge-request-id', crypto.randomUUID());
  response.headers.set('x-edge-timestamp', Date.now().toString());

  // Add performance monitoring headers
  response.headers.set('X-Edge-Performance-Enabled', 'true');
  response.headers.set('X-Edge-Monitoring-Version', '1.0.0');

  // Enhanced edge optimizations
  const country = request.headers.get('x-vercel-ip-country');
  if (country === 'CN') {
    response.headers.set('X-Content-Region', 'apac');
  }
  
  // Device-based optimization
  const userAgent = request.headers.get('user-agent') || '';
  const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
  response.headers.set('X-Device-Type', isMobile ? 'mobile' : 'desktop');
  
  // A/B testing framework
  const abTestGroup = Math.random() < 0.5 ? 'A' : 'B';
  response.headers.set('X-AB-Test', abTestGroup);

  // Handle bot traffic
  const isBot = /bot|crawler|spider|crawling|facebook|twitter|google|yahoo|bing/i.test(userAgent);
  
  if (isBot) {
    response.headers.set('X-Edge-Bot-Detected', 'true');
  }

  // Add A/B testing or feature flag headers if needed
  const featureFlags = request.headers.get('x-feature-flags');
  if (featureFlags) {
    response.headers.set('X-Feature-Flags', featureFlags);
  }

  return response;
}

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