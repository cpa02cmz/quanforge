import DOMPurify from 'dompurify';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

export class SecurityValidator {
  private maxPayloadSize = 5 * 1024 * 1024; // 5MB

  // Main validation orchestrator
  sanitizeAndValidate(data: any, type: 'robot' | 'strategy' | 'backtest' | 'user'): ValidationResult {
    const errors: string[] = [];
    let sanitizedData = data;
    let riskScore = 0;

    try {
      // Check payload size
      const payloadSize = new Blob([JSON.stringify(data)]).size;
      if (payloadSize > this.maxPayloadSize) {
        errors.push(`Payload too large: ${payloadSize} bytes (max: ${this.maxPayloadSize})`);
        riskScore += 50;
      }

      // Basic structure validation
      if (!data || typeof data !== 'object') {
        errors.push('Invalid data structure: must be an object');
        return { isValid: false, errors, riskScore: 100 };
      }

      // Type-specific validation
      switch (type) {
        case 'robot':
          return this.validateRobotData(data);
        case 'strategy':
          return this.validateStrategyData(data);
        case 'backtest':
          return this.validateBacktestData(data);
        case 'user':
          return this.validateUserData(data);
        default:
          errors.push('Unknown validation type');
          return { isValid: false, errors, riskScore: 25 };
      }

      // XSS Prevention
      const xssResult = this.preventXSS(sanitizedData);
      if (xssResult.hasXSS) {
        errors.push('XSS attack detected and blocked');
        riskScore += 40;
        sanitizedData = xssResult.sanitizedData;
      }

      // SQL Injection Prevention
      const sqlResult = this.preventSQLInjection(sanitizedData);
      if (sqlResult.hasSQLInjection) {
        errors.push('SQL Injection attempt detected and blocked');
        riskScore += 45;
        sanitizedData = sqlResult.sanitizedData;
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedData,
        riskScore
      };

    } catch (error) {
      console.error('Security validation error:', error);
      return {
        isValid: false,
        errors: ['Validation process failed'],
        riskScore: 100
      };
    }
  }

  // Robot-specific validation
  private validateRobotData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 10;

    // Check for prototype pollution
    if (this.isPrototypePollution(data)) {
      errors.push('Prototype pollution detected');
      riskScore += 50;
    }

    // Name validation
    if (data.name) {
      const sanitizedName = this.sanitizeString(data.name);
      data.name = sanitizedName;
      
      if (sanitizedName.length < 3 || sanitizedName.length > 100) {
        errors.push('Robot name must be between 3 and 100 characters');
        riskScore += 15;
      }
    }

    // Description validation
    if (data.description) {
      const sanitizedDescription = this.sanitizeString(data.description);
      data.description = sanitizedDescription;
      
      if (sanitizedDescription.length > 1000) {
        errors.push('Description must be less than 1000 characters');
        riskScore += 10;
      }
    }

    // Code validation
    if (data.code) {
      const codeValidation = this.validateMQL5Code(data.code);
      if (!codeValidation.isValid) {
        errors.push(...codeValidation.errors);
        riskScore += 30;
        data.code = codeValidation.sanitizedCode;
      }
    }

    // Strategy type validation
    if (data.strategy_type) {
      const validTypes = ['trend', 'range', 'scalping', 'swing', 'position', 'custom'];
      if (!validTypes.includes(data.strategy_type)) {
        errors.push('Invalid strategy type');
        riskScore += 20;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: data,
      riskScore
    };
  }

  // Strategy parameter validation
  private validateStrategyData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 5;

    // Timeframe validation
    if (data.timeframe) {
      const validTimeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'];
      if (!validTimeframes.includes(data.timeframe)) {
        errors.push('Invalid timeframe');
        riskScore += 10;
      }
    }

    // Symbol validation
    if (data.symbol) {
      const sanitizedSymbol = this.sanitizeSymbol(data.symbol);
      if (!sanitizedSymbol) {
        errors.push('Invalid symbol format');
        riskScore += 10;
      } else {
        data.symbol = sanitizedSymbol;
      }
    }

    // Risk percentage validation
    if (typeof data.riskPercent === 'number') {
      if (data.riskPercent < 0.01 || data.riskPercent > 100) {
        errors.push('Risk percentage must be between 0.01 and 100');
        riskScore += 15;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: data,
      riskScore
    };
  }

  // Backtest settings validation
  private validateBacktestData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 5;

    // Initial deposit validation
    if (typeof data.initialDeposit === 'number') {
      if (data.initialDeposit < 100 || data.initialDeposit > 10000000) {
        errors.push('Initial deposit must be between 100 and 10,000,000');
        riskScore += 10;
      }
    }

    // Days validation
    if (typeof data.days === 'number') {
      if (data.days < 1 || data.days > 365) {
        errors.push('Backtest period must be between 1 and 365 days');
        riskScore += 10;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: data,
      riskScore
    };
  }

  // User data validation
  private validateUserData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 5;

    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Invalid email format');
        riskScore += 15;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: data,
      riskScore
    };
  }

  // MQL5 code validation with security checks
  private validateMQL5Code(code: string): { isValid: boolean; errors: string[]; sanitizedCode: string } {
    const errors: string[] = [];
    let sanitizedCode = code;

    // Remove potentially dangerous patterns
    const dangerousFunctions = [
      'ShellExecute', 'WinExec', 'system', 'exec', 'CreateProcess', 
      'WriteProcessMemory', 'VirtualAlloc', 'SetWindowsHookEx'
    ];

    for (const func of dangerousFunctions) {
      const regex = new RegExp(`\\b${func}\\s*\\(`, 'gi');
      if (regex.test(sanitizedCode)) {
        errors.push(`Dangerous function ${func} detected`);
        sanitizedCode = sanitizedCode.replace(regex, `// REMOVED_${func}(`);
      }
    }

    // Check for file operations
    const fileOperations = [
      'FileOpen', 'FileWrite', 'FileDelete', 'FileCopy', 'FileMove'
    ];

    for (const op of fileOperations) {
      const regex = new RegExp(`\\b${op}\\s*\\(`, 'gi');
      if (regex.test(sanitizedCode)) {
        errors.push(`File operation ${op} detected`);
        sanitizedCode = sanitizedCode.replace(regex, `// RESTRICTED_${op}(`);
      }
    }

    // Check for network operations
    const networkOps = [
      'WebRequest', 'SocketCreate', 'SocketConnect', 'SocketSend'
    ];

    for (const op of networkOps) {
      const regex = new RegExp(`\\b${op}\\s*\\(`, 'gi');
      if (regex.test(sanitizedCode)) {
        errors.push(`Network operation ${op} detected`);
        sanitizedCode = sanitizedCode.replace(regex, `// RESTRICTED_${op}(`);
      }
    }

    // Check for memory operations
    const memoryOps = [
      'memcpy', 'memset', 'malloc', 'free'
    ];

    for (const op of memoryOps) {
      const regex = new RegExp(`\\b${op}\\s*\\(`, 'gi');
      if (regex.test(sanitizedCode)) {
        errors.push(`Memory operation ${op} detected`);
        sanitizedCode = sanitizedCode.replace(regex, `// RESTRICTED_${op}(`);
      }
    }

    // Check for registry operations
    const registryOps = [
      'RegOpenKey', 'RegCreateKey', 'RegSetValue', 'RegDeleteValue'
    ];

    for (const op of registryOps) {
      const regex = new RegExp(`\\b${op}\\s*\\(`, 'gi');
      if (regex.test(sanitizedCode)) {
        errors.push(`Registry operation ${op} detected`);
        sanitizedCode = sanitizedCode.replace(regex, `// RESTRICTED_${op}(`);
      }
    }

    // Validate required functions are present
    if (!sanitizedCode.includes('OnTick') && !sanitizedCode.includes('OnStart') && 
        !sanitizedCode.includes('OnInit') && !sanitizedCode.includes('OnDeinit')) {
      errors.push('MQL5 code must include at least one required function (OnTick, OnInit, OnStart, or OnDeinit)');
    }

    // Check for suspicious patterns
    const mqlSecurityPatterns = [
      { pattern: /\beval\s*\(/gi, message: 'eval() function detected' },
      { pattern: /\bloadlibrary\s*\(/gi, message: 'LoadLibrary function detected' },
      { pattern: /\bgetprocaddress\s*\(/gi, message: 'GetProcAddress function detected' },
      { pattern: /\bvirtualalloc\s*\(/gi, message: 'VirtualAlloc function detected' },
      { pattern: /\bcreatefile\s*\(/gi, message: 'CreateFile function detected' },
    ];

    for (const { pattern, message } of mqlSecurityPatterns) {
      if (pattern.test(sanitizedCode)) {
        errors.push(message);
        // Remove the dangerous pattern
        sanitizedCode = sanitizedCode.replace(pattern, '/* REMOVED */ ');
      }
    }

    // Additional dangerous patterns
    const dangerousPatterns = [
      { pattern: /document\.write/gi, message: 'document.write detected' },
      { pattern: /innerHTML\s*=/gi, message: 'innerHTML assignment detected' },
      { pattern: /outerHTML\s*=/gi, message: 'outerHTML assignment detected' },
      { pattern: /setTimeout\s*\(/gi, message: 'setTimeout function detected' },
      { pattern: /setInterval\s*\(/gi, message: 'setInterval function detected' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(sanitizedCode)) {
        errors.push(message);
        sanitizedCode = sanitizedCode.replace(pattern, '/* RESTRICTED */ ');
      }
    }

    // Check for obfuscation patterns
    const obfuscatedPatterns = [
      /\\u[0-9a-fA-F]{4}/g,  // Unicode escapes
      /String\.fromCharCode/gi,
      /\\x[0-9a-fA-F]{2}/g,  // Hex escapes
    ];

    for (const pattern of obfuscatedPatterns) {
      const matches = sanitizedCode.match(pattern);
      if (matches && matches.length > 5) { // Allow some legitimate uses
        errors.push('Excessive obfuscation detected');
        break;
      }
    }

    // MQL5-specific security checks
    const mql5SecurityChecks = [
      { pattern: /#import\s+["']?user32\.dll["']?/gi, message: 'Direct user32.dll import detected' },
      { pattern: /#import\s+["']?kernel32\.dll["']?/gi, message: 'Direct kernel32.dll import detected' },
      { pattern: /#import\s+["']?shell32\.dll["']?/gi, message: 'Direct shell32.dll import detected' },
    ];

    for (const check of mql5SecurityChecks) {
      if (check.pattern.test(sanitizedCode)) {
        errors.push(check.message);
        sanitizedCode = sanitizedCode.replace(check.pattern, '/* REMOVED IMPORT */');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedCode
    };
  }

  // XSS Prevention
  private preventXSS(data: any): { hasXSS: boolean; sanitizedData: any } {
    let hasXSS = false;

    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*src[^>]*javascript:/gi,
      /<\s*script/gi,
      /<\s*object/gi,
      /<\s*embed/gi,
      /<\s*link/gi,
      /<\s*meta/gi,
    ];

    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        let sanitized = obj;
        for (const pattern of xssPatterns) {
          if (pattern.test(sanitized)) {
            hasXSS = true;
            sanitized = sanitized.replace(pattern, '');
          }
        }
        return sanitized;
      } else if (Array.isArray(obj)) {
        return obj.map(sanitize);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, val] of Object.entries(obj)) {
          sanitized[key] = sanitize(val);
        }
        return sanitized;
      }
      return obj;
    };

    return {
      hasXSS,
      sanitizedData: sanitize(data)
    };
  }

  // SQL Injection Prevention
  private preventSQLInjection(data: any): { hasSQLInjection: boolean; sanitizedData: any } {
    let hasSQLInjection = false;

    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
      /(--|\#|\/\*)/gi,
      /(\b(or|and)\s+\d+\s*=\s*\d+)/gi,
      /(\b(or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/gi,
      /(\bxp_cmdshell\b)/gi,
      /(\bsp_executesql\b)/gi,
      /(\bwaitfor\s+delay\b)/gi,
    ];

    const sanitize = (obj: any): any => {
      if (typeof obj === 'string') {
        let sanitized = obj;
        for (const pattern of sqlPatterns) {
          if (pattern.test(sanitized)) {
            hasSQLInjection = true;
            sanitized = sanitized.replace(pattern, '');
          }
        }
        return sanitized;
      } else if (Array.isArray(obj)) {
        return obj.map(sanitize);
      } else if (obj && typeof obj === 'object') {
        const sanitized: any = {};
        for (const [key, val] of Object.entries(obj)) {
          sanitized[key] = sanitize(val);
        }
        return sanitized;
      }
      return obj;
    };

    return {
      hasSQLInjection,
      sanitizedData: sanitize(data)
    };
  }

  // Utility functions
  private sanitizeString(input: string): string {
    return DOMPurify.sanitize(input);
  }

  private sanitizeSymbol(symbol: string): string {
    // Remove dangerous characters and validate format
    const sanitized = symbol.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return /^[A-Z]{6}$/.test(sanitized) ? sanitized : '';
  }

  private isPrototypePollution(obj: any): boolean {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    return dangerousKeys.some(key => key in obj);
  }
}