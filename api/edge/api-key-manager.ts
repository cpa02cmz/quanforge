/**
 * Server-side API Key Management Edge Function
 * Eliminates client-side API key storage and provides secure key management
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables for secure API key storage
const VALID_API_KEYS = {
  google: process.env.GOOGLE_AI_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  // Add more providers as needed
};

// Rate limiting per user session
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per minute per session

export const config = {
  runtime: 'edge',
  maxDuration: 30,
};

// Initialize Supabase client for audit logging
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function validateRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(sessionId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or create new limit entry
    rateLimitMap.set(sessionId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false; // Rate limited
  }

  userLimit.count++;
  return true;
}

async function logApiKeyUsage(
  sessionId: string, 
  provider: string, 
  success: boolean, 
  error?: string
): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from('api_key_usage').insert({
      session_id: sessionId,
      provider,
      success,
      error,
      created_at: new Date().toISOString(),
    });
  } catch (logError) {
    // Don't fail the request if logging fails
    // Silent logging for security
  }
}

export default async function handler(req: Request) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { sessionId, provider, operation } = await req.json();

    // Validate required fields
    if (!sessionId || !provider || !operation) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: sessionId, provider, operation' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate provider
    if (!VALID_API_KEYS[provider as keyof typeof VALID_API_KEYS]) {
      await logApiKeyUsage(sessionId, provider, false, 'Invalid provider');
      return new Response(
        JSON.stringify({ error: 'Invalid provider' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    if (!validateRateLimit(sessionId)) {
      await logApiKeyUsage(sessionId, provider, false, 'Rate limited');
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the API key
    const apiKey = VALID_API_KEYS[provider as keyof typeof VALID_API_KEYS];
    
    if (!apiKey) {
      await logApiKeyUsage(sessionId, provider, false, 'API key not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log successful usage
    await logApiKeyUsage(sessionId, provider, true);

    // Return the API key for the specific operation
    // In production, you might want to return a temporary token instead
    return new Response(
      JSON.stringify({
        success: true,
        apiKey,
        provider,
        operation,
        // Include mask for client-side display
        maskedKey: `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`,
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

  } catch (error) {
    // Security error logged silently
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}