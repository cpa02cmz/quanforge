/**
 * @deprecated This file has been refactored into modular services.
 * Please use the new SecurityFacade instead: import securityManager from './security/SecurityFacade'
 * 
 * This file remains for backward compatibility during the migration period.
 * The original 1611-line monolith has been decomposed into:
 * - SecurityUtilsService: Foundation utilities and helpers
 * - InputValidationService: Data validation and sanitization
 * - RateLimitingService: Rate limiting and access control
 * - AuthenticationTokenService: Token and API key management
 * - SecurityMonitoringService: Security event monitoring and alerting
 * - WebApplicationFirewallService: WAF patterns and threat detection
 * - SecurityFacade: Backward compatibility layer
 */

// Legacy export - redirects to new modular implementation
export { default } from './security/SecurityFacade';
export type {
  SecurityConfig,
  ValidationResult
} from './security/SecurityFacade';

// Keep this file for backward compatibility during migration
console.warn('⚠️ DEPRECATED: Using legacy securityManager.ts. Please migrate to the new modular security services in ./security/');