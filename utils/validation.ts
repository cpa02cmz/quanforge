import { StrategyParams, BacktestSettings } from '../types';
import DOMPurify from 'dompurify';

export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationService {
  private static readonly TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H1', 'D1', 'W1', 'MN1'];
  private static readonly SYMBOL_REGEX = /^[A-Z]{3,6}\/?[A-Z]{3,6}$/;
  private static readonly NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  private static readonly MAX_RISK_PERCENT = 100;
  private static readonly MIN_RISK_PERCENT = 0.01;
  private static readonly MAX_STOP_LOSS = 1000;
  private static readonly MIN_STOP_LOSS = 1;
  private static readonly MAX_TAKE_PROFIT = 1000;
  private static readonly MIN_TAKE_PROFIT = 1;
  private static readonly MAX_MAGIC_NUMBER = 999999;
  private static readonly MIN_MAGIC_NUMBER = 1;
  private static readonly MAX_INITIAL_DEPOSIT = 10000000;
  private static readonly MIN_INITIAL_DEPOSIT = 100;
  private static readonly MAX_DURATION = 365;
  private static readonly MIN_DURATION = 1;
  private static readonly MAX_LEVERAGE = 1000;
  private static readonly MIN_LEVERAGE = 1;

  // Rate limiting for chat validation
  private static rateLimiter = new Map<string, { count: number; resetTime: number }>();
  private static readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private static readonly RATE_LIMIT_MAX_REQUESTS = 10;
  
  // Cached regex patterns for performance in chat validation
  private static readonly XSS_PATTERNS = [
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /&#x?0*(58|106|0*74|0*42|0*6a);?/gi,  // Hex/decimal encoded chars
  ];
  
  private static readonly MQL5_DANGEROUS_PATTERNS = [
    // File system operations
    /FileFind\s*\(|FileOpen\s*\(|FileClose\s*\(|FileDelete\s*\(|FileCopy\s*\(|FileMove\s*\(/i,
    /FileIsExist\s*\(|FileIsLineEnding\s*\(|FileIsEnding\s*\(/i,
    /FileRead\s*\(|FileWrite\s*\(|FileFlush\s*\(/i,
    
    // Network operations
    /WebRequest\s*\(|SocketCreate\s*\(|SocketConnect\s*\(|SocketSend\s*\(|SocketReceive\s*\(/i,
    /InternetOpen\s*\(|InternetConnect\s*\(|HttpOpenRequest\s*\(/i,
    
    // System operations
    /ShellExecute\s*\(|WinExec\s*\(|CreateProcess\s*\(/i,
    /System\s*\(|Exec\s*\(|Popen\s*\(/i,
    
    // Memory operations
    /memcpy\s*\(|memset\s*\(|malloc\s*\(|free\s*\(/i,
    /GetMemory\s*\(|FreeMemory\s*\(/i,
    
    // Registry operations
    /RegOpenKey\s*\(|RegCreateKey\s*\(|RegSetValue\s*\(|RegGetValue\s*\(/i,
    
    // Dangerous imports
    /#import\s+["']?(?!user32\.dll|kernel32\.dll|gdi32\.dll|msvcrt\.dll)[^"']*["']?/i,
    /Import\s+["']?(?!user32\.dll|kernel32\.dll|gdi32\.dll|msvcrt\.dll)[^"']*["']?/i,
    
    // Resource operations
    /ResourceCreate\s*\(|ResourceSave\s*\(|ResourceRead\s*\(/i,
    
    // Global variable manipulation
    /GlobalVariableSet\s*\(|GlobalVariableGet\s*\(|GlobalVariableDel\s*\(/i,
    /GlobalVariablesFlush\s*\(|GlobalVariableTemp\s*\(/i,
    
    // Terminal information access
    /TerminalInfoInteger\s*\(|TerminalInfoString\s*\(/i,
    /AccountInfo\s*\(|AccountInfoInteger\s*\(|AccountInfoDouble\s*\(/i,
    
    // Dangerous MQL5 functions
    /SendNotification\s*\(|SendMail\s*\(|SendFTP\s*\(/i,
    /Alert\s*\(|Comment\s*\(|Print\s*\(/i, // Can be used for social engineering
    
    // Chart manipulation
    /ChartApplyTemplate\s*\(|ChartSave\s*\(|ChartScreenShot\s*\(/i,
    
    // Trade operations that could be exploited
    /OrderSend\s*\(|OrderClose\s*\(|OrderModify\s*\(/i,
    /PositionOpen\s*\(|PositionClose\s*\(|PositionModify\s*\(/i,
    
    // String operations that could lead to code injection
    /StringConcatenate\s*\(|StringTrimLeft\s*\(|StringTrimRight\s*\(/i,
    
    // Array operations that could lead to memory issues
    /ArrayCopy\s*\(|ArrayFill\s*\(|ArraySort\s*\(/i,

    // Time functions that could be used for timing attacks
    /GetTickCount\s*\(|TimeCurrent\s*\(|TimeLocal\s*\(/i,
    
    // Math functions that could be used for computational attacks
    /MathRand\s*\(|MathSrand\s*\(/i,
  ];
  
  private static readonly OBFUSCATION_PATTERNS = [
    /0x[0-9a-fA-F]+/g,  // Hex encoded content
    /[A-Za-z0-9+/]{20,}={0,2}/g,  // Potential base64
    /\\u[0-9a-fA-F]{4}/g,  // Unicode escapes
    /\\x[0-9a-fA-F]{2}/g,  // Hex escapes
  ];
  
  private static readonly SUSPICIOUS_KEYWORDS = new Set([
    'password', 'secret', 'key', 'token', 'auth', 'credential',
    'exploit', 'hack', 'crack', 'bypass', 'inject', 'payload',
    'malware', 'virus', 'trojan', 'backdoor', 'rootkit'
  ]);

   static validateStrategyParams(params: StrategyParams): ValidationError[] {
     const errors: ValidationError[] = [];

     // Validate timeframe - use Set for O(1) lookup
     const TIMEFRAMES_SET = new Set(this.TIMEFRAMES);
     if (!TIMEFRAMES_SET.has(params.timeframe)) {
       errors.push({
         field: 'timeframe',
         message: `Invalid timeframe. Must be one of: ${this.TIMEFRAMES.join(', ')}`
       });
     }

     // Validate symbol
     if (!params.symbol) {
       errors.push({
         field: 'symbol',
         message: 'Symbol is required'
       });
     } else {
       // Optimize regex by pre-processing the string
       const cleanSymbol = params.symbol.replace('USDT', '').replace('BUSD', '');
       if (!this.SYMBOL_REGEX.test(cleanSymbol)) {
         errors.push({
           field: 'symbol',
           message: 'Invalid symbol format. Use format like BTCUSDT, EUR/USD, XAUUSD'
         });
       }
     }

     // Validate risk percent - single check with bounds
     if (params.riskPercent < this.MIN_RISK_PERCENT || params.riskPercent > this.MAX_RISK_PERCENT) {
       errors.push({
         field: 'riskPercent',
         message: `Risk percent must be between ${this.MIN_RISK_PERCENT} and ${this.MAX_RISK_PERCENT}`
       });
     }

     // Validate stop loss
     if (params.stopLoss < this.MIN_STOP_LOSS || params.stopLoss > this.MAX_STOP_LOSS) {
       errors.push({
         field: 'stopLoss',
         message: `Stop loss must be between ${this.MIN_STOP_LOSS} and ${this.MAX_STOP_LOSS} pips`
       });
     }

     // Validate take profit
     if (params.takeProfit < this.MIN_TAKE_PROFIT || params.takeProfit > this.MAX_TAKE_PROFIT) {
       errors.push({
         field: 'takeProfit',
         message: `Take profit must be between ${this.MIN_TAKE_PROFIT} and ${this.MAX_TAKE_PROFIT} pips`
       });
     }

     // Validate magic number
     if (params.magicNumber < this.MIN_MAGIC_NUMBER || params.magicNumber > this.MAX_MAGIC_NUMBER) {
       errors.push({
         field: 'magicNumber',
         message: `Magic number must be between ${this.MIN_MAGIC_NUMBER} and ${this.MAX_MAGIC_NUMBER}`
       });
     }

     // Validate custom inputs - optimize duplicate checking
     const seenNames = new Set<string>();
     for (let index = 0; index < params.customInputs.length; index++) {
       const input = params.customInputs[index];
       const prefix = `customInputs[${index}]`;
       
       if (!input?.name || !input.name.trim()) {
         errors.push({
           field: `${prefix}.name`,
           message: 'Custom input name is required'
         });
         continue; // Skip further validation for invalid names
       }
       
       if (input && !this.NAME_REGEX.test(input.name)) {
         errors.push({
           field: `${prefix}.name`,
           message: 'Invalid name format. Use letters, numbers, and underscores only, starting with a letter or underscore'
         });
       }

       // Check for duplicate names using Set for O(1) lookup
if (input && seenNames.has(input.name)) {
          errors.push({
            field: `${prefix}.name`,
            message: `Duplicate input name: "${input.name}"`
          });
        } else if (input) {
          seenNames.add(input.name);
        }

        // Validate value based on type
        if (input && input.type === 'int') {
          const value = parseInt(input.value, 10);
          if (isNaN(value) || value < -2147483648 || value > 2147483647) {
            errors.push({
              field: `${prefix}.value`,
              message: 'Invalid integer value'
            });
          }
        } else if (input && input.type === 'double') {
          const value = parseFloat(input.value);
          if (isNaN(value) || !isFinite(value)) {
            errors.push({
              field: `${prefix}.value`,
              message: 'Invalid number value'
            });
          }
        } else if (input && input.type === 'bool') {
          if (input.value !== 'true' && input.value !== 'false') {
            errors.push({
              field: `${prefix}.value`,
             message: 'Boolean value must be "true" or "false"'
           });
         }
       }
     }

     return errors;
   }

  static validateBacktestSettings(settings: BacktestSettings): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate initial deposit
    if (settings.initialDeposit < this.MIN_INITIAL_DEPOSIT || settings.initialDeposit > this.MAX_INITIAL_DEPOSIT) {
      errors.push({
        field: 'initialDeposit',
        message: `Initial deposit must be between $${this.MIN_INITIAL_DEPOSIT} and $${this.MAX_INITIAL_DEPOSIT}`
      });
    }

    // Validate duration
    if (settings.days < this.MIN_DURATION || settings.days > this.MAX_DURATION) {
      errors.push({
        field: 'days',
        message: `Duration must be between ${this.MIN_DURATION} and ${this.MAX_DURATION} days`
      });
    }

    // Validate leverage
    if (settings.leverage < this.MIN_LEVERAGE || settings.leverage > this.MAX_LEVERAGE) {
      errors.push({
        field: 'leverage',
        message: `Leverage must be between ${this.MIN_LEVERAGE} and ${this.MAX_LEVERAGE}`
      });
    }

    return errors;
  }

  static validateRobotName(name: string): ValidationError[] {
    const errors: ValidationError[] = [];

     if (!name || !name.trim()) {
       errors.push({
         field: 'name',
         message: 'Robot name is required'
       });
       return errors; // Return early if name is empty
     }

     if (name.length < 3) {
       errors.push({
         field: 'name',
         message: 'Robot name must be at least 3 characters long'
       });
     } else if (name.length > 100) {
       errors.push({
         field: 'name',
         message: 'Robot name must not exceed 100 characters'
       });
     }

    return errors;
  }

    static validateChatMessageWithRateLimit(userId: string, message: string): ValidationError[] {
       const errors: ValidationError[] = [];
       const now = Date.now();
       
       // Check rate limit
       const userLimit = this.rateLimiter.get(userId);
       if (userLimit && now < userLimit.resetTime) {
         if (userLimit.count >= this.RATE_LIMIT_MAX_REQUESTS) {
           errors.push({
             field: 'rate',
             message: `Rate limit exceeded. Please wait ${Math.ceil((userLimit.resetTime - now) / 1000)} seconds.`
           });
           return errors;
         }
         userLimit.count++;
       } else {
         this.rateLimiter.set(userId, { 
           count: 1, 
           resetTime: now + this.RATE_LIMIT_WINDOW 
         });
       }

       return this.validateChatMessage(message);
     }

     static validateChatMessage(message: string): ValidationError[] {
       const errors: ValidationError[] = [];

       if (!message || !message.trim()) {
         errors.push({
           field: 'message',
           message: 'Message cannot be empty'
         });
         return errors;
       }

       if (message.length > 10000) {
         errors.push({
           field: 'message',
           message: 'Message is too long (max 10,000 characters)'
         });
         return errors;
       }

// Enhanced XSS prevention using DOMPurify for comprehensive sanitization
        const sanitizedMessage = DOMPurify.sanitize(message, { 
          ALLOWED_TAGS: [], 
          ALLOWED_ATTR: [],
          KEEP_CONTENT: true 
        });
        
        // If sanitization removed content, there was likely XSS content
        if (sanitizedMessage.length !== message.length) {
          errors.push({
            field: 'message',
            message: 'Message contains potentially dangerous content'
          });
          return errors;
        }

         // Check remaining XSS patterns using cached patterns
         for (const pattern of ValidationService.XSS_PATTERNS) {
           if (pattern.test(message)) {
            errors.push({
              field: 'message',
              message: 'Message contains potentially unsafe content'
            });
            return errors; // Return early on first match
          }
        }

        // Check for obfuscated patterns (base64, hex encoding, etc.) using cached patterns
        for (const pattern of ValidationService.OBFUSCATION_PATTERNS) {
          const matches = message.match(pattern);
          if (matches && matches.length > 3) { // Allow a few legitimate uses
            errors.push({
              field: 'message',
              message: 'Message contains potentially obfuscated content'
            });
            return errors; // Return early
          }
        }

        // Then check for dangerous MQL5 patterns using cached patterns
        for (const pattern of ValidationService.MQL5_DANGEROUS_PATTERNS) {
          if (pattern.test(message)) {
            errors.push({
              field: 'message',
              message: 'Message contains potentially dangerous MQL5 operations'
            });
            return errors; // Return early
          }
        }

        // Additional heuristic checks with cached suspicious keywords
        const lowerMessage = message.toLowerCase();
        let suspiciousCount = 0;
        for (const keyword of ValidationService.SUSPICIOUS_KEYWORDS) {
          if (lowerMessage.includes(keyword)) {
            suspiciousCount++;
          }
        }

        if (suspiciousCount > 2) { // Allow some false positives
          errors.push({
            field: 'message',
            message: 'Message contains suspicious content'
          });
        }

        return errors;
      }

static sanitizeInput(input: string): string {
     if (!input) return '';
     
     return input
       .trim()
       // Remove HTML tags more comprehensively
       .replace(/<[^>]*>/g, '')
       // Remove dangerous protocols
       .replace(/javascript:/gi, '')
       .replace(/vbscript:/gi, '')
       .replace(/data:/gi, '')
       // Remove event handlers
       .replace(/on\w+\s*=/gi, '')
       // Remove potentially dangerous attributes
       .replace(/href\s*=\s*["']?javascript:/gi, '')
       .replace(/src\s*=\s*["']?javascript:/gi, '')
       // Remove encoded characters that could be used for injection
       .replace(/&#x?0*[0-9a-fA-F]+;?/g, '')
       // Remove CSS expressions
       .replace(/expression\s*\(/gi, '')
       // Remove eval and similar functions
       .replace(/eval\s*\(/gi, '')
       .replace(/setTimeout\s*\(/gi, '')
       .replace(/setInterval\s*\(/gi, '')
       // Limit length to prevent DoS
       .substring(0, 10000);
   }

   static validateApiKey(apiKey: string): ValidationError[] {
     const errors: ValidationError[] = [];

     if (!apiKey || !apiKey.trim()) {
       errors.push({
         field: 'apiKey',
         message: 'API key is required'
       });
       return errors;
     }

     // Basic format validation for common API key patterns
     const apiKeyPatterns = [
       /^[A-Za-z0-9_-]{20,}$/,  // Generic API key pattern
       /^[A-Za-z0-9]{32}$/,     // 32-character keys
       /^[A-Za-z0-9_-]{40}$/,   // 40-character keys (like some Google keys)
     ];

     const isValidFormat = apiKeyPatterns.some(pattern => pattern.test(apiKey.trim()));
     
     if (!isValidFormat) {
       errors.push({
         field: 'apiKey',
         message: 'Invalid API key format'
       });
     }

     // Check for common placeholder/fake keys
     const placeholderKeys = [
       'your-api-key-here',
       '1234567890',
       'abcdefghijk',
       'test-key',
       'demo-key',
       'sample-key'
     ];

     const lowerKey = apiKey.toLowerCase();
     if (placeholderKeys.some(placeholder => lowerKey.includes(placeholder))) {
       errors.push({
         field: 'apiKey',
         message: 'Please use a valid API key, not a placeholder'
       });
     }

     return errors;
   }

static validateSymbol(symbol: string): ValidationError[] {
      const errors: ValidationError[] = [];

      if (!symbol || !symbol.trim()) {
        errors.push({
          field: 'symbol',
          message: 'Symbol is required'
        });
        return errors;
      }

      const trimmedSymbol = symbol.trim().toUpperCase();
      
      // Use a single regex with OR pattern for better performance
      const symbolPattern = /^(?:[A-Z]{6}|[A-Z]{3}\/[A-Z]{3}|[A-Z]{3,6}[A-Z]{3}|[A-Z]{2,5}[-_][A-Z]{2,5}|[A-Z]{3,6}USDT|[A-Z]{3,6}BUSD)$/;
      
      if (!symbolPattern.test(trimmedSymbol)) {
        errors.push({
          field: 'symbol',
          message: 'Invalid symbol format. Use formats like: EURUSD, EUR/USD, XAUUSD, BTCUSDT'
        });
      }

      // Use Set for O(1) lookup instead of Array.includes for blacklisted symbols
      const blacklistedSymbols = new Set(['TEST', 'DEMO', 'FAKE', 'INVALID']);
      if (blacklistedSymbols.has(trimmedSymbol)) {
        errors.push({
          field: 'symbol',
          message: 'Invalid symbol for trading'
        });
      }

      return errors;
    }

  static isValid(errors: ValidationError[]): boolean {
    return errors.length === 0;
  }

   static formatErrors(errors: ValidationError[]): string {
     return errors.map(error => `${error.field}: ${error.message}`).join('\n');
   }
   
   // Comprehensive validation for user inputs that combines multiple validation checks
   static validateUserInputs(input: string, context: 'chat' | 'robotName' | 'strategyParam' | 'apiKey' | 'symbol' | 'code' = 'chat'): ValidationError[] {
     const errors: ValidationError[] = [];
     
     switch (context) {
       case 'chat':
         errors.push(...this.validateChatMessage(input));
         break;
       case 'robotName':
         errors.push(...this.validateRobotName(input));
         break;
       case 'apiKey':
         errors.push(...this.validateApiKey(input));
         break;
       case 'symbol':
         errors.push(...this.validateSymbol(input));
         break;
       case 'strategyParam':
         // For strategy params, we might have multiple validations
         if (input.trim() && input.length < 3) {
           errors.push({
             field: 'param',
             message: 'Parameter value is too short'
           });
         }
         break;
       case 'code':
         // Basic code validation - ensure it doesn't contain dangerous patterns
         if (input.includes('FileOpen') && !input.includes('//')) {
           errors.push({
             field: 'code',
             message: 'Code contains potentially unsafe file operations'
           });
         }
         break;
       default:
         errors.push(...this.validateChatMessage(input));
     }
     
     return errors;
   }
 }
