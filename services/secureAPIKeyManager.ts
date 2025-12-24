/**
 * Client-side API Key Management Service
 * Uses server-side edge function for secure API key management
 * Eliminates client-side API key storage
 */

interface APIKeyRequest {
  sessionId: string;
  provider: 'google' | 'openai';
  operation: 'generate' | 'analyze' | 'validate';
}

interface APIKeyResponse {
  success: boolean;
  apiKey?: string;
  maskedKey?: string;
  provider: string;
  operation: string;
  error?: string;
}

export class SecureAPIKeyManager {
  private static instance: SecureAPIKeyManager;
  private edgeFunctionURL = '/api/edge/api-key-manager';
  private sessionId: string;
  private keyCache = new Map<string, { key: string; expires: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Generate or retrieve session ID
    this.sessionId = this.getOrCreateSessionId();
  }

  static getInstance(): SecureAPIKeyManager {
    if (!SecureAPIKeyManager.instance) {
      SecureAPIKeyManager.instance = new SecureAPIKeyManager();
    }
    return SecureAPIKeyManager.instance;
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('secure_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('secure_session_id', sessionId);
    }
    return sessionId;
  }

  async getAPIKey(provider: 'google' | 'openai', operation: 'generate' | 'analyze' | 'validate' = 'generate'): Promise<string> {
    const cacheKey = `${provider}_${operation}`;
    const cached = this.keyCache.get(cacheKey);

    // Check cache first
    if (cached && Date.now() < cached.expires) {
      return cached.key;
    }

    try {
      const request: APIKeyRequest = {
        sessionId: this.sessionId,
        provider,
        operation,
      };

      const response = await fetch(this.edgeFunctionURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: APIKeyResponse = await response.json();

      if (!data.success || !data.apiKey) {
        throw new Error(data.error || 'Failed to retrieve API key');
      }

      // Cache the key
      this.keyCache.set(cacheKey, {
        key: data.apiKey,
        expires: Date.now() + this.CACHE_DURATION,
      });

      return data.apiKey;

    } catch (error) {
      console.error('Secure API key retrieval failed:', error);
      
      // In case of failure, try to fall back to any cached key (even if expired)
      if (cached) {
        console.warn('Using expired cached API key as fallback');
        return cached.key;
      }

      throw new Error(
        `Failed to retrieve secure API key: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Method to validate API key availability
  async validateAPIKey(provider: 'google' | 'openai'): Promise<boolean> {
    try {
      await this.getAPIKey(provider, 'validate');
      return true;
    } catch (error) {
      console.warn(`API key validation failed for ${provider}:`, error);
      return false;
    }
  }

  // Get masked key for display purposes
  async getMaskedKey(provider: 'google' | 'openai'): Promise<string> {
    try {
      const request: APIKeyRequest = {
        sessionId: this.sessionId,
        provider,
        operation: 'validate',
      };

      const response = await fetch(this.edgeFunctionURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: APIKeyResponse = await response.json();

      if (!data.success || !data.maskedKey) {
        throw new Error(data.error || 'Failed to retrieve masked key');
      }

      return data.maskedKey;

    } catch (error) {
      console.error('Failed to get masked key:', error);
      return '***';
    }
  }

  // Clear cache (useful for testing or when keys change)
  clearCache(): void {
    this.keyCache.clear();
  }

  // Get session info for debugging
  getSessionInfo(): { sessionId: string; cacheSize: number } {
    return {
      sessionId: this.sessionId,
      cacheSize: this.keyCache.size,
    };
  }
}

// Export singleton instance
export const secureAPIKeyManager = SecureAPIKeyManager.getInstance();