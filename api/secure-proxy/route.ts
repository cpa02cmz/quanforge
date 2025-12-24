// Secure API Proxy Route
// This route acts as a server-side proxy to hide API keys from the client

import { secureApiCall, getServerApiKey, SecureApiError } from '../../services/secureApiProxy';

export const config = {
  runtime: 'edge',
  maxDuration: 30
};

// Rate limiting storage (in production, use Redis or proper cache)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// Simple rate limiting function
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const client = rateLimitStore.get(clientId);
  
  if (!client || now > client.resetTime) {
    rateLimitStore.set(clientId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (client.count >= RATE_LIMIT) {
    return false;
  }
  
  client.count++;
  return true;
}

// Get client identifier from request
function getClientId(request: Request): string {
  // Try to get user ID from auth header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return `user:${authHeader.slice(7)}`;
  }
  
  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return `ip:${ip}`;
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientId = getClientId(request);
    if (!checkRateLimit(clientId)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // CSRF Validation
    const csrfToken = request.headers.get('X-CSRF-Token');
    if (!csrfToken) {
      return new Response(
        JSON.stringify({ error: 'CSRF token required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate CSRF token (in production, use proper CSRF middleware)
    const csrfCookie = request.headers.get('Cookie')?.match(/csrf_token_id=([^;]+)/)?.[1];
    if (!csrfCookie) {
      return new Response(
        JSON.stringify({ error: 'CSRF session required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate the token against our CSRF endpoint
    const csrfValidationResponse = await fetch(
      `${new URL(request.url).origin}/api/csrf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: csrfCookie,
          submittedToken: csrfToken
        })
      }
    );

    if (!csrfValidationResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'CSRF validation failed' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const csrfResult = await csrfValidationResponse.json();
    if (!csrfResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid CSRF token' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const body = await request.json();
    const { provider, endpoint, data } = body;

    if (!provider || !endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: provider and endpoint' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate provider
    const validProviders = ['google', 'openai', 'twelveData'];
    if (!validProviders.includes(provider)) {
      return new Response(
        JSON.stringify({ error: `Invalid provider: ${provider}` }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check if API key is configured
    const apiKey = getServerApiKey(provider as any);
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: `API key not configured for provider: ${provider}` }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Build request options
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data && Object.keys(data).length > 0) {
      requestOptions.body = JSON.stringify(data);
    }

    // Make secure API call
    const response = await secureApiCall(provider as any, endpoint, requestOptions);
    const responseData = await response.json();

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Secure proxy error:', error);

    if (error instanceof SecureApiError) {
      return new Response(
        JSON.stringify({ 
          error: error.message,
          provider: error.provider,
          statusCode: error.statusCode
        }),
        { 
          status: error.statusCode || 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      message: 'Secure API Proxy - Use POST to make authenticated API calls',
      providers: ['google', 'openai', 'twelveData'],
      rateLimit: '100 requests per hour'
    }),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}