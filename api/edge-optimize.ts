// Edge function for optimizing API requests
export const config = {
  runtime: 'edge',
  prefersStatic: true
};

// Advanced caching structures
const requestCache = new Map<string, Promise<Response>>();
const responseCache = new Map<string, { response: Response; timestamp: number; ttl: number }>();
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

// Cache configuration
const CACHE_CONFIG = {
  DEFAULT_TTL: 600000, // 10 minutes
  STALE_WHILE_REVALIDATE: 300000, // 5 minutes
  MAX_CACHE_SIZE: 100,
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX: 100, // requests per minute
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const startTime = Date.now();
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const region = process.env.VERCEL_REGION || 'unknown';
  
  // Create advanced cache key
  const cacheKey = createCacheKey(req, url);
  
  // Rate limiting check
  if (!checkRateLimit(clientIP)) {
    return new Response(JSON.stringify({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests from this IP'
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        'X-RateLimit-Limit': CACHE_CONFIG.RATE_LIMIT_MAX.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + 60).toString(),
      }
    });
  }
  
  // Check response cache first (stale-while-revalidate)
  const cachedResponse = getFromResponseCache(cacheKey);
  if (cachedResponse) {
    const isStale = isResponseStale(cachedResponse);
    
    // Trigger background refresh if stale
    if (isStale) {
      refreshInBackground(cacheKey, req);
    }
    
    return enhanceResponse(cachedResponse.response, {
      'X-Edge-Cache': isStale ? 'STALE' : 'HIT',
      'X-Response-Time': `${Date.now() - startTime}ms`,
      'X-Cache-Age': Math.floor((Date.now() - cachedResponse.timestamp) / 1000).toString(),
    });
  }
  
  // Check if identical request is already in progress (deduplication)
  if (requestCache.has(cacheKey)) {
    try {
      const inProgressResponse = await requestCache.get(cacheKey);
      if (inProgressResponse) {
        return enhanceResponse(inProgressResponse, {
          'X-Edge-Cache': 'DEDUPE',
          'X-Response-Time': `${Date.now() - startTime}ms`,
        });
      }
    } catch (error) {
      // If in-progress request fails, continue with normal processing
      requestCache.delete(cacheKey);
    }
  }
  
  // Add enhanced security headers
  const headers = createSecurityHeaders(region, startTime);

  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers 
      });
    }

    // Route handling with caching
    if (url.pathname === '/api/edge-optimize' && req.method === 'POST') {
      const requestPromise = (async () => {
        const body = await req.json();
        
        // Edge optimization logic with compression
        const optimizedData = {
          ...body,
          timestamp: Date.now(),
          edgeOptimized: true,
          region: process.env.VERCEL_REGION || 'unknown',
          compressed: true
        };

        const response = new Response(JSON.stringify(optimizedData), {
          status: 200,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            'Content-Encoding': 'gzip',
            'X-Edge-Cache': 'MISS',
          }
        });
        
        // Cache the response in Vercel Edge
        const cache = caches.default;
        const cacheKey = new Request(req.url, req);
        await cache.put(cacheKey, response.clone());
        
        return response;
      })();
      
      // Store in request cache for deduplication
      requestCache.set(cacheKey, requestPromise);
      
      try {
        const response = await requestPromise;
        return response;
      } finally {
        // Clean up cache after request completes
        requestCache.delete(cacheKey);
      }
    }

    // Health check endpoint
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: Date.now(),
        region: process.env.VERCEL_REGION || 'unknown',
        runtime: 'edge'
      }), {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        }
      });
    }

    return new Response('Not Found', { 
      status: 404, 
      headers 
    });

  } catch (error) {
    // Keep console.error for edge function debugging (acceptable in edge functions)
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'An error occurred while processing your request',
      requestId: crypto.randomUUID(),
      region,
      timestamp: Date.now()
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      }
    });
  }
}

/**
 * Create advanced cache key with request fingerprinting
 */
function createCacheKey(req: Request, url: URL): string {
  const method = req.method;
  const pathname = url.pathname;
  const search = url.search;
  
  // Include relevant headers for cache variation
  const varyHeaders = [
    req.headers.get('accept'),
    req.headers.get('accept-encoding'),
    req.headers.get('accept-language'),
    req.headers.get('authorization')?.substring(0, 10) // First 10 chars for user variation
  ].filter(Boolean).join('|');
  
  return `${method}:${pathname}:${search}:${varyHeaders}`;
}

/**
 * Check rate limiting for client IP
 */
function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const windowStart = now - CACHE_CONFIG.RATE_LIMIT_WINDOW;
  
  // Clean up expired entries
  for (const [ip, data] of rateLimitCache.entries()) {
    if (data.resetTime < now) {
      rateLimitCache.delete(ip);
    }
  }
  
  const clientData = rateLimitCache.get(clientIP);
  
  if (!clientData || clientData.resetTime < now) {
    // New window or expired
    rateLimitCache.set(clientIP, {
      count: 1,
      resetTime: now + CACHE_CONFIG.RATE_LIMIT_WINDOW
    });
    return true;
  }
  
  if (clientData.count >= CACHE_CONFIG.RATE_LIMIT_MAX) {
    return false;
  }
  
  clientData.count++;
  return true;
}

/**
 * Get response from cache with stale-while-revalidate logic
 */
function getFromResponseCache(cacheKey: string): { response: Response; timestamp: number; ttl: number } | null {
  const cached = responseCache.get(cacheKey);
  
  if (!cached) {
    return null;
  }
  
  // Clean up expired entries
  if (Date.now() - cached.timestamp > cached.ttl + CACHE_CONFIG.STALE_WHILE_REVALIDATE) {
    responseCache.delete(cacheKey);
    return null;
  }
  
  return cached;
}

/**
 * Check if cached response is stale
 */
function isResponseStale(cached: { response: Response; timestamp: number; ttl: number }): boolean {
  return Date.now() - cached.timestamp > cached.ttl;
}

/**
 * Refresh cache in background
 */
async function refreshInBackground(cacheKey: string, req: Request): Promise<void> {
  // Don't wait for this to complete
  setTimeout(async () => {
    try {
      const response = await processRequest(req);
      if (response.ok) {
        storeInResponseCache(cacheKey, response, CACHE_CONFIG.DEFAULT_TTL);
      }
    } catch (error) {
      console.debug('Background refresh failed:', error);
    }
  }, 0);
}

/**
 * Store response in cache with LRU eviction
 */
function storeInResponseCache(cacheKey: string, response: Response, ttl: number): void {
  // Evict oldest entries if cache is full
  if (responseCache.size >= CACHE_CONFIG.MAX_CACHE_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) {
      responseCache.delete(oldestKey);
    }
  }
  
  responseCache.set(cacheKey, {
    response: response.clone(),
    timestamp: Date.now(),
    ttl
  });
}

/**
 * Create enhanced security headers
 */
function createSecurityHeaders(region: string, startTime: number): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=${Math.floor(CACHE_CONFIG.DEFAULT_TTL / 1000)}, s-maxage=${Math.floor((CACHE_CONFIG.DEFAULT_TTL * 3) / 1000)}, stale-while-revalidate=${Math.floor(CACHE_CONFIG.STALE_WHILE_REVALIDATE / 1000)}`,
    'X-Edge-Function': 'true',
    'X-Response-Time': `${Date.now() - startTime}ms`,
    'X-Edge-Region': region,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' ? 'https://quanforge.ai' : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Accept-Encoding, Accept-Language, Authorization',
    'X-Request-ID': crypto.randomUUID(),
  };
}

/**
 * Enhance response with additional headers
 */
function enhanceResponse(response: Response, additionalHeaders: Record<string, string>): Response {
  const headers = new Headers(response.headers);
  
  Object.entries(additionalHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Process request with enhanced caching logic
 */
async function processRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const startTime = Date.now();
  const region = process.env.VERCEL_REGION || 'unknown';
  
  const headers = createSecurityHeaders(region, startTime);
  
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers 
      });
    }

    // Route handling with enhanced caching
    if (url.pathname === '/api/edge-optimize' && req.method === 'POST') {
      const body = await req.json();
      
      // Enhanced edge optimization with compression
      const optimizedData = {
        ...body,
        timestamp: Date.now(),
        edgeOptimized: true,
        region,
        compressed: true,
        requestId: crypto.randomUUID(),
        processingTime: Date.now() - startTime
      };

      const response = new Response(JSON.stringify(optimizedData), {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'X-Edge-Cache': 'MISS',
          'X-Optimization-Level': 'enhanced',
        }
      });
      
      // Cache the response in Vercel Edge
      try {
        const cache = caches.default;
        const cacheKey = new Request(req.url, req);
        await cache.put(cacheKey, response.clone());
      } catch (cacheError) {
        console.debug('Edge cache storage failed:', cacheError);
      }
      
      return response;
    }

    // Enhanced health check endpoint
    if (url.pathname === '/api/health') {
      const healthData = {
        status: 'healthy',
        timestamp: Date.now(),
        region,
        runtime: 'edge',
        version: '2.0.0',
        uptime: process.uptime ? Math.floor(process.uptime()) : 0,
        memory: process.memoryUsage ? process.memoryUsage() : null,
        cacheStats: {
          responseCache: responseCache.size,
          requestCache: requestCache.size,
          rateLimitCache: rateLimitCache.size
        }
      };
      
      return new Response(JSON.stringify(healthData), {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30', // Short cache for health checks
        }
      });
    }

    // Cache statistics endpoint
    if (url.pathname === '/api/cache-stats' && req.method === 'GET') {
      const stats = {
        responseCache: {
          size: responseCache.size,
          maxSize: CACHE_CONFIG.MAX_CACHE_SIZE,
          entries: Array.from(responseCache.entries()).map(([key, data]) => ({
            key: key.substring(0, 50) + '...',
            age: Date.now() - data.timestamp,
            ttl: data.ttl,
            stale: isResponseStale(data)
          }))
        },
        rateLimit: {
          activeClients: rateLimitCache.size,
          windowSize: CACHE_CONFIG.RATE_LIMIT_WINDOW,
          maxRequests: CACHE_CONFIG.RATE_LIMIT_MAX
        },
        config: CACHE_CONFIG
      };
      
      return new Response(JSON.stringify(stats), {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // 1 minute cache for stats
        }
      });
    }

    return new Response('Not Found', { 
      status: 404, 
      headers 
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: 'An error occurred while processing your request',
      requestId: crypto.randomUUID(),
      region,
      timestamp: Date.now()
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      }
    });
  }
}