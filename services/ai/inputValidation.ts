import {
  SECURITY_PATTERNS,
  INPUT_VALIDATION
} from "../modularConstants";
import { AI_CONFIG } from "../../constants/config";
import { VALIDATION_LIMITS } from "../../constants/modularConfig";
import { StrategyParams } from "../../types";
import { createScopedLogger } from "../../utils/logger";
import { getAIRateLimiter } from "../../utils/enhancedRateLimit";
import { getLocalStorage, getSessionStorage } from "../../utils/storage";

const logger = () => createScopedLogger('input-validation');

// Storage instances for session management
const authStorage = getLocalStorage();
const sessionStorageInstance = getSessionStorage();

interface SessionData {
  user?: {
    id?: string;
  };
}

interface MockSession {
  user?: {
    id?: string;
  };
}

/**
 * Get current user ID for rate limiting
 * @returns User ID or anonymous session ID
 */
export const getCurrentUserId = (): string | null => {
  try {
    // Try to get user from Supabase session first
    const sessionData = authStorage.get<SessionData>('supabase.auth.token');
    if (sessionData) {
      return sessionData?.user?.id || null;
    }

    // Fallback to mock session
    const mockSession = authStorage.get<MockSession>('mock_session');
    if (mockSession) {
      return mockSession?.user?.id || null;
    }

    // Generate anonymous session ID if none exists
    let anonymousId = sessionStorageInstance.get<string>('anonymous_session_id');
    if (!anonymousId) {
      anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      sessionStorageInstance.set('anonymous_session_id', anonymousId);
    }
    return anonymousId;
  } catch (error: unknown) {
    logger().warn('Failed to get user ID for rate limiting:', error);
    return null;
  }
};

/**
 * Sanitize user prompt input for security
 * @param prompt Raw user input
 * @returns Sanitized prompt
 * @throws Error if prompt is invalid or contains dangerous content
 */
export const sanitizePrompt = (prompt: string): string => {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Invalid prompt: must be a non-empty string');
  }
  
  // Remove potentially dangerous patterns with enhanced regex
  const sanitized = prompt
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: protocol and variants
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/on\w+\s*=\s*[^>\s]*/gi, '')
    // Remove iframe and object tags
    .replace(/<iframe\b[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    // Remove meta tags with refresh
    .replace(/<meta\s+http-equiv\s*=\s*["']refresh["'][^>]*>/gi, '')
    // Remove CSS expressions
    .replace(/expression\s*\(/gi, '')
    // Remove @import and other CSS injections
    .replace(/@import\s+[^;]+;/gi, '')
    // Remove HTML comments that might hide scripts
    .replace(/<!--[\s\S]*?-->/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Enhanced validation with character checks
  // eslint-disable-next-line no-control-regex -- Intentionally checking for control characters
  const hasInvalidChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(sanitized);
  if (hasInvalidChars) {
    throw new Error('Invalid characters detected in prompt');
  }
  
  // Check for potential injection patterns
  const suspiciousPatterns = [
    new RegExp(SECURITY_PATTERNS.CODE_INJECTION.EVAL, 'gi'),
    new RegExp(SECURITY_PATTERNS.CODE_INJECTION.FUNCTION_CONSTRUCTOR, 'gi'),
    new RegExp(SECURITY_PATTERNS.CODE_INJECTION.DOCUMENT_ACCESS, 'gi'),
    new RegExp(SECURITY_PATTERNS.CODE_INJECTION.WINDOW_ACCESS, 'gi'),
    new RegExp(SECURITY_PATTERNS.CODE_INJECTION.LOCAL_STORAGE, 'gi'),
    new RegExp(SECURITY_PATTERNS.CODE_INJECTION.SESSION_STORAGE, 'gi'),
    new RegExp(SECURITY_PATTERNS.CODE_INJECTION.COOKIE_ACCESS, 'gi'),
    new RegExp(SECURITY_PATTERNS.CODE_INJECTION.LOCATION_ACCESS, 'gi'),
    new RegExp(SECURITY_PATTERNS.CODE_INJECTION.NAVIGATOR_ACCESS, 'gi'),
  ];
  
  const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(sanitized));
  if (hasSuspiciousContent) {
    logger().warn('Suspicious content detected in prompt, applying additional sanitization');
    // Additional sanitization for suspicious content
    return sanitized.replace(/[<>]/g, '').substring(0, AI_CONFIG.CACHE.MAX_ANALYSIS_CACHE_SIZE * 10);
  }
  
  // Enforce length limits to prevent token exhaustion attacks
  if (sanitized.length > AI_CONFIG.TOKEN_LIMITS.DEFAULT) {
    throw new Error(`Prompt too long: maximum ${AI_CONFIG.TOKEN_LIMITS.DEFAULT} characters allowed`);
  }
  
  if (sanitized.length < INPUT_VALIDATION.PROMPT.MIN_LENGTH) {
    throw new Error(`Prompt too short: minimum ${INPUT_VALIDATION.PROMPT.MIN_LENGTH} characters required`);
  }
  
  // Enhanced rate limiting check
  const userId = getCurrentUserId() || 'anonymous';
  const rateLimiter = getAIRateLimiter();
  const rateLimitResult = rateLimiter.checkLimit(userId);
  
  if (!rateLimitResult.allowed) {
    const waitTime = Math.ceil(rateLimitResult.retryAfter! / 60);
    throw new Error(
      `Rate limit exceeded: Please wait ${waitTime} minute${waitTime > 1 ? 's' : ''} before sending another request. ` +
      `Limit: ${INPUT_VALIDATION.RATE_LIMIT.REQUESTS_PER_MINUTE} requests per minute. Reset in ${rateLimitResult.retryAfter} seconds.`
    );
  }
  
  return sanitized;
};

/**
 * Validate strategy parameters
 * @param params Strategy parameters to validate
 * @returns Validated and normalized parameters
 * @throws Error if parameters are invalid
 */
export const validateStrategyParams = (params: StrategyParams): StrategyParams => {
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid strategy parameters');
  }
  
  // Validate numeric ranges
  const validated = { ...params };
  
  if (validated.stopLoss !== undefined) {
    validated.stopLoss = Math.max(
      VALIDATION_LIMITS.NUMERIC.STOP_LOSS_PIPS.MIN,
      Math.min(VALIDATION_LIMITS.NUMERIC.STOP_LOSS_PIPS.MAX,
        Number(validated.stopLoss) || VALIDATION_LIMITS.NUMERIC.STOP_LOSS_PIPS.DEFAULT)
    );
  }

  if (validated.takeProfit !== undefined) {
    validated.takeProfit = Math.max(
      VALIDATION_LIMITS.NUMERIC.TAKE_PROFIT_PIPS.MIN,
      Math.min(VALIDATION_LIMITS.NUMERIC.TAKE_PROFIT_PIPS.MAX,
        Number(validated.takeProfit) || VALIDATION_LIMITS.NUMERIC.TAKE_PROFIT_PIPS.DEFAULT)
    );
  }

  if (validated.riskPercent !== undefined) {
    validated.riskPercent = Math.max(
      VALIDATION_LIMITS.NUMERIC.RISK_PERCENT.MIN,
      Math.min(VALIDATION_LIMITS.NUMERIC.RISK_PERCENT.MAX,
        Number(validated.riskPercent) || VALIDATION_LIMITS.NUMERIC.RISK_PERCENT.DEFAULT)
    );
  }

  if (validated.magicNumber !== undefined) {
    validated.magicNumber = Math.max(
      VALIDATION_LIMITS.NUMERIC.MAGIC_NUMBER.MIN,
      Math.min(VALIDATION_LIMITS.NUMERIC.MAGIC_NUMBER.MAX,
        Number(validated.magicNumber) || VALIDATION_LIMITS.NUMERIC.MAGIC_NUMBER.DEFAULT)
    );
  }
  
  return validated;
};
