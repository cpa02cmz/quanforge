/**
 * Unified Security Manager - Consolidated Security Implementation
 * Combines advanced features from securityManager.ts and enhancedSecurityManager.ts
 * Provides comprehensive security protection with enhanced performance and maintainability
 */

import DOMPurify from 'dompurify';

// Export interfaces
export interface SecurityConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
  endpoint?: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    skipFailedRequests: boolean;
  };
  adaptiveRateLimiting: {
    enabled: boolean;
    userTiers: Record<string, { maxRequests: number; windowMs: number }>;
    requestSizeLimit: number;
  };
  encryption: {
    algorithm: string;
    keyRotationInterval: number;
  };
  validation: {
    strictMode: boolean;
    sanitizeInput: boolean;
    validateMQL5: boolean;
  };
  monitoring: {
    enabled: boolean;
    logViolations: boolean;
    alertThreshold: number;
  };
  edgeRateLimiting: {
    enabled: boolean;
    requestsPerSecond: number;
    burstLimit: number;
  };
  regionBlocking: {
    enabled: boolean;
    blockedRegions: string[];
  };
  botDetection: {
    enabled: boolean;
    suspiciousPatterns: string[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData?: any;
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

export interface WAFResult {
  isMalicious: boolean;
  threats: string[];
  riskScore: number;
  confidence: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  violations: number;
  lastReset: number;
}

interface IPReputation {
  score: number;
  lastSeen: number;
  violations: string[];
  requestHistory: number[];
}

interface CSRFEntry {
  token: string;
  expiresAt: number;
}

class UnifiedSecurityManager {
  private static instance: UnifiedSecurityManager;
  private config: SecurityConfig;
  private rateLimitStore = new Map<string, RateLimitEntry>();
  private ipReputation = new Map<string, IPReputation>();
  private csrfTokens = new Map<string, CSRFEntry>();
  private patternCache = new Map<string, RegExp>();

  // Comprehensive Security Patterns - Combined and Enhanced
  private readonly SECURITY_PATTERNS = {
    // SQL Injection patterns with advanced detection
    sqlInjection: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|SCRIPT|EXEC|ALTER|CREATE|TRUNCATE|LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b)/i,
      /['"]\s*OR\s*['"]?\w+['"]?\s*=['"]?\w+['"]?/i,
      /['"]\s*AND\s*['"]?\w+['"]?\s*=['"]?\w+['"]?/i,
      /\bUNION\s+SELECT\b/i,
      /\b(OR|AND)\s+\d+\s*=\s*\d+/i,
      /;\s*(DROP|DELETE|UPDATE|INSERT)\s/i,
      /waitfor\s+delay/gi,
      /benchmark\s*\(/gi,
      /sleep\s*\(/gi,
      /pg_sleep\s*\(/gi,
      /dbms_pipe\.receive_message/gi
    ],
    
    // XSS patterns with enhanced coverage
    xss: [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /<object[^>]*>.*?<\/object>/gi,
      /<embed[^>]*>.*?<\/embed>/gi,
      /<link[^>]*>.*?<\/link>/gi,
      /<meta[^>]*>.*?<\/meta>/gi,
      /<form[^>]*>.*?<\/form>/gi,
      /vbscript:/gi,
      /data:text\/html/i,
      /data:\/\//gi,
      /about:/gi,
      /expression\(/gi,
      /@import/gi,
      /binding:\s*source/gi,
      /document\.cookie/gi,
      /window\.location/gi,
      /document\.write/gi,
      /eval\(/gi,
      /alert\(/gi,
      /confirm\(/gi,
      /prompt\(/gi,
      /decodeURIComponent/gi,
      /escape\(/gi,
      /unescape\(/gi
    ],
    
    // Command injection with comprehensive patterns
    commandInjection: [
      /[;&|`$(){}[\]]/i,
      /\b(curl|wget|nc|netcat|ssh|ftp|telnet|nmap|nikto|sqlmap|dirb|gobuster|wfuzz|burp)\b/i,
      /\b(rm|mv|cp|cat|ls|ps|kill|chmod|chown|format|fdisk|mkfs)\b/i,
      /\b(python|perl|ruby|bash|sh|cmd|powershell)\b/i,
      /`[^`]*`/i,
      /\$\([^)]*\)/i,
      /{{[^}]*}}/i,
      /<%[^%]*%>/gi,
      /\b(system|exec|popen|shell_exec|passthru)\s*\(/i
    ],
    
    // Path traversal with encoding variants
    pathTraversal: [
      /\.\.[\/\\]/g,
      /%2e%2e[\/\\]/i,
      /\.\.%2f/i,
      /\.\.%5c/i,
      /%252e%252e[\/\\]/i,
      /\/etc\/passwd/i,
      /\/windows\/system32/i,
      /\\windows\\system32/i,
      /\/proc\//gi,
      /\/sys\//gi
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
      /&[a-zA-Z]+;/gi,
      /<\?xml/gi,
      /SYSTEM\s+"/gi,
      /PUBLIC\s+"/gi
    ],
    
    // SSRF attacks with internal IP ranges
    ssrf: [
      /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|169\.254\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/gi,
      /0x7f000001/gi,
      /2130706433/gi,
      /::1/gi,
      /metadata/gi,
      /file:\/\//gi,
      /ftp:\/\//gi,
      /gopher:\/\//gi,
      /dict:\/\//gi
    ],
    
    // File inclusion attacks
    fileInclusion: [
      /php:\/\/filter/gi,
      /php:\/\/input/gi,
      /data:\/\//gi,
      /expect:\/\//gi,
      /file:\/\/\/etc\//gi,
      /file:\/\/\/windows\//gi,
      /zip:\/\//gi,
      /phar:\/\//gi,
      /ssh2\.shell/gi,
      /ssh2\.exec/gi
    ],
    
    // Buffer overflow patterns
    bufferOverflow: [
      /A{1000,}/g,
      /%41{100,}/gi,
      /0x41{100,}/gi,
      /\x90{100,}/gi,
      /\x90{50,}\x31\xc0/gi
    ],
    
    // Null byte and encoding attacks
    encodingAttacks: [
      /\\x00/gi,
      /%00/gi,
      /\x00/gi,
      /%u[0-9a-fA-F]{4}/gi,
      /\\u[0-9a-fA-F]{4}/gi,
      /\%E2\%80\%AE/gi, // Right-to-left override
      /\%E2\%80\%8B/gi  // Zero-width space
    ]
  };

  // MQL5-specific security patterns - Most comprehensive set
  private readonly MQL5_PATTERNS = {
    dangerousFunctions: [
      /\b(ShellExecute|WinExec|CreateProcess|system|exec|popen|ExitWindows|RebootWindows)\b/i,
      /\b(DeleteFile|RemoveDirectory|CreateFile|WriteFile|ReadFile|CopyFile|MoveFile)\b/i,
      /\b(RegCreateKey|RegSetValue|RegDeleteKey|RegOpenKey|RegCloseKey)\b/i,
      /\b(SocketCreate|SocketConnect|SocketSend|SocketReceive|SocketListen|SocketBind)\b/i,
      /\b(HttpAddRequestHeaders|HttpOpenRequest|HttpSendRequest|InternetOpen|InternetConnect)\b/i,
      /\b(CryptEncrypt|CryptDecrypt|CryptGenKey|CryptCreateHash|CryptHashData)\b/i,
      /\b(SendFTP|SendMail|SendNotification|WebRequest)\b/i,
      /\b(CustomIndicator|WindowFind|WindowScreenShot|GlobalVariableTemp|ResourceCreate)\b/i,
      /\b(FileFindFirst|FileFindNext|FileFindClose|FileFlush|ResourceSave|ResourceRead)\b/i,
      /\b(GlobalVariablesFlush|TerminalInfoInteger|TerminalInfoString|TerminalInfoDouble)\b/i,
      /\b(ChartApplyTemplate|ChartSave|ChartScreenShot|AccountInfo|AccountInfoInteger|AccountInfoDouble)\b/i,
      /\b(OrderSend|OrderClose|OrderModify|OrderDelete|PositionOpen|PositionClose|PositionModify)\b/i,
      /\b(Alert|Comment|Print|MessageBox|Sleep)\b/i
    ],
    
    suspiciousImports: [
      /\b(kernel32\.dll|user32\.dll|shell32\.dll|ws2_32\.dll|wininet\.dll|advapi32\.dll|crypt32\.dll|winhttp\.dll)\b/i,
      /#import\s+["']([^"']+\.(dll|exe|sys))["']/gi,
      /#import/gi
    ],
    
    networkOperations: [
      /\b(InternetOpen|InternetConnect|HttpOpenRequest|FtpOpenFile|SocketCreate|SocketConnect)\b/i,
      /\b(send|recv|sendto|recvfrom|connect|bind|listen|accept)\b/i,
      /resourceadd/gi,
      /resourcecreate/gi,
      /resourcefree/gi
    ],
    
    fileOperations: [
      /\b(CreateFile|ReadFile|WriteFile|DeleteFile|MoveFile|CopyFile|FileOpen|FileClose|FileRead|FileWrite|FileDelete|FileCopy|FileMove|FileIsExist)\b/i,
      /\b(CreateDirectory|RemoveDirectory|GetCurrentDirectory|SetCurrentDirectory)\b/i,
      /filefindfirst|filefindnext|filefindclose/gi
    ],
    
    registryOperations: [
      /\b(RegOpenKey|RegCreateKey|RegSetValue|RegDeleteValue|RegCloseKey|RegQueryValue|RegEnumValue)\b/i
    ],

    memoryOperations: [
      /\b(memcpy|memset|malloc|free|GetMemory|FreeMemory)\b/i,
      /char.*\[|uchar.*\[|int.*\[|long.*\[/gi,
      /char\(|uchar\(|int\(|long\(/gi
    ],

    obfuscationPatterns: [
      /string\.concat|StringConcatenate/gi,
      /arraycopy|ArrayCopy/gi,
      /[^a-zA-Z0-9\s\(\)\[\]\{\}\.\,\;\:\+\-\*\/\=\>\<\!\&\|\^\~\%]+/g,
      /0x[0-9a-fA-F]+/g,
      /\\u[0-9a-fA-F]{4}/g,
      /\\x[0-9a-fA-F]{2}/g,
      /\+\s*\+\s*\+\s*\+\s*\+/g
    ]
  };

  private readonly TOKEN_EXPIRY_MS = 3600000; // 1 hour

  private constructor() {
    this.config = {
      maxPayloadSize: 5 * 1024 * 1024, // 5MB
      allowedOrigins: [
        'https://quanforge.ai',
        'https://www.quanforge.ai',
        'http://localhost:3000',
        'http://localhost:5173'
      ],
      rateLimiting: {
        windowMs: 60000, // 1 minute
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false
      },
      adaptiveRateLimiting: {
        enabled: true,
        userTiers: {
          basic: { maxRequests: 100, windowMs: 60000 },
          premium: { maxRequests: 500, windowMs: 60000 },
          enterprise: { maxRequests: 2000, windowMs: 60000 }
        },
        requestSizeLimit: 10 * 1024 * 1024 // 10MB
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        keyRotationInterval: 43200000, // 12 hours
      },
      validation: {
        strictMode: false,
        sanitizeInput: true,
        validateMQL5: true,
      },
      monitoring: {
        enabled: true,
        logViolations: true,
        alertThreshold: 10,
      },
      edgeRateLimiting: {
        enabled: true,
        requestsPerSecond: 10,
        burstLimit: 20
      },
      regionBlocking: {
        enabled: true,
        blockedRegions: ['CN', 'RU', 'IR', 'KP']
      },
      botDetection: {
        enabled: true,
        suspiciousPatterns: [
          'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster', 
          'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider'
        ]
      }
    };

    // Initialize monitoring systems
    if (typeof window !== 'undefined') {
      this.monitorCSPViolations();
      this.startPeriodicCleanup();
    }
  }

  static getInstance(): UnifiedSecurityManager {
    if (!UnifiedSecurityManager.instance) {
      UnifiedSecurityManager.instance = new UnifiedSecurityManager();
    }
    return UnifiedSecurityManager.instance;
  }

  /**
   * Enhanced adaptive rate limiting with IP reputation and context awareness
   */
  async checkRateLimit(
    identifier: string, 
    context: 'default' | 'api' | 'auth' | 'generate' = 'default',
    options: { userTier?: string; requestSize?: number } = {}
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const { userTier = 'basic', requestSize = 0 } = options;
    
    // Base limits
    let maxRequests = this.config.rateLimiting.maxRequests;
    let windowMs = this.config.rateLimiting.windowMs;
    
    // Adaptive limits based on user tier
    if (this.config.adaptiveRateLimiting.enabled) {
      const tierConfig = this.config.adaptiveRateLimiting.userTiers[userTier];
      if (tierConfig) {
        maxRequests = tierConfig.maxRequests;
        windowMs = tierConfig.windowMs;
      }
    }
    
    // Context-specific adjustments
    const contextMultipliers = {
      default: 1,
      api: 0.8,
      auth: 0.3,
      generate: 0.5
    };
    
    maxRequests = Math.floor(maxRequests * contextMultipliers[context]);
    
    // IP reputation adjustments
    const reputation = this.getIPReputation(identifier);
    if (reputation.score < -50) {
      // Suspicious IP - stricter limits
      maxRequests = Math.floor(maxRequests * 0.3);
      windowMs = Math.floor(windowMs * 2);
    } else if (reputation.score > 50) {
      // Trusted IP - more lenient limits
      maxRequests = Math.floor(maxRequests * 1.5);
    }
    
    // Request size considerations
    if (requestSize > this.config.adaptiveRateLimiting.requestSizeLimit) {
      maxRequests = Math.floor(maxRequests * 0.5);
    }
    
    const key = `${context}:${identifier}`;
    const current = this.rateLimitStore.get(key) || { 
      count: 0, 
      resetTime: now + windowMs, 
      violations: 0,
      lastReset: now
    };
    
    // Reset if window expired
    if (now > current.resetTime) {
      current.count = 0;
      current.violations = 0;
      current.lastReset = now;
      current.resetTime = now + windowMs;
    }
    
    current.count++;
    this.rateLimitStore.set(key, current);
    
    const allowed = current.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - current.count);
    const retryAfter = allowed ? undefined : Math.ceil((current.resetTime - now) / 1000);
    
    // Update IP reputation on violations
    if (!allowed) {
      current.violations++;
      this.updateIPReputation(identifier, -10, 'RATE_LIMIT_EXCEEDED');
      this.logSecurityEvent('RATE_LIMIT_VIOLATION', { identifier, context, count: current.count });
    }
    
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
    context: 'code' | 'chat' | 'search' | 'api' | 'mql5' | 'text' | 'symbol' | 'url' | 'token' | 'html' = 'api',
    options: { strict?: boolean; sanitize?: boolean } = {}
  ): ValidationResult {
    let sanitized = input;
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskScore = 0;
    
    const strict = options.strict ?? this.config.validation.strictMode;
    const sanitize = options.sanitize ?? this.config.validation.sanitizeInput;
    
    // Basic validation
    if (!input || typeof input !== 'string') {
      errors.push('Input must be a non-empty string');
      return { isValid: false, errors, warnings, riskScore: 100 };
    }
    
    // Size validation
    const inputSize = new Blob([input]).size;
    if (inputSize > this.config.maxPayloadSize) {
      errors.push(`Input too large: ${inputSize} bytes (max: ${this.config.maxPayloadSize})`);
      riskScore += 50;
    }
    
    // Length validation
    if (input.length > 100000) {
      errors.push('Input too long (>100KB)');
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
      case 'html':
        this.validateHTMLInput(input, errors, warnings, riskScore);
        break;
      case 'symbol':
        this.validateSymbolInput(input, errors, warnings, riskScore);
        break;
      case 'token':
        this.validateTokenInput(input, errors, warnings, riskScore);
        break;
    }
    
    // General security validation
    this.validateSecurityPatterns(input, errors, warnings, riskScore, strict);
    
    // XSS and injection prevention
    const xssResult = this.preventXSS({ data: input });
    if (xssResult.hasXSS) {
      errors.push('Potential XSS detected and removed');
      riskScore += 30;
      sanitized = xssResult.sanitizedData.data;
    }
    
    const sqlResult = this.preventSQLInjection({ data: input });
    if (sqlResult.hasSQLInjection) {
      errors.push('Potential SQL injection detected and removed');
      riskScore += 40;
      sanitized = sqlResult.sanitizedData.data;
    }
    
    // Sanitization
    if (sanitize && errors.length === 0) {
      const sanitizeContext = this.mapToSanitizeContext(context);
      sanitized = this.sanitizeInput(sanitized, sanitizeContext);
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
      sanitizedData: sanitized,
      riskScore: Math.min(riskScore, 100)
    };
  }

  /**
   * Enhanced Web Application Firewall (WAF) with advanced threat detection
   */
  detectWAFPatterns(request: Request): WAFResult {
    const threats: string[] = [];
    let riskScore = 0;
    
    const url = request.url;
    const method = request.method;
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const origin = request.headers.get('origin') || '';
    
    const urlToCheck = url + referer + origin;
    
    // Check all security pattern categories
    for (const [category, patterns] of Object.entries(this.SECURITY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(urlToCheck)) {
          threats.push(this.mapCategoryToThreatName(category));
          riskScore += this.getPatternRiskScore(category);
        }
      }
    }
    
    // Bot detection
    if (this.config.botDetection.enabled) {
      const botDetection = this.detectBot(userAgent);
      if (botDetection.isBot) {
        threats.push(`Bot detected: ${botDetection.botType}`);
        riskScore += 50;
      }
    }
    
    // HTTP method abuse
    const dangerousMethods = ['TRACE', 'CONNECT', 'TRACK', 'DEBUG'];
    if (dangerousMethods.includes(method.toUpperCase())) {
      threats.push('Dangerous HTTP Method');
      riskScore += 60;
    }
    
    // Header injection and IP spoofing detection
    this.checkHeaderSecurity(request.headers, threats, riskScore);
    
    // Content-Length abuse
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.config.maxPayloadSize) {
      threats.push('Oversized Payload');
      riskScore += 40;
    }
    
    const isMalicious = riskScore > 50;
    const confidence = Math.min(riskScore / 100, 1);
    
    return {
      isMalicious,
      threats: Array.from(new Set(threats)),
      riskScore: Math.min(riskScore, 100),
      confidence
    };
  }

  /**
   * MQL5 code validation with comprehensive security checks
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
    
    // Check for memory operations
    for (const pattern of this.MQL5_PATTERNS.memoryOperations) {
      if (pattern.test(input)) {
        warnings.push('Memory operation detected');
        currentRiskScore += 15;
      }
    }
    
    // Check for obfuscation patterns
    for (const pattern of this.MQL5_PATTERNS.obfuscationPatterns) {
      if (pattern.test(input)) {
        errors.push('Code obfuscation or suspicious patterns detected');
        currentRiskScore += 25;
      }
    }
    
    // Basic MQL5 structure validation
    if (!input.includes('OnTick') && !input.includes('OnStart') && !input.includes('OnInit') && !input.includes('OnDeinit')) {
      warnings.push('MQL5 code should contain standard functions like OnTick, OnInit, OnDeinit');
      currentRiskScore += 5;
    }
  }

  /**
   * Generic code validation
   */
  private validateGenericCode(input: string, errors: string[], warnings: string[], riskScore: number): void {
    let currentRiskScore = riskScore;
    
    const dangerousPatterns = [
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /require\s*\(\s*['"`]child_process/gi,
      /require\s*\(\s*['"`]fs/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(\s*["']/gi,
      /setInterval\s*\(\s*["']/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        errors.push('Dangerous code pattern detected');
        currentRiskScore += 30;
      }
    }
  }

  /**
   * Chat input validation for prompt injection
   */
  private validateChatInput(input: string, errors: string[], warnings: string[], riskScore: number): void {
    let currentRiskScore = riskScore;
    
    const promptInjectionPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /disregard\s+the\s+above/gi,
      /system\s*:\s*you\s+are/gi,
      /\[SYSTEM\]/gi,
      /\[ADMIN\]/gi,
      /\[IMPORTANT\]/gi,
      /jailbreak/gi,
      /developer\s+mode/gi
    ];
    
    for (const pattern of promptInjectionPatterns) {
      if (pattern.test(input)) {
        warnings.push('Potential prompt injection attempt');
        currentRiskScore += 15;
      }
    }
    
    if (this.detectExcessiveRepetition(input)) {
      warnings.push('Excessive repetition detected');
      currentRiskScore += 10;
    }
  }

  /**
   * Search input validation
   */
  private validateSearchInput(input: string, errors: string[], warnings: string[], riskScore: number): void {
    if (input.trim().length === 0) return;
    
    if (input.length > 1000) {
      errors.push('Search query too long');
      riskScore += 20;
    }
  }

  /**
   * HTML input validation
   */
  private validateHTMLInput(input: string, errors: string[], warnings: string[], riskScore: number): void {
    // Additional HTML-specific validation
    if (/<script/i.test(input)) {
      errors.push('Script tags not allowed in HTML input');
      riskScore += 40;
    }
    
    if (/<iframe/i.test(input)) {
      warnings.push('Iframe detected in HTML input');
      riskScore += 20;
    }
  }

  /**
   * Symbol input validation for trading symbols
   */
  private validateSymbolInput(input: string, errors: string[], warnings: string[], riskScore: number): void {
    const sanitized = input.toUpperCase().replace(/[^A-Z0-9/]/g, '');
    
    // Common patterns
    const forexPattern = /^[A-Z]{3}\/[A-Z]{3}$/;
    const cryptoPattern = /^[A-Z]{3,10}\/[A-Z]{3,10}$/;
    const stockPattern = /^[A-Z]{1,5}$/;
    
    if (!forexPattern.test(sanitized) && !cryptoPattern.test(sanitized) && !stockPattern.test(sanitized)) {
      errors.push('Invalid symbol format');
      riskScore += 15;
    }
  }

  /**
   * Token input validation
   */
  private validateTokenInput(input: string, errors: string[], warnings: string[], riskScore: number): void {
    const placeholders = ['your-api-key', 'api-key-here', 'xxx', 'test-key', 'demo', 'sample'];
    if (placeholders.some(placeholder => input.toLowerCase().includes(placeholder))) {
      errors.push('Placeholder token detected');
      riskScore += 25;
    }
    
    if (input.length < 20) {
      warnings.push('Token appears to be too short');
      riskScore += 10;
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
   * Enhanced input sanitization with context awareness
   */
  sanitizeInput(input: string, type: 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html' = 'text'): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    let sanitized = input.trim();
    
    switch (type) {
      case 'html':
        if (typeof DOMPurify !== 'undefined') {
          sanitized = DOMPurify.sanitize(sanitized, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre', 'br', 'p'],
            ALLOWED_ATTR: ['class'],
            KEEP_CONTENT: true
          });
        } else {
          sanitized = sanitized.replace(/<[^>]*>/g, '');
        }
        sanitized = sanitized.substring(0, 1000);
        break;
        
      case 'text':
        sanitized = sanitized.replace(/<[^>]*>/g, '');
        sanitized = sanitized.replace(/[<>]/g, '');
        sanitized = sanitized.substring(0, 1000);
        break;
        
      case 'code':
        sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, '');
        sanitized = sanitized.replace(/javascript:/gi, '');
        sanitized = sanitized.substring(0, 50000);
        break;
        
      case 'symbol':
        sanitized = sanitized.toUpperCase().replace(/[^A-Z0-9/]/g, '');
        sanitized = sanitized.substring(0, 10);
        break;
        
      case 'url':
        sanitized = sanitized.replace(/[<>'"]/g, '');
        if (!sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
          sanitized = 'https://' + sanitized;
        }
        sanitized = sanitized.substring(0, 2048);
        break;
        
      case 'token':
        sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '');
        sanitized = sanitized.substring(0, 500);
        break;
        
      case 'search':
        sanitized = sanitized.replace(/[<>'"]/g, '');
        sanitized = sanitized.substring(0, 200);
        break;
        
      case 'email':
        sanitized = sanitized.toLowerCase().replace(/[^a-z0-9@._-]/g, '');
        sanitized = sanitized.substring(0, 254);
        break;
    }
    
    return sanitized;
  }

  /**
   * XSS prevention
   */
  private preventXSS(data: { data: string }): { hasXSS: boolean; sanitizedData: { data: string } } {
    let hasXSS = false;
    let sanitized = data.data;
    
    const xssPatterns = this.SECURITY_PATTERNS.xss;
    for (const pattern of xssPatterns) {
      if (pattern.test(sanitized)) {
        hasXSS = true;
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    return { hasXSS, sanitizedData: { data: sanitized } };
  }

  /**
   * SQL injection prevention
   */
  private preventSQLInjection(data: { data: string }): { hasSQLInjection: boolean; sanitizedData: { data: string } } {
    let hasSQLInjection = false;
    let sanitized = data.data;
    
    const sqlPatterns = this.SECURITY_PATTERNS.sqlInjection;
    for (const pattern of sqlPatterns) {
      if (pattern.test(sanitized)) {
        hasSQLInjection = true;
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    return { hasSQLInjection, sanitizedData: { data: sanitized } };
  }

  /**
   * Bot detection
   */
  private detectBot(userAgent: string): { isBot: boolean; botType?: string } {
    const patterns = this.config.botDetection.suspiciousPatterns;
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      if (regex.test(userAgent)) {
        return { isBot: true, botType: pattern };
      }
    }
    return { isBot: false };
  }

  /**
   * Check header security for injection and spoofing
   */
  private checkHeaderSecurity(headers: Headers, threats: string[], riskScore: number): void {
    const headersToCheck = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip', 'x-remote-ip', 'x-remote-addr'];
    
    for (const name of headersToCheck) {
      const value = headers.get(name);
      if (value) {
        // Check for header injection
        if (/\r|\n/.test(value)) {
          threats.push('Header Injection');
          riskScore += 70;
        }
        
        // Check for IP spoofing
        if (this.isPrivateIP(value)) {
          threats.push('IP Spoofing Attempt');
          riskScore += 65;
        }
      }
    }
  }

  /**
   * IP validation for private ranges
   */
  private isPrivateIP(ip: string): boolean {
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];
    
    return privatePatterns.some(pattern => pattern.test(ip));
  }

  /**
   * Detect excessive repetition patterns
   */
  private detectExcessiveRepetition(input: string): boolean {
    const repeatedCharPattern = /(.)\1{10,}/g;
    const repeatedWordPattern = /(\b\w+\b)\s+\1{5,}/gi;
    
    return repeatedCharPattern.test(input) || repeatedWordPattern.test(input);
  }

  /**
   * Get IP reputation data
   */
  private getIPReputation(identifier: string): IPReputation {
    return this.ipReputation.get(identifier) || { 
      score: 0, 
      lastSeen: 0, 
      violations: [],
      requestHistory: []
    };
  }

  /**
   * Update IP reputation scores
   */
  private updateIPReputation(identifier: string, scoreChange: number, violation: string): void {
    const current = this.getIPReputation(identifier);
    current.score += scoreChange;
    current.lastSeen = Date.now();
    current.violations.push(violation);
    current.requestHistory.push(Date.now());
    
    // Keep only recent data
    if (current.violations.length > 50) {
      current.violations = current.violations.slice(-50);
    }
    
    const hourAgo = Date.now() - 3600000;
    current.requestHistory = current.requestHistory.filter(time => time > hourAgo);
    
    this.ipReputation.set(identifier, current);
  }

  /**
   * Map pattern categories to threat names
   */
  private mapCategoryToThreatName(category: string): string {
    const threatMap: Record<string, string> = {
      sqlInjection: 'SQL Injection',
      xss: 'Cross-Site Scripting',
      commandInjection: 'Command Injection',
      pathTraversal: 'Path Traversal',
      ldapInjection: 'LDAP Injection',
      nosqlInjection: 'NoSQL Injection',
      xxe: 'XXE Attack',
      ssrf: 'Server-Side Request Forgery',
      fileInclusion: 'File Inclusion',
      bufferOverflow: 'Buffer Overflow',
      encodingAttacks: 'Encoding Attack'
    };
    
    return threatMap[category] || 'Security Violation';
  }

  /**
   * Get pattern risk score
   */
  private getPatternRiskScore(category: string): number {
    const riskScores: Record<string, number> = {
      sqlInjection: 80,
      xss: 70,
      commandInjection: 90,
      pathTraversal: 75,
      ldapInjection: 65,
      nosqlInjection: 70,
      xxe: 85,
      ssrf: 80,
      fileInclusion: 85,
      bufferOverflow: 75,
      encodingAttacks: 50
    };
    
    return riskScores[category] || 50;
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
      bufferOverflow: 'medium',
      encodingAttacks: 'low'
    };
    
    return severityMap[category] || 'medium';
  }

  /**
   * Get security message for category
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
      bufferOverflow: 'Buffer overflow attempt detected',
      encodingAttacks: 'Encoding attack attempt detected'
    };
    
    return messageMap[category] || 'Security violation detected';
  }

  /**
   * Get risk score with error/warning multiplier
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
      bufferOverflow: 25,
      encodingAttacks: 15
    };
    
    const score = baseScores[category] || 20;
    return type === 'error' ? score : Math.floor(score * 0.6);
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(sessionId: string): string {
    const token = this.generateSecureToken();
    const expiresAt = Date.now() + this.TOKEN_EXPIRY_MS;
    
    this.csrfTokens.set(sessionId, { token, expiresAt });
    return token;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(sessionId: string, token: string): boolean {
    const stored = this.csrfTokens.get(sessionId);
    if (!stored || stored.expiresAt < Date.now()) {
      this.csrfTokens.delete(sessionId);
      return false;
    }
    return stored.token === token;
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Monitor CSP violations
   */
  private monitorCSPViolations(): void {
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation = {
        blockedURI: event.blockedURI,
        documentURI: event.documentURI,
        referrer: event.referrer,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        disposition: event.disposition,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        statusCode: event.statusCode,
        sample: event.sample,
        timestamp: Date.now()
      };
      
      console.warn('🛡️ CSP Violation detected:', violation);
      this.storeCSPViolation(violation);
      
      if (this.isHighSeverityViolation(violation)) {
        this.triggerSecurityAlert('CSP Violation', violation);
      }
    });
  }

  /**
   * Store CSP violations
   */
  private storeCSPViolation(violation: any): void {
    const violations = JSON.parse(localStorage.getItem('csp_violations') || '[]');
    violations.push(violation);
    
    if (violations.length > 100) {
      violations.splice(0, violations.length - 100);
    }
    
    localStorage.setItem('csp_violations', JSON.stringify(violations));
  }

  /**
   * Check for high severity violations
   */
  private isHighSeverityViolation(violation: any): boolean {
    const highSeverityDirectives = [
      'script-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors'
    ];
    
    return highSeverityDirectives.includes(violation.effectiveDirective);
  }

  /**
   * Trigger security alert
   */
  private triggerSecurityAlert(type: string, data: any): void {
    const alert = {
      type,
      data,
      timestamp: Date.now(),
      severity: 'high',
      url: window.location.href
    };
    
    console.error('🚨 Security Alert:', alert);
    
    if (process.env['NODE_ENV'] === 'production' && this.config.endpoint) {
      this.sendSecurityAlert(alert);
    }
  }

  /**
   * Send security alert to monitoring
   */
  private async sendSecurityAlert(alert: any): Promise<void> {
    try {
      await fetch(`${this.config.endpoint}/security-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Security-Alert': 'true'
        },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }

  /**
   * Log security events
   */
  private logSecurityEvent(eventType: string, data: any): void {
    if (!this.config.monitoring.enabled || !this.config.monitoring.logViolations) {
      return;
    }
    
    const event = {
      type: eventType,
      data,
      timestamp: Date.now(),
      userAgent: navigator.userAgent
    };
    
    console.warn(`Security Event [${eventType}]:`, event);
  }

  /**
   * Start periodic cleanup of old data
   */
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, 300000); // Every 5 minutes
  }

  /**
   * Clean up old rate limit and reputation data
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const hourAgo = now - 3600000;
    
    // Clean rate limit store
    for (const [key, data] of this.rateLimitStore.entries()) {
      if (now > data.resetTime + this.config.rateLimiting.windowMs) {
        this.rateLimitStore.delete(key);
      }
    }
    
    // Clean IP reputation
    for (const [key, data] of this.ipReputation.entries()) {
      if (data.lastSeen < hourAgo) {
        this.ipReputation.delete(key);
      }
    }
    
    // Clean expired CSRF tokens
    for (const [key, token] of this.csrfTokens.entries()) {
      if (token.expiresAt < now) {
        this.csrfTokens.delete(key);
      }
    }
  }

  /**
   * Generate comprehensive security report
   */
  generateSecurityReport(): {
    totalRequests: number;
    blockedRequests: number;
    topViolations: Array<{ type: string; count: number }>;
    ipReputation: Array<{ ip: string; score: number; violations: number }>;
    cspViolations: number;
  } {
    const totalRequests = Array.from(this.rateLimitStore.values())
      .reduce((sum, data) => sum + data.count, 0);
    
    const blockedRequests = Array.from(this.rateLimitStore.values())
      .reduce((sum, data) => sum + data.violations, 0);
    
    const topViolations = this.aggregateViolationTypes();
    const ipReputation = this.getTopIPReputations();
    const cspViolations = JSON.parse(localStorage.getItem('csp_violations') || '[]').length;
    
    return {
      totalRequests,
      blockedRequests,
      topViolations,
      ipReputation,
      cspViolations
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
   * Validate API key format
   */
  validateAPIKey(apiKey: string, type: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    
    const placeholders = ['your-api-key', 'api-key-here', 'xxx', 'test-key', 'demo', 'sample'];
    if (placeholders.some(placeholder => apiKey.toLowerCase().includes(placeholder))) {
      return false;
    }
    
    switch (type) {
      case 'gemini':
        return /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey);
      case 'supabase':
        return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(apiKey);
      case 'twelvedata':
        return /^[A-Za-z0-9]{32,}$/.test(apiKey);
      case 'generic':
      default:
        const patterns = [
          /^[a-zA-Z0-9_-]{20,}$/,
          /^sk-[a-zA-Z0-9_-]{20,}$/,
          /^AI[0-9a-zA-Z]{20,}$/,
          /^[\w-]{20,40}$/
        ];
        return patterns.some(pattern => pattern.test(apiKey)) && apiKey.length >= 20;
    }
  }

  /**
   * Safe JSON parsing with prototype pollution protection
   */
  safeJSONParse(jsonString: string): any {
    try {
      const parsed = JSON.parse(jsonString);
      if (this.isPrototypePollution(parsed)) {
        throw new Error('Prototype pollution detected in JSON');
      }
      return parsed;
    } catch (error) {
      console.error('JSON parsing error:', error);
      return null;
    }
  }

  /**
   * Detect prototype pollution
   */
  private isPrototypePollution(obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    for (const key of dangerousKeys) {
      if (key in obj) {
        return true;
      }
    }
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
        if (this.isPrototypePollution(obj[key])) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Reset all security data
   */
  reset(): void {
    this.rateLimitStore.clear();
    this.ipReputation.clear();
    this.csrfTokens.clear();
    this.patternCache.clear();
    localStorage.removeItem('csp_violations');
  }

  /**
   * Get comprehensive security statistics
   */
  getStats(): {
    rateLimitEntries: number;
    ipReputationEntries: number;
    activeCSRFTokens: number;
    blockedRequests: number;
    averageRiskScore: number;
  } {
    const rateLimitEntries = this.rateLimitStore.size;
    const ipReputationEntries = this.ipReputation.size;
    const activeCSRFTokens = this.csrfTokens.size;
    const blockedRequests = Array.from(this.rateLimitStore.values())
      .reduce((sum, data) => sum + data.violations, 0);
    
    return {
      rateLimitEntries,
      ipReputationEntries,
      activeCSRFTokens,
      blockedRequests,
      averageRiskScore: 0 // Would need to track this across validations
    };
  }

  /**
   * Map validation context to sanitization context
   */
  private mapToSanitizeContext(context: string): 'text' | 'code' | 'symbol' | 'url' | 'token' | 'search' | 'email' | 'html' {
    switch (context) {
      case 'mql5':
      case 'code':
        return 'code';
      case 'chat':
      case 'search':
        return 'search';
      case 'symbol':
        return 'symbol';
      case 'url':
        return 'url';
      case 'token':
        return 'token';
      case 'html':
        return 'html';
      case 'api':
      default:
        return 'text';
    }
  }

  /**
   * Backward compatibility method - sanitize and validate data
   */
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): {
    isValid: boolean;
    errors: string[];
    sanitizedData?: any;
    riskScore: number;
  } {
    const jsonString = JSON.stringify(data);
    const result = this.validateInput(jsonString, 'api', { sanitize: true });
    
    return {
      isValid: result.isValid,
      errors: result.errors,
      sanitizedData: result.sanitizedData ? JSON.parse(result.sanitizedData) : data,
      riskScore: result.riskScore
    };
  }

  /**
   * Backward compatibility method - check rate limit (synchronous)
   */
  checkRateLimitSync(identifier: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const record = this.rateLimitStore.get(identifier);

    if (!record || now > record.resetTime) {
      this.rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + this.config.rateLimiting.windowMs,
        violations: 0,
        lastReset: now
      });
      return { allowed: true };
    }

    if (record.count >= this.config.rateLimiting.maxRequests) {
      return { allowed: false, resetTime: record.resetTime };
    }

    record.count++;
    return { allowed: true };
  }

  /**
   * Backward compatibility method - validate origin
   */
  validateOrigin(origin: string): boolean {
    return this.config.allowedOrigins.includes(origin);
  }

  /**
   * Backward compatibility method - get security metrics
   */
  getSecurityMetrics(): {
    rateLimitEntries: number;
    averageRiskScore: number;
    blockedRequests: number;
  } {
    const rateLimitEntries = this.rateLimitStore.size;
    const blockedRequests = Array.from(this.rateLimitStore.values())
      .reduce((sum, record) => sum + record.violations, 0);

    return {
      rateLimitEntries,
      averageRiskScore: 0, // Would need to track this across validations
      blockedRequests,
    };
  }

  /**
   * Hash string for caching and rate limiting
   */
  hashString(input: string): string {
    if (!input) return '';
    
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// Export singleton instance
export const securityManager = UnifiedSecurityManager.getInstance();
export { UnifiedSecurityManager };