/**
 * Security Configuration - Centralized security settings
 */

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
    edgeWindowMs?: number;
  };
  regionBlocking: {
    enabled: boolean;
    blockedRegions: string[];
  };
  botDetection: {
    enabled: boolean;
    suspiciousPatterns: string[];
  };
  validation: {
    name: {
      minLength: number;
      maxLength: number;
    };
    description: {
      maxLength: number;
    };
    risk: {
      minPercentage: number;
      maxPercentage: number;
    };
    deposit: {
      minAmount: number;
      maxAmount: number;
    };
    backtest: {
      minDays: number;
      maxDays: number;
    };
  };
  company: {
    name: string;
    url: string;
    email: string;
    phone: string;
    address: string;
    social: {
      twitter: string;
      linkedin: string;
      github: string;
    };
  };
}

export const securityConfig: SecurityConfig = {
  maxPayloadSize: parseInt(import.meta.env.VITE_MAX_PAYLOAD_SIZE || '5242880') || 5 * 1024 * 1024,
  allowedOrigins: (
    import.meta.env.VITE_ALLOWED_ORIGINS?.split(',') || [
      'https://quanforge.ai',
      'https://www.quanforge.ai',
      'http://localhost:3000',
      'http://localhost:5173'
    ]
  ).map(origin => origin.trim()),
  endpoint: import.meta.env.VITE_SECURITY_ENDPOINT,
  rateLimiting: {
    windowMs: parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW || '60000') || 60000,
    maxRequests: parseInt(import.meta.env.VITE_RATE_LIMIT_MAX || '100') || 100,
  },
  encryption: {
    algorithm: import.meta.env.VITE_ENCRYPTION_ALGORITHM || 'AES-256-GCM',
    keyRotationInterval: parseInt(import.meta.env.VITE_ENCRYPTION_KEY_ROTATION || '43200000') || 43200000,
  },
  edgeRateLimiting: {
    enabled: import.meta.env.VITE_EDGE_RATE_LIMIT_ENABLED !== 'false',
    requestsPerSecond: parseInt(import.meta.env.VITE_EDGE_RATE_LIMIT_RPS || '10') || 10,
    burstLimit: parseInt(import.meta.env.VITE_EDGE_RATE_LIMIT_BURST || '20') || 20,
    edgeWindowMs: parseInt(import.meta.env.VITE_EDGE_RATE_LIMIT_WINDOW || '1000') || 1000,
  },
  regionBlocking: {
    enabled: import.meta.env.VITE_REGION_BLOCKING_ENABLED !== 'false',
    blockedRegions: (
      import.meta.env.VITE_BLOCKED_REGIONS?.split(',') || ['CN', 'RU', 'IR', 'KP']
    ).map(region => region.trim()),
  },
  botDetection: {
    enabled: import.meta.env.VITE_BOT_DETECTION_ENABLED !== 'false',
    suspiciousPatterns: (
      import.meta.env.VITE_SUSPICIOUS_BOT_PATTERNS?.split(',') || [
        'bot',
        'crawler',
        'spider',
        'scraper'
      ]
    ).map(pattern => pattern.trim()),
  },
  validation: {
    name: {
      minLength: parseInt(import.meta.env.VITE_NAME_MIN_LENGTH || '3') || 3,
      maxLength: parseInt(import.meta.env.VITE_NAME_MAX_LENGTH || '100') || 100,
    },
    description: {
      maxLength: parseInt(import.meta.env.VITE_DESCRIPTION_MAX_LENGTH || '1000') || 1000,
    },
    risk: {
      minPercentage: parseFloat(import.meta.env.VITE_RISK_MIN_PERCENTAGE || '0.01') || 0.01,
      maxPercentage: parseFloat(import.meta.env.VITE_RISK_MAX_PERCENTAGE || '100') || 100,
    },
    deposit: {
      minAmount: parseFloat(import.meta.env.VITE_DEPOSIT_MIN_AMOUNT || '100') || 100,
      maxAmount: parseFloat(import.meta.env.VITE_DEPOSIT_MAX_AMOUNT || '10000000') || 10000000,
    },
    backtest: {
      minDays: parseInt(import.meta.env.VITE_BACKTEST_MIN_DAYS || '1') || 1,
      maxDays: parseInt(import.meta.env.VITE_BACKTEST_MAX_DAYS || '365') || 365,
    },
  },
  company: {
    name: import.meta.env.VITE_COMPANY_NAME || 'QuantForge AI',
    url: import.meta.env.VITE_SITE_URL || 'https://quanforge.ai',
    email: import.meta.env.VITE_COMPANY_EMAIL || 'contact@quanforge.ai',
    phone: import.meta.env.VITE_COMPANY_PHONE || '+1-555-0123',
    address: import.meta.env.VITE_COMPANY_ADDRESS || '123 Tech Street, San Francisco, CA 94105',
    social: {
      twitter: import.meta.env.VITE_COMPANY_TWITTER || 'https://twitter.com/quanforge',
      linkedin: import.meta.env.VITE_COMPANY_LINKEDIN || 'https://linkedin.com/company/quanforge',
      github: import.meta.env.VITE_COMPANY_GITHUB || 'https://github.com/quanforge',
    },
  },
};