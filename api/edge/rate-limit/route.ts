/**
 * Rate Limiting Edge Function
 * Distributed rate limiting for API protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { advancedCache } from '../../services/advancedCache';
import { performanceMonitorEnhanced } from '../../services/performanceMonitorEnhanced';
import { securityManager } from '../../services/securityManager';

export const config = {
  runtime: 'edge',
<<<<<<< HEAD
=======
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1'],
>>>>>>> b6abd17 (Merge pull request #143 from cpa02cmz/feature/codebase-analysis-2025-12-20)
};

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (request: NextRequest) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Default rate limit configurations
const DEFAULT_LIMITS: Record<string, RateLimitConfig> = {
  'default': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  'strict': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
  },
  'api': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
  },
  'market_data': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
  },
  'upload': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
  },
};

/**
 * Generate rate limit key based on request
 */
const generateKey = (request: NextRequest, type: string = 'default'): string => {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const userId = request.headers.get('x-user-id') || 'anonymous';
  
  // Create a hash of IP and user agent for better identification
  const identifier = `${ip}:${userId}:${type}`;
  
  return `rate_limit:${securityManager.hashString(identifier)}`;
};

/**
 * Check rate limit for a given key
 */
const checkRateLimit = async (
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> => {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  try {
    // Get current request data from cache
    const cached = await advancedCache.get(key);
    let requests: number[] = cached?.requests || [];
    
    // Filter out old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    const allowed = requests.length < config.maxRequests;
    
    if (allowed) {
      // Add current request
      requests.push(now);
    }
    
    // Calculate remaining requests and reset time
    const remaining = Math.max(0, config.maxRequests - requests.length);
    const resetTime = now + config.windowMs;
    const retryAfter = allowed ? undefined : Math.ceil(config.windowMs / 1000);
    
    // Update cache
    await advancedCache.set(key, { requests }, {
      ttl: config.windowMs,
      tags: ['rate_limit'],
      priority: 'high',
    });
    
    return {
      allowed,
      limit: config.maxRequests,
      remaining,
      resetTime,
      retryAfter,
    };
    
  } catch (error) {
    console.error('Rate limit check error:', error);
    
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
    };
  }
};

/**
 * GET /api/edge/rate-limit - Check current rate limit status
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'default';
    
    const config = DEFAULT_LIMITS[type] || DEFAULT_LIMITS.default;
    const key = generateKey(request, type);
    
    const result = await checkRateLimit(key, config);
    
    const response = {
      success: true,
      data: {
        ...result,
        type,
        windowMs: config.windowMs,
        timestamp: Date.now(),
        region: process.env.VERCEL_REGION || 'unknown',
      },
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('rate_limit_check', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetTime.toString(),
        ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('rate_limit_error', duration);
    
    console.error('Rate limit API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check rate limit',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}

/**
 * POST /api/edge/rate-limit - Check and enforce rate limit
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const body = await request.json();
    const { 
      type = 'default', 
      action = 'check',
      customConfig 
    } = body;
    
    let config = DEFAULT_LIMITS[type] || DEFAULT_LIMITS.default;
    
    // Allow custom configuration for specific use cases
    if (customConfig && typeof customConfig === 'object') {
      config = {
        ...config,
        ...customConfig,
      };
    }
    
    const key = generateKey(request, type);
    const result = await checkRateLimit(key, config);
    
    if (action === 'check') {
      // Just check without enforcing
      const response = {
        success: true,
        data: {
          ...result,
          type,
          action: 'checked',
          timestamp: Date.now(),
          region: process.env.VERCEL_REGION || 'unknown',
        },
      };

      const duration = performance.now() - startTime;
      performanceMonitorEnhanced.recordMetric('rate_limit_check', duration);

      return NextResponse.json(response, {
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      });
      
    } else if (action === 'enforce') {
      // Enforce rate limit
      if (!result.allowed) {
        const response = {
          success: false,
          error: 'Rate limit exceeded',
          data: {
            ...result,
            type,
            action: 'blocked',
            timestamp: Date.now(),
            region: process.env.VERCEL_REGION || 'unknown',
          },
        };

        const duration = performance.now() - startTime;
        performanceMonitorEnhanced.recordMetric('rate_limit_block', duration);

        return NextResponse.json(response, {
          status: 429,
          headers: {
            'X-Response-Time': `${duration.toFixed(2)}ms`,
            'Cache-Control': 'no-cache',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': (result.retryAfter || 60).toString(),
          },
        });
      }
      
      // Request allowed
      const response = {
        success: true,
        data: {
          ...result,
          type,
          action: 'allowed',
          timestamp: Date.now(),
          region: process.env.VERCEL_REGION || 'unknown',
        },
      };

      const duration = performance.now() - startTime;
      performanceMonitorEnhanced.recordMetric('rate_limit_allow', duration);

      return NextResponse.json(response, {
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      });
      
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action',
          availableActions: ['check', 'enforce'],
        },
        { 
          status: 400,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('rate_limit_error', duration);
    
    console.error('Rate limit API error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process rate limit',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}

/**
 * DELETE /api/edge/rate-limit - Reset rate limit for a key (admin only)
 */
export async function DELETE(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'default';
    const adminKey = request.headers.get('x-admin-key');
    
    // Simple admin key check (in production, use proper authentication)
    if (adminKey !== process.env.RATE_LIMIT_ADMIN_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
        },
        { 
          status: 401,
          headers: {
            'X-Response-Time': `${(performance.now() - startTime).toFixed(2)}ms`,
          },
        }
      );
    }
    
    const key = generateKey(request, type);
    await advancedCache.delete(key);
    
    const response = {
      success: true,
      data: {
        message: 'Rate limit reset successfully',
        type,
        timestamp: Date.now(),
        region: process.env.VERCEL_REGION || 'unknown',
      },
    };

    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('rate_limit_reset', duration);

    return NextResponse.json(response, {
      headers: {
        'X-Response-Time': `${duration.toFixed(2)}ms`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    const duration = performance.now() - startTime;
    performanceMonitorEnhanced.recordMetric('rate_limit_error', duration);
    
    console.error('Rate limit reset error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reset rate limit',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 500,
        headers: {
          'X-Response-Time': `${duration.toFixed(2)}ms`,
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}