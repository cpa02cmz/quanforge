// Edge function for optimizing API requests
export const config = {
  runtime: 'edge',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1'],
  prefersStatic: true
};

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const startTime = Date.now();
  
  // Add security headers
  const headers = {
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'X-Edge-Function': 'true',
    'X-Response-Time': `${Date.now() - startTime}ms`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers 
      });
    }

    // Route handling
    if (url.pathname === '/api/edge-optimize' && req.method === 'POST') {
      const body = await req.json();
      
      // Edge optimization logic
      const optimizedData = {
        ...body,
        timestamp: Date.now(),
        edgeOptimized: true,
        region: process.env.VERCEL_REGION || 'unknown'
      };

      return new Response(JSON.stringify(optimizedData), {
        status: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        }
      });
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