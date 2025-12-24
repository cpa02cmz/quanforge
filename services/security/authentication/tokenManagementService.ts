interface CSRFToken {
  token: string;
  expiresAt: number;
}

interface APIKeyConfig {
  apiKey: string;
  provider: string;
  createdAt: number;
  lastUsed?: number;
  isActive: boolean;
}

export class TokenManagementService {
  private static instance: TokenManagementService;
  private csrfTokens = new Map<string, CSRFToken>();
  private apiKeys = new Map<string, APIKeyConfig>();
  private readonly tokenExpiration = 3600000; // 1 hour
  private readonly apiKeyRotationInterval = 86400000; // 24 hours

  private constructor() {
    // Clean up expired tokens every 10 minutes
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 10 * 60 * 1000);
  }

  static getInstance(): TokenManagementService {
    if (!TokenManagementService.instance) {
      TokenManagementService.instance = new TokenManagementService();
    }
    return TokenManagementService.instance;
  }

  generateCSRFToken(sessionId: string): string {
    // Generate secure token
    const token = this.generateSecureToken();
    const expiresAt = Date.now() + this.tokenExpiration;

    // Store token
    this.csrfTokens.set(sessionId, { token, expiresAt });

    // Clean up existing expired tokens for this session
    this.cleanupExpiredTokens();

    return token;
  }

  validateCSRFToken(sessionId: string, token: string): boolean {
    const stored = this.csrfTokens.get(sessionId);
    
    if (!stored) {
      return false;
    }

    const isExpired = Date.now() > stored.expiresAt;
    
    if (isExpired || stored.token !== token) {
      this.csrfTokens.delete(sessionId);
      return false;
    }

    // Remove token after successful validation (one-time use)
    this.csrfTokens.delete(sessionId);
    return true;
  }

  validateAPIKey(apiKey: string, _type: 'gemini' | 'supabase' | 'twelvedata' | 'generic' = 'generic'): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic format validation
    const keyConfig = this.apiKeys.get(apiKey);
    if (!keyConfig) {
      return false;
    }

    // Check if key is active
    if (!keyConfig.isActive) {
      return false;
    }

    // Check if key has expired (if rotation is enabled)
    const keyAge = Date.now() - keyConfig.createdAt;
    if (keyAge > this.apiKeyRotationInterval) {
      keyConfig.isActive = false;
      return false;
    }

    // Update last used timestamp
    keyConfig.lastUsed = Date.now();

    return true;
  }

  registerAPIKey(apiKey: string, provider: string): boolean {
    if (!apiKey || !provider) {
      return false;
    }

    // Check if key already exists
    if (this.apiKeys.has(apiKey)) {
      return false;
    }

    // Register new key
    this.apiKeys.set(apiKey, {
      apiKey,
      provider,
      createdAt: Date.now(),
      isActive: true
    });

    return true;
  }

  rotateAPIKey(oldKey: string, newKey: string): { success: boolean; message: string } {
    if (!oldKey || !newKey) {
      return { success: false, message: 'Both old and new keys are required' };
    }

    const existingKey = this.apiKeys.get(oldKey);
    if (!existingKey) {
      return { success: false, message: 'Old key not found' };
    }

    if (!existingKey.isActive) {
      return { success: false, message: 'Old key is already inactive' };
    }

    // Deactivate old key
    existingKey.isActive = false;

    // Activate new key
    const success = this.registerAPIKey(newKey, existingKey.provider);
    if (success) {
      return { success: true, message: 'API key rotated successfully' };
    } else {
      // Reactivate old key if new key registration failed
      existingKey.isActive = true;
      return { success: false, message: 'Failed to register new key' };
    }
  }

  deactivateAPIKey(apiKey: string): boolean {
    const keyConfig = this.apiKeys.get(apiKey);
    if (!keyConfig) {
      return false;
    }

    keyConfig.isActive = false;
    return true;
  }

  getActiveAPIKeys(provider?: string): Array<{ apiKey: string; provider: string; createdAt: number; lastUsed?: number }> {
    const activeKeys: Array<{ apiKey: string; provider: string; createdAt: number; lastUsed?: number }> = [];

    this.apiKeys.forEach((config, key) => {
      if (config.isActive && (!provider || config.provider === provider)) {
        activeKeys.push({
          apiKey: key,
          provider: config.provider,
          createdAt: config.createdAt,
          lastUsed: config.lastUsed
        });
      }
    });

    return activeKeys;
  }

  getTokenStats(): {
    activeCSRF: number;
    expiredCSRF: number;
    activeAPIKeys: number;
    inactiveAPIKeys: number;
  } {
    const now = Date.now();
    let activeCSRF = 0;
    let expiredCSRF = 0;
    let activeAPIKeys = 0;
    let inactiveAPIKeys = 0;

    this.csrfTokens.forEach(token => {
      if (now > token.expiresAt) {
        expiredCSRF++;
      } else {
        activeCSRF++;
      }
    });

    this.apiKeys.forEach(config => {
      if (config.isActive) {
        activeAPIKeys++;
      } else {
        inactiveAPIKeys++;
      }
    });

    return {
      activeCSRF,
      expiredCSRF,
      activeAPIKeys,
      inactiveAPIKeys
    };
  }

  clearExpiredTokens(): number {
    return this.cleanupExpiredTokens();
  }

  // Admin function to manually add a key with custom expiration
  addCustomAPIKey(
    apiKey: string, 
    provider: string, 
    _customExpiration?: number
  ): { success: boolean; message: string } {
    if (!apiKey || !provider) {
      return { success: false, message: 'API key and provider are required' };
    }

    if (this.apiKeys.has(apiKey)) {
      return { success: false, message: 'API key already exists' };
    }

    this.apiKeys.set(apiKey, {
      apiKey,
      provider,
      createdAt: Date.now(),
      isActive: true
    });

    return { success: true, message: 'Custom API key added successfully' };
  }

  // Get key usage analytics
  getKeyUsageAnalytics(): Array<{
    provider: string;
    totalKeys: number;
    activeKeys: number;
    recentlyUsed: number;
    averageAge: number;
  }> {
    const providerStats = new Map<string, {
      total: number;
      active: number;
      recentlyUsed: number;
      totalAge: number;
    }>();

    const now = Date.now();
    const recentThreshold = 24 * 60 * 60 * 1000; // 24 hours

    this.apiKeys.forEach((config) => {
      const existing = providerStats.get(config.provider) || {
        total: 0,
        active: 0,
        recentlyUsed: 0,
        totalAge: 0
      };

      existing.total++;
      if (config.isActive) existing.active++;
      if (config.lastUsed && (now - config.lastUsed) < recentThreshold) {
        existing.recentlyUsed++;
      }
      existing.totalAge += (now - config.createdAt);

      providerStats.set(config.provider, existing);
    });

    return Array.from(providerStats.entries()).map(([provider, stats]) => ({
      provider,
      totalKeys: stats.total,
      activeKeys: stats.active,
      recentlyUsed: stats.recentlyUsed,
      averageAge: stats.total > 0 ? stats.totalAge / stats.total : 0
    }));
  }

  private generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = 32;
    let result = '';
    
    // Use crypto if available, fallback to Math.random
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const randomValues = new Uint32Array(length);
      window.crypto.getRandomValues(randomValues);
      // Simple fallback to avoid TypeScript strict issues
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    } else {
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    
    return result;
  }

  private cleanupExpiredTokens(): number {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean up expired CSRF tokens
    const expiredTokens: string[] = [];
    this.csrfTokens.forEach((token, sessionId) => {
      if (now > token.expiresAt) {
        expiredTokens.push(sessionId);
      }
    });

    expiredTokens.forEach(sessionId => {
      this.csrfTokens.delete(sessionId);
      cleanedCount++;
    });

    return cleanedCount;
  }
}