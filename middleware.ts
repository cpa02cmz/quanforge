/**
 * Vercel Edge Middleware for Security and Performance
 * Optimized for Vite SPA deployment on Vercel
 */

export function middleware(request: { url: string; headers: Record<string, string> }) {
  const startTime = performance.now();
  
  // Generate secure nonce for CSP
  const generateNonce = () => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  };
  
  const nonce = generateNonce();
  const url = new URL(request.url);
  
  // Enhanced Content Security Policy to prevent XSS attacks
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const isProduction = process.env.VERCEL_ENV === 'production';
  
  // CSP Directives - tightened for production
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // Development exclusions
    ...(isDevelopment ? ["'unsafe-eval'", "'unsafe-inline'"] : []),
    // Vercel and CDN sources
    'https://vercel.live',
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com',
    // Analytics (only in production)
    ...(isProduction ? ['https://www.googletagmanager.com'] : []),
    // External libraries we trust
    ...(isPreview ? ['https://cdn.skypack.dev'] : [])
  ].filter(Boolean).join(' ');
  
  const styleSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    // Required for some CSS frameworks
    ...(isDevelopment ? ["'unsafe-inline'"] : []),
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com',
    'https://fonts.googleapis.com'
  ].filter(Boolean).join(' ');
  
  const imgSrc = [
    "'self'",
    'data:',
    'blob:',
    'https:',
    ...(isProduction ? ['https://*.vercel.app'] : [])
  ].filter(Boolean).join(' ');
  
  const connectSrc = [
    "'self'",
    'wss:', // WebSocket connections
    'https:',
    // Supabase
    'https://*.supabase.co',
    // Vercel edge functions
    'https://*.vercel.app',
    // Development servers
    ...(isDevelopment ? ['ws://localhost:*', 'http://localhost:*'] : []),
    // Analytics
    ...(isProduction ? ['https://www.google-analytics.com'] : [])
  ].filter(Boolean).join(' ');
  
  const fontSrc = [
    "'self'",
    'https://fonts.gstatic.com',
    'https://cdn.jsdelivr.net',
    'data:'
  ].filter(Boolean).join(' ');
  
  const mediaSrc = [
    "'self'",
    'blob:',
    'data:'
  ].filter(Boolean).join(' ');
  
  const objectSrc = "'none'"; // Prevent object/embed entirely
  
  const baseUri = "'self'"; // Prevent base tag injection
  
  const formAction = [
    "'self'",
    ...(isProduction ? ['https://*.supabase.co'] : [])
  ].filter(Boolean).join(' ');
  
  const frameAncestors = "'none'"; // Prevent clickjacking
  
  const csp = [
    `default-src 'self';`,
    `script-src ${scriptSrc};`,
    `style-src ${styleSrc};`,
    `img-src ${imgSrc};`,
    `connect-src ${connectSrc};`,
    `font-src ${fontSrc};`,
    `media-src ${mediaSrc};`,
    `object-src ${objectSrc};`,
    `base-uri ${baseUri};`,
    `form-action ${formAction};`,
    `frame-ancestors ${frameAncestors};`,
    `upgrade-insecure-requests;`, // Force HTTPS
    // Additional security directives
    `block-all-mixed-content;`, // Prevent mixed content
    `require-trusted-types-for 'script';` // Trusted Types API
  ].join(' ');
  
  // Create response headers
  const headers = new Headers();
  
  // Content Security Policy
  headers.set('Content-Security-Policy', csp);
  headers.set('X-Content-Security-Policy-Nonce', nonce);
  
  // Enhanced security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-DNS-Prefetch-Control', 'off');
  headers.set('X-Download-Options', 'noopen');
  headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  
  // HSTS (only in production with HTTPS)
  if (isProduction) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Permissions Policy - tightened security
  headers.set('Permissions-Policy', [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'battery=()',
    'bluetooth=()',
    'clipboard-read=()',
    'clipboard-write=()',
    'device-info=()',
    'display-capture=()',
    'encrypted-media=()',
    'gamepad=()',
    'hid=()',
    'idle-detection=()',
    'local-fonts=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'payment=()',
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'serial=()',
    'speaker=()',
    'screen-capture=()',
    'window-management=()',
    // Allow some features for functionality
    'autoplay=(self)',
    'fullscreen=(self)',
    'web-share=(self)'
  ].join(', '));
  
  // Remove sensitive server headers
  headers.delete('server');
  headers.delete('x-powered-by');
  
  // Edge performance and optimization headers
  headers.set('X-Edge-Optimized', 'true');
  headers.set('X-Edge-Version', '3.2.0');
  headers.set('X-Edge-Security-Enhanced', 'true');
  
  // Enhanced region-based caching and optimization
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 'unknown';
  const edgeRegion = request.headers.get('x-vercel-region') || 'local';
  const country = request.headers.get('x-vercel-ip-country') || 'unknown';
  const city = request.headers.get('x-vercel-ip-city') || 'unknown';
  
  headers.set('X-Edge-Region', edgeRegion);
  headers.set('X-Edge-Country', country);
  headers.set('X-Edge-City', city);
  headers.set('X-Client-ID-Hash', Buffer.from(clientIP.slice(-8)).toString('base64'));
  
  // Smart edge caching with predictive optimization
  const pathname = url.pathname;
  
  if (pathname.startsWith('/api/')) {
    // API endpoints with varying cache times
    if (pathname.includes('/edge/optimization')) {
      headers.set('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=30');
      headers.set('X-Edge-Cache-Tag', 'api-optimization');
      headers.set('X-Edge-Priority', 'high');
    } else if (pathname.includes('/metrics') || pathname.includes('/health')) {
      headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');
      headers.set('X-Edge-Cache-Tag', 'api-metrics');
    } else if (pathname.includes('/security/')) {
      headers.set('Cache-Control', 'no-store, private, no-cache, must-revalidate');
      headers.set('X-Edge-Cache-Tag', 'api-security');
      headers.set('X-Edge-Security-Sensitive', 'true');
    } else {
      headers.set('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=300');
      headers.set('X-Edge-Cache-Tag', 'api-general');
    }
    headers.set('X-Edge-API-Optimized', 'true');
  } else if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|avif|woff|woff2|ttf|eot)$/)) {
    // Static assets - very long cache with integrity hashing
    const ext = pathname.split('.').pop()?.toLowerCase();
    const assetType = ext ? `static-${ext}` : 'asset';
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('X-Edge-Cache-Tag', assetType);
    headers.set('Vary', 'Accept-Encoding, Accept');
    
    if (['js', 'css'].includes(ext || '')) {
      headers.set('X-Edge-Preload', 'true');
      headers.set('X-Edge-Critical', 'false');
    }
  } else if (pathname === '/' || pathname.includes('/dashboard') || pathname.includes('/generator')) {
    // Critical pages - shorter cache for dynamic content
    headers.set('Cache-Control', 'public, max-age=180, s-maxage=600, stale-while-revalidate=180');
    headers.set('X-Edge-Cache-Tag', 'critical-page');
    headers.set('X-Edge-Priority', 'high');
    headers.set('X-Edge-Preload', 'true');
  } else {
    // Other pages - moderate cache
    headers.set('Cache-Control', 'public, max-age=900, s-maxage=3600, stale-while-revalidate=900');
    headers.set('X-Edge-Cache-Tag', 'page');
  }
  
  // Enhanced performance monitoring headers
  const responseTime = performance.now() - startTime;
  headers.set('X-Response-Time', responseTime.toFixed(2));
  headers.set('X-Edge-Timestamp', new Date().toISOString());
  headers.set('X-Edge-Processing-Time', responseTime.toFixed(2));
  
  // Bot detection and security
  const userAgent = request.headers.get('user-agent') || '';
  const isBot = /bot|crawler|spider|scraper|monitor|checker|auditor|headless|phantom|selenium/i.test(userAgent);
  
  if (isBot) {
    headers.set('X-Bot-Detected', 'true');
    headers.set('X-Edge-Bot-Optimized', 'true');
    // Longer cache for bots to reduce server load
    if (!pathname.startsWith('/api/')) {
      headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=3600');
    }
  }
  
  // Connection optimization hints
  if (pathname.startsWith('/api/')) {
    headers.set('X-Edge-Connection-Reuse', 'true');
    headers.set('X-Edge-Keep-Alive', 'true');
    headers.set('Connection', 'keep-alive');
  }
  
  // Predictive prefetching hints for critical resources
  if (pathname === '/') {
    headers.set('X-Edge-Prefetch', '/api/edge/optimization,/api/robots');
    headers.set('Link', '</api/edge/optimization>; rel=prefetch, </api/robots>; rel=prefetch');
  }
  
  // Region-specific optimization hints
  if (edgeRegion !== 'local') {
    headers.set('X-Edge-Region-Optimized', 'true');
    headers.set('X-Edge-Affinity', edgeRegion);
  }
  
  // Security monitoring headers
  if (pathname.includes('/api/security/')) {
    headers.set('X-Security-Monitored', 'true');
    headers.set('X-Rate-Limit-Enabled', 'true');
  }
  
  // CSP violation reporting (only in production)
  if (isProduction) {
    const reportCsp = csp + ' report-uri https://quanforge.ai/api/security/csp-report;';
    headers.set('Content-Security-Policy-Report-Only', reportCsp);
  }
  
  return new Response(null, {
    status: 200,
    headers
  });
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots.txt|sitemap.xml).*)'
  ]
};