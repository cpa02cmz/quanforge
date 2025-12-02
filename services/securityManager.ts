import { Robot, StrategyParams, BacktestSettings } from '../types';

interface SecurityConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
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
      ];
      
      for (const pattern of obfuscatedPatterns) {
        const matches = sanitizedCode.match(pattern);
        if (matches && matches.length > 5) { // Allow some legitimate uses
          errors.push('Code contains potentially obfuscated content');
          break;
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
     ];
     
     return patterns.some(pattern => pattern.test(key));
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
}

export const securityManager = SecurityManager.getInstance();