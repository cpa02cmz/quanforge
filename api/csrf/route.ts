// CSRF Token API Route
// Generates and validates CSRF tokens for protection

export const config = {
  runtime: 'edge',
  maxDuration: 10
};

// Generate server-side CSRF token
function generateServerCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// In-memory token storage (use Redis/database in production)
const tokenStore = new Map<string, { token: string; expires: number; sessionId?: string }>();
const TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

// Get client identifier for token binding
function getClientId(request: Request): string {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return `user:${authHeader.slice(7)}`;
  }
  
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0] : 'anonymous';
}

// Clean up expired tokens
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [key, value] of tokenStore.entries()) {
    if (now > value.expires) {
      tokenStore.delete(key);
    }
  }
}

export async function GET(request: Request) {
  try {
    const clientId = getClientId(request);
    const token = generateServerCSRFToken();
    const expires = Date.now() + TOKEN_EXPIRY;
    const tokenId = `${clientId}:${Date.now()}:${Math.random()}`;
    
    // Store token with expiry
    tokenStore.set(tokenId, {
      token,
      expires,
      sessionId: clientId
    });
    
    // Clean up old tokens
    cleanupExpiredTokens();
    
    return new Response(
      JSON.stringify({
        csrfToken: token,
        tokenId,
        expires
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Set token in cookie for automatic validation
          'Set-Cookie': `csrf_token_id=${tokenId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(TOKEN_EXPIRY / 1000)}`
        }
      }
    );
  } catch (error) {
    console.error('CSRF token generation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate CSRF token' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tokenId, submittedToken } = body;
    
    if (!tokenId || !submittedToken) {
      return new Response(
        JSON.stringify({ error: 'Missing tokenId or submittedToken' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Retrieve stored token
    const storedData = tokenStore.get(tokenId);
    if (!storedData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired CSRF token' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Check expiry
    if (Date.now() > storedData.expires) {
      tokenStore.delete(tokenId);
      return new Response(
        JSON.stringify({ error: 'CSRF token expired' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Validate token
    if (storedData.token !== submittedToken) {
      return new Response(
        JSON.stringify({ error: 'Invalid CSRF token' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Token is valid - return success
    return new Response(
      JSON.stringify({ valid: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('CSRF validation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to validate CSRF token' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const clientId = getClientId(request);
    
    // Remove all tokens for this client
    for (const [key, value] of tokenStore.entries()) {
      if (value.sessionId === clientId) {
        tokenStore.delete(key);
      }
    }
    
    return new Response(
      JSON.stringify({ message: 'CSRF tokens cleared' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('CSRF cleanup error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to clear CSRF tokens' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}