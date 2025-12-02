import { Robot, StrategyParams, BacktestSettings } from '../types';

interface SecurityConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
  endpoint?: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  encryption: {
    algorithm: string;
    keyRotationInterval: number;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

class SecurityManager {
  private static instance: SecurityManager;
  private config: SecurityConfig = {
    maxPayloadSize: 10 * 1024 * 1024, // 10MB
    allowedOrigins: ['https://quanforge.ai', 'http://localhost:3000'],
    rateLimiting: {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
    },
    encryption: {
      algorithm: 'AES-GCM',
      keyRotationInterval: 86400000, // 24 hours
    },
  };
  private rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  private constructor() {}

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager();
    }
    return SecurityManager.instance;
  }

  // Input sanitization and validation
  sanitizeAndValidate<T>(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    const errors: string[] = [];
    let sanitizedData = data;
    let riskScore = 0;

    try {
      // Check payload size
      const payloadSize = new Blob([JSON.stringify(data)]).size;
      if (payloadSize > this.config.maxPayloadSize) {
        errors.push(`Payload too large: ${payloadSize} bytes (max: ${this.config.maxPayloadSize})`);
        riskScore += 50;
      }

      // Basic structure validation
      if (!data || typeof data !== 'object') {
        errors.push('Invalid data structure');
        return { isValid: false, errors, riskScore: 100 };
      }

      // Type-specific validation
      switch (type) {
        case 'robot':
          const robotResult = this.validateRobotData(data);
          errors.push(...robotResult.errors);
          sanitizedData = robotResult.sanitizedData;
          riskScore += robotResult.riskScore;
          break;

        case 'strategy':
          const strategyResult = this.validateStrategyData(data);
          errors.push(...strategyResult.errors);
          sanitizedData = strategyResult.sanitizedData;
          riskScore += strategyResult.riskScore;
          break;

        case 'backtest':
          const backtestResult = this.validateBacktestData(data);
          errors.push(...backtestResult.errors);
          sanitizedData = backtestResult.sanitizedData;
          riskScore += backtestResult.riskScore;
          break;

        case 'user':
          const userResult = this.validateUserData(data);
          errors.push(...userResult.errors);
          sanitizedData = userResult.sanitizedData;
          riskScore += userResult.riskScore;
          break;
      }

      // XSS and injection prevention
      const xssResult = this.preventXSS(sanitizedData);
      if (xssResult.hasXSS) {
        errors.push('Potential XSS detected and removed');
        riskScore += 30;
        sanitizedData = xssResult.sanitizedData;
      }

      // SQL injection prevention
      const sqlResult = this.preventSQLInjection(sanitizedData);
      if (sqlResult.hasSQLInjection) {
        errors.push('Potential SQL injection detected and removed');
        riskScore += 40;
        sanitizedData = sqlResult.sanitizedData;
      }

    } catch (error) {
      errors.push(`Validation error: ${error}`);
      riskScore += 20;
    }

    return {
      isValid: errors.length === 0 && riskScore < 70,
      errors,
      sanitizedData,
      riskScore,
    };
  }

  private validateRobotData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;
    const sanitized: Partial<Robot> = {};

    // Name validation
    if (data.name) {
      const sanitizedName = this.sanitizeString(data.name);
      if (sanitizedName.length < 3 || sanitizedName.length > 100) {
        errors.push('Robot name must be between 3 and 100 characters');
        riskScore += 10;
      }
      sanitized.name = sanitizedName;
    } else {
      errors.push('Robot name is required');
      riskScore += 15;
    }

    // Description validation
    if (data.description) {
      const sanitizedDescription = this.sanitizeString(data.description);
      if (sanitizedDescription.length > 1000) {
        errors.push('Description too long (max 1000 characters)');
        riskScore += 5;
      }
      sanitized.description = sanitizedDescription;
    }

    // Code validation - critical for security
    if (data.code) {
      const codeValidation = this.validateMQL5Code(data.code);
      if (!codeValidation.isValid) {
        errors.push(...codeValidation.errors);
        riskScore += 25;
      }
      sanitized.code = codeValidation.sanitizedCode;
    } else {
      errors.push('Robot code is required');
      riskScore += 20;
    }

    // Strategy type validation
    if (data.strategy_type) {
      const validTypes = ['Trend', 'Scalping', 'Grid', 'Martingale', 'Custom'];
      if (!validTypes.includes(data.strategy_type)) {
        errors.push('Invalid strategy type');
        riskScore += 10;
      }
      sanitized.strategy_type = data.strategy_type;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

  private validateStrategyData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;
    const sanitized: Partial<StrategyParams> = {};

    // Timeframe validation
    if (data.timeframe) {
      const validTimeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
      if (!validTimeframes.includes(data.timeframe)) {
        errors.push('Invalid timeframe');
        riskScore += 10;
      }
      sanitized.timeframe = data.timeframe;
    }

    // Symbol validation
    if (data.symbol) {
      const sanitizedSymbol = this.sanitizeSymbol(data.symbol);
      if (!sanitizedSymbol) {
        errors.push('Invalid symbol format');
        riskScore += 10;
      }
      sanitized.symbol = sanitizedSymbol;
    }

    // Risk percent validation
    if (typeof data.riskPercent === 'number') {
      if (data.riskPercent < 0.01 || data.riskPercent > 100) {
        errors.push('Risk percent must be between 0.01 and 100');
        riskScore += 10;
      }
      sanitized.riskPercent = Math.max(0.01, Math.min(100, data.riskPercent));
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

  private validateBacktestData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;
    const sanitized: Partial<BacktestSettings> = {};

    // Initial deposit validation
    if (typeof data.initialDeposit === 'number') {
      if (data.initialDeposit < 100 || data.initialDeposit > 10000000) {
        errors.push('Initial deposit must be between $100 and $10,000,000');
        riskScore += 10;
      }
      sanitized.initialDeposit = Math.max(100, Math.min(10000000, data.initialDeposit));
    }

    // Days validation
    if (typeof data.days === 'number') {
      if (data.days < 1 || data.days > 365) {
        errors.push('Backtest duration must be between 1 and 365 days');
        riskScore += 10;
      }
      sanitized.days = Math.max(1, Math.min(365, data.days));
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

  private validateUserData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;
    const sanitized: any = {};

    // Email validation
    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Invalid email format');
        riskScore += 15;
      }
      sanitized.email = data.email.toLowerCase().trim();
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: sanitized,
      riskScore,
    };
  }

    private validateMQL5Code(code: string): { isValid: boolean; errors: string[]; sanitizedCode: string } {
     const errors: string[] = [];
     let sanitizedCode = code;

     // Check for dangerous functions with more comprehensive patterns
     const dangerousFunctions = [
       'SendFTP', 'SendMail', 'SendNotification', 'WebRequest',
       'ShellExecute', 'Import', 'CustomIndicator', 'WindowFind',
       'WindowScreenShot', 'GlobalVariableTemp', 'ResourceCreate',
       'WinExec', 'CreateProcess', 'System', 'Exec', 'Popen',
       'FileFindFirst', 'FileFindNext', 'FileFindClose', 'FileFlush',
       'ResourceSave', 'ResourceRead', 'GlobalVariablesFlush',
       'OrderSend', 'OrderClose', 'OrderModify', 'OrderDelete',
       'PositionOpen', 'PositionClose', 'PositionModify',
       'TerminalInfoInteger', 'TerminalInfoString', 'TerminalInfoDouble',
       'AccountInfo', 'AccountInfoInteger', 'AccountInfoDouble',
       'ChartApplyTemplate', 'ChartSave', 'ChartScreenShot',
       'Alert', 'Comment', 'Print', 'MessageBox', 'Sleep'
     ];

     for (const func of dangerousFunctions) {
       const regex = new RegExp(`\\b${func}\\s*\\(`, 'gi');
       if (regex.test(sanitizedCode)) {
         errors.push(`Dangerous function detected: ${func}`);
         // Remove or comment out dangerous functions
         sanitizedCode = sanitizedCode.replace(regex, `// REMOVED_${func}(`);
       }
     }

     // Check for file operations
     const fileOperations = ['FileOpen', 'FileWrite', 'FileRead', 'FileDelete', 'FileCopy', 'FileMove', 'FileIsExist'];
     for (const op of fileOperations) {
       const regex = new RegExp(`\\b${op}\\s*\\(`, 'gi');
       if (regex.test(sanitizedCode)) {
         errors.push(`File operation detected: ${op}`);
         sanitizedCode = sanitizedCode.replace(regex, `// REMOVED_${op}(`);
       }
     }

     // Check for network operations
     const networkOps = ['InternetOpen', 'InternetConnect', 'HttpOpenRequest', 'SocketCreate', 'SocketConnect', 'SocketSend', 'SocketReceive'];
     for (const op of networkOps) {
       const regex = new RegExp(`\\b${op}\\s*\\(`, 'gi');
       if (regex.test(sanitizedCode)) {
         errors.push(`Network operation detected: ${op}`);
         sanitizedCode = sanitizedCode.replace(regex, `// REMOVED_${op}(`);
       }
     }

     // Check for memory operations
     const memoryOps = ['memcpy', 'memset', 'malloc', 'free', 'GetMemory', 'FreeMemory'];
     for (const op of memoryOps) {
       const regex = new RegExp(`\\b${op}\\s*\\(`, 'gi');
       if (regex.test(sanitizedCode)) {
         errors.push(`Memory operation detected: ${op}`);
         sanitizedCode = sanitizedCode.replace(regex, `// REMOVED_${op}(`);
       }
     }

     // Check for registry operations
     const registryOps = ['RegOpenKey', 'RegCreateKey', 'RegSetValue', 'RegGetValue'];
     for (const op of registryOps) {
       const regex = new RegExp(`\\b${op}\\s*\\(`, 'gi');
       if (regex.test(sanitizedCode)) {
         errors.push(`Registry operation detected: ${op}`);
         sanitizedCode = sanitizedCode.replace(regex, `// REMOVED_${op}(`);
       }
     }

      // Basic syntax validation
      if (!sanitizedCode.includes('OnTick') && !sanitizedCode.includes('OnStart') && !sanitizedCode.includes('OnInit') && !sanitizedCode.includes('OnDeinit')) {
        errors.push('MQL5 code should contain standard functions like OnTick, OnInit, OnDeinit');
      }
      
      // Additional MQL5 security validations with more comprehensive patterns
      const mqlSecurityPatterns = [
        { pattern: /import\s+|^#import/gi, message: 'Import directives detected' },
        { pattern: /resourceadd/gi, message: 'Resource addition detected' },
        { pattern: /filefindfirst|filefindnext|filefindclose/gi, message: 'File system search functions detected' },
        { pattern: /terminalinfostring|terminalinfointeger|terminalinfodouble/gi, message: 'Terminal information access detected' },
        { pattern: /webrequest/gi, message: 'Web request functions detected' },
        { pattern: /resourcecreate/gi, message: 'Resource creation detected' },
        { pattern: /resourcefree/gi, message: 'Resource management detected' },
        { pattern: /sendftp/gi, message: 'FTP operations detected' },
        { pattern: /sendmail/gi, message: 'Email operations detected' },
        { pattern: /sendnotification/gi, message: 'Notification operations detected' },
        { pattern: /globalvariable/gi, message: 'Global variable operations detected' },
        { pattern: /window/gi, message: 'Window operations detected' },
        { pattern: /chart/gi, message: 'Chart operations detected' },
        { pattern: /trade/gi, message: 'Direct trade operations detected' },
        { pattern: /order/gi, message: 'Order operations detected' },
        { pattern: /alert\(/gi, message: 'Alert function detected' },
        { pattern: /comment\(/gi, message: 'Comment function detected' },
        { pattern: /print\(/gi, message: 'Print function detected' },
        { pattern: /printf\(/gi, message: 'Printf function detected' },
        { pattern: /eval\(/gi, message: 'Eval-like function detected' },
        { pattern: /exec\(/gi, message: 'Exec function detected' },
        { pattern: /system\(/gi, message: 'System function detected' },
        { pattern: /shell/i, message: 'Shell command detected' },
        { pattern: /process/i, message: 'Process command detected' },
        { pattern: /command/i, message: 'Command detected' },
        { pattern: /system\./gi, message: 'System access detected' },
        { pattern: /process\./gi, message: 'Process access detected' },
      ];
      
      for (const { pattern, message } of mqlSecurityPatterns) {
        if (pattern.test(sanitizedCode)) {
          errors.push(message);
          // Remove dangerous patterns
          sanitizedCode = sanitizedCode.replace(pattern, `// SECURITY_BLOCKED: ${message}`);
        }
      }
      
      // Check for potentially dangerous patterns
      const dangerousPatterns = [
        // String concatenation that might lead to code injection
        { pattern: /string\.concat|StringConcatenate/gi, message: 'String concatenation function detected' },
        // Potentially unsafe array operations
        { pattern: /arraycopy|ArrayCopy/gi, message: 'Array copy function detected' },
        // Potentially unsafe memory access
        { pattern: /char.*\[|uchar.*\[|int.*\[|long.*\[/gi, message: 'Direct memory access detected' },
        // Potentially unsafe casting
        { pattern: /char\(|uchar\(|int\(|long\(/gi, message: 'Direct casting detected' },
      ];
      
      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(sanitizedCode)) {
          errors.push(message);
          sanitizedCode = sanitizedCode.replace(pattern, `// SECURITY_CAUTION: ${message}`);
        }
      }

// Check for obfuscated code patterns
       const obfuscatedPatterns = [
         /[^a-zA-Z0-9\s\(\)\[\]\{\}\.\,\;\:\+\-\*\/\=\>\<\!\&\|\^\~\%]+/g, // Non-alphanumeric characters
         /0x[0-9a-fA-F]+/g, // Hex numbers
         /\\u[0-9a-fA-F]{4}/g, // Unicode escapes
         /\\x[0-9a-fA-F]{2}/g, // Hex escapes
         /\+\s*\+\s*\+\s*\+\s*\+/g, // Multiple consecutive operators (obfuscation pattern)
         /String\.Concatenate|\.concat/gi, // String concatenation for obfuscation
       ];
       
       for (const pattern of obfuscatedPatterns) {
         const matches = sanitizedCode.match(pattern);
         if (matches && matches.length > 5) { // Allow some legitimate uses
           errors.push('Code contains potentially obfuscated content');
           break;
         }
       }
       
       // Additional MQL5-specific validations
       const mql5SecurityChecks = [
         // Check for potential DLL imports that could be dangerous
         { pattern: /#import\s+["']([^"']+\.(dll|exe|sys))["']/gi, message: 'Potential unsafe DLL import detected' },
         // Check for file operations that could be dangerous
         { pattern: /FileOpenHandle|FileWrite|FileRead|FileDelete|FileMove|FileCopy/gi, message: 'Potential file operation detected' },
         // Check for registry operations
         { pattern: /RegOpenKey|RegSetValue|RegGetValue/gi, message: 'Potential registry operation detected' },
         // Check for process creation
         { pattern: /ShellExecute|WinExec|CreateProcess/gi, message: 'Potential process creation detected' },
         // Check for network operations
         { pattern: /SocketCreate|SocketConnect|WebRequest/gi, message: 'Potential network operation detected' },
         // Check for self-modifying code patterns
         { pattern: /WriteString|WriteInteger|WriteDouble/gi, message: 'Potential self-modifying code detected' },
       ];
       
       for (const check of mql5SecurityChecks) {
         if (check.pattern.test(sanitizedCode)) {
           errors.push(check.message);
           sanitizedCode = sanitizedCode.replace(check.pattern, `// SECURITY_BLOCKED: ${check.message}`);
         }
       }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedCode,
      };
   }

   private preventXSS(data: any): { hasXSS: boolean; sanitizedData: any } {
     let hasXSS = false;
     const sanitized = Array.isArray(data) ? [...data] : { ...data };

     const xssPatterns = [
       /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
       /javascript:/gi,
       /on\w+\s*=/gi,
       /<iframe\b[^>]*>/gi,
       /<object\b[^>]*>/gi,
       /<embed\b[^>]*>/gi,
       /<link\b[^>]*>/gi,
       /<meta\b[^>]*>/gi,
       /<form\b[^>]*>/gi,
       /vbscript:/gi,
       /data:/gi,
       /about:/gi,
       /document\.cookie/gi,
       /window\.location/gi,
       /document\.write/gi,
       /eval\(/gi,
       /expression\(/gi,
       /alert\(/gi,
       /confirm\(/gi,
       /prompt\(/gi,
       /decodeURIComponent/gi,
       /escape\(/gi,
       /unescape\(/gi,
     ];

    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        let sanitized = value;
        for (const pattern of xssPatterns) {
          if (pattern.test(sanitized)) {
            hasXSS = true;
            sanitized = sanitized.replace(pattern, '');
          }
        }
        return sanitized;
      } else if (typeof value === 'object' && value !== null) {
        const sanitizedObj = Array.isArray(value) ? [] : {};
        for (const [key, val] of Object.entries(value)) {
          (sanitizedObj as any)[key] = sanitizeValue(val);
        }
        return sanitizedObj;
      }
      return value;
    };

    const sanitizedData = sanitizeValue(sanitized);
    return { hasXSS, sanitizedData };
  }

  private preventSQLInjection(data: any): { hasSQLInjection: boolean; sanitizedData: any } {
    let hasSQLInjection = false;
    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /(--|\*\/|\/\*)/g,
      /(\bOR\b.*=.*\bOR\b)/gi,
      /(\bAND\b.*=.*\bAND\b)/gi,
      /('.*'|".*")/g,
    ];

    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        let sanitized = value;
        for (const pattern of sqlPatterns) {
          if (pattern.test(sanitized)) {
            hasSQLInjection = true;
            sanitized = sanitized.replace(pattern, '');
          }
        }
        return sanitized;
      } else if (typeof value === 'object' && value !== null) {
        const sanitizedObj = Array.isArray(value) ? [] : {};
        for (const [key, val] of Object.entries(value)) {
          (sanitizedObj as any)[key] = sanitizeValue(val);
        }
        return sanitizedObj;
      }
      return value;
    };

    const sanitizedData = sanitizeValue(sanitized);
    return { hasSQLInjection, sanitizedData };
  }

  private sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .substring(0, 1000); // Prevent extremely long strings
  }

  private sanitizeSymbol(symbol: string): string {
    // Allow common forex symbols and crypto pairs
    const symbolRegex = /^[A-Z]{3,6}[\/]?[A-Z]{3,6}$/;
    const cleanSymbol = symbol.replace(/[^A-Z\/]/g, '').toUpperCase();
    return symbolRegex.test(cleanSymbol) ? cleanSymbol : '';
  }

  // Rate limiting
  checkRateLimit(identifier: string): { allowed: boolean; resetTime?: number } {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.config.rateLimiting.windowMs,
      });
      return { allowed: true };
    }

    if (record.count >= this.config.rateLimiting.maxRequests) {
      return { allowed: false, resetTime: record.resetTime };
    }

    record.count++;
    return { allowed: true };
  }

  // Origin validation
  validateOrigin(origin: string): boolean {
    return this.config.allowedOrigins.includes(origin);
  }

// Validate API key format
    validateAPIKey(key: string): boolean {
      if (!key) return false;
      
      // Basic format validation for common API key patterns
      const patterns = [
        /^[a-zA-Z0-9_-]{20,}$/,  // Generic API key format
        /^sk-[a-zA-Z0-9_-]{20,}$/,  // OpenAI-style
        /^AI[0-9a-zA-Z]{20,}$/,  // Google-style
        /^[\w-]{20,40}$/,  // General API key format
        /^[\w]{32,64}$/,  // Common API key lengths
        /^[\w]{20,}$/, // General format
      ];
      
      const isValid = patterns.some(pattern => pattern.test(key));
      
      if (!isValid) return false;
      
      // Additional checks for common placeholder patterns
      const lowerKey = key.toLowerCase();
      const placeholders = ['your-', 'api-', 'key-', 'test', 'demo', 'sample', '123', 'xxx'];
      
      return !placeholders.some(placeholder => lowerKey.includes(placeholder));
    }
   
   // Get security metrics
   getSecurityMetrics(): {
     rateLimitEntries: number;
     averageRiskScore: number;
     blockedRequests: number;
   } {
    const rateLimitEntries = this.rateLimitMap.size;
    const blockedRequests = Array.from(this.rateLimitMap.values())
      .reduce((sum, record) => sum + Math.max(0, record.count - this.config.rateLimiting.maxRequests), 0);

    return {
      rateLimitEntries,
      averageRiskScore: 0, // Would need to track this across validations
      blockedRequests,
    };
  }

  // Web Application Firewall (WAF) patterns
  detectWAFPatterns(request: Request): { isMalicious: boolean; threats: string[]; riskScore: number } {
    const threats: string[] = [];
    let riskScore = 0;

    // Get request details
    const url = request.url;
    const method = request.method;
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const origin = request.headers.get('origin') || '';

    // Common attack patterns
    const wafPatterns = [
      // SQL Injection patterns
      {
        name: 'SQL Injection',
        patterns: [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
          /(--|\*\/|\/\*)/g,
          /(\bOR\b.*=.*\bOR\b)/gi,
          /(\bAND\b.*=.*\bAND\b)/gi,
          /('.*'|".*")/g,
          /waitfor\s+delay/gi,
          /benchmark\s*\(/gi,
          /sleep\s*\(/gi,
          /pg_sleep\s*\(/gi,
          /dbms_pipe\.receive_message/gi
        ],
        riskScore: 80
      },
      // XSS patterns
      {
        name: 'Cross-Site Scripting',
        patterns: [
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          /javascript:/gi,
          /on\w+\s*=/gi,
          /<iframe\b[^>]*>/gi,
          /<object\b[^>]*>/gi,
          /<embed\b[^>]*>/gi,
          /vbscript:/gi,
          /data:text\/html/gi,
          /expression\(/gi,
          /@import/gi,
          /binding:\s*source/gi
        ],
        riskScore: 70
      },
      // Path Traversal
      {
        name: 'Path Traversal',
        patterns: [
          /\.\.\//g,
          /\.\.\\/g,
          /%2e%2e%2f/gi,
          /%2e%2e\\/gi,
          /etc\/passwd/gi,
          /windows\/system32/gi,
          /\/proc\//gi,
          /\/sys\//gi
        ],
        riskScore: 75
      },
      // Command Injection
      {
        name: 'Command Injection',
        patterns: [
          /;\s*(rm|del|format|fdisk|mkfs)/gi,
          /\|\s*(nc|netcat|telnet|wget|curl)/gi,
          /&&\s*(rm|del|format|shutdown|reboot)/gi,
          /\$\(/g,
          /`[^`]*`/g,
          /\${[^}]*}/g,
          /eval\s*\(/gi,
          /exec\s*\(/gi,
          /system\s*\(/gi
        ],
        riskScore: 90
      },
      // LDAP Injection
      {
        name: 'LDAP Injection',
        patterns: [
          /\*\)/g,
          /\)\(/g,
          /\*\(/g,
          /&\(/g,
          /\|\(/g,
          /!\(/g,
          /\/\*/g,
          /\*\//g
        ],
        riskScore: 65
      },
      // NoSQL Injection
      {
        name: 'NoSQL Injection',
        patterns: [
          /\$where/gi,
          /\$ne/gi,
          /\$gt/gi,
          /\$lt/gi,
          /\$in/gi,
          /\$nin/gi,
          /\$regex/gi,
          /\{.*\$.*\}/gi
        ],
        riskScore: 70
      },
      // XXE (XML External Entity)
      {
        name: 'XXE Attack',
        patterns: [
          /<!DOCTYPE/gi,
          /<!ENTITY/gi,
          /&[a-zA-Z]+;/g,
          /<\?xml/gi,
          /SYSTEM\s+"/gi,
          /PUBLIC\s+"/gi
        ],
        riskScore: 85
      },
      // SSRF (Server-Side Request Forgery)
      {
        name: 'SSRF Attack',
        patterns: [
          /localhost/gi,
          /127\.0\.0\.1/gi,
          /0x7f000001/gi,
          /2130706433/gi,
          /169\.254\./gi,
          /192\.168\./gi,
          /10\./gi,
          /172\.1[6-9]\./gi,
          /172\.2[0-9]\./gi,
          /172\.3[0-1]\./gi,
          /::1/gi,
          /metadata/gi
        ],
        riskScore: 80
      },
      // File Inclusion
      {
        name: 'File Inclusion',
        patterns: [
          /php:\/\/filter/gi,
          /php:\/\/input/gi,
          /data:\/\//gi,
          /expect:\/\//gi,
          /file:\/\//gi,
          /zip:\/\//gi,
          /phar:\/\//gi,
          /ssh2\.shell/gi,
          /ssh2\.exec/gi
        ],
        riskScore: 85
      },
      // Buffer Overflow
      {
        name: 'Buffer Overflow',
        patterns: [
          /A{1000,}/g,
          /%41{100,}/gi,
          /0x41{100,}/gi,
          /\x90{100,}/gi,
          /\x90{50,}\x31\xc0/gi
        ],
        riskScore: 75
      }
    ];

    // Check URL and parameters
    const urlToCheck = url + referer + origin;
    
    wafPatterns.forEach(threat => {
      threat.patterns.forEach(pattern => {
        if (pattern.test(urlToCheck)) {
          threats.push(threat.name);
          riskScore += threat.riskScore;
        }
      });
    });

    // Check User-Agent for suspicious patterns
    const suspiciousUAPatterns = [
      /sqlmap/gi,
      /nikto/gi,
      /nmap/gi,
      /masscan/gi,
      /dirb/gi,
      /gobuster/gi,
      /wfuzz/gi,
      /burp/gi,
      /owasp/gi,
      /scanner/gi,
      /bot/gi,
      /crawler/gi,
      /spider/gi
    ];

    suspiciousUAPatterns.forEach(pattern => {
      if (pattern.test(userAgent)) {
        threats.push('Suspicious User-Agent');
        riskScore += 50;
      }
    });

    // Check for HTTP method abuse
    const dangerousMethods = ['TRACE', 'CONNECT', 'TRACK', 'DEBUG'];
    if (dangerousMethods.includes(method.toUpperCase())) {
      threats.push('Dangerous HTTP Method');
      riskScore += 60;
    }

     // Check for unusual header patterns
     // Use a safer approach for getting header entries
     try {
       // In some environments, we might need to iterate differently
       const headerNames = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip', 'x-remote-ip', 'x-remote-addr'];
       headerNames.forEach(name => {
         const value = request.headers.get(name);
         if (value) {
           // Check for header injection
           if (/\r|\n/.test(value)) {
             threats.push('Header Injection');
             riskScore += 70;
           }
           
           // Check for suspicious headers
           if (this.isPrivateIP(value)) {
             threats.push('IP Spoofing Attempt');
             riskScore += 65;
           }
         }
       });
     } catch (e) {
       // Fallback for environments where headers.entries() is not available
       console.warn('Could not check headers for threats:', e);
     }

    // Content-Length abuse
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > this.config.maxPayloadSize) {
      threats.push('Oversized Payload');
      riskScore += 40;
    }

     return {
       isMalicious: riskScore > 50,
       threats: Array.from(new Set(threats)), // Remove duplicates
       riskScore: Math.min(riskScore, 100)
     };
   }

  // Check if IP is private/internal
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

  // Advanced API key rotation
  rotateAPIKeys(): { oldKey: string; newKey: string; expiresAt: number } {
    const oldKey = this.getCurrentAPIKey();
    const newKey = this.generateSecureAPIKey();
    const expiresAt = Date.now() + this.config.encryption.keyRotationInterval;

    // Store new key with expiration
    this.storeAPIKey(newKey, expiresAt);

    return {
      oldKey,
      newKey,
      expiresAt
    };
  }

  private getCurrentAPIKey(): string {
    // Retrieve current API key from secure storage
    return localStorage.getItem('current_api_key') || '';
  }

  private generateSecureAPIKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private storeAPIKey(key: string, expiresAt: number): void {
    localStorage.setItem('current_api_key', key);
    localStorage.setItem('api_key_expires', expiresAt.toString());
  }

  // Content Security Policy monitoring
  monitorCSPViolations(): void {
    // Listen for CSP violation reports
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
      
      // Store violation for analysis
      this.storeCSPViolation(violation);
      
      // Trigger alert if high severity
      if (this.isHighSeverityViolation(violation)) {
        this.triggerSecurityAlert('CSP Violation', violation);
      }
    });
  }

  private storeCSPViolation(violation: any): void {
    const violations = JSON.parse(localStorage.getItem('csp_violations') || '[]');
    violations.push(violation);
    
    // Keep only last 100 violations
    if (violations.length > 100) {
      violations.splice(0, violations.length - 100);
    }
    
    localStorage.setItem('csp_violations', JSON.stringify(violations));
  }

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

  private triggerSecurityAlert(type: string, data: any): void {
    const alert = {
      type,
      data,
      timestamp: Date.now(),
      severity: 'high',
      url: window.location.href
    };

    console.error('🚨 Security Alert:', alert);
    
    // In production, send to security monitoring service
    if (process.env["NODE_ENV"] === 'production' && this.config.endpoint) {
      this.sendSecurityAlert(alert);
    }
  }

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

  // Enhanced rate limiting with adaptive thresholds
  checkAdaptiveRateLimit(identifier: string, userTier: string = 'basic'): { 
    allowed: boolean; 
    resetTime?: number; 
    remainingRequests?: number;
  } {
    const now = Date.now();
    const record = this.rateLimitMap.get(identifier);

    // Adaptive limits based on user tier
    const tierLimits = {
      basic: { maxRequests: 100, windowMs: 60000 },
      premium: { maxRequests: 500, windowMs: 60000 },
      enterprise: { maxRequests: 2000, windowMs: 60000 }
    };

    const limits = tierLimits[userTier as keyof typeof tierLimits] || tierLimits.basic;

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + limits.windowMs,
      });
      return { 
        allowed: true, 
        remainingRequests: limits.maxRequests - 1 
      };
    }

    if (record.count >= limits.maxRequests) {
      return { 
        allowed: false, 
        resetTime: record.resetTime,
        remainingRequests: 0
      };
    }

    record.count++;
    return { 
      allowed: true, 
      remainingRequests: limits.maxRequests - record.count 
    };
  }

  // Get comprehensive security statistics
  getComprehensiveSecurityStats(): {
    wafStats: {
      totalRequests: number;
      blockedRequests: number;
      topThreats: Array<{ threat: string; count: number }>;
    };
    cspStats: {
      totalViolations: number;
      highSeverityViolations: number;
      topViolations: Array<{ directive: string; count: number }>;
    };
    rateLimitStats: {
      activeEntries: number;
      blockedRequests: number;
      topBlockedIPs: Array<{ ip: string; count: number }>;
    };
  } {
    // WAF Statistics
    const wafStats = {
      totalRequests: parseInt(localStorage.getItem('waf_total_requests') || '0'),
      blockedRequests: parseInt(localStorage.getItem('waf_blocked_requests') || '0'),
      topThreats: JSON.parse(localStorage.getItem('waf_top_threats') || '[]')
    };

    // CSP Statistics
    const cspViolations = JSON.parse(localStorage.getItem('csp_violations') || '[]');
    const highSeverityViolations = cspViolations.filter((v: any) => this.isHighSeverityViolation(v));
    
    const directiveCounts = cspViolations.reduce((acc: any, violation: any) => {
      const directive = violation.effectiveDirective;
      acc[directive] = (acc[directive] || 0) + 1;
      return acc;
    }, {});

    const cspStats = {
      totalViolations: cspViolations.length,
      highSeverityViolations: highSeverityViolations.length,
      topViolations: Object.entries(directiveCounts)
        .map(([directive, count]) => ({ directive, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    };

    // Rate Limit Statistics
    const rateLimitEntries = Array.from(this.rateLimitMap.entries());
    const blockedRequests = rateLimitEntries.reduce((sum, [_, record]) => 
      sum + Math.max(0, record.count - this.config.rateLimiting.maxRequests), 0);

    const rateLimitStats = {
      activeEntries: this.rateLimitMap.size,
      blockedRequests,
      topBlockedIPs: [] // Would need IP tracking implementation
    };

    return {
      wafStats,
      cspStats,
      rateLimitStats
    };
  }
}

export const securityManager = SecurityManager.getInstance();