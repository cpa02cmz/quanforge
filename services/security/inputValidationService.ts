import DOMPurify from 'dompurify';

export interface ValidationConfig {
  maxPayloadSize: number;
  allowedSymbols: string[];
  mql5AllowedFunctions: string[];
  dangerousPatterns: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

export class InputValidationService {
  private config: ValidationConfig;

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = {
      maxPayloadSize: 5 * 1024 * 1024,
      allowedSymbols: [
        'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD',
        'EURGBP', 'EURJPY', 'GBPJPY', 'EURCHF', 'EURAUD', 'GBPCHF', 'GBPAUD',
        'BTCUSD', 'ETHUSD', 'XRPUSD', 'LTCUSD', 'ADAUSD', 'DOTUSD'
      ],
      mql5AllowedFunctions: [
        'OrderSend', 'OrderModify', 'OrderClose', 'OrderSelect', 'OrdersTotal',
        'SymbolInfoDouble', 'SymbolInfoInteger', 'SymbolInfoString',
        'AccountInfoDouble', 'AccountInfoInteger', 'AccountInfoString',
        'Trade', 'Positions', 'History', 'MQL5InfoInteger', 'MQL5InfoString',
        'TerminalInfoInteger', 'TerminalInfoDouble', 'TerminalInfoString'
      ],
      dangerousPatterns: [
        '\\b#include\\b', '\\b#import\\b', '\\b#include\\b', '\\b#define\\b',
        '\\b#property\\b', '\\bstruct\\s*\\w+\\s*\\{', '\\bclass\\s*\\w+\\s*\\{',
        '\\btemplate\\b', '\\boperator\\s*\\w+', '\\bfriend\\s+class',
        '\\bvirtual\\s+\\w+', '\\boverride\\s+\\w+', '\\bstatic\\s+\\w+',
        '\\bextern\\s+\\w+', '\\b__asm__', '\\b__builtin_', '\\b__attribute__'
      ],
      ...config
    };
  }

  validateRobotData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    // Basic structure validation
    if (!data || typeof data !== 'object') {
      errors.push('Invalid robot data structure');
      return { isValid: false, errors, riskScore: 100 };
    }

    // Name validation
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Robot name is required and must be a string');
      riskScore += 20;
    } else if (data.name.length > 100) {
      errors.push('Robot name too long (max 100 characters)');
      riskScore += 10;
    }

    // Description validation
    if (data.description && typeof data.description !== 'string') {
      errors.push('Description must be a string');
      riskScore += 15;
    }

    // Code validation - critical for security
    if (!data.code || typeof data.code !== 'string') {
      errors.push('Robot code is required and must be a string');
      riskScore += 30;
    } else {
      const codeValidation = this.validateMQL5Code(data.code);
      if (!codeValidation.isValid) {
        errors.push(...codeValidation.errors);
        riskScore += 40;
      }
    }

    // Strategy type validation
    if (data.strategy_type && !['trend', 'range', 'breakout', 'scalping', 'swing', 'position'].includes(data.strategy_type)) {
      errors.push('Invalid strategy type');
      riskScore += 15;
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      riskScore: Math.min(riskScore, 100),
      sanitizedData: data 
    };
  }

  validateStrategyData(data: any): ValidationResult {
    const errors: string[] = [];
    let riskScore = 0;

    if (!data || typeof data !== 'object') {
      errors.push('Invalid strategy data structure');
      return { isValid: false, errors, riskScore: 100 };
    }

    // Timeframe validation
    if (data.timeframe && !['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN1'].includes(data.timeframe)) {
      errors.push('Invalid timeframe');
      riskScore += 15;
    }

    // Symbol validation
    if (data.symbol && typeof data.symbol === 'string') {
      if (!this.config.allowedSymbols.includes(data.symbol.toUpperCase())) {
        errors.push('Invalid trading symbol');
        riskScore += 20;
      }
    }

    // Risk percent validation
    if (data.risk_percent && (data.risk_percent < 0.1 || data.risk_percent > 100)) {
      errors.push('Risk percent must be between 0.1 and 100');
      riskScore += 10;
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      riskScore: Math.min(riskScore, 100),
      sanitizedData: data 
    };
  }

  validateMQL5Code(code: string): { isValid: boolean; errors: string[]; sanitizedCode: string } {
    const errors: string[] = [];
    let sanitizedCode = code;

    // Check for dangerous functions with more comprehensive patterns
    const dangerousFunctions = [
      'shell32', 'kernel32', 'user32', 'CreateFile', 'DeleteFile', 'MoveFile',
      'CopyFile', 'WriteFile', 'ReadFile', 'WinExec', 'ShellExecute',
      'CreateProcess', 'OpenProcess', 'TerminateProcess', 'VirtualAlloc',
      'VirtualProtect', 'CreateThread', 'ExitThread', 'GetModuleHandle',
      'GetProcAddress', 'LoadLibrary', 'FreeLibrary', 'RegOpenKey',
      'RegCreateKey', 'RegDeleteKey', 'RegSetValue', 'RegQueryValue'
    ];

    for (const dangerousFn of dangerousFunctions) {
      const pattern = new RegExp(`\\b${dangerousFn}\\b`, 'gi');
      if (pattern.test(code)) {
        errors.push(`Dangerous function found: ${dangerousFn}`);
        sanitizedCode = sanitizedCode.replace(pattern, `// REMOVED: ${dangerousFn}`);
      }
    }

    // Check for file operations
    const fileOperations = ['\\bFILE\\b', '\\\\.+\\\\', 'C:/', 'D:/', '/etc/', '/sys/', '/var/'];
    for (const fileOp of fileOperations) {
      const pattern = new RegExp(fileOp, 'gi');
      if (pattern.test(code)) {
        errors.push(`File operation detected: ${fileOp}`);
        sanitizedCode = sanitizedCode.replace(pattern, '// REMOVED_FILE_OP');
      }
    }

    // Check for network operations
    const networkOps = ['\\bsocket\\b', '\\bhttp\\b', '\\bftp\\b', '\\btcp\\b', '\\budp\\b'];
    for (const netOp of networkOps) {
      const pattern = new RegExp(netOp, 'gi');
      if (pattern.test(code)) {
        errors.push(`Network operation detected: ${netOp}`);
        sanitizedCode = sanitizedCode.replace(pattern, '// REMOVED_NETWORK_OP');
      }
    }

    // Basic syntax validation
    if (!code.includes('OnInit(') || !code.includes('OnTick(')) {
      errors.push('Missing required MQL5 functions (OnInit, OnTick)');
    }

    return { 
      isValid: errors.length === 0, 
      errors, 
      sanitizedCode 
    };
  }

  sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    
    // Remove potential script tags and dangerous attributes
    let sanitized = input.replace(/<script[^>]*>.*?<\/script>/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    // Limit length
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000);
    }
    
    return sanitized;
  }

  sanitizeSymbol(symbol: string): string {
    if (!symbol || typeof symbol !== 'string') {
      return '';
    }
    
    // Remove potentially dangerous characters and allow alphanumeric only
    const sanitized = symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Validate against allowed symbols
    if (!this.config.allowedSymbols.includes(sanitized)) {
      return '';
    }
    
    return sanitized;
  }

  preventXSS(data: any): { hasXSS: boolean; sanitizedData: any } {
    let hasXSS = false;
    const sanitized = { ...data };

    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        // Use DOMPurify for comprehensive XSS protection
        const clean = DOMPurify.sanitize(value, {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: [],
          KEEP_CONTENT: false
        });
        
        if (clean !== value) {
          hasXSS = true;
        }
        
        return clean;
      } else if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      } else if (value && typeof value === 'object') {
        const sanitizedObj: any = {};
        for (const [key, val] of Object.entries(value)) {
          sanitizedObj[this.sanitizeString(key)] = sanitizeValue(val);
        }
        return sanitizedObj;
      }
      
      return value;
    };

    const resultData = sanitizeValue(sanitized);
    
    return { hasXSS, sanitizedData: resultData };
  }

  preventSQLInjection(data: any): { hasSQLInjection: boolean; sanitizedData: any } {
    let hasSQLInjection = false;
    const sanitized = { ...data };

    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(--)|(\/\*)|(\*\/)|(\bOR\b\s+\b1\s*=\s*1)|(\bAND\b\s+\b1\s*=\s*1)/i,
      /(\'\s*;\s*)|(\x27\x27)|(\x27\x3D)/i,
      /(\bWAITFOR\b\s+\bDELAY\b)|(\bSLEEP\b\s*\()/i
    ];

    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        let clean = value;
        
        for (const pattern of sqlPatterns) {
          if (pattern.test(clean)) {
            hasSQLInjection = true;
            clean = clean.replace(pattern, '[REMOVED]');
          }
        }
        
        return clean;
      } else if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      } else if (value && typeof value === 'object') {
        const sanitizedObj: any = {};
        for (const [key, val] of Object.entries(value)) {
          sanitizedObj[key] = sanitizeValue(val);
        }
        return sanitizedObj;
      }
      
      return value;
    };

    const resultData = sanitizeValue(sanitized);
    
    return { hasSQLInjection, sanitizedData: resultData };
  }
}