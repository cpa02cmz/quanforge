export interface MQL5ValidationResult {
  isValid: boolean;
  errors: string;
  sanitizedCode: string;
}

/**
 * MQL5-specific security validation service
 * Handles validation and sanitization of MQL5 trading code
 */
export class MQL5SecurityService {
  private static instance: MQL5SecurityService;

  private constructor() {}

  static getInstance(): MQL5SecurityService {
    if (!MQL5SecurityService.instance) {
      MQL5SecurityService.instance = new MQL5SecurityService();
    }
    return MQL5SecurityService.instance;
  }

  /**
   * Validate and sanitize MQL5 code for security threats
   */
  validateMQL5Code(code: string): MQL5ValidationResult {
    const errors: string[] = [];
    let sanitizedCode = code;

    // Check for dangerous functions
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

    // Additional MQL5 security validations
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
        sanitizedCode = sanitizedCode.replace(pattern, `// SECURITY_BLOCKED: ${message}`);
      }
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
      { pattern: /string\.concat|StringConcatenate/gi, message: 'String concatenation function detected' },
      { pattern: /arraycopy|ArrayCopy/gi, message: 'Array copy function detected' },
      { pattern: /char.*\[|uchar.*\[|int.*\[|long.*\[/gi, message: 'Direct memory access detected' },
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
      /[^a-zA-Z0-9\s(){},.;:+/=><!&|^~%-]+/g,
      /0x[0-9a-fA-F]+/g,
      /\\u[0-9a-fA-F]{4}/g,
      /\\x[0-9a-fA-F]{2}/g,
      /\+\s*\+\s*\+\s*\+\s*\+/g,
      /String\.Concatenate|\.concat/gi,
    ];
    
    for (const pattern of obfuscatedPatterns) {
      const matches = sanitizedCode.match(pattern);
      if (matches && matches.length > 5) {
        errors.push('Code contains potentially obfuscated content');
        break;
      }
    }

    // Additional MQL5-specific security checks
    const mql5SecurityChecks = [
      { pattern: /#import\s+["']([^"']+\.(dll|exe|sys))["']/gi, message: 'Potential unsafe DLL import detected' },
      { pattern: /FileOpenHandle|FileWrite|FileRead|FileDelete|FileMove|FileCopy/gi, message: 'Potential file operation detected' },
      { pattern: /RegOpenKey|RegSetValue|RegGetValue/gi, message: 'Potential registry operation detected' },
      { pattern: /ShellExecute|WinExec|CreateProcess/gi, message: 'Potential process creation detected' },
      { pattern: /SocketCreate|SocketConnect|WebRequest/gi, message: 'Potential network operation detected' },
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
}

export default MQL5SecurityService;