/**
 * Authentication Token Service
 * 
 * Handles all token management, API key rotation, and authentication-related functionality.
 * This service manages CSRF tokens, API keys, and secure token generation.
 * 
 * @author QuantForge Security Team
 * @version 1.0.0
 */

import { securityUtils } from './SecurityUtilsService';

export interface TokenConfig {
  tokenExpiryMs: number;
  keyRotationIntervalMs: number;
  tokenLength: number;
  enableAutoRotation: boolean;
}

export interface APIKeyRotationResult {
  oldKey: string;
  newKey: string;
  expiresAt: number;
  rotationSuccessful: boolean;
}

export interface TokenValidationResult {
  isValid: boolean;
  isExpired: boolean;
  expiresAt?: number;
  timeRemaining?: number;
}

/**
 * Authentication and token management service
 */
export class AuthenticationTokenService {
  private static instance: AuthenticationTokenService;
  private config: TokenConfig;
  private csrfTokens = new Map<string, { token: string; expiresAt: number }>();
  private apiKeys = new Map<string, { key: string; expiresAt: number; type: string }>();

  private constructor() {
    this.config = {
      tokenExpiryMs: 3600000, // 1 hour
      keyRotationIntervalMs: 43200000, // 12 hours
      tokenLength: 32,
      enableAutoRotation: true
    };

    // Initialize existing tokens from storage
    this.loadTokensFromStorage();
    this.startTokenCleanupTimer();
  }

  static getInstance(): AuthenticationTokenService {
    if (!AuthenticationTokenService.instance) {
      AuthenticationTokenService.instance = new AuthenticationTokenService();
    }
    return AuthenticationTokenService.instance;
  }

  /**
   * Generate CSRF token for session
   */
  generateCSRFToken(sessionId: string): string {
    const token = securityUtils.generateSecureToken();
    const expiresAt = Date.now() + this.config.tokenExpiryMs;
    
    // Store token with expiration
    this.csrfTokens.set(sessionId, { token, expiresAt });
    this.saveTokensToStorage();
    
    securityUtils.logSecurityEvent('CSRFTokenGenerated', { sessionId });
    return token;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(sessionId: string, token: string): boolean {
    const stored = this.csrfTokens.get(sessionId);
    if (!stored || stored.expiresAt < Date.now()) {
      this.csrfTokens.delete(sessionId);
      this.saveTokensToStorage();
      return false;
    }
    
    const isValid = stored.token === token;
    if (!isValid) {
      securityUtils.logSecurityEvent('CSRFTokenInvalid', { sessionId, providedToken: token });
    }
    
    return isValid;
  }

  /**
   * Generate secure API key for specific service
   */
  generateSecureAPIKey(serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): string {
    const prefix = this.getAPIKeyPrefix(serviceType);
    const randomPart = securityUtils.generateSecureToken().replace(/-/g, '');
    return `${prefix}${randomPart}`;
  }

  /**
   * Get API key prefix based on service type
   */
  private getAPIKeyPrefix(serviceType: string): string {
    const prefixes = {
      gemini: 'qf_gem_',
      supabase: 'qf_sup_',
      twelvedata: 'qf_td_',
      generic: 'qf_gen_'
    };
    return prefixes[serviceType as keyof typeof prefixes] || prefixes.generic;
  }

  /**
   * Store API key with expiration
   */
  storeAPIKey(key: string, serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic', customExpiry?: number): void {
    const expiresAt = customExpiry || Date.now() + this.config.keyRotationIntervalMs;
    
    this.apiKeys.set(securityUtils.hashString(key), {
      key,
      expiresAt,
      type: serviceType
    });
    
    this.saveTokensToStorage();
    securityUtils.logSecurityEvent('APIKeyStored', { serviceType, keyCount: this.apiKeys.size, expiresAt });
  }

  /**
   * Get current API key for service type
   */
  getCurrentAPIKey(serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic'): string | null {
    for (const [, keyData] of this.apiKeys.entries()) {
      if (keyData.type === serviceType && keyData.expiresAt > Date.now()) {
        return keyData.key;
      }
    }
    return null;
  }

  /**
   * Rotate API keys for enhanced security
   */
  rotateAPIKeys(serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic'): APIKeyRotationResult {
    const oldKey = this.getCurrentAPIKey(serviceType);
    
    try {
      const newKey = this.generateSecureAPIKey(serviceType);
      const expiresAt = Date.now() + this.config.keyRotationIntervalMs;

      // Store new key
      this.storeAPIKey(newKey, serviceType, expiresAt);

      // Remove old key
      if (oldKey) {
        this.apiKeys.delete(securityUtils.hashString(oldKey));
      }

      securityUtils.logSecurityEvent('APIKeyRotated', { serviceType, oldKeyPresent: !!oldKey });
      
      return {
        oldKey: oldKey || '',
        newKey,
        expiresAt,
        rotationSuccessful: true
      };
    } catch (error) {
      securityUtils.logSecurityEvent('APIKeyRotationFailed', { serviceType, error });
      
      return {
        oldKey: oldKey || '',
        newKey: '',
        expiresAt: 0,
        rotationSuccessful: false
      };
    }
  }

  /**
   * Validate API key format and expiration
   */
  validateAPIKey(apiKey: string, serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): TokenValidationResult {
    if (!apiKey || typeof apiKey !== 'string') {
      return { isValid: false, isExpired: false };
    }

    // Check for placeholder/demo values
    const placeholders = ['your-api-key', 'api-key-here', 'xxx', 'test-key', 'demo', 'sample'];
    if (placeholders.some(placeholder => apiKey.toLowerCase().includes(placeholder))) {
      return { isValid: false, isExpired: false };
    }

    // Service-specific validation
    let formatValid = false;
    switch (serviceType) {
      case 'gemini':
        // Gemini API keys typically start with 'AIza'
        formatValid = /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey);
        break;
        
      case 'supabase':
        // Supabase keys are typically JWT tokens or longer strings
        formatValid = /^[A-Za-z0-9_-]{30,}$/.test(apiKey);
        break;
        
      case 'twelvedata':
        // TwelveData API keys are typically 32 characters
        formatValid = /^[A-Za-z0-9]{32}$/.test(apiKey);
        break;
        
      case 'generic':
        // Generic validation - allow alphanumeric with common symbols
        formatValid = /^[A-Za-z0-9._-]{10,}$/.test(apiKey);
        break;
    }

    if (!formatValid) {
      return { isValid: false, isExpired: false };
    }

    // Check if key is stored and not expired
    const keyId = securityUtils.hashString(apiKey);
    const storedKey = this.apiKeys.get(keyId);
    
    if (!storedKey) {
      return { isValid: false, isExpired: false };
    }

    const now = Date.now();
    const isExpired = storedKey.expiresAt <= now;
    const timeRemaining = Math.max(0, storedKey.expiresAt - now);

    return {
      isValid: !isExpired,
      isExpired,
      expiresAt: storedKey.expiresAt,
      timeRemaining
    };
  }

  /**
   * Generate generic secure token
   */
  generateSecureToken(length?: number): string {
    const tokenLength = length || this.config.tokenLength;
    const array = new Uint8Array(tokenLength);
    
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for older environments
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if any keys need rotation
   */
  checkKeyRotationNeeds(): Array<{ serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic'; needsRotation: boolean; timeUntilExpiry: number }> {
    const results: Array<{ serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic'; needsRotation: boolean; timeUntilExpiry: number }> = [];
    
    const serviceTypes: Array<'gemini' | 'supabase' | 'twelvedata' | 'generic'> = ['gemini', 'supabase', 'twelvedata', 'generic'];
    
    for (const serviceType of serviceTypes) {
      const currentKey = this.getCurrentAPIKey(serviceType);
      if (currentKey) {
        const validation = this.validateAPIKey(currentKey, serviceType);
        const timeUntilExpiry = validation.timeRemaining || 0;
        const needsRotation = timeUntilExpiry < (this.config.keyRotationIntervalMs * 0.1); // 10% threshold
        
        results.push({ serviceType, needsRotation, timeUntilExpiry });
      } else {
        results.push({ serviceType, needsRotation: true, timeUntilExpiry: 0 });
      }
    }
    
    return results;
  }

  /**
   * Auto-rotate keys if needed (when enabled)
   */
  async autoRotateKeys(): Promise<Array<{ serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic'; rotated: boolean; error?: string }>> {
    if (!this.config.enableAutoRotation) {
      return [];
    }

    const rotationNeeds = this.checkKeyRotationNeeds();
    const results: Array<{ serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic'; rotated: boolean; error?: string }> = [];

    for (const { serviceType, needsRotation } of rotationNeeds) {
      if (needsRotation) {
        try {
          const rotation = this.rotateAPIKeys(serviceType);
          results.push({ 
            serviceType, 
            rotated: rotation.rotationSuccessful,
            error: rotation.rotationSuccessful ? undefined : 'Rotation failed'
          });
        } catch (error) {
          results.push({ 
            serviceType, 
            rotated: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        results.push({ serviceType, rotated: false });
      }
    }

    return results;
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens(): number {
    let cleanedCount = 0;

    // Clean CSRF tokens
    for (const [sessionId, tokenData] of this.csrfTokens.entries()) {
      if (Date.now() > tokenData.expiresAt) {
        this.csrfTokens.delete(sessionId);
        cleanedCount++;
      }
    }

    // Clean API keys
    for (const [keyId, keyData] of this.apiKeys.entries()) {
      if (Date.now() > keyData.expiresAt) {
        this.apiKeys.delete(keyId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.saveTokensToStorage();
      securityUtils.logSecurityEvent('TokenCleanup', { cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Start automatic token cleanup timer
   */
  private startTokenCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 60000); // Check every minute
  }

  /**
   * Save tokens to localStorage
   */
  private saveTokensToStorage(): void {
    try {
      // Save CSRF tokens
      const csrfData = Array.from(this.csrfTokens.entries()).map(([sessionId, data]) => ({
        sessionId,
        ...data
      }));
      localStorage.setItem('csrf_tokens', JSON.stringify(csrfData));

      // Save API keys (only key IDs and metadata, not actual keys for security)
      const apiKeyData = Array.from(this.apiKeys.entries()).map(([keyId, data]) => ({
        keyId,
        expiresAt: data.expiresAt,
        type: data.type
        // Note: actual key is not stored in localStorage for security
      }));
      localStorage.setItem('api_keys_metadata', JSON.stringify(apiKeyData));
    } catch (error) {
      securityUtils.logSecurityEvent('TokenStorageError', { error });
    }
  }

  /**
   * Load tokens from localStorage
   */
  private loadTokensFromStorage(): void {
    try {
      // Load CSRF tokens
      const csrfData = localStorage.getItem('csrf_tokens');
      if (csrfData) {
        const tokens = JSON.parse(csrfData);
        for (const token of tokens) {
          if (token.expiresAt > Date.now()) {
            this.csrfTokens.set(token.sessionId, {
              token: token.token,
              expiresAt: token.expiresAt
            });
          }
        }
      }

      // Load API keys metadata (actual keys need to be provided by application)
      const apiKeyData = localStorage.getItem('api_keys_metadata');
      if (apiKeyData) {
        const keys = JSON.parse(apiKeyData);
        for (const key of keys) {
          // Only restore metadata - actual keys must be provided by application
          if (key.expiresAt > Date.now()) {
            // This would require the application to provide the actual key values
            // For now, we just track the metadata
          }
        }
      }
    } catch (error) {
      securityUtils.logSecurityEvent('TokenLoadError', { error });
    }
  }

  /**
   * Get token statistics
   */
  getTokenStats(): {
    activeCSRFTokens: number;
    activeAPIKeys: number;
    expiredTokens: number;
    keysNeedingRotation: number;
  } {
    let activeCSRFTokens = 0;
    let activeAPIKeys = 0;
    let keysNeedingRotation = 0;

    // Count active CSRF tokens
    for (const [, tokenData] of this.csrfTokens.entries()) {
      if (Date.now() <= tokenData.expiresAt) {
        activeCSRFTokens++;
      }
    }

    // Count active API keys and those needing rotation
    for (const [, keyData] of this.apiKeys.entries()) {
      if (Date.now() <= keyData.expiresAt) {
        activeAPIKeys++;
        const timeRemaining = keyData.expiresAt - Date.now();
        if (timeRemaining < (this.config.keyRotationIntervalMs * 0.1)) {
          keysNeedingRotation++;
        }
      }
    }

    return {
      activeCSRFTokens,
      activeAPIKeys,
      expiredTokens: (this.csrfTokens.size + this.apiKeys.size) - (activeCSRFTokens + activeAPIKeys),
      keysNeedingRotation
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): TokenConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TokenConfig>): void {
    this.config = { ...this.config, ...newConfig };
    securityUtils.logSecurityEvent('TokenConfigUpdated', { newConfig });
  }

  /**
   * Manually revoke all tokens for a service
   */
  revokeServiceTokens(serviceType: 'gemini' | 'supabase' | 'twelvedata' | 'generic'): number {
    let revokedCount = 0;
    const keysToDelete: string[] = [];

    for (const [keyId, keyData] of this.apiKeys.entries()) {
      if (keyData.type === serviceType) {
        keysToDelete.push(keyId);
      }
    }

    keysToDelete.forEach(keyId => {
      this.apiKeys.delete(keyId);
      revokedCount++;
    });

    if (revokedCount > 0) {
      this.saveTokensToStorage();
      securityUtils.logSecurityEvent('TokensRevoked', { serviceType, revokedCount });
    }

    return revokedCount;
  }
}

// Export singleton instance for convenience
export const authToken = AuthenticationTokenService.getInstance();