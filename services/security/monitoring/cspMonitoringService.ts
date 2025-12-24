interface CSPViolation {
  blockedURI: string;
  documentURI: string;
  effectiveDirective: string;
  originalPolicy: string;
  referrer: string;
  sample: string;
  sourceFile: string;
  lineNumber: number;
  columnNumber: number;
  statusCode: number;
  violatedDirective: string;
}

interface CSPStats {
  totalViolations: number;
  blockedURIs: number;
  topDirectives: Array<{ directive: string; count: number }>;
  topBlockedURIs: Array<{ uri: string; count: number }>;
  severityDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

interface CSPAlertConfig {
  enabled: boolean;
  threshold: number;
  webhookUrl?: string;
  emailRecipients?: string[];
}

export class CSPMonitoringService {
  private static instance: CSPMonitoringService;
  private violations: CSPViolation[] = [];
  private alertConfig: CSPAlertConfig;
  private violationCounts = new Map<string, number>();
  private severityThresholds = {
    low: 3,
    medium: 5,
    high: 10,
    critical: 20
  };

  private constructor() {
    this.alertConfig = {
      enabled: true,
      threshold: 10
    };

    // Set up CSP violation listener if in browser environment
    if (typeof window !== 'undefined' && 'addEventListener' in window) {
      this.setupCSPViolationListener();
    }

    // Clean up old violations periodically
    setInterval(() => {
      this.cleanupOldViolations();
    }, 60 * 60 * 1000); // Every hour
  }

  static getInstance(): CSPMonitoringService {
    if (!CSPMonitoringService.instance) {
      CSPMonitoringService.instance = new CSPMonitoringService();
    }
    return CSPMonitoringService.instance;
  }

  monitorCSPViolations(): void {
    // This method is mainly for manual triggering or health checks
    console.log('CSP Monitoring Service active');
    
    // Emit current statistics
    const stats = this.getCSPStats();
    console.log('Current CSP Statistics:', stats);
    
    // Check if alert threshold is met
    if (stats.totalViolations >= this.alertConfig.threshold) {
      this.sendSecurityAlert(stats);
    }
  }

  reportViolation(violation: Partial<CSPViolation>): void {
    const fullViolation: CSPViolation = {
      blockedURI: violation.blockedURI || '',
      documentURI: violation.documentURI || '',
      effectiveDirective: violation.effectiveDirective || '',
      originalPolicy: violation.originalPolicy || '',
      referrer: violation.referrer || '',
      sample: violation.sample || '',
      sourceFile: violation.sourceFile || '',
      lineNumber: violation.lineNumber || 0,
      columnNumber: violation.columnNumber || 0,
      statusCode: violation.statusCode || 0,
      violatedDirective: violation.violatedDirective || ''
    };

    this.violations.push(fullViolation);

    // Count violations by type
    const directive = fullViolation.effectiveDirective || 'unknown';
    const currentCount = this.violationCounts.get(directive) || 0;
    this.violationCounts.set(directive, currentCount + 1);

    // Check severity
    const severity = this.calculateViolationSeverity(directive, fullViolation);
    if (severity === 'critical' || severity === 'high') {
      this.sendImmediateAlert(fullViolation, severity);
    }

    console.warn('CSP Violation detected:', {
      directive,
      blockedURI: fullViolation.blockedURI,
      severity,
      totalViolations: this.violations.length
    });
  }

  getCSPStats(): CSPStats {
    const directiveCounts = new Map<string, number>();
    const uriCounts = new Map<string, number>();
    
    let severityDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    this.violations.forEach(violation => {
      // Count by directive
      const directive = violation.effectiveDirective || 'unknown';
      directiveCounts.set(directive, (directiveCounts.get(directive) || 0) + 1);

      // Count by URI
      const uri = violation.blockedURI || 'unknown';
      uriCounts.set(uri, (uriCounts.get(uri) || 0) + 1);

      // Calculate severity
      const severity = this.calculateViolationSeverity(directive, violation);
      severityDistribution[severity]++;
    });

    // Get top directives
    const topDirectives = Array.from(directiveCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([directive, count]) => ({ directive, count }));

    // Get top blocked URIs
    const topBlockedURIs = Array.from(uriCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([uri, count]) => ({ uri, count }));

    return {
      totalViolations: this.violations.length,
      blockedURIs: uriCounts.size,
      topDirectives,
      topBlockedURIs,
      severityDistribution
    };
  }

  getRecentViolations(limit: number = 50): CSPViolation[] {
    return this.violations.slice(-limit);
  }

  getViolationsByDirective(directive: string): CSPViolation[] {
    return this.violations.filter(v => v.effectiveDirective === directive);
  }

  getViolationsByURI(uri: string): CSPViolation[] {
    return this.violations.filter(v => v.blockedURI === uri);
  }

  updateAlertConfig(config: Partial<CSPAlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
  }

  clearViolations(): void {
    this.violations = [];
    this.violationCounts.clear();
    console.log('CSP violations cleared');
  }

  exportViolations(): string {
    const exportData = {
      exportTime: new Date().toISOString(),
      totalViolations: this.violations.length,
      stats: this.getCSPStats(),
      violations: this.violations
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Private methods
  private setupCSPViolationListener(): void {
    const handler = (event: SecurityPolicyViolationEvent) => {
      this.reportViolation({
        blockedURI: event.blockedURI,
        documentURI: event.documentURI,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        referrer: event.referrer,
        sample: event.sample,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        statusCode: event.statusCode,
        violatedDirective: event.violatedDirective
      });
    };

    document.addEventListener('securitypolicyviolation', handler);
  }

  private calculateViolationSeverity(directive: string, violation: CSPViolation): 'low' | 'medium' | 'high' | 'critical' {
    // Critical violations
    if (['script-src', 'object-src', 'frame-src'].includes(directive)) {
      return 'critical';
    }

    // High severity violations
    if (['style-src', 'connect-src', 'font-src'].includes(directive)) {
      return 'high';
    }

    // Medium severity violations
    if (['img-src', 'media-src'].includes(directive)) {
      // Check if it's a suspicious URI
      if (this.isSuspiciousURI(violation.blockedURI)) {
        return 'high';
      }
      return 'medium';
    }

    // Check violation count pattern
    const count = this.violationCounts.get(directive) || 0;
    if (count >= this.severityThresholds.critical) return 'critical';
    if (count >= this.severityThresholds.high) return 'high';
    if (count >= this.severityThresholds.medium) return 'medium';

    return 'low';
  }

  private isSuspiciousURI(uri: string): boolean {
    if (!uri) return false;

    const suspiciousPatterns = [
      /data:/i,
      /javascript:/i,
      /vbscript:/i,
      /file:/i,
      /ftp:/i,
      /127\.0\.0\.1/,
      /localhost/,
      /192\.168\./,
      /10\./,
      /172\.1[6-9]\./,
      /172\.2[0-9]\./,
      /172\.3[0-1]\./
    ];

    return suspiciousPatterns.some(pattern => pattern.test(uri));
  }

  private sendSecurityAlert(stats: CSPStats): void {
    if (!this.alertConfig.enabled) return;

    const alert = {
      type: 'CSP_VIOLATION_ALERT',
      timestamp: new Date().toISOString(),
      stats,
      message: `CSP violations threshold exceeded: ${stats.totalViolations} total violations`,
      severity: this.overallSeverity(stats)
    };

    console.error('CSP Security Alert:', alert);

    // Send to webhook if configured
    if (this.alertConfig.webhookUrl) {
      this.sendWebhookAlert(alert);
    }
  }

  private sendImmediateAlert(violation: CSPViolation, severity: string): void {
    if (!this.alertConfig.enabled) return;

    const alert = {
      type: 'IMMEDIATE_CSP_ALERT',
      timestamp: new Date().toISOString(),
      severity,
      violation,
      message: `High-severity CSP violation: ${violation.effectiveDirective} blocked ${violation.blockedURI}`
    };

    console.error('Immediate CSP Alert:', alert);

    if (this.alertConfig.webhookUrl) {
      this.sendWebhookAlert(alert);
    }
  }

  private sendWebhookAlert(alert: any): void {
    // Implementation would depend on your webhook service
    // This is a placeholder for the actual webhook implementation
    console.log('Webhook alert would be sent to:', this.alertConfig.webhookUrl, alert);
  }

  private overallSeverity(stats: CSPStats): string {
    if (stats.severityDistribution.critical > 0) return 'critical';
    if (stats.severityDistribution.high > 0) return 'high';
    if (stats.severityDistribution.medium > 5) return 'medium';
    if (stats.severityDistribution.low > 20) return 'low';
    return 'info';
  }

  private cleanupOldViolations(): void {
    // Note: Cutoff time calculation ready for when timestamps are available
    // const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    // const now = Date.now();
    // const cutoffTime = now - maxAge;

    const originalLength = this.violations.length;
    this.violations = this.violations.filter(violation => {
      // Filter based on timestamp (would need timestamp in violation for accurate filtering)
      // For now, just limit to last 1000 violations
      return this.violations.indexOf(violation) >= this.violations.length - 1000;
    });

    const cleaned = originalLength - this.violations.length;
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} old CSP violations`);
    }
  }
}