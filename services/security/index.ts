// Main SecurityManager facade
export { SecurityManager, securityManager, SecurityManagerClass } from './securityManager';
export type { SecurityConfig, SecurityStatistics } from './securityManager';

// Modular services
export { InputValidationService } from './security/inputValidationService';
export type { ValidationConfig, ValidationResult } from './security/inputValidationService';

export { RateLimitService } from './security/rateLimitService';
export type { 
  RateLimitConfig, 
  RateLimitEntry, 
  BotDetectionEntry, 
  BotDetectionConfig 
} from './security/rateLimitService';

export { ThreatDetectionService } from './security/threatDetectionService';
export type { 
  ThreatConfig, 
  WAFRule, 
  ThreatDetectionResult 
} from './security/threatDetectionService';

export { EncryptionService } from './security/encryptionService';
export type { 
  CryptoConfig, 
  APIKeyInfo, 
  CSPToken 
} from './security/encryptionService';