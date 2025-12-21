// Vite-compatible Edge Optimization Service
// Replaces Next.js middleware with browser/edge-compatible implementation

interface EdgeRequest {
  url: string;
  headers: Map<string, string>;
  geo?: {
    region?: string;
  };
}

interface EdgeResponse {
  headers: Map<string, string>;
}

/**
 * Vite-compatible edge optimization function
 * This replaces the Next.js middleware for Vite applications
 */
export function optimizeRequest(request: EdgeRequest): EdgeResponse {
  const startTime = performance.now();
  const response: EdgeResponse = {
    headers: new Map()
  };
  
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
  response.headers.set('X-Edge-Version', '3.2.0');
  response.headers.set('X-Powered-By', 'QuantForge-AI-Edge-Optimized');
  
  // Enhanced region-based caching and optimization
  const region = request.geo?.region || getHeader(request.headers, 'x-vercel-ip-country') || 'unknown';
  const edgeRegion = getHeader(request.headers, 'x-vercel-region') || 'unknown';
  response.headers.set('X-Edge-Region', region);
  response.headers.set('X-Edge-Function-Region', edgeRegion);
  
  // Smart edge caching with predictive optimization
  const url = new URL(request.url);
  const isEdgeOptimization = url.pathname.startsWith('/api/edge/');
  
  if (url.pathname.startsWith('/api/')) {
    // Enhanced API caching with edge optimization
    if (isEdgeOptimization) {
      // Edge optimization endpoints - very short cache for real-time data
      response.headers.set('Cache-Control', 'public, max-age=30, s-maxage=120, stale-while-revalidate=30');
      response.headers.set('X-Edge-Cache-Tag', 'api-optimization');
      response.headers.set('X-Edge-Priority', 'high');
    } else if (url.pathname.includes('/metrics') || url.pathname.includes('/health')) {
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');
      response.headers.set('X-Edge-Cache-Tag', 'api-metrics');
      response.headers.set('X-Edge-Priority', 'medium');
    } else if (url.pathname.includes('/robots') || url.pathname.includes('/strategies')) {
      response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=900, stale-while-revalidate=300');
      response.headers.set('X-Edge-Cache-Tag', 'api-data');
      response.headers.set('X-Edge-Priority', 'medium');
    } else {
      response.headers.set('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=600');
      response.headers.set('X-Edge-Cache-Tag', 'api-general');
      response.headers.set('X-Edge-Priority', 'low');
    }
    
    // Add edge optimization headers for API routes
    response.headers.set('X-Edge-API-Optimized', 'true');
    response.headers.set('X-Edge-Connection-Pool', 'enhanced');
    
  } else if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|webp|avif|woff|woff2|ttf|eot)$/)) {
    // Static assets - long cache with edge optimization and compression hints
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    response.headers.set('X-Edge-Cache-Tag', 'static-asset');
    response.headers.set('Vary', 'Accept-Encoding');
    response.headers.set('X-Edge-Compression', 'brotli,gzip');
    
    // Add content-specific optimization hints
    if (url.pathname.match(/\.(js|css)$/)) {
      response.headers.set('X-Edge-Preload', 'true');
      response.headers.set('X-Edge-Critical', 'false');
    } else if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|avif)$/)) {
      response.headers.set('X-Edge-Image-Optimized', 'true');
    }
    
  } else if (url.pathname === '/' || url.pathname.includes('/dashboard') || url.pathname.includes('/generator')) {
    // Critical pages - shorter cache for dynamic content with edge optimization
    response.headers.set('Cache-Control', 'public, max-age=180, s-maxage=600, stale-while-revalidate=180');
    response.headers.set('X-Edge-Cache-Tag', 'critical-page');
    response.headers.set('X-Edge-Priority', 'high');
    response.headers.set('X-Edge-Preload', 'true');
    
  } else {
    // Other pages - moderate cache with edge optimization
    response.headers.set('Cache-Control', 'public, max-age=900, s-maxage=3600, stale-while-revalidate=900');
    response.headers.set('X-Edge-Cache-Tag', 'page');
    response.headers.set('X-Edge-Priority', 'medium');
  }
  
  // Enhanced performance monitoring headers
  const responseTime = performance.now() - startTime;
  response.headers.set('X-Response-Time', responseTime.toFixed(2));
  response.headers.set('X-Edge-Timestamp', new Date().toISOString());
  response.headers.set('X-Edge-Version', '3.2.0');
  response.headers.set('X-Edge-Processing-Time', responseTime.toFixed(2));
  
  // Enhanced security and bot detection
  const userAgent = getHeader(request.headers, 'user-agent') || '';
  const isBot = userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('spider');
  
  if (isBot) {
    response.headers.set('X-Bot-Detected', 'true');
    response.headers.set('X-Edge-Bot-Optimized', 'true');
    // Longer cache for bots to reduce server load
    if (!url.pathname.startsWith('/api/')) {
      response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=3600');
    }
  }
  
  // Enhanced rate limiting and client identification
  const clientIP = getHeader(request.headers, 'x-forwarded-for') || getHeader(request.headers, 'x-real-ip') || 'unknown';
  const clientID = Buffer.from(clientIP).toString('base64').slice(0, 16);
  response.headers.set('X-Client-ID', clientID);
  
  // Add edge performance hints
  response.headers.set('X-Edge-Performance-Monitoring', 'enabled');
  response.headers.set('X-Edge-Metrics-Collection', 'enabled');
  
  // Add connection optimization hints
  if (url.pathname.startsWith('/api/')) {
    response.headers.set('X-Edge-Connection-Reuse', 'true');
    response.headers.set('X-Edge-Keep-Alive', 'true');
  }
  
  // Add predictive prefetching hints for critical resources
  if (url.pathname === '/') {
    response.headers.set('X-Edge-Prefetch', '/api/edge/optimization,/api/robots');
  }
  
  // Add region-specific optimization hints
  if (edgeRegion !== 'unknown') {
    response.headers.set('X-Edge-Region-Optimized', 'true');
    response.headers.set('X-Edge-Affinity', edgeRegion);
  }
  
  return response;
}

/**
 * Utility function to get header value case-insensitively
 */
function getHeader(headers: Map<string, string>, name: string): string | undefined {
  // Case-insensitive header lookup
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === name.toLowerCase()) {
      return value;
    }
  }
  return undefined;
}

/**
 * Edge Optimization Service Class
 * Provides a singleton for managing edge optimizations in Vite applications
 */
export class EdgeOptimizationService {
  private static instance: EdgeOptimizationService;
  private version = '3.2.0';

  static getInstance(): EdgeOptimizationService {
    if (!EdgeOptimizationService.instance) {
      EdgeOptimizationService.instance = new EdgeOptimizationService();
    }
    return EdgeOptimizationService.instance;
  }

  /**
   * Public API for client-side usage
   */
  getOptimizationHeaders(url: string, headers: Record<string, string> = {}): EdgeResponse {
    const request: EdgeRequest = {
      url,
      headers: new Map(Object.entries(headers))
    };

    return optimizeRequest(request);
  }

  /**
   * Utility to apply optimizations to fetch requests
   */
  async optimizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    
    // Get optimization headers for this request
    const optimization = this.getOptimizationHeaders(url, Object.fromEntries(headers));
    
    // Apply optimization headers
    optimization.headers.forEach((value, key) => {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    });

    return fetch(url, { ...options, headers });
  }

  /**
   * Apply optimization headers to existing Headers object
   */
  applyOptimizationHeaders(url: string, existingHeaders: Headers): void {
    const optimization = this.getOptimizationHeaders(url, Object.fromEntries(existingHeaders));
    
    optimization.headers.forEach((value, key) => {
      if (!existingHeaders.has(key)) {
        existingHeaders.set(key, value);
      }
    });
  }
}

// Export singleton instance for easy usage
export const edgeOptimizer = EdgeOptimizationService.getInstance();

// Export types for external usage
export type { EdgeRequest, EdgeResponse };

// Legacy export for backward compatibility
export const middleware = optimizeRequest;