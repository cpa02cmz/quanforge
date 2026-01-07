/**
 * CSRF Protection Service
 * Provides comprehensive CSRF protection for API requests
 */

interface CSRFToken {
  token: string;
  expires: number;
  sessionId: string;
}

interface CSRFConfig {
  tokenLength: number;
  tokenExpiry: number;
  cookieName: string;
  headerName: string;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}

class CSRFProtection {
  private static instance: CSRFProtection;
  private config: CSRFConfig = {
    tokenLength: 32,
    tokenExpiry: 3600000, // 1 hour
    cookieName: 'csrf-token',
    headerName: 'X-CSRF-Token',
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  };
  private tokens: Map<string, CSRFToken> = new Map();
  private currentToken: CSRFToken | null = null;

  private constructor() {
    this.initializeToken();
    this.startTokenCleanup();
  }

  static getInstance(): CSRFProtection {
    if (!CSRFProtection.instance) {
      CSRFProtection.instance = new CSRFProtection();
    }
    return CSRFProtection.instance;
  }

  /**
   * Initialize CSRF token for the session
   */
  private initializeToken(): void {
    const existingToken = this.getTokenFromCookie();
    
    if (existingToken && this.isValidTokenFormat(existingToken)) {
      this.currentToken = {
        token: existingToken,
        expires: Date.now() + this.config.tokenExpiry,
        sessionId: this.getSessionId()
      };
    } else {
      this.generateNewToken();
    }
  }

  /**
   * Generate a new CSRF token
   */
  private generateNewToken(): void {
    const token = this.generateSecureToken();
    const expires = Date.now() + this.config.tokenExpiry;
    const sessionId = this.getSessionId();

    this.currentToken = { token, expires, sessionId };
    this.tokens.set(sessionId, this.currentToken);
    this.setTokenCookie(token);
  }

  /**
   * Generate cryptographically secure random token
   */
  private generateSecureToken(): string {
    const array = new Uint8Array(this.config.tokenLength);
    crypto.getRandomValues(array);
    
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get or generate session ID
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('csrf-session-id');
    
    if (!sessionId) {
      sessionId = this.generateSecureToken();
      sessionStorage.setItem('csrf-session-id', sessionId);
    }
    
    return sessionId;
  }

  /**
   * Set CSRF token in cookie
   */
  private setTokenCookie(token: string): void {
    const expires = new Date(Date.now() + this.config.tokenExpiry);
    const cookieString = [
      `${this.config.cookieName}=${token}`,
      `expires=${expires.toUTCString()}`,
      'path=/',
      this.config.secure ? 'secure' : '',
      `samesite=${this.config.sameSite}`
    ].filter(Boolean).join('; ');

    document.cookie = cookieString;
  }

  /**
   * Get CSRF token from cookie
   */
  private getTokenFromCookie(): string | null {
    const cookies = document.cookie.split(';');
    
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === this.config.cookieName) {
        return value || null;
      }
    }
    
    return null;
  }

  /**
   * Validate CSRF token format and expiry
   */
  private isValidTokenFormat(token: string): boolean {
    if (!token || token.length !== this.config.tokenLength * 2) {
      return false;
    }

    // Check if token contains only hex characters
    return /^[a-f0-9]+$/i.test(token);
  }

  /**
   * Start periodic cleanup of expired tokens
   */
  private startTokenCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredTokens();
    }, 300000); // Cleanup every 5 minutes
  }

  /**
   * Remove expired tokens from memory
   */
  private cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, token] of this.tokens.entries()) {
      if (now > token.expires) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.tokens.delete(sessionId);
    });

    if (expiredSessions.length > 0) {
      console.debug(`Cleaned up ${expiredSessions.length} expired CSRF tokens`);
    }
  }

  /**
   * Get current CSRF token
   */
  getToken(): string {
    if (!this.currentToken || Date.now() > this.currentToken.expires) {
      this.generateNewToken();
    }

    return this.currentToken!.token;
  }

  /**
   * Validate CSRF token from request
   */
  validateToken(token: string): boolean {
    if (!token || !this.currentToken) {
      return false;
    }

    // Check if token matches current token
    if (token !== this.currentToken.token) {
      console.warn('CSRF token mismatch');
      return false;
    }

    // Check if token has expired
    if (Date.now() > this.currentToken.expires) {
      console.warn('CSRF token expired');
      return false;
    }

    return true;
  }

  /**
   * Validate CSRF token from request headers
   */
  validateCSRFRequest(request: Request): boolean {
    const token = request.headers.get(this.config.headerName);
    
    if (!token) {
      return false;
    }

    return this.validateToken(token);
  }

  /**
   * Add CSRF token to request headers
   */
  addTokenToHeaders(headers: Record<string, string>): Record<string, string> {
    return {
      ...headers,
      [this.config.headerName]: this.getToken()
    };
  }

  /**
   * Add CSRF token to fetch options
   */
  addToFetchOptions(options: any = {}): any {
    const headers = new Headers(options.headers);
    headers.set(this.config.headerName, this.getToken());

    return {
      ...options,
      headers
    };
  }

  /**
   * Refresh CSRF token
   */
  refreshToken(): void {
    this.generateNewToken();
  }

  /**
   * Revoke current CSRF token
   */
  revokeToken(): void {
    if (this.currentToken) {
      this.tokens.delete(this.currentToken.sessionId);
      this.currentToken = null;
    }

    // Remove cookie
    document.cookie = `${this.config.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    
    // Remove session ID
    sessionStorage.removeItem('csrf-session-id');
  }

  /**
   * Get CSRF protection status
   */
  getStatus(): {
    enabled: boolean;
    hasToken: boolean;
    tokenExpires: number | null;
    sessionId: string | null;
  } {
    return {
      enabled: true,
      hasToken: !!this.currentToken,
      tokenExpires: this.currentToken?.expires || null,
      sessionId: this.currentToken?.sessionId || null
    };
  }

  /**
   * Configure CSRF protection settings
   */
  configure(config: Partial<CSRFConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('CSRF protection configuration updated:', this.config);
  }

  /**
   * Generate nonce for CSP
   */
  generateNonce(): string {
    return this.generateSecureToken();
  }

  /**
   * Validate origin for same-site requests
   */
  validateOrigin(request: Request): boolean {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const currentOrigin = window.location.origin;

    // Allow same-origin requests
    if (origin === currentOrigin) {
      return true;
    }

    // Check referer as fallback
    if (referer && referer.startsWith(currentOrigin)) {
      return true;
    }

    // Allow requests without origin/referer (like mobile apps)
    if (!origin && !referer) {
      return true;
    }

    console.warn('CSRF origin validation failed:', { origin, referer, currentOrigin });
    return false;
  }

  /**
   * Comprehensive request validation
   */
  validateFullRequest(request: Request): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate origin
    if (!this.validateOrigin(request)) {
      errors.push('Invalid origin');
    }

    // Validate CSRF token
    const token = request.headers.get(this.config.headerName);
    if (!token) {
      errors.push('CSRF token missing');
    } else if (!this.validateToken(token)) {
      errors.push('Invalid CSRF token');
    }

    // Validate request method (CSRF mainly for state-changing requests)
    const method = request.method.toUpperCase();
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (!safeMethods.includes(method) && !token) {
      errors.push('CSRF token required for state-changing requests');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export const csrfProtection = CSRFProtection.getInstance();

// Utility functions for common use cases
export const withCSRF = (fetch: typeof global.fetch) => {
  return async (url: string, options?: RequestInit) => {
    const optionsWithCSRF = csrfProtection.addToFetchOptions(options);
    return fetch(url, optionsWithCSRF);
  };
};

export const addCSRFToHeaders = (headers: any = {}): any => {
  const csrfHeaders = csrfProtection.addTokenToHeaders({});
  return { ...headers, ...csrfHeaders };
};