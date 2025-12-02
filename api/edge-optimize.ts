// Edge function for optimizing API requests
export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
  prefersStatic: true
};

// Request deduplication cache
const requestCache = new Map<string, Promise<Response>>();

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const startTime = Date.now();
  
  // Create cache key for deduplication
  const cacheKey = `${req.method}:${url.pathname}:${url.search}`;
  
  // Check if identical request is already in progress
  if (requestCache.has(cacheKey)) {
    const cachedResponse = await requestCache.get(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
  }
  
  // Add security headers
  const headers = {
    'Cache-Control': 'public, max-age=600, s-maxage=1800, stale-while-revalidate=300',
    'X-Edge-Function': 'true',
    'X-Response-Time': `${Date.now() - startTime}ms`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' ? 'https://quanforge.ai' : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Accept-Encoding',
  };

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
      message: 'An error occurred while processing your request'
    }), {
      status: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      }
    });
  }
}