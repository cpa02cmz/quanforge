// Unified AI Service with Modular Architecture
import { StrategyParams, StrategyAnalysis, AISettings } from "../types";
import { createScopedLogger } from "../utils/logger";
import { AI_CONFIG } from "../constants/config";
import { supabase } from "./supabase";

// Import modular AI components
import { aiCore, AICoreConfig } from "./ai/aiCore";
import { aiWorkerManager } from "./ai/aiWorkerManager";
import { aiRateLimiter } from "./ai/aiRateLimiter";
import { aiCacheManager } from "./ai/aiCacheManager";

const logger = createScopedLogger('modular-gemini');

// Helper function to get current user ID for rate limiting
const getCurrentUserId = async (): Promise<string | null> => {
  try {
    // Try to get user from Supabase session using secure method
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }
    
    // Fallback to mock session from secure storage
    const { data: { session: mockSession } } = await supabase.auth.getSession();
    if (mockSession?.user?.id) {
      return mockSession.user.id;
    }
    
    // Generate anonymous session ID if none exists
    let anonymousId = sessionStorage.getItem('anonymous_session_id');
    if (!anonymousId) {
      anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      sessionStorage.setItem('anonymous_session_id', anonymousId);
    }
    return anonymousId;
  } catch (error) {
    logger.warn('Failed to get user ID for rate limiting:', error);
    return null;
  }
};

/**
 * Retry an async operation with exponential backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>, 
  retries = AI_CONFIG.RETRY.MAX_ATTEMPTS, 
  delay = AI_CONFIG.RETRY.INITIAL_DELAY, 
  maxDelay = AI_CONFIG.RETRY.MAX_DELAY
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;

    if (retries === 0) throw error;
    
    const isRateLimit = error.status === 429 || (error.message && error.message.includes('429'));
    const isServerErr = error.status >= 500;
    const isNetworkErr = error.message?.includes('fetch failed') || 
                         error.message?.includes('network') || 
                         error.message?.includes('timeout') ||
                         error.message?.includes('ETIMEDOUT') ||
                         error.message?.includes('ECONNRESET');

    // Only retry on Rate Limits, Server Errors, or Network Issues
    if (!isRateLimit && !isServerErr && !isNetworkErr) {
      throw error;
    }

    // Calculate backoff delay
    const backoffDelay = Math.min(delay * Math.pow(2, AI_CONFIG.RETRY.BACKOFF_MULTIPLIER), maxDelay);
    
    logger.warn(`Retrying request after ${backoffDelay}ms (attempts left: ${retries})`, error.message);
    
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    
    return withRetry(fn, retries - 1, backoffDelay, maxDelay);
  }
}

/**
 * Generate MQL5 code with caching, rate limiting, and retry logic
 */
export const generateMQL5Code = async (
  prompt: string,
  currentCode: string | null,
  strategyParams: StrategyParams,
  settings: AISettings,
  signal?: AbortSignal
): Promise<{ thinking?: string, content: string }> => {
  const userId = await getCurrentUserId();

  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    // Check rate limit first
    if (userId) {
      const rateLimitResult = await aiRateLimiter.checkRateLimit(userId, 'generation');
      if (!rateLimitResult.allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds. Reason: ${rateLimitResult.reason}`);
      }
    }

    // Check cache
    const cached = aiCacheManager.getCachedGeneration(prompt, currentCode || undefined, strategyParams, settings);
    if (cached) {
      logger.info('Cache hit for MQL5 generation');
      return cached;
    }

    // Check if we should use worker for this request
    const shouldUseWorker = currentCode && currentCode.length > 1000;
    
    let result: { thinking?: string, content: string };
    
    if (shouldUseWorker) {
      // Use worker for complex requests
      result = await aiWorkerManager.executeTask(
        'generation',
        { prompt, currentCode, strategyParams, settings },
        signal
      );
    } else {
      // Use core service for simple requests
      const config: AICoreConfig = {
        currentCode,
        strategyParams,
        settings,
        signal
      };
      
      const aiResult = await withRetry(() => aiCore.generateMQL5Code(prompt, config));
      result = { thinking: undefined, content: aiResult.content };
    }

    // Cache the result
    aiCacheManager.setCachedGeneration(prompt, result, currentCode || undefined, strategyParams, settings);
    
    // Record success with rate limiter
    if (userId) {
      aiRateLimiter.recordSuccess(userId);
    }

    logger.info('MQL5 generation completed successfully');
    return result;

  } catch (error: any) {
    // Record error with rate limiter
    if (userId) {
      aiRateLimiter.recordError(userId, error);
    }
    
    if (error.name === 'AbortError') {
      logger.info('MQL5 generation aborted by user');
      throw error;
    }
    
    logger.error('MQL5 generation failed:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    return { content: `Error: ${errorMessage}` };
  }
};

/**
 * Analyze strategy with caching, rate limiting, and retry logic
 */
export const analyzeStrategy = async (
  code: string,
  settings: AISettings,
  signal?: AbortSignal
): Promise<StrategyAnalysis> => {
  const userId = await getCurrentUserId();

  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    // Check rate limit first
    if (userId) {
      const rateLimitResult = await aiRateLimiter.checkRateLimit(userId, 'analysis');
      if (!rateLimitResult.allowed) {
        throw new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfter} seconds. Reason: ${rateLimitResult.reason}`);
      }
    }

    // Check cache
    const cached = aiCacheManager.getCachedAnalysis(code, settings);
    if (cached) {
      logger.info('Cache hit for strategy analysis');
      return cached;
    }

    // Perform analysis
    const aiResult = await withRetry(() => aiCore.analyzeStrategy(code, settings, signal));
    const result: StrategyAnalysis = {
      riskScore: aiResult.riskScore,
      profitability: aiResult.profitability,
      description: aiResult.description
    };

    // Cache the result
    aiCacheManager.setCachedAnalysis(code, result, settings);
    
    // Record success with rate limiter
    if (userId) {
      aiRateLimiter.recordSuccess(userId);
    }

    logger.info('Strategy analysis completed successfully');
    return result;

  } catch (error: any) {
    // Record error with rate limiter
    if (userId) {
      aiRateLimiter.recordError(userId, error);
    }
    
    if (error.name === 'AbortError') {
      logger.info('Strategy analysis aborted by user');
      throw error;
    }
    
    logger.error('Strategy analysis failed:', error);
    return {
      riskScore: 0,
      profitability: 0,
      description: `Analysis failed: ${error.message || 'Unknown error occurred'}`
    };
  }
};

/**
 * Get AI service metrics and statistics
 */
export const getAIMetrics = () => {
  return {
    core: aiCore.isReady(),
    worker: aiWorkerManager.getMetrics(),
    rateLimiter: aiRateLimiter.getAllStats(),
    cache: aiCacheManager.getStats()
  };
};

/**
 * Clear AI service caches
 */
export const clearAICache = (type?: 'generation' | 'analysis') => {
  aiCacheManager.clearCache(type);
  logger.info(`Cleared AI cache: ${type || 'all'}`);
};

/**
 * Get detailed user statistics
 */
export const getUserStats = (userId: string) => {
  return {
    rateLimit: aiRateLimiter.getUserStats(userId),
    metrics: getAIMetrics()
  };
};

/**
 * Cleanup method to destroy all AI services
 */
export const destroyAIServices = () => {
  try {
    aiCacheManager.destroy();
    aiWorkerManager.destroy();
    aiRateLimiter.destroy();
    logger.info('All AI services destroyed');
  } catch (error) {
    logger.error('Error destroying AI services:', error);
  }
};

/**
 * Health check for all AI services
 */
export const checkAIHealth = async () => {
  const health = {
    core: aiCore.isReady(),
    worker: aiWorkerManager.isReady(),
    cache: aiCacheManager.getStats().totalEntries >= 0,
    rateLimiter: aiRateLimiter.getAllStats().totalUsers >= 0
  };

  const allHealthy = Object.values(health).every(Boolean);
  
  if (allHealthy) {
    logger.info('All AI services are healthy');
  } else {
    logger.warn('Some AI services are unhealthy:', health);
  }

  return {
    healthy: allHealthy,
    services: health,
    metrics: getAIMetrics()
  };
};

// Export utilities for testing and debugging
export {
  aiCore,
  aiWorkerManager,
  aiRateLimiter,
  aiCacheManager
};