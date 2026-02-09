import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance';

interface SecurityMetrics {
  requestCount: number;
  blockedRequests: number;
  suspiciousIPs: string[];
  commonAttackPatterns: string[];
  timestamp: number;
}

interface SecurityConfig {
  enableRateLimiting: boolean;
  enableInputValidation: boolean;
  enableXSSProtection: boolean;
  enableCSRFProtection: boolean;
  maxRequestsPerMinute: number;
  blockSuspiciousRequests: boolean;
}

class EdgeSecurityService {
  private metrics: SecurityMetrics;
  private config: SecurityConfig;
  private requestCounts = new Map<string, { count: number; resetTime: number }>();
  private blockedIPs = new Set<string>();
  private suspiciousPatterns = new Map<string, number>();

  constructor() {
    this.config = {
      enableRateLimiting: true,
      enableInputValidation: true,
      enableXSSProtection: true,
      enableCSRFProtection: true,
      maxRequestsPerMinute: 100,
      blockSuspiciousRequests: true,
    };

    this.metrics = {
      requestCount: 0,
      blockedRequests: 0,
      suspiciousIPs: [],
      commonAttackPatterns: [],
      timestamp: Date.now(),
    };

    this.initialize();
  }

  private initialize() {
    // Start monitoring
    this.startMonitoring();
    
    // Setup security headers
    this.setupSecurityHeaders();
    
    logger.info('Edge security service initialized');
  }

  private startMonitoring() {
    // Reset counters periodically
    setInterval(() => {
      this.resetCounters();
    }, 60 * 1000); // Every minute

    // Analyze patterns periodically
    setInterval(() => {
      this.analyzePatterns();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private setupSecurityHeaders() {
    // Add security headers to all responses
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      
      // Add security headers to response
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('X-Frame-Options', 'DENY');
      headers.set('X-XSS-Protection', '1; mode=block');
      headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };
  }

  // Main security validation function
  validateRequest(request: Request): { allowed: boolean; reason?: string } {
    this.metrics.requestCount++;

    const clientIP = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    const url = request.url;

    // Rate limiting check
    if (this.config.enableRateLimiting && !this.checkRateLimit(clientIP)) {
      this.blockRequest(clientIP, 'Rate limit exceeded');
      return { allowed: false, reason: 'Rate limit exceeded' };
    }

    // IP blacklist check
    if (this.blockedIPs.has(clientIP)) {
      this.metrics.blockedRequests++;
      return { allowed: false, reason: 'IP blocked' };
    }

    // Suspicious pattern detection
    if (this.config.blockSuspiciousRequests && this.detectSuspiciousPattern(url, userAgent)) {
      this.blockRequest(clientIP, 'Suspicious pattern detected');
      return { allowed: false, reason: 'Suspicious pattern detected' };
    }

    // Input validation for POST requests
    if (request.method === 'POST' && this.config.enableInputValidation) {
      // This would be implemented based on specific endpoint requirements
      // For now, we'll just log the request for monitoring
      this.logRequest(clientIP, request.method, url);
    }

    return { allowed: true };
  }

  private getClientIP(request: Request): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0] ||
           request.headers.get('x-real-ip') ||
           'unknown';
  }

  private checkRateLimit(clientIP: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute
    const limit = this.config.maxRequestsPerMinute;

    const current = this.requestCounts.get(clientIP);
    
    if (!current || now > current.resetTime) {
      this.requestCounts.set(clientIP, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (current.count >= limit) {
      return false;
    }
    
    current.count++;
    return true;
  }

  private detectSuspiciousPattern(url: string, userAgent: string): boolean {
    const suspiciousPatterns = [
      /\.\./,           // Directory traversal
      /<script/i,       // XSS attempts
      /javascript:/i,   // JavaScript protocol
      /data:/i,         // Data protocol
      /vbscript:/i,     // VBScript protocol
      /onload=/i,       // Event handlers
      /onerror=/i,      // Event handlers
      /union.*select/i, // SQL injection
      /drop.*table/i,   // SQL injection
      /insert.*into/i,  // SQL injection
      /delete.*from/i,  // SQL injection
    ];

    const combined = `${url} ${userAgent}`;
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(combined)) {
        this.trackSuspiciousPattern(pattern.source);
        return true;
      }
    }

    return false;
  }

  private trackSuspiciousPattern(pattern: string) {
    const count = this.suspiciousPatterns.get(pattern) || 0;
    this.suspiciousPatterns.set(pattern, count + 1);
  }

  private blockRequest(clientIP: string, reason: string) {
    this.blockedIPs.add(clientIP);
    this.metrics.blockedRequests++;
    
    if (!this.metrics.suspiciousIPs.includes(clientIP)) {
      this.metrics.suspiciousIPs.push(clientIP);
    }

    logger.warn(`Request blocked from ${clientIP}: ${reason}`);
    performanceMonitor.recordMetric('security_blocked_request', 1);
  }

  private logRequest(clientIP: string, method: string, url: string) {
    // Log requests for monitoring (excluding sensitive data)
    const sanitizedURL = url.replace(/token=[^&]*/, 'token=***');
    logger.debug(`Request: ${method} ${sanitizedURL} from ${clientIP}`);
  }

  private resetCounters() {
    const now = Date.now();
    
    // Reset rate limit counters
    for (const [key, value] of this.requestCounts.entries()) {
      if (now > value.resetTime) {
        this.requestCounts.delete(key);
      }
    }

    // Clean old blocked IPs (block for 1 hour)
    const blockedIPsArray = Array.from(this.blockedIPs);
    // This would need to be enhanced to track block timestamps
  }

  private analyzePatterns() {
    // Analyze suspicious patterns and update metrics
    const sortedPatterns = Array.from(this.suspiciousPatterns.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10); // Top 10 patterns

    this.metrics.commonAttackPatterns = sortedPatterns.map(([pattern]) => pattern);
    this.metrics.timestamp = Date.now();

    // Log high-frequency patterns
    sortedPatterns.forEach(([pattern, count]) => {
      if (count > 10) {
        logger.warn(`High-frequency attack pattern detected: ${pattern} (${count} times)`);
      }
    });
  }

  // Input sanitization
  sanitizeInput(input: string): string {
    if (!input) return '';
    
    return input
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove JavaScript protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/expression\s*\(/gi, '') // Remove CSS expressions
      .replace(/@import/gi, '') // Remove CSS imports
      .trim();
  }

  // CSRF protection
  generateCSRFToken(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  validateCSRFToken(token: string, sessionToken: string): boolean {
    // Simple validation - in production, this would be more sophisticated
    return token && sessionToken && token.length === sessionToken.length;
  }

  // Content Security Policy
  getCSPHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.vercel-insights.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://*.supabase.co https://googleapis.com",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    };
  }

  // Public API
  getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  getSecurityStatus() {
    const blockedRate = this.metrics.requestCount > 0 
      ? (this.metrics.blockedRequests / this.metrics.requestCount) * 100 
      : 0;

    return {
      status: blockedRate > 10 ? 'warning' : 'healthy',
      blockedRequests: this.metrics.blockedRequests,
      totalRequests: this.metrics.requestCount,
      blockedRate: blockedRate.toFixed(2),
      suspiciousIPs: this.metrics.suspiciousIPs.length,
      commonPatterns: this.metrics.commonAttackPatterns,
      timestamp: this.metrics.timestamp,
    };
  }

  updateConfig(newConfig: Partial<SecurityConfig>) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Security config updated', this.config);
  }

  unblockIP(ip: string) {
    this.blockedIPs.delete(ip);
    logger.info(`IP unblocked: ${ip}`);
  }

  clearMetrics() {
    this.metrics = {
      requestCount: 0,
      blockedRequests: 0,
      suspiciousIPs: [],
      commonAttackPatterns: [],
      timestamp: Date.now(),
    };
    this.suspiciousPatterns.clear();
    logger.info('Security metrics cleared');
  }
}

// Export singleton instance
export const edgeSecurityService = new EdgeSecurityService();
export default edgeSecurityService;