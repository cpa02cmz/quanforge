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
  sanitizedData?: unknown;
  riskScore: number;
}

export interface RateLimitInfo {
  count: number;
  resetTime: number;
  isBlocked: boolean;
}

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  reasons: string[];
}

export interface RegionInfo {
  country: string;
  region: string;
  isBlocked: boolean;
}

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxPayloadSize: 5 * 1024 * 1024, // 5MB
  allowedOrigins: [
    'https://quanforge.ai',
    'https://www.quanforge.ai',
    'http://localhost:3000',
    'http://localhost:5173' // Vite dev server
  ],
  rateLimiting: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
  },
  encryption: {
    algorithm: 'AES-256-GCM',
    keyRotationInterval: 43200000, // 12 hours
  },
  edgeRateLimiting: {
    enabled: true,
    requestsPerSecond: 10,
    burstLimit: 20
  },
  regionBlocking: {
    enabled: true,
    blockedRegions: ['CN', 'RU', 'IR', 'KP']
  },
  botDetection: {
    enabled: true,
    suspiciousPatterns: [
      'sqlmap', 'nikto', 'nmap', 'masscan', 'dirb', 'gobuster', 
      'wfuzz', 'burp', 'owasp', 'scanner', 'bot', 'crawler', 'spider'
    ]
  }
};