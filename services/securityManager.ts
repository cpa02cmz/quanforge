// Re-export the new SecurityManager facade for backward compatibility
export { default as SecurityManager } from './security/core/securityManager';
export type { SecurityConfig, ValidationResult } from './security/core/securityManager';

// Legacy export for direct service access
import SecurityManagerFacade from './security/core/securityManager';

// Create singleton instance for legacy usage
const securityManagerInstance = SecurityManagerFacade.getInstance();

// Export both the class instance and the facade for backward compatibility
export default securityManagerInstance;
export { securityManagerInstance as securityManager };