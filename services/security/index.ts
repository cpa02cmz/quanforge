// Main SecurityManager export
export { SecurityManager } from './securityManager';

// Module exports for advanced usage
export { InputValidator } from './inputValidator';
export { InputSanitizer } from './inputSanitizer';
export { RateLimiter, EdgeRateLimiter } from './rateLimiter';
export { BotDetector } from './botDetector';
export { RegionBlocker } from './regionBlocker';

// Type exports
export type { 
  SecurityConfig, 
  ValidationResult, 
  RateLimitInfo, 
  BotDetectionResult, 
  RegionInfo 
} from './types';

// Default config for customization
export { DEFAULT_SECURITY_CONFIG } from './types';