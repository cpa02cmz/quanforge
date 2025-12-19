// Legacy SecurityManager - redirects to modular implementation
// This file maintains backward compatibility while the actual implementation
// has been moved to the modular structure in /security/

export { securityManager, SecurityManager } from './security/SecurityManager';

// Re-export types for backward compatibility
export type { ValidationResult } from './security/InputValidator';