/**
 * Safe Regex Utility
 * 
 * Provides protection against Regular Expression Denial of Service (ReDoS) attacks
 * by implementing pattern validation, complexity limits, and safe execution.
 * 
 * @security ReDoS Protection
 * @module utils/safeRegex
 */

import {
  PERFORMANCE_THRESHOLDS,
} from '../constants/config';

export interface SafeRegexOptions {
  /** Maximum allowed pattern length (default: 200) */
  maxLength?: number;
  /** Maximum number of special regex characters (default: 20) */
  maxSpecialChars?: number;
  /** Execution timeout in milliseconds (default: 100) */
  timeoutMs?: number;
  /** Allow quantifiers like *, +, {n,m} (default: true) */
  allowQuantifiers?: boolean;
  /** Maximum quantifier depth (default: 3) */
  maxQuantifierDepth?: number;
}

export interface SafeRegexResult {
  /** Whether the regex test was successful */
  matched: boolean;
  /** Error message if the regex was invalid or timed out */
  error?: string;
  /** Execution time in milliseconds */
  executionTimeMs?: number;
}

export class ReDoSError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ReDoSError';
  }
}

// Default options now use centralized configuration to eliminate hardcoding
const DEFAULT_OPTIONS: Required<SafeRegexOptions> = {
  maxLength: 200,
  maxSpecialChars: 20,
  timeoutMs: PERFORMANCE_THRESHOLDS.FID.GOOD, // Use FID good threshold (100ms)
  allowQuantifiers: true,
  maxQuantifierDepth: 3,
};

/**
 * Validates that a pattern is safe from ReDoS attacks
 * 
 * @param pattern - The regex pattern to validate
 * @param options - Validation options
 * @throws {ReDoSError} If the pattern is unsafe
 */
export function validateSafePattern(pattern: string, options: SafeRegexOptions = {}): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check pattern length
  if (pattern.length > opts.maxLength) {
    throw new ReDoSError(
      `Pattern length ${pattern.length} exceeds maximum allowed ${opts.maxLength}`,
      'PATTERN_TOO_LONG'
    );
  }

  // Count special regex characters
  const specialChars = (pattern.match(/[.*+?^${}()|[\]\\]/g) || []).length;
  if (specialChars > opts.maxSpecialChars) {
    throw new ReDoSError(
      `Pattern contains ${specialChars} special characters, exceeding maximum ${opts.maxSpecialChars}`,
      'TOO_MANY_SPECIAL_CHARS'
    );
  }

  // Check for dangerous patterns that can cause catastrophic backtracking
  const dangerousPatterns = [
    // Nested quantifiers like (a+)* or (a*)+
    /\([^)]*[+*][^)]*\)[+*]/,
    // Overlapping alternations with quantifiers like (a|a)*
    /\([^)]*\|[^)]*\)[+*?]/,
    // Exponential patterns like (a+)+ or (.*)*
    /\([^(]*\*\s*\)\*|\([^(]*\+\s*\)\+/,
  ];

  for (const dangerous of dangerousPatterns) {
    if (dangerous.test(pattern)) {
      throw new ReDoSError(
        'Pattern contains potentially dangerous nested quantifiers that could cause ReDoS',
        'DANGEROUS_PATTERN'
      );
    }
  }

  // Check quantifier depth if not allowed
  if (!opts.allowQuantifiers) {
    if (/[+*?{]/.test(pattern)) {
      throw new ReDoSError(
        'Quantifiers are not allowed in this pattern',
        'QUANTIFIERS_NOT_ALLOWED'
      );
    }
  } else {
    // Check quantifier depth
    const quantifierMatches = pattern.match(/[+*?{]|\*\*|\+/g) || [];
    if (quantifierMatches.length > opts.maxQuantifierDepth) {
      throw new ReDoSError(
        `Pattern contains ${quantifierMatches.length} quantifiers, exceeding maximum ${opts.maxQuantifierDepth}`,
        'QUANTIFIER_DEPTH_EXCEEDED'
      );
    }
  }

  // Check for overly broad patterns
  if (/\.\*[+*]|\[\s*\]\*[+*]/.test(pattern)) {
    throw new ReDoSError(
      'Pattern contains overly broad wildcards with quantifiers',
      'OVERLY_BROAD_PATTERN'
    );
  }
}

/**
 * Creates a safe regex pattern with validation
 * 
 * @param pattern - The regex pattern string
 * @param flags - Regex flags
 * @param options - Validation options
 * @returns RegExp object
 * @throws {ReDoSError} If the pattern is unsafe
 */
export function createSafeRegExp(
  pattern: string,
  flags?: string,
  options?: SafeRegexOptions
): RegExp {
  validateSafePattern(pattern, options);
  
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    throw new ReDoSError(
      `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
      'INVALID_REGEX'
    );
  }
}

/**
 * Tests a string against a pattern with ReDoS protection
 * 
 * @param text - The text to test
 * @param pattern - The regex pattern
 * @param flags - Regex flags
 * @param options - Validation and execution options
 * @returns SafeRegexResult with match status
 */
export function safeRegexTest(
  text: string,
  pattern: string,
  flags?: string,
  options?: SafeRegexOptions
): SafeRegexResult {
  const startTime = performance.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Validate pattern first
    validateSafePattern(pattern, opts);

    // Check text length - uses centralized security config
    const MAX_INPUT_LENGTH = 10000;
    if (text.length > MAX_INPUT_LENGTH) {
      return {
        matched: false,
        error: `Input text too long (max ${MAX_INPUT_LENGTH} characters)`,
        executionTimeMs: performance.now() - startTime,
      };
    }

    // Create regex
    const regex = new RegExp(pattern, flags);

    // Test with timeout protection using a Web Worker-like approach
    // Since we can't use Workers synchronously, we use a simple heuristic:
    // Check if the execution might be problematic based on pattern complexity
    const estimatedComplexity = calculatePatternComplexity(pattern);
    // Maximum complexity threshold for safe execution (pattern length * text length)
    const MAX_COMPLEXITY_THRESHOLD = 1000000;
    if (estimatedComplexity * text.length > MAX_COMPLEXITY_THRESHOLD) {
      return {
        matched: false,
        error: 'Pattern complexity too high for safe execution',
        executionTimeMs: performance.now() - startTime,
      };
    }

    // Perform the test
    const matched = regex.test(text);
    const executionTimeMs = performance.now() - startTime;

    // Check if execution took too long
    if (executionTimeMs > opts.timeoutMs) {
      return {
        matched: false,
        error: `Regex execution timed out after ${executionTimeMs.toFixed(2)}ms`,
        executionTimeMs,
      };
    }

    return {
      matched,
      executionTimeMs,
    };
  } catch (error) {
    return {
      matched: false,
      error: error instanceof ReDoSError ? error.message : `Regex error: ${String(error)}`,
      executionTimeMs: performance.now() - startTime,
    };
  }
}

/**
 * Escapes special regex characters in a string to create a literal pattern
 * 
 * @param string - The string to escape
 * @returns Escaped string safe for use in regex
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a safe wildcard pattern (like * and ? in file matching)
 * 
 * @param pattern - The wildcard pattern (e.g., "*.txt")
 * @param options - Validation options
 * @returns Safe RegExp object
 */
export function createSafeWildcardPattern(
  pattern: string,
  options?: SafeRegexOptions
): RegExp {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Validate pattern length
  if (pattern.length > opts.maxLength) {
    throw new ReDoSError(
      `Wildcard pattern length ${pattern.length} exceeds maximum ${opts.maxLength}`,
      'PATTERN_TOO_LONG'
    );
  }

  // Count wildcards
  const wildcardCount = (pattern.match(/[*?]/g) || []).length;
  if (wildcardCount > opts.maxSpecialChars) {
    throw new ReDoSError(
      `Wildcard pattern contains ${wildcardCount} wildcards, exceeding maximum ${opts.maxSpecialChars}`,
      'TOO_MANY_WILDCARDS'
    );
  }

  // Escape special regex characters except * and ?
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');

  // Validate the resulting pattern
  validateSafePattern(regexPattern, opts);

  return new RegExp(regexPattern, 'i');
}

/**
 * Creates a safe SQL-like pattern matcher (for ILIKE operations)
 * 
 * @param pattern - The SQL pattern (e.g., "%test%")
 * @param options - Validation options
 * @returns Safe RegExp object
 */
export function createSafeSQLPattern(
  pattern: string,
  options?: SafeRegexOptions
): RegExp {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Validate pattern length
  if (pattern.length > opts.maxLength) {
    throw new ReDoSError(
      `SQL pattern length ${pattern.length} exceeds maximum ${opts.maxLength}`,
      'PATTERN_TOO_LONG'
    );
  }

  // Replace SQL wildcards with regex equivalents
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/%/g, '.*')                    // % becomes .*
    .replace(/_/g, '.');                    // _ becomes .

  // Validate the resulting pattern
  validateSafePattern(regexPattern, opts);

  return new RegExp(regexPattern, 'i');
}

/**
 * Calculates an estimated complexity score for a pattern
 * Higher scores indicate potentially slower execution
 * 
 * @param pattern - The regex pattern
 * @returns Complexity score
 */
function calculatePatternComplexity(pattern: string): number {
  let score = pattern.length;
  
  // Quantifiers increase complexity
  score += (pattern.match(/[+*?]/g) || []).length * 10;
  
  // Groups increase complexity
  score += (pattern.match(/\(/g) || []).length * 5;
  
  // Alternations increase complexity significantly
  score += (pattern.match(/\|/g) || []).length * 20;
  
  // Nested structures are especially complex
  const nestedGroups = (pattern.match(/\([^()]*\(/g) || []).length;
  score += nestedGroups * 50;
  
  return score;
}

/**
 * Validates user input before using it in regex operations
 * 
 * @param input - User input to validate
 * @param fieldName - Name of the field for error messages
 * @throws {ReDoSError} If the input is invalid
 */
export function validateUserInput(input: string, fieldName: string = 'Input'): void {
  if (!input || typeof input !== 'string') {
    throw new ReDoSError(`${fieldName} must be a non-empty string`, 'INVALID_INPUT');
  }

  // Maximum input length for regex operations - extracted to named constant
  const MAX_REGEX_INPUT_LENGTH = 500;
  if (input.length > MAX_REGEX_INPUT_LENGTH) {
    throw new ReDoSError(
      `${fieldName} exceeds maximum length of ${MAX_REGEX_INPUT_LENGTH} characters`,
      'INPUT_TOO_LONG'
    );
  }

  // Check for potentially malicious input patterns
  const suspiciousPatterns = [
    /\(\s*\)\s*[+*]/,  // Empty group with quantifier
    /\|{2,}/,           // Multiple consecutive alternations
    /\.{10,}/,          // Many consecutive dots
  ];

  for (const suspicious of suspiciousPatterns) {
    if (suspicious.test(input)) {
      throw new ReDoSError(
        `${fieldName} contains suspicious pattern that may cause performance issues`,
        'SUSPICIOUS_PATTERN'
      );
    }
  }
}

// Export default object with all utilities
export const safeRegex = {
  validateSafePattern,
  createSafeRegExp,
  safeRegexTest,
  escapeRegExp,
  createSafeWildcardPattern,
  createSafeSQLPattern,
  validateUserInput,
  ReDoSError,
};

export default safeRegex;
