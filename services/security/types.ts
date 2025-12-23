export interface SecurityConfig {
  maxPayloadSize: number;
  allowedOrigins: string[];
  endpoint?: string;
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
  };
  encryption: {
    algorithm: string;
    keyRotationInterval: number;
  };
  edgeRateLimiting: {
    enabled: boolean;
    requestsPerSecond: number;
    burstLimit: number;
  };
  regionBlocking: {
    enabled: boolean;
    blockedRegions: string[];
  };
  botDetection: {
    enabled: boolean;
    suspiciousPatterns: string[];
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
  riskScore: number;
}

export interface MQL5ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedCode: string;
}

export interface WAFResult {
  isBlocked: boolean;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  blockedPatterns: string[];
  riskScore: number;
  sanitizedRequest?: any;
}

export interface RateLimitResult {
  allowed: boolean;
  resetTime?: number;
  remainingRequests?: number;
  retryAfter?: number;
}

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  botType?: 'known' | 'suspicious' | 'malicious';
  reasons: string[];
}

export interface CSPViolation {
  documentURI: string;
  referrer: string;
  violatedDirective: string;
  effectiveDirective: string;
  originalPolicy: string;
  disposition: 'report' | 'enforce';
  blockedURI?: string;
  lineNumber?: number;
  columnNumber?: number;
  sourceFile?: string;
  statusCode?: number;
  sample?: string;
}

export interface SecurityAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  data?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  wafBlocks: number;
  rateLimitBlocks: number;
  botDetection: number;
  cspViolations: number;
  topThreats: Array<{ type: string; count: number }>;
  responseTime: number;
  errorRate: number;
}

export interface CSRFToken {
  token: string;
  expiresAt: number;
  used?: boolean;
}

export interface APIKey {
  key: string;
  expiresAt: number;
  permissions: string[];
  isActive: boolean;
  lastUsed?: number;
}

export interface EdgeRequest {
  timestamp: number;
  region: string;
  endpoint: string;
  method: string;
  userAgent: string;
  ipAddress: string;
  threatScore?: number;
}

export interface SecurityAnalytics {
  threats: {
    total: number;
    byType: Record<string, number>;
    byRegion: Record<string, number>;
    timeline: Array<{ timestamp: number; count: number }>;
  };
  performance: {
    averageResponseTime: number;
    requestRate: number;
    errorRate: number;
  };
  trends: {
    emergingThreats: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
  };
}