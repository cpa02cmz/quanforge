import { SecurityConfig } from './types';

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  reasons: string[];
}

export class BotDetector {
  private config: SecurityConfig['botDetection'];

  constructor(config: SecurityConfig['botDetection']) {
    this.config = config;
  }

  analyzeRequest(requestData: {
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
    requestPath?: string;
    requestMethod?: string;
  }): BotDetectionResult {
    if (!this.config.enabled) {
      return { isBot: false, confidence: 0, reasons: [] };
    }

    const reasons: string[] = [];
    let confidence = 0;

    // User Agent analysis
    if (requestData.userAgent) {
      const ua = requestData.userAgent.toLowerCase();
      
      for (const pattern of this.config.suspiciousPatterns) {
        if (ua.includes(pattern.toLowerCase())) {
          reasons.push(`Suspicious pattern in user agent: ${pattern}`);
          confidence += 20;
        }
      }

      // Common bot signatures
      if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
        reasons.push('Bot-like user agent pattern');
        confidence += 30;
      }

      if (ua.length < 10 || ua.length > 500) {
        reasons.push('Unusual user agent length');
        confidence += 15;
      }
    }

    // Header analysis
    if (requestData.headers) {
      const headerKeys = Object.keys(requestData.headers).map(k => k.toLowerCase());
      
      // Missing common headers
      const commonHeaders = ['accept', 'accept-language', 'accept-encoding'];
      const missingCommon = commonHeaders.filter(h => !headerKeys.includes(h));
      if (missingCommon.length > 1) {
        reasons.push('Missing common browser headers');
        confidence += 10;
      }

      // Suspicious header patterns
      for (const [key, value] of Object.entries(requestData.headers)) {
        const headerValue = value.toLowerCase();
        for (const pattern of this.config.suspiciousPatterns) {
          if (headerValue.includes(pattern.toLowerCase())) {
            reasons.push(`Suspicious pattern in header ${key}: ${pattern}`);
            confidence += 15;
          }
        }
      }
    }

    // Request pattern analysis
    if (requestData.requestPath) {
      const path = requestData.requestPath.toLowerCase();
      
      // Common scanning paths
      const scanningPaths = ['/admin', '/wp-admin', '/phpmyadmin', '/shell', '/config'];
      if (scanningPaths.some(p => path.includes(p))) {
        reasons.push('Suspicious request path');
        confidence += 25;
      }
    }

    // Method analysis
    if (requestData.requestMethod) {
      const unusualMethods = ['TRACE', 'CONNECT', 'OPTIONS'];
      if (unusualMethods.includes(requestData.requestMethod)) {
        reasons.push(`Unusual HTTP method: ${requestData.requestMethod}`);
        confidence += 20;
      }
    }

    // Normalize confidence to 0-100
    confidence = Math.min(100, confidence);

    return {
      isBot: confidence >= 50, // Threshold for bot detection
      confidence,
      reasons
    };
  }

  isSuspiciousIP(ip: string): boolean {
    // Basic IP validation - can be extended with more sophisticated checks
    if (!ip) return true;

    // Check for private/internal IPs that shouldn't be public
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    // For production, you might want to allow certain private ranges
    // For security monitoring, detect suspicious patterns
    return privateRanges.some(range => range.test(ip));
  }

  getBotScore(requestData: Parameters<typeof this.analyzeRequest>[0]): number {
    const result = this.analyzeRequest(requestData);
    return result.confidence;
  }
}