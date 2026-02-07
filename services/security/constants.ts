/**
 * Security Constants and Configuration
 * Centralized configuration for all security modules
 */

import { getUrlConfig } from '../../utils/urls';

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

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxPayloadSize: 5 * 1024 * 1024, // 5MB for security
  allowedOrigins: (() => {
    const urlConfig = getUrlConfig();
    return urlConfig.getAllowedOrigins();
  })(),
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

// MQL5 Security Patterns
export const DANGEROUS_FUNCTIONS = [
  'SendFTP', 'SendMail', 'SendNotification', 'Sleep', 'TerminalClose',
  'ExpertRemove', 'ChartClose', 'ObjectDelete', 'WindowScreenShot'
];

export const MQL5_SECURITY_PATTERNS = [
  {
    pattern: /import\s+/,
    message: 'Import directives detected in code',
    riskScore: 60
  },
  {
    pattern: /#property\s+copyright/i,
    message: 'Copyright directives may contain sensitive info',
    riskScore: 20
  },
  {
    pattern: /dllimport/i,
    message: 'DLL imports detected - potential security risk',
    riskScore: 80
  },
  {
    pattern: /wininet|winhttp/i,
    message: 'Direct HTTP calls detected',
    riskScore: 50
  },
  {
    pattern: /fileopen|fileread|filewrite/i,
    message: 'File operations detected',
    riskScore: 40
  }
];

// XSS Prevention Patterns
export const XSS_PATTERNS = [
  /<script\b[^<]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /import\s+.*\s+from/gi,
  /vbscript:/gi,
  /data:text\/html/gi
];

// SQL Injection Prevention Patterns
export const SQL_PATTERNS = [
  /(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+/gi,
  /(--|\/\*)/g,
  /(\bUNION\b|\bOR\b|\bAND\b).+\b(=|LIKE)\b/gi,
  /;\s*DROP\s+/gi,
  /;\s*DELETE\s+/gi,
  /;\s*INSERT\s+/gi,
  /'\s*OR\s*'?\d+/gi,
  /'\s*AND\s*'?\d+/gi,
  /\b(SELECT|INSERT|UPDATE|DELETE)\b.*\b(FROM|INTO|WHERE)\b/gi,
  /EXEC\s*\(/gi,
  /SP_EXECUTESQL/gi,
  /xp_cmdshell/gi
];

// WAF Pattern Categories
export const WAF_PATTERNS = [
  {
    name: 'SQL Injection',
    patterns: SQL_PATTERNS,
    riskScore: 80
  },
  {
    name: 'XSS',
    patterns: XSS_PATTERNS,
    riskScore: 70
  },
  {
    name: 'Command Injection',
    patterns: [/;\s*rm\s+/gi, /;\s*cat\s+/gi, /;\s*ls\s+/gi, /\|\s*sh\s/gi],
    riskScore: 90
  },
  {
    name: 'Path Traversal',
    patterns: [/(\.\.\/|\.\.\\)/g, /%2e%2e[/\\]/gi],
    riskScore: 75
  },
  {
    name: 'LDAP Injection',
    patterns: [/\)\)\(/g, /\*\)\(/g, /\)\(\*/g],
    riskScore: 60
  },
  {
    name: 'NoSQL Injection',
    patterns: [/\{.*\$.*\}/gi, /\[.*\$.*\]/gi],
    riskScore: 65
  },
  {
    name: 'XXE Injection',
    patterns: [/]<!DOCTYPE[^>]*>/gi, /<\?xml[^>]*>/gi],
    riskScore: 85
  },
  {
    name: 'SSRF',
    patterns: [/localhost/gi, /127\.0\.0\.1/gi, /0x7f000001/gi, /::1/gi],
    riskScore: 80
  },
  {
    name: 'File Inclusion',
    patterns: [/php:\/\//gi, /data:\/\//gi, /file:\/\//gi],
    riskScore: 75
  },
  {
    name: 'Bot Detection',
    patterns: [/bot/gi, /crawler/gi, /spider/gi, /scraper/gi],
    riskScore: 30
  }
];

// Bot Detection User Agents
export const BOT_USER_AGENTS = [
  /googlebot/gi,
  /bingbot/gi,
  /slurp/gi,
  /duckduckbot/gi,
  /baidu/gi,
  /yandex/gi,
  /facebookexternalhit/gi,
  /twitterbot/gi,
  /whatsapp/gi,
  /telegram/gi,
  /curl/gi,
  /wget/gi,
  /python/gi,
  /java/gi,
  /scrapy/gi,
  /selenium/gi
];

// Security Headers
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
};

// Token Configuration
export const TOKEN_EXPIRY_MS = 3600000; // 1 hour
export const TOKEN_REFRESH_BEFORE_EXPIRY_MS = 300000; // 5 minutes before expiry

// Validation Limits
export const VALIDATION_LIMITS = {
  maxRobotNameLength: 100,
  maxRobotDescriptionLength: 1000,
  maxCodeLength: 100000, // 100KB of MQL5 code
  maxParamNameLength: 50,
  maxParamValueLength: 500,
  maxUserEmailLength: 255,
  maxUserNameLength: 100,
  minPasswordLength: 8,
  maxPasswordLength: 128
};

// CSP (Content Security Policy) Configuration
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
};