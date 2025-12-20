import { ValidationError } from './validationTypes';
import { validateRequired } from './validationHelpers';
import DOMPurify from 'dompurify';
import { securityManager } from '../services/securityManager';

// Enhanced authentication validation types
export interface AuthValidationResult {
  isValid: boolean;
  sanitizedValue: string;
  errors: ValidationError[];
  riskScore: number;
  strength?: 'weak' | 'moderate' | 'strong';
  feedback?: string[];
}

// Enhanced email validation with security checks
export const validateEmail = (email: string): AuthValidationResult => {
  const errors: ValidationError[] = [];
  let riskScore = 0;
  let sanitizedValue = '';

  const EMAIL_MAX_LENGTH = 254; // RFC 5321 standard

  try {
    if (typeof email !== 'string') {
      errors.push({ field: 'email', message: 'Email must be a string' });
      return { isValid: false, sanitizedValue: '', errors, riskScore: 100 };
    }

    // Use security manager for initial sanitization
    sanitizedValue = securityManager.sanitizeInput(email, 'email');

    // Length validation
    if (sanitizedValue.length === 0) {
      errors.push({ field: 'email', message: 'Email cannot be empty' });
      riskScore += 50;
    } else if (sanitizedValue.length > EMAIL_MAX_LENGTH) {
      errors.push({ field: 'email', message: `Email too long (max ${EMAIL_MAX_LENGTH} characters)` });
      riskScore += 25;
    }

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedValue)) {
      errors.push({ field: 'email', message: 'Invalid email format' });
      riskScore += 40;
    }

    // Enhanced security checks
    if (hasSuspiciousPatterns(sanitizedValue)) {
      errors.push({ field: 'email', message: 'Email contains suspicious patterns' });
      riskScore += 60;
    }

    // Check for disposable email domains
    if (isDisposableEmail(sanitizedValue)) {
      errors.push({ field: 'email', message: 'Disposable email addresses are not allowed' });
      riskScore += 30;
    }

    // Check for email injection attempts
    if (hasEmailInjection(sanitizedValue)) {
      errors.push({ field: 'email', message: 'Email contains potential injection code' });
      riskScore += 80;
    }

    // Validate domain structure
    const domain = sanitizedValue.split('@')[1];
    if (domain && !isValidDomain(domain)) {
      errors.push({ field: 'email', message: 'Invalid domain in email address' });
      riskScore += 35;
    }

  } catch (error) {
    errors.push({ field: 'email', message: 'Email validation failed due to system error' });
    riskScore += 50;
    sanitizedValue = '';
  }

  const isValid = errors.length === 0 && riskScore < 50;

  if (!isValid) {
    sanitizedValue = ''; // Clear on invalid
  }

  return { isValid, sanitizedValue, errors, riskScore };
};

// Enhanced password validation with comprehensive security checks
export const validatePassword = (password: string): AuthValidationResult => {
  const errors: ValidationError[] = [];
  const feedback: string[] = [];
  let riskScore = 0;
  let strength: 'weak' | 'moderate' | 'strong' = 'weak';

  const PASSWORD_MIN_LENGTH = 8;
  const PASSWORD_MAX_LENGTH = 128;

  try {
    if (typeof password !== 'string') {
      errors.push({ field: 'password', message: 'Password must be a string' });
      return { isValid: false, sanitizedValue: '', errors, riskScore: 100, strength: 'weak', feedback };
    }

    // Length validation
    if (password.length === 0) {
      errors.push({ field: 'password', message: 'Password cannot be empty' });
      riskScore += 80;
    } else if (password.length < PASSWORD_MIN_LENGTH) {
      errors.push({ field: 'password', message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long` });
      riskScore += 40;
      feedback.push('Consider using a longer password for better security');
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      errors.push({ field: 'password', message: `Password too long (max ${PASSWORD_MAX_LENGTH} characters)` });
      riskScore += 20;
    } else {
      feedback.push('Good password length');
      strength = 'moderate';
    }

    // Character variety analysis
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!hasLowercase) {
      errors.push({ field: 'password', message: 'Password must contain lowercase letters' });
      riskScore += 15;
    }
    if (!hasUppercase) {
      errors.push({ field: 'password', message: 'Password must contain uppercase letters' });
      riskScore += 15;
    }
    if (!hasNumbers) {
      errors.push({ field: 'password', message: 'Password must contain numbers' });
      riskScore += 15;
    }
    if (!hasSpecialChars) {
      errors.push({ field: 'password', message: 'Password must contain special characters' });
      riskScore += 10;
      feedback.push('Add special characters for stronger security');
    }

    // Check for common weak patterns
    if (hasCommonWeakPatterns(password)) {
      errors.push({ field: 'password', message: 'Password contains common weak patterns' });
      riskScore += 50;
      feedback.push('Avoid common patterns like "123456" or "password"');
    }

    // Check for repeated characters
    if (hasExcessiveRepetition(password)) {
      errors.push({ field: 'password', message: 'Password contains too many repeated characters' });
      riskScore += 25;
      feedback.push('Avoid using the same character multiple times in a row');
    }

    // Check for sequential characters
    if (hasSequentialCharacters(password)) {
      errors.push({ field: 'password', message: 'Password contains sequential characters' });
      riskScore += 20;
      feedback.push('Avoid sequential patterns like "123" or "abc"');
    }

    // Password strength assessment
    const varietyScore = [hasLowercase, hasUppercase, hasNumbers, hasSpecialChars].filter(Boolean).length;
    if (varietyScore >= 3 && password.length >= 12 && riskScore < 30) {
      strength = 'strong';
      feedback.push('Strong password!');
    } else if (varietyScore >= 2 && password.length >= 8 && riskScore < 50) {
      strength = 'moderate';
      feedback.push('Moderate password strength');
    }

  } catch (error) {
    errors.push({ field: 'password', message: 'Password validation failed due to system error' });
    riskScore += 50;
  }

  const isValid = errors.length === 0 && riskScore < 50;

  return { isValid, sanitizedValue: '', errors, riskScore, strength, feedback };
};

// Chat message validation
export const validateChatMessage = (content: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Check if content is empty or just whitespace
  const requiredError = validateRequired(content, 'message');
  if (requiredError) {
    errors.push(requiredError);
    return errors; // Early return if empty
  }

  // Check minimum length
  if (content.trim().length < 3) {
    errors.push({
      field: 'message',
      message: 'Message must be at least 3 characters long'
    });
  }

  // Check maximum length (prevent token abuse)
  if (content.length > 10000) {
    errors.push({
      field: 'message',
      message: 'Message is too long. Maximum 10,000 characters allowed.'
    });
  }

  return errors;
};

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  }).trim();
};

// API key validation
export const validateApiKey = (apiKey: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  const requiredError = validateRequired(apiKey, 'apiKey');
  if (requiredError) {
    errors.push(requiredError);
    return errors;
  }

  // Check for placeholder values
  const placeholders = [
    'your-api-key-here',
    'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    'demo-key',
    'test-key'
  ];

  if (placeholders.some(placeholder => apiKey.toLowerCase().includes(placeholder))) {
    errors.push({
      field: 'apiKey',
      message: 'Please enter a valid API key, not a placeholder'
    });
  }

  // Basic format validation for common API key patterns
  const validPatterns = [
    /^sk-[a-zA-Z0-9]{48}$/, // OpenAI pattern
    /^[a-zA-Z0-9_-]{20,}$/, // Generic pattern
  ];

  const isValidFormat = validPatterns.some(pattern => pattern.test(apiKey));
  if (!isValidFormat && apiKey.length < 20) {
    errors.push({
      field: 'apiKey',
      message: 'API key appears to be too short or invalid'
    });
  }

  return errors;
};

// Symbol validation
export const validateSymbol = (symbol: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  const requiredError = validateRequired(symbol, 'symbol');
  if (requiredError) {
    errors.push(requiredError);
    return errors;
  }

  // Common forex/crypto symbol patterns
  const validPatterns = [
    /^[A-Z]{6}$/, // Forex pairs (EURUSD)
    /^[A-Z]{3}\/[A-Z]{3}$/, // Forex with slash (EUR/USD)
    /^[A-Z]{3,8}[A-Z]{3,8}$/, // Crypto pairs (BTCUSDT)
    /^[A-Z]{2,6}$/, // Indices and commodities
  ];

  const isValidFormat = validPatterns.some(pattern => pattern.test(symbol.toUpperCase()));
  if (!isValidFormat) {
    errors.push({
      field: 'symbol',
      message: 'Invalid symbol format. Use formats like EURUSD, EUR/USD, BTCUSDT, etc.'
    });
  }

  // Check for blacklisted symbols
  const blacklist = ['TEST', 'DEMO', 'INVALID'];
  if (blacklist.includes(symbol.toUpperCase())) {
    errors.push({
      field: 'symbol',
      message: 'Invalid symbol. Please use a real trading symbol.'
    });
  }

  return errors;
};

// Helper functions for enhanced validation

function hasSuspiciousPatterns(input: string): boolean {
  const suspiciousPatterns = [
    /<script[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload=/gi,
    /onerror=/gi,
    /onclick=/gi,
    /onmouseover=/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
    /url\s*\(/gi,
    /@import/gi,
    /binding\s*:/gi,
    /<!--[\s\S]*?-->/g,
    /data:text\/html/gi,
    /data:application\/javascript/gi
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'temp-mail.org', 'throwaway.email', 'maildrop.cc',
    'tempmail.org', 'mailnesia.com', 'spam4.me', 'getairmail.com'
  ];

  const domain = email.toLowerCase().split('@')[1];
  return disposableDomains.some(disposable => domain?.includes(disposable));
}

function hasEmailInjection(email: string): boolean {
  const injectionPatterns = [
    /\r\n/g,
    /\n/g,
    /\r/g,
    /bcc:/gi,
    /cc:/gi,
    /to:/gi,
    /from:/gi,
    /subject:/gi,
    /content-type:/gi,
    /multipart/gi,
    /%0d/gi,
    /%0a/gi,
    /%0d%0a/gi
  ];

  return injectionPatterns.some(pattern => pattern.test(email));
}

function isValidDomain(domain: string): boolean {
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253 && domain.length >= 4;
}

function hasCommonWeakPatterns(password: string): boolean {
  const commonPatterns = [
    /123456/gi,
    /password/gi,
    /qwerty/gi,
    /abc123/gi,
    /letmein/gi,
    /admin/gi,
    /welcome/gi,
    /monkey/gi,
    /dragon/gi,
    /master/gi,
    /hello/gi,
    /freedom/gi,
    /whatever/gi,
    /qazwsx/gi,
    /trustno1/gi,
    /123qwe/gi,
    /1q2w3e/gi
  ];

  return commonPatterns.some(pattern => pattern.test(password.toLowerCase()));
}

function hasExcessiveRepetition(password: string): boolean {
  // Check for 3+ consecutive same characters
  const repetitionRegex = /(.)\1{2,}/g;
  return repetitionRegex.test(password);
}

function hasSequentialCharacters(password: string): boolean {
  // Check for 3+ sequential characters (123, abc, etc.)
  const lowerPassword = password.toLowerCase();
  
  for (let i = 0; i < lowerPassword.length - 2; i++) {
    const char1 = lowerPassword.charCodeAt(i);
    const char2 = lowerPassword.charCodeAt(i + 1);
    const char3 = lowerPassword.charCodeAt(i + 2);
    
    // Check for ascending sequence
    if (char2 === char1 + 1 && char3 === char2 + 1) {
      return true;
    }
    
    // Check for descending sequence
    if (char2 === char1 - 1 && char3 === char2 - 1) {
      return true;
    }
  }
  
  return false;
}