/**
 * Enhanced Edge Middleware for Vercel Deployment
 * Provides edge-level optimizations, security, and rate limiting
 */

// Rate limiting store (in production, use Redis or KV)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Security patterns for threat detection
const SECURITY_PATTERNS = {
  sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|SCRIPT)\b)/i,
  xss: /<script|javascript:|on\w+\s*=/i,
  pathTraversal: /\.\.\//g,
  suspiciousUserAgents: /curl|wget|python|java|go-http|scanner|bot|crawler/i
};

// Rate limiting configuration
const RATE_LIMITS = {
  default: { requests: 100, window: 60000 }, // 100 requests per minute
  api: { requests: 60, window: 60000 },      // 60 requests per minute for API
  auth: { requests: 10, window: 60000 },      // 10 requests per minute for auth
  suspicious: { requests: 20, window: 60000 } // 20 requests per minute for suspicious IPs
};

export default function middleware(request: Request) {
  const startTime = performance.now();
  const url = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';
  const clientIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const region = request.headers.get('x-vercel-region') || 'unknown';
  const country = request.headers.get('x-vercel-ip-country') || 'unknown';

  // Enhanced prewarming for edge functions
  if (request.headers.get('x-purpose') === 'prefetch' || 
      request.headers.get('x-moz') === 'prefetch' ||
      request.headers.get('purpose') === 'prefetch') {
    handlePrewarming(request, region);
  }

  // Create response object
  const response = new Response();

  // Add edge-specific headers
  response.headers.set('x-edge-region', region);
  response.headers.set('x-edge-country', country);
  response.headers.set('x-edge-city', request.headers.get('x-vercel-ip-city') || 'unknown');
  response.headers.set('x-edge-request-id', crypto.randomUUID());
  response.headers.set('x-edge-timestamp', Date.now().toString());

  // Security analysis
  const securityAnalysis = analyzeRequest(request, userAgent, clientIP);
  
  // Apply rate limiting
  const rateLimitResult = applyRateLimit(clientIP, url.pathname, securityAnalysis.isSuspicious);
  
  if (rateLimitResult.blocked) {
    return createRateLimitResponse(rateLimitResult);
  }

  // Block malicious requests
  if (securityAnalysis.isMalicious) {
    return createSecurityResponse('MALICIOUS_REQUEST', 'Request blocked due to security concerns');
  }

  // Add security headers
  addSecurityHeaders(response, securityAnalysis);

  // Add performance monitoring headers
  response.headers.set('X-Edge-Performance-Enabled', 'true');
  response.headers.set('X-Edge-Monitoring-Version', '2.0.0');
  response.headers.set('X-Edge-Processing-Time', `${(performance.now() - startTime).toFixed(2)}ms`);

  // Enhanced edge optimizations
  applyEdgeOptimizations(response, country, userAgent, url);

  // Device and browser detection
  const deviceInfo = detectDevice(userAgent);
  response.headers.set('X-Device-Type', deviceInfo.type);
  response.headers.set('X-Device-OS', deviceInfo.os);
  response.headers.set('X-Device-Browser', deviceInfo.browser);

  // A/B testing framework with consistent grouping
  const abTestGroup = getConsistentABGroup(clientIP, url.pathname);
  response.headers.set('X-AB-Test', abTestGroup);

  // Bot handling with enhanced detection
  const botInfo = detectBot(userAgent, request.headers);
  if (botInfo.isBot) {
    response.headers.set('X-Edge-Bot-Detected', 'true');
    response.headers.set('X-Edge-Bot-Type', botInfo.type);
    response.headers.set('X-Edge-Bot-Name', botInfo.name);
    
    // Apply bot-specific optimizations
    applyBotOptimizations(response, botInfo);
  }

  // Geographic content optimization
  applyGeographicOptimizations(response, country, region);

  // Feature flag handling
  const featureFlags = request.headers.get('x-feature-flags');
  if (featureFlags) {
    response.headers.set('X-Feature-Flags', featureFlags);
  }

  // Add rate limit info to response headers
  response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString());
  response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

  // Cache optimization based on request characteristics
  applyCacheOptimizations(response, request, securityAnalysis, botInfo);

  return response;
}

/**
 * Analyze request for security threats
 */
function analyzeRequest(request: Request, userAgent: string, clientIP: string) {
  const url = request.nextUrl;
  const searchParams = url.searchParams.toString();
  
  let isSuspicious = false;
  let isMalicious = false;
  const threats: string[] = [];

  // Check for SQL injection
  if (SECURITY_PATTERNS.sqlInjection.test(searchParams)) {
    isMalicious = true;
    threats.push('SQL_INJECTION');
  }

  // Check for XSS
  if (SECURITY_PATTERNS.xss.test(searchParams)) {
    isMalicious = true;
    threats.push('XSS');
  }

  // Check for path traversal
  if (SECURITY_PATTERNS.pathTraversal.test(url.pathname)) {
    isMalicious = true;
    threats.push('PATH_TRAVERSAL');
  }

  // Check for suspicious user agents
  if (SECURITY_PATTERNS.suspiciousUserAgents.test(userAgent)) {
    isSuspicious = true;
    threats.push('SUSPICIOUS_USER_AGENT');
  }

  // Check for missing required headers
  if (!userAgent || userAgent.length < 10) {
    isSuspicious = true;
    threats.push('MISSING_USER_AGENT');
  }

  // Check for request size anomalies
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB
    isSuspicious = true;
    threats.push('LARGE_REQUEST');
  }

  return {
    isSuspicious,
    isMalicious,
    threats,
    riskScore: calculateRiskScore(isSuspicious, isMalicious, threats)
  };
}

/**
 * Calculate risk score for the request
 */
function calculateRiskScore(isSuspicious: boolean, isMalicious: boolean, threats: string[]): number {
  let score = 0;
  
  if (isSuspicious) score += 30;
  if (isMalicious) score += 80;
  score += threats.length * 10;
  
  return Math.min(score, 100);
}

/**
 * Apply rate limiting based on IP and request type
 */
function applyRateLimit(clientIP: string, pathname: string, isSuspicious: boolean) {
  const now = Date.now();
  const key = `${clientIP}:${pathname}`;
  
  // Determine rate limit tier
  let limitConfig = RATE_LIMITS.default;
  if (pathname.startsWith('/api/')) limitConfig = RATE_LIMITS.api;
  if (pathname.startsWith('/auth/')) limitConfig = RATE_LIMITS.auth;
  if (isSuspicious) limitConfig = RATE_LIMITS.suspicious;
  
  // Get current rate limit data
  const current = rateLimitStore.get(key) || { count: 0, resetTime: now + limitConfig.window };
  
  // Reset if window expired
  if (now > current.resetTime) {
    current.count = 0;
    current.resetTime = now + limitConfig.window;
  }
  
  // Increment counter
  current.count++;
  rateLimitStore.set(key, current);
  
  // Check if limit exceeded
  const blocked = current.count > limitConfig.requests;
  const remaining = Math.max(0, limitConfig.requests - current.count);
  
  return {
    blocked,
    limit: limitConfig.requests,
    remaining,
    resetTime: current.resetTime,
    window: limitConfig.window
  };
}

/**
 * Create rate limit response
 */
function createRateLimitResponse(rateLimitResult: any) {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Limit: ${rateLimitResult.limit}, Window: ${rateLimitResult.window}ms`,
      retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        'X-Edge-RateLimited': 'true'
      }
    }
  );
}

/**
 * Create security response
 */
function createSecurityResponse(code: string, message: string) {
  return new Response(
    JSON.stringify({
      error: 'Security violation',
      code,
      message
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'X-Edge-Security-Block': code,
        'X-Edge-Security-Reason': message
      }
    }
  );
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: Response, securityAnalysis: any) {
  // Basic security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Enhanced security headers
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Permissions policy
  response.headers.set('Permissions-Policy', 
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=()'
  );
  
  // Security analysis headers
  response.headers.set('X-Edge-Risk-Score', securityAnalysis.riskScore.toString());
  if (securityAnalysis.threats.length > 0) {
    response.headers.set('X-Edge-Threats', securityAnalysis.threats.join(','));
  }
}

/**
 * Apply edge optimizations based on geography and device
 */
function applyEdgeOptimizations(response: Response, country: string, userAgent: string, url: URL) {
  // Region-specific optimizations
  if (country === 'CN') {
    response.headers.set('X-Content-Region', 'apac');
    response.headers.set('X-Edge-Optimization', 'china-optimized');
  } else if (['US', 'CA', 'MX'].includes(country)) {
    response.headers.set('X-Content-Region', 'north-america');
  } else if (['GB', 'DE', 'FR', 'IT', 'ES'].includes(country)) {
    response.headers.set('X-Content-Region', 'europe');
  } else if (['AU', 'NZ', 'SG', 'JP', 'KR'].includes(country)) {
    response.headers.set('X-Content-Region', 'apac');
  }

  // Protocol optimization
  response.headers.set('X-Edge-Protocol', 'https-only');
  response.headers.set('X-Edge-Compression', 'enabled');
}

/**
 * Detect device information
 */
function detectDevice(userAgent: string) {
  const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent);
  
  let os = 'unknown';
  if (/Windows/i.test(userAgent)) os = 'windows';
  else if (/Mac/i.test(userAgent)) os = 'macos';
  else if (/Linux/i.test(userAgent)) os = 'linux';
  else if (/Android/i.test(userAgent)) os = 'android';
  else if (/iOS|iPhone|iPad|iPod/i.test(userAgent)) os = 'ios';
  
  let browser = 'unknown';
  if (/Chrome/i.test(userAgent)) browser = 'chrome';
  else if (/Firefox/i.test(userAgent)) browser = 'firefox';
  else if (/Safari/i.test(userAgent)) browser = 'safari';
  else if (/Edge/i.test(userAgent)) browser = 'edge';
  else if (/Opera/i.test(userAgent)) browser = 'opera';
  
  return {
    type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
    os,
    browser
  };
}

/**
 * Get consistent A/B test group based on IP and path
 */
function getConsistentABGroup(clientIP: string, pathname: string): string {
  const hash = simpleHash(clientIP + pathname);
  return hash % 2 === 0 ? 'A' : 'B';
}

/**
 * Simple hash function for consistent grouping
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Enhanced bot detection
 */
function detectBot(userAgent: string, headers: Headers) {
  const botPatterns = {
    google: /googlebot|google/i,
    bing: /bingbot|bing/i,
    facebook: /facebookexternalhit|facebot/i,
    twitter: /twitterbot/i,
    linkedin: /linkedinbot/i,
    apple: /applebot/i,
    baidu: /baiduspider/i,
    yandex: /yandexbot/i,
    duckduckgo: /duckduckbot/i,
    generic: /bot|crawler|spider|crawling|facebook|twitter|google|yahoo|bing/i
  };
  
  let isBot = false;
  let type = 'unknown';
  let name = 'unknown';
  
  for (const [botName, pattern] of Object.entries(botPatterns)) {
    if (pattern.test(userAgent)) {
      isBot = true;
      type = botName === 'generic' ? 'generic' : 'search-engine';
      name = botName;
      break;
    }
  }
  
  // Additional bot detection via headers
  const fromHeader = headers.get('from');
  if (fromHeader && fromHeader.includes('google')) {
    isBot = true;
    type = 'search-engine';
    name = 'google';
  }
  
  return { isBot, type, name };
}

/**
 * Apply bot-specific optimizations
 */
function applyBotOptimizations(response: Response, botInfo: any) {
  // Disable JavaScript for SEO bots
  if (botInfo.type === 'search-engine') {
    response.headers.set('X-Edge-Bot-Optimization', 'seo-friendly');
  }
  
  // Provide structured data hints
  response.headers.set('X-Edge-Structured-Data', 'enabled');
}

/**
 * Apply geographic optimizations
 */
function applyGeographicOptimizations(response: Response, country: string, region: string) {
  // CDN hints for different regions
  if (['CN', 'HK', 'SG', 'JP', 'KR'].includes(country)) {
    response.headers.set('X-Edge-CDN-Preference', 'asia');
  } else if (['US', 'CA', 'MX'].includes(country)) {
    response.headers.set('X-Edge-CDN-Preference', 'americas');
  } else if (['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'SE'].includes(country)) {
    response.headers.set('X-Edge-CDN-Preference', 'europe');
  }
  
  // Language hints
  const languageMap: Record<string, string> = {
    'CN': 'zh-CN',
    'JP': 'ja',
    'KR': 'ko',
    'ES': 'es',
    'FR': 'fr',
    'DE': 'de',
    'IT': 'it',
    'BR': 'pt-BR',
    'MX': 'es-MX'
  };
  
  if (languageMap[country]) {
    response.headers.set('X-Edge-Language-Hint', languageMap[country]);
  }
}

/**
 * Apply cache optimizations based on request characteristics
 */
function applyCacheOptimizations(response: Response, request: Request, securityAnalysis: any, botInfo: any) {
  const url = request.nextUrl;
  
  // Different cache strategies for different content types
  if (url.pathname.startsWith('/api/')) {
    // API endpoints - shorter cache for authenticated, longer for public
    if (securityAnalysis.isSuspicious) {
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    }
  } else if (url.pathname.startsWith('/static/') || url.pathname.includes('.')) {
    // Static assets - long cache
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    // Dynamic content - moderate cache with validation
    if (botInfo.isBot) {
      response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200');
    } else {
      response.headers.set('Cache-Control', 'public, max-age=180, s-maxage=300, stale-while-revalidate=60');
    }
  }
  
  // Edge cache tags
  response.headers.set('Edge-Cache-Tag', `region-${request.headers.get('x-vercel-region')},device-${response.headers.get('X-Device-Type')}`);
}

/**
 * Enhanced prewarming handler for edge functions
 */
async function handlePrewarming(request: Request, region: string) {
  try {
    // Trigger concurrent warmup for critical functions
    const warmupPromises = [
      fetch('/api/edge/warmup', { 
        headers: { 'X-Prewarm': 'true', 'X-Region': region } 
      }),
      fetch('/api/health', { 
        headers: { 'X-Prewarm': 'true' } 
      }),
      // Warm up database connections
      fetch('/api/database/ping', { 
        headers: { 'X-Prewarm': 'true', 'X-Region': region } 
      })
    ];
    
    // Execute warmup in parallel without blocking
    Promise.allSettled(warmupPromises).catch(() => {
      // Ignore warmup errors to not affect main request
    });
  } catch (error) {
    // Silently ignore warmup failures
  }
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