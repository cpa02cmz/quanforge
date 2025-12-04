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
  addSecurityHeaders(response, securityAnalysis, request);

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
function addSecurityHeaders(response: Response, securityAnalysis: any, request: Request) {
  const region = request.headers.get('x-vercel-region') || 'unknown';
  const userAgent = request.headers.get('user-agent') || '';
  
  // Generate dynamic CSP based on context
  const csp = generateDynamicCSP(request, region, securityAnalysis);
  response.headers.set('Content-Security-Policy', csp);
  
  // Basic security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Enhanced security headers
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Permissions policy with dynamic adjustments
  const permissionsPolicy = generatePermissionsPolicy(securityAnalysis, userAgent);
  response.headers.set('Permissions-Policy', permissionsPolicy);
  
  // Security analysis headers
  response.headers.set('X-Edge-Risk-Score', securityAnalysis.riskScore.toString());
  if (securityAnalysis.threats.length > 0) {
    response.headers.set('X-Edge-Threats', securityAnalysis.threats.join(','));
  }
  
  // HSTS for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
}

/**
 * Generate dynamic CSP based on request context
 */
function generateDynamicCSP(request: Request, region: string, securityAnalysis: any): string {
  const url = request.nextUrl;
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isAPI = url.pathname.startsWith('/api/');
  
  // Base CSP policy
  let csp = "default-src 'self'; ";
  
  // Script sources with context-aware rules
  if (isDevelopment) {
    csp += "script-src 'self' 'unsafe-inline' 'unsafe-eval' ";
  } else {
    csp += "script-src 'self' 'unsafe-inline' ";
  }
  
  // Add Vercel analytics
  csp += "https://cdn.vercel-insights.com ";
  
  // Add Supabase domains
  csp += "https://*.supabase.co ";
  
  // Add Google Analytics if in production
  if (!isDevelopment) {
    csp += "https://www.googletagmanager.com https://www.google-analytics.com ";
  }
  
  // Style sources
  csp += "; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ";
  
  // Image sources with region-specific CDN domains
  csp += "; img-src 'self' data: https: https://*.supabase.co https://www.google-analytics.com ";
  
  // Add region-specific CDN domains
  const regionCDNs = {
    'hkg1': 'https://cdn.asia.quanforge.ai',
    'iad1': 'https://cdn.us.quanforge.ai',
    'fra1': 'https://cdn.eu.quanforge.ai',
    'sin1': 'https://cdn.asia.quanforge.ai',
    'sfo1': 'https://cdn.us.quanforge.ai',
    'arn1': 'https://cdn.us.quanforge.ai',
    'gru1': 'https://cdn.sa.quanforge.ai',
    'cle1': 'https://cdn.us.quanforge.ai'
  };
  
  const cdnDomain = regionCDNs[region as keyof typeof regionCDNs];
  if (cdnDomain) {
    csp += `${cdnDomain} `;
  }
  
  // Font sources
  csp += "; font-src 'self' data: https://fonts.gstatic.com ";
  
  // Connect sources with API endpoints
  csp += "; connect-src 'self' https://*.supabase.co https://googleapis.com ";
  
  if (!isDevelopment) {
    csp += "https://www.google-analytics.com https://region1.google-analytics.com ";
  }
  
  // Frame sources - generally deny frames
  csp += "; frame-src 'none' ";
  
  // Object sources
  csp += "; object-src 'none' ";
  
  // Base URI
  csp += "; base-uri 'self' ";
  
  // Form action
  csp += "; form-action 'self' ";
  
  // Upgrade insecure requests
  if (!isDevelopment) {
    csp += "; upgrade-insecure-requests ";
  }
  
  // Adjust CSP based on security analysis
  if (securityAnalysis.isSuspicious) {
    // Stricter CSP for suspicious requests
    csp = csp.replace("'unsafe-inline'", "'nonce-dynamic'").replace("'unsafe-eval'", '');
  }
  
  if (isAPI) {
    // Stricter CSP for API endpoints
    csp = "default-src 'self'; script-src 'none'; style-src 'none'; img-src 'none'; connect-src 'self'";
  }
  
  return csp;
}

/**
 * Generate dynamic permissions policy
 */
function generatePermissionsPolicy(securityAnalysis: any, userAgent: string): string {
  const policies = [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
    'ambient-light-sensor=()',
    'bluetooth=()',
    'clipboard-read=()',
    'clipboard-write=()',
    'fullscreen=(self)',
    'payment=()',
    'speaker=()',
    'vr=()',
    'xr=()'
  ];
  
  // Allow some permissions for trusted browsers in development
  if (process.env.NODE_ENV === 'development' && !securityAnalysis.isSuspicious) {
    // Add development-specific permissions
    policies.push('microphone=(self)', 'camera=(self)');
  }
  
  // Adjust based on device type
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
  if (isMobile) {
    // Allow some mobile-specific permissions if needed
    policies.push('orientation-lock=(self)');
  }
  
  return policies.join(', ');
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
 * Apply advanced cache optimizations based on request characteristics
 */
function applyCacheOptimizations(response: Response, request: Request, securityAnalysis: any, botInfo: any) {
  const url = request.nextUrl;
  const region = request.headers.get('x-vercel-region') || 'unknown';
  const deviceType = response.headers.get('X-Device-Type') || 'unknown';
  
  // Generate intelligent cache key
  const cacheKey = generateCacheKey(request, securityAnalysis, botInfo);
  response.headers.set('X-Cache-Key', cacheKey);
  
  // Different cache strategies for different content types
  if (url.pathname.startsWith('/api/')) {
    // Enhanced API caching with intelligent invalidation
    applyAPICacheOptimizations(response, url, securityAnalysis, region);
  } else if (url.pathname.startsWith('/static/') || url.pathname.includes('.')) {
    // Static assets - long cache with compression hints
    applyStaticAssetCacheOptimizations(response, url);
  } else {
    // Dynamic content - moderate cache with validation
    applyDynamicContentCacheOptimizations(response, request, botInfo, region, deviceType);
  }
  
  // Enhanced edge cache tags for intelligent invalidation
  const cacheTags = generateCacheTags(url.pathname, region, deviceType, securityAnalysis);
  response.headers.set('Edge-Cache-Tag', cacheTags);
  
  // Add CDN cache hints
  applyCDNCacheHints(response, url, region);
}

/**
 * Generate intelligent cache key based on request context
 */
function generateCacheKey(request: Request, securityAnalysis: any, botInfo: any): string {
  const url = request.nextUrl;
  const region = request.headers.get('x-vercel-region') || 'unknown';
  const deviceType = request.headers.get('x-device-type') || 'unknown';
  
  let key = `${url.pathname}:${region}:${deviceType}`;
  
  // Add user agent family for bot-specific caching
  if (botInfo.isBot) {
    key += `:bot-${botInfo.type}`;
  }
  
  // Add security level for suspicious requests
  if (securityAnalysis.isSuspicious) {
    key += ':suspicious';
  }
  
  // Add query parameters for API requests (whitelisted only)
  if (url.pathname.startsWith('/api/')) {
    const whitelistedParams = ['page', 'limit', 'sort', 'filter'];
    const searchParams = new URLSearchParams(url.search);
    const filteredParams = Array.from(searchParams.entries())
      .filter(([key]) => whitelistedParams.includes(key))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    if (filteredParams) {
      key += `:${filteredParams}`;
    }
  }
  
  // Hash the key for consistency
  return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

/**
 * Apply API-specific cache optimizations
 */
function applyAPICacheOptimizations(response: Response, url: URL, securityAnalysis: any, region: string) {
  if (securityAnalysis.isSuspicious) {
    // No caching for suspicious requests
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('X-API-Cache-Strategy', 'disabled');
  } else {
    // Enhanced API caching with region-specific TTL
    const apiType = getAPIType(url.pathname);
    const cacheConfig = getAPICacheConfig(apiType, region);
    
    response.headers.set('Cache-Control', 
      `public, max-age=${cacheConfig.maxAge}, s-maxage=${cacheConfig.sMaxAge}, stale-while-revalidate=${cacheConfig.staleWhileRevalidate}`
    );
    
    // Add API-specific headers
    response.headers.set('X-API-Cache-Strategy', cacheConfig.strategy);
    response.headers.set('X-API-Type', apiType);
    response.headers.set('X-API-Region-Optimized', 'true');
    
    // Add Vary header for proper cache variation
    response.headers.set('Vary', 'Accept-Encoding, X-Region, X-Device-Type');
  }
}

/**
 * Apply static asset cache optimizations
 */
function applyStaticAssetCacheOptimizations(response: Response, url: URL) {
  const ext = url.pathname.split('.').pop()?.toLowerCase();
  
  // Base static asset caching
  response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  
  // Add compression hints
  response.headers.set('Compress', 'true');
  response.headers.set('Edge-Compress', 'br'); // Brotli compression preferred
  
  // Content-specific optimizations
  if (['js', 'css'].includes(ext || '')) {
    response.headers.set('X-Content-Optimization', 'minified-compressed');
  } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'].includes(ext || '')) {
    response.headers.set('X-Content-Optimization', 'image-optimized');
    response.headers.set('Accept-CH', 'DPR, Viewport-Width, Width');
  } else if (['woff2', 'woff', 'ttf', 'eot'].includes(ext || '')) {
    response.headers.set('X-Content-Optimization', 'font-compressed');
  }
}

/**
 * Apply dynamic content cache optimizations
 */
function applyDynamicContentCacheOptimizations(response: Response, request: Request, botInfo: any, region: string, deviceType: string) {
  if (botInfo.isBot) {
    // Longer cache for SEO bots
    response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=300');
    response.headers.set('X-Dynamic-Cache-Strategy', 'bot-optimized');
  } else {
    // Adaptive cache based on region and device
    const cacheConfig = getDynamicCacheConfig(region, deviceType);
    response.headers.set('Cache-Control', 
      `public, max-age=${cacheConfig.maxAge}, s-maxage=${cacheConfig.sMaxAge}, stale-while-revalidate=${cacheConfig.staleWhileRevalidate}`
    );
    response.headers.set('X-Dynamic-Cache-Strategy', cacheConfig.strategy);
  }
  
  // Add proper Vary headers
  response.headers.set('Vary', 'Accept-Encoding, Cookie, X-Region, X-Device-Type, User-Agent');
}

/**
 * Generate intelligent cache tags for invalidation
 */
function generateCacheTags(pathname: string, region: string, deviceType: string, securityAnalysis: any): string {
  const tags = [`region-${region}`, `device-${deviceType}`];
  
  // Content-specific tags
  if (pathname.startsWith('/api/')) {
    tags.push('api', getAPIType(pathname));
  } else if (pathname.startsWith('/static/')) {
    tags.push('static');
  } else {
    tags.push('dynamic');
  }
  
  // Page-specific tags
  const pageName = pathname.split('/')[1] || 'home';
  if (pageName) {
    tags.push(`page-${pageName}`);
  }
  
  // Security tags
  if (securityAnalysis.isSuspicious) {
    tags.push('suspicious');
  }
  
  // Version tag for cache invalidation
  tags.push(`version-${process.env.NEXT_PUBLIC_APP_VERSION || '1'}`);
  
  return tags.join(', ');
}

/**
 * Apply CDN cache hints
 */
function applyCDNCacheHints(response: Response, url: URL, region: string) {
  // Region-specific CDN preferences
  const cdnPreferences = {
    'hkg1': 'asia-primary',
    'sin1': 'asia-secondary',
    'iad1': 'us-east-primary',
    'sfo1': 'us-west-primary',
    'fra1': 'europe-primary',
    'cle1': 'us-east-secondary',
    'arn1': 'us-south-primary',
    'gru1': 'south-america-primary'
  };
  
  const cdnPreference = cdnPreferences[region as keyof typeof cdnPreferences] || 'global';
  response.headers.set('X-CDN-Preference', cdnPreference);
  
  // Content delivery optimizations
  if (url.pathname.includes('.js') || url.pathname.includes('.css')) {
    response.headers.set('X-CDN-Optimization', 'bundle-optimized');
  } else if (url.pathname.includes('/api/')) {
    response.headers.set('X-CDN-Optimization', 'api-optimized');
  }
}

/**
 * Get API type for cache configuration
 */
function getAPIType(pathname: string): string {
  if (pathname.includes('robots')) return 'robots';
  if (pathname.includes('generate')) return 'generate';
  if (pathname.includes('auth')) return 'auth';
  if (pathname.includes('analytics')) return 'analytics';
  if (pathname.includes('market-data')) return 'market-data';
  return 'general';
}

/**
 * Get API cache configuration based on type and region
 */
function getAPICacheConfig(apiType: string, region: string) {
  const configs = {
    robots: { maxAge: 300, sMaxAge: 600, staleWhileRevalidate: 120, strategy: 'standard' },
    generate: { maxAge: 60, sMaxAge: 300, staleWhileRevalidate: 60, strategy: 'conservative' },
    auth: { maxAge: 0, sMaxAge: 0, staleWhileRevalidate: 0, strategy: 'disabled' },
    analytics: { maxAge: 600, sMaxAge: 1800, staleWhileRevalidate: 300, strategy: 'aggressive' },
    'market-data': { maxAge: 30, sMaxAge: 120, staleWhileRevalidate: 30, strategy: 'realtime' },
    general: { maxAge: 300, sMaxAge: 600, staleWhileRevalidate: 120, strategy: 'standard' }
  };
  
  const baseConfig = configs[apiType as keyof typeof configs] || configs.general;
  
  // Region-specific adjustments
  if (['hkg1', 'sin1'].includes(region)) {
    // Asia regions - slightly longer cache due to higher latency
    return { ...baseConfig, maxAge: baseConfig.maxAge * 1.2, sMaxAge: baseConfig.sMaxAge * 1.2 };
  }
  
  return baseConfig;
}

/**
 * Get dynamic content cache configuration
 */
function getDynamicCacheConfig(region: string, deviceType: string) {
  const baseConfig = { maxAge: 180, sMaxAge: 300, staleWhileRevalidate: 60, strategy: 'adaptive' };
  
  // Device-specific adjustments
  if (deviceType === 'mobile') {
    return { ...baseConfig, maxAge: baseConfig.maxAge * 1.3, strategy: 'mobile-optimized' };
  }
  
  // Region-specific adjustments
  if (['hkg1', 'sin1'].includes(region)) {
    return { ...baseConfig, maxAge: baseConfig.maxAge * 1.2, strategy: 'asia-optimized' };
  }
  
  return baseConfig;
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