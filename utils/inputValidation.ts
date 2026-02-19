import { ValidationError } from './validationTypes';
import { validateRequired } from './validationHelpers';
import DOMPurify from 'dompurify';
import { VALIDATION_LIMITS } from '../constants/modularConfig';

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
  if (content.length > VALIDATION_LIMITS.STRING.TEXT_AREA) {
    errors.push({
      field: 'message',
      message: `Message is too long. Maximum ${VALIDATION_LIMITS.STRING.TEXT_AREA.toLocaleString()} characters allowed.`
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