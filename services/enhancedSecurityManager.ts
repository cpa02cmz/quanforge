/**
 * Enhanced Security Manager with Advanced Rate Limiting and Input Validation
 * Provides comprehensive security protection for the QuantForge AI platform
 */

export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  validation: {
    enabled: boolean;
    strictMode: boolean;
    sanitizeInput: boolean;
    validateMQL5: boolean;
  };
  monitoring: {
    enabled: boolean;
    logViolations: boolean;
    alertThreshold: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitized?: string;
  riskScore: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  windowMs: number;
}

export class EnhancedSecurityManager {
  private config: SecurityConfig;
  private rateLimitStore = new Map<string, { count: number; resetTime: number; violations: number }>();
  private ipReputation = new Map<string, { score: number; lastSeen: number; violations: string[] }>();
  private patternCache = new Map<string, RegExp>();
  
  // Enhanced security patterns with context awareness
  private readonly SECURITY_PATTERNS = {
    // SQL Injection patterns
    sqlInjection: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|SCRIPT|EXEC|ALTER|CREATE|TRUNCATE)\b)/i,
      /['"]\s*OR\s*['"]?\w+['"]?\s*=['"]?\w+['"]?/i,
      /['"]\s*AND\s*['"]?\w+['"]?\s*=['"]?\w+['"]?/i,
      /\bUNION\s+SELECT\b/i,
      /\b(OR|AND)\s+\d+\s*=\s*\d+/i,
      /;\s*(DROP|DELETE|UPDATE|INSERT)\s/i,
      /\b(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i
    ],
    
    // XSS patterns
    xss: [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /vbscript:/gi,
      /data:text\/html/i,
      /<img[^>]*src\s*=\s*["']javascript:/gi,
      /<link[^>]*href\s*=\s*["']javascript:/gi
    ],
    
    // Command injection
    commandInjection: [
      /[;&|`$(){}[\]]/i,
      /\b(curl|wget|nc|netcat|ssh|ftp|telnet)\b/i,
      /\b(rm|mv|cp|cat|ls|ps|kill|chmod|chown)\b/i,
      /\b(python|perl|ruby|bash|sh|cmd|powershell)\b/i,
      /`[^`]*`/i,
      /\$\([^)]*\)/i,
      /{{[^}]*}}/i,
      /<%[^%]*%>/i
    ],
    
    // Path traversal
    pathTraversal: [
      /\.\.[/\\]/g,
      /%2e%2e[/\\]/i,
      /\.\.%2f/i,
      /\.\.%5c/i,
      /%252e%252e[/\\]/i,
      /\/etc\/passwd/i,
      /\/windows\/system32/i,
      /\\windows\\system32/i
    ],
    
    // LDAP injection
    ldapInjection: [
      /[()=*,]/gi,
      /\*\)\(/gi,
      /\)\(.*\*\)/gi,
      /[&|!<>]/gi
    ],
    
    // NoSQL injection
    nosqlInjection: [
      /\$where/gi,
      /\$ne/gi,
      /\$in/gi,
      /\$nin/gi,
      /\$gt/gi,
      /\$lt/gi,
      /\$gte/gi,
      /\$lte/gi,
      /\$regex/gi,
      /\{.*\$.*\}/gi
    ],
    
    // XXE attacks
    xxe: [
      /<!DOCTYPE[^>]*\[.*\]/gi,
      /<!ENTITY[^>]*SYSTEM/gi,
      /<!ENTITY[^>]*PUBLIC/gi,
      /&[a-zA-Z]+;/gi
    ],
    
    // SSRF attacks
    ssrf: [
      /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/gi,
      /file:\/\//gi,
      /ftp:\/\//gi,
      /gopher:\/\//gi,
      /dict:\/\//gi
    ],
    
    // File inclusion
    fileInclusion: [
      /php:\/\/filter/gi,
      /php:\/\/input/gi,
      /data:\/\//gi,
      /expect:\/\//gi,
      /file:\/\/\/etc\//gi,
      /file:\/\/\/windows\//gi
    ],
    
    // Null byte injection
    nullByte: [
      /\\x00/gi,
      /%00/gi,
      // eslint-disable-next-line no-control-regex -- Intentionally checking for null byte
      /\x00/gi
    ],

    // Unicode attacks
    unicode: [
      /%u[0-9a-fA-F]{4}/gi,
      /\\u[0-9a-fA-F]{4}/gi,
      /%E2\%80\%AE/gi, // Right-to-left override
      /%E2\%80\%8B/gi  // Zero-width space
    ]
  };

  // MQL5-specific security patterns
  private readonly MQL5_PATTERNS = {
    dangerousFunctions: [
      /\b(ShellExecute|WinExec|CreateProcess|system|exec|popen)\b/i,
      /\b(DeleteFile|RemoveDirectory|CreateFile|WriteFile)\b/i,
      /\b(RegCreateKey|RegSetValue|RegDeleteKey)\b/i,
      /\b(Socket|Connect|Send|Recv|Listen)\b/i,
      /\b(HttpAddRequestHeaders|HttpOpenRequest|HttpSendRequest)\b/i,
      /\b(CryptEncrypt|CryptDecrypt|CryptGenKey)\b/i
    ],
    
    suspiciousImports: [
      /\b(kernel32\.dll|user32\.dll|shell32\.dll|ws2_32\.dll|wininet\.dll)\b/i,
      /\b(advapi32\.dll|crypt32\.dll|winhttp\.dll)\b/i
    ],
    
    networkOperations: [
      /\b(InternetOpen|InternetConnect|HttpOpenRequest|FtpOpenFile)\b/i,
      /\b(send|recv|sendto|recvfrom|connect|bind|listen)\b/i
    ],
    
    fileOperations: [
      /\b(CreateFile|ReadFile|WriteFile|DeleteFile|MoveFile|CopyFile)\b/i,
      /\b(CreateDirectory|RemoveDirectory|GetCurrentDirectory)\b/i
    ],
    
    registryOperations: [
      /\b(RegOpenKey|RegCreateKey|RegSetValue|RegDeleteValue|RegCloseKey)\b/i
    ]
  };

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = {
      rateLimiting: {
        enabled: true,
        windowMs: 60000, // 1 minute
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },
      validation: {
        enabled: true,
        strictMode: false,
        sanitizeInput: true,
        validateMQL5: true
      },
      monitoring: {
        enabled: true,
        logViolations: true,
        alertThreshold: 10
      },
      ...config
    };
  }

  /**
   * Enhanced rate limiting with IP reputation and adaptive limits
   */
  async checkRateLimit(
    identifier: string, 
    context: 'default' | 'api' | 'auth' | 'generate' = 'default',
    requestSize?: number
  ): Promise<RateLimitResult> {
    if (!this.config.rateLimiting.enabled) {
      return {
        allowed: true,
        limit: 0,
        remaining: 0,
        resetTime: 0,
        windowMs: 0
      };
    }

    const now = Date.now();
    const key = `${context}:${identifier}`;
    const reputation = this.getIPReputation(identifier);
    
    // Adaptive limits based on IP reputation
    let maxRequests = this.config.rateLimiting.maxRequests;
    let windowMs = this.config.rateLimiting.windowMs;
    
    if (reputation.score < -50) {
      // Suspicious IP - stricter limits
      maxRequests = Math.floor(maxRequests * 0.3);
      windowMs = Math.floor(windowMs * 2);
    } else if (reputation.score > 50) {
      // Trusted IP - more lenient limits
      maxRequests = Math.floor(maxRequests * 1.5);
    }

    // Context-specific adjustments
    const contextMultipliers = {
      default: 1,
      api: 0.8,
      auth: 0.3,
      generate: 0.5
    };
    
    maxRequests = Math.floor(maxRequests * contextMultipliers[context]);

    // Get current rate limit data
    const current = this.rateLimitStore.get(key) || { 
      count: 0, 
      resetTime: now + windowMs, 
      violations: 0 
    };

    // Reset if window expired
    if (now > current.resetTime) {
      current.count = 0;
      current.violations = 0;
      current.resetTime = now + windowMs;
    }

    // Increment counter
    current.count++;
    this.rateLimitStore.set(key, current);

    // Check if limit exceeded
    const allowed = current.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - current.count);
    const retryAfter = allowed ? undefined : Math.ceil((current.resetTime - now) / 1000);

    // Update IP reputation on violations
    if (!allowed) {
      current.violations++;
      this.updateIPReputation(identifier, -10, 'RATE_LIMIT_EXCEEDED');
    }

    // Cleanup old entries
    this.cleanupRateLimitStore();

    return {
      allowed,
      limit: maxRequests,
      remaining,
      resetTime: current.resetTime,
      retryAfter,
      windowMs
    };
  }

  /**
   * Comprehensive input validation with context awareness
   */
  validateInput(
    input: string, 
    context: 'code' | 'chat' | 'search' | 'api' | 'mql5' = 'api',
    options: { strict?: boolean; sanitize?: boolean } = {}
  ): ValidationResult {
    if (!this.config.validation.enabled) {
      return {
        isValid: true,
        errors: [],
        warnings: [],
        riskScore: 0
      };
    }

    const strict = options.strict ?? this.config.validation.strictMode;
    const sanitize = options.sanitize ?? this.config.validation.sanitizeInput;
    
    let sanitized = input;
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskScore = 0;

    // Basic validation
    if (!input || typeof input !== 'string') {
      errors.push('Input must be a non-empty string');
      return {
        isValid: false,
        errors,
        warnings,
        riskScore: 100
      };
    }

    // Length validation
    if (input.length > 100000) {
      errors.push('Input too large (>100KB)');
      riskScore += 30;
    }

    if (input.length < 1 && context !== 'search') {
      errors.push('Input cannot be empty');
      riskScore += 20;
    }

    // Context-specific validation
    switch (context) {
      case 'mql5':
        this.validateMQL5Code(input, errors, warnings, riskScore);
        break;
      case 'code':
        this.validateGenericCode(input, errors, warnings, riskScore);
        break;
      case 'chat':
        this.validateChatInput(input, errors, warnings, riskScore);
        break;
      case 'search':
        this.validateSearchInput(input, errors, warnings, riskScore);
        break;
    }

    // General security validation
    this.validateSecurityPatterns(input, errors, warnings, riskScore, strict);

    // Sanitization
    if (sanitize && errors.length === 0) {
      sanitized = this.sanitizeInput(input);
      if (sanitized !== input) {
        warnings.push('Input was sanitized for security reasons');
        riskScore += 5;
      }
    }

    const isValid = errors.length === 0 && riskScore < 70;

    return {
      isValid,
      errors,
      warnings,
      sanitized,
      riskScore: Math.min(riskScore, 100)
    };
  }

  /**
   * MQL5-specific code validation
   */
  private validateMQL5Code(input: string, errors: string[], warnings: string[], riskScore: number): void {
    let currentRiskScore = riskScore;
    
    // Check for dangerous functions
    for (const pattern of this.MQL5_PATTERNS.dangerousFunctions) {
      if (pattern.test(input)) {
        errors.push('Dangerous function detected in MQL5 code');
        currentRiskScore += 40;
      }
    }

    // Check for suspicious imports
    for (const pattern of this.MQL5_PATTERNS.suspiciousImports) {
      if (pattern.test(input)) {
        warnings.push('Suspicious DLL import detected');
        currentRiskScore += 20;
      }
    }

    // Check for network operations
    for (const pattern of this.MQL5_PATTERNS.networkOperations) {
      if (pattern.test(input)) {
        warnings.push('Network operation detected in MQL5 code');
        currentRiskScore += 15;
      }
    }

    // Check for file operations
    for (const pattern of this.MQL5_PATTERNS.fileOperations) {
      if (pattern.test(input)) {
        warnings.push('File system operation detected');
        currentRiskScore += 10;
      }
    }

    // Check for registry operations
    for (const pattern of this.MQL5_PATTERNS.registryOperations) {
      if (pattern.test(input)) {
        errors.push('Registry operation detected in MQL5 code');
        currentRiskScore += 35;
      }
    }

    // Check for obfuscation patterns
    if (this.detectObfuscation(input)) {
      errors.push('Code obfuscation detected');
      currentRiskScore += 25;
    }
  }

  /**
   * Generic code validation
   */
  private validateGenericCode(input: string, errors: string[], warnings: string[], riskScore: number): void {
    let currentRiskScore = riskScore;
    
    // Check for common dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /require\s*\(\s*['"`]child_process/gi,
      /require\s*\(\s*['"`]fs/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        errors.push('Dangerous code pattern detected');
        currentRiskScore += 30;
      }
    }
  }

  /**
   * Chat input validation
   */
  private validateChatInput(input: string, errors: string[], warnings: string[], riskScore: number): void {
    let currentRiskScore = riskScore;
    
    // Check for prompt injection attempts
    const promptInjectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /disregard\s+the\s+above/gi,
      /system\s*:\s*you\s+are/gi,
      /\[SYSTEM\]/gi,
      /\[ADMIN\]/gi
    ];

    for (const pattern of promptInjectionPatterns) {
      if (pattern.test(input)) {
        warnings.push('Potential prompt injection attempt');
        currentRiskScore += 15;
      }
    }

    // Check for excessive repetition (potential DoS)
    if (this.detectExcessiveRepetition(input)) {
      warnings.push('Excessive repetition detected');
      currentRiskScore += 10;
    }
  }

  /**
   * Search input validation
   */
  private validateSearchInput(input: string, errors: string[], warnings: string[], riskScore: number): void {
    let currentRiskScore = riskScore;
    
    // Allow empty search (might show all results)
    if (input.trim().length === 0) {
      return;
    }

    // Check for search-based injection attempts
    if (input.length > 1000) {
      errors.push('Search query too long');
      currentRiskScore += 20;
    }
  }

  /**
   * Security pattern validation
   */
  private validateSecurityPatterns(
    input: string, 
    errors: string[], 
    warnings: string[], 
    riskScore: number, 
    strict: boolean
  ): void {
    let currentRiskScore = riskScore;
    
    // Check all security pattern categories
    for (const [category, patterns] of Object.entries(this.SECURITY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          const severity = this.getPatternSeverity(category);
          const message = this.getSecurityMessage(category);
          
          if (severity === 'high' || (strict && severity === 'medium')) {
            errors.push(message);
            currentRiskScore += this.getRiskScore(category, 'error');
          } else {
            warnings.push(message);
            currentRiskScore += this.getRiskScore(category, 'warning');
          }
        }
      }
    }
  }

  /**
   * Input sanitization
   */
  private sanitizeInput(input: string): string {
    let sanitized = input;

    // Remove null bytes
    sanitized = sanitized.replace(/\x00/g, '');

    // Normalize Unicode
    sanitized = sanitized.normalize('NFC');

    // Escape HTML entities
    sanitized = sanitized.replace(/&/g, '&amp;')
                       .replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;')
                       .replace(/"/g, '&quot;')
                       .replace(/'/g, '&#x27;');

    // Remove potentially dangerous characters in strict mode
    if (this.config.validation.strictMode) {
      sanitized = sanitized.replace(/[<>]/g, '');
    }

    return sanitized;
  }

  /**
   * Detect code obfuscation
   */
  private detectObfuscation(input: string): boolean {
    const obfuscationPatterns = [
      /\\x[0-9a-fA-F]{2}/g,  // Hex encoding
      /\\u[0-9a-fA-F]{4}/g,  // Unicode encoding
      /\%[0-9a-fA-F]{2}/g,   // URL encoding
      /eval\s*\(\s*['"`].*['"`]\s*\)/gi, // Eval with string
      /String\.fromCharCode/gi, // Char code obfuscation
      /atob\s*\(/gi,         // Base64 decode
      /btoa\s*\(/gi          // Base64 encode
    ];

    let matchCount = 0;
    for (const pattern of obfuscationPatterns) {
      const matches = input.match(pattern);
      if (matches) {
        matchCount += matches.length;
      }
    }

    // Consider obfuscated if more than 5 patterns found
    return matchCount > 5;
  }

  /**
   * Detect excessive repetition
   */
  private detectExcessiveRepetition(input: string): boolean {
    // Check for repeated characters or patterns
    const repeatedCharPattern = /(.)\1{10,}/g;
    const repeatedWordPattern = /(\b\w+\b)\s+\1{5,}/gi;
    
    return repeatedCharPattern.test(input) || repeatedWordPattern.test(input);
  }

  /**
   * Get IP reputation
   */
  private getIPReputation(identifier: string): { score: number; lastSeen: number; violations: string[] } {
    return this.ipReputation.get(identifier) || { score: 0, lastSeen: 0, violations: [] };
  }

  /**
   * Update IP reputation
   */
  private updateIPReputation(identifier: string, scoreChange: number, violation: string): void {
    const current = this.getIPReputation(identifier);
    current.score += scoreChange;
    current.lastSeen = Date.now();
    current.violations.push(violation);
    
    // Keep only last 50 violations
    if (current.violations.length > 50) {
      current.violations = current.violations.slice(-50);
    }
    
    this.ipReputation.set(identifier, current);
  }

  /**
   * Cleanup old rate limit entries
   */
  private cleanupRateLimitStore(): void {
    const now = Date.now();
    for (const [key, data] of this.rateLimitStore.entries()) {
      if (now > data.resetTime + 60000) { // Keep for 1 minute after reset
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Get pattern severity
   */
  private getPatternSeverity(category: string): 'low' | 'medium' | 'high' {
    const severityMap: Record<string, 'low' | 'medium' | 'high'> = {
      sqlInjection: 'high',
      xss: 'high',
      commandInjection: 'high',
      pathTraversal: 'high',
      ldapInjection: 'medium',
      nosqlInjection: 'medium',
      xxe: 'high',
      ssrf: 'high',
      fileInclusion: 'high',
      nullByte: 'medium',
      unicode: 'low'
    };

    return severityMap[category] || 'medium';
  }

  /**
   * Get security message
   */
  private getSecurityMessage(category: string): string {
    const messageMap: Record<string, string> = {
      sqlInjection: 'SQL injection attempt detected',
      xss: 'Cross-site scripting attempt detected',
      commandInjection: 'Command injection attempt detected',
      pathTraversal: 'Path traversal attempt detected',
      ldapInjection: 'LDAP injection attempt detected',
      nosqlInjection: 'NoSQL injection attempt detected',
      xxe: 'XXE attack attempt detected',
      ssrf: 'Server-side request forgery attempt detected',
      fileInclusion: 'File inclusion attempt detected',
      nullByte: 'Null byte injection detected',
      unicode: 'Unicode attack attempt detected'
    };

    return messageMap[category] || 'Security violation detected';
  }

  /**
   * Get risk score
   */
  private getRiskScore(category: string, type: 'error' | 'warning'): number {
    const baseScores: Record<string, number> = {
      sqlInjection: 40,
      xss: 35,
      commandInjection: 45,
      pathTraversal: 30,
      ldapInjection: 20,
      nosqlInjection: 25,
      xxe: 35,
      ssrf: 30,
      fileInclusion: 30,
      nullByte: 15,
      unicode: 10
    };

    const score = baseScores[category] || 20;
    return type === 'error' ? score : Math.floor(score * 0.6);
  }

  /**
   * Generate security report
   */
  generateSecurityReport(): {
    totalRequests: number;
    blockedRequests: number;
    topViolations: Array<{ type: string; count: number }>;
    ipReputation: Array<{ ip: string; score: number; violations: number }>;
  } {
    const totalRequests = Array.from(this.rateLimitStore.values())
      .reduce((sum, data) => sum + data.count, 0);
    
    const blockedRequests = Array.from(this.rateLimitStore.values())
      .reduce((sum, data) => sum + data.violations, 0);

    const topViolations = this.aggregateViolationTypes();
    const ipReputation = this.getTopIPReputations();

    return {
      totalRequests,
      blockedRequests,
      topViolations,
      ipReputation
    };
  }

  /**
   * Aggregate violation types
   */
  private aggregateViolationTypes(): Array<{ type: string; count: number }> {
    const violationCounts = new Map<string, number>();
    
    for (const [, data] of this.ipReputation) {
      for (const violation of data.violations) {
        violationCounts.set(violation, (violationCounts.get(violation) || 0) + 1);
      }
    }

    return Array.from(violationCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Get top IP reputations
   */
  private getTopIPReputations(): Array<{ ip: string; score: number; violations: number }> {
    return Array.from(this.ipReputation.entries())
      .map(([ip, data]) => ({
        ip,
        score: data.score,
        violations: data.violations.length
      }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 20);
  }

  /**
   * Reset security data
   */
  reset(): void {
    this.rateLimitStore.clear();
    this.ipReputation.clear();
    this.patternCache.clear();
  }
}

// Singleton instance
export const securityManager = new EnhancedSecurityManager();