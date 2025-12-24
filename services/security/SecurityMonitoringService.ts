/**
 * Security Monitoring Service
 * 
 * Handles security event monitoring, alerts, metrics collection, and compliance tracking.
 * This service tracks security incidents and provides analytics.
 * 
 * @author QuantForge Security Team
 * @version 1.0.0
 */

import { securityUtils } from './SecurityUtilsService';

export interface CSPViolation {
  blockedURI: string;
  documentURI: string;
  referrer: string;
  violatedDirective: string;
  effectiveDirective: string;
  originalPolicy: string;
  disposition: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
  sample?: string;
  timestamp: number;
}

export interface SecurityAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  data: any;
  acknowledged: boolean;
  resolved: boolean;
}

export interface SecurityMetrics {
  totalViolations: number;
  highSeverityViolations: number;
  uniqueIPAddresses: number;
  blockedRequests: number;
  rateLimitEntries: number;
  averageRiskScore: number;
}

export interface CompliantSecurityStats {
  totalViolations: number;
  cspViolations: number;
  wafEvents: number;
  rateLimitViolations: number;
  blockedRequests: number;
  activeIPAddresses: number;
  topThreats: Array<{ threat: string; count: number }>;
  securityScore: number;
}

export interface MonitoringConfig {
  maxViolationsStored: number;
  alertThresholds: {
    cspViolations: number;
    wafEvents: number;
    rateLimitViolations: number;
  };
  retentionPeriodMs: number;
  enableRealTimeAlerts: boolean;
}

/**
 * Security monitoring and alerting service
 */
export class SecurityMonitoringService {
  private static instance: SecurityMonitoringService;
  private config: MonitoringConfig;
  private cspViolations: CSPViolation[] = [];
  private securityAlerts: SecurityAlert[] = [];
  private securityMetrics: Map<string, number> = new Map();
  private isMonitoring = false;

  private constructor() {
    this.config = {
      maxViolationsStored: 100,
      alertThresholds: {
        cspViolations: 10,
        wafEvents: 50,
        rateLimitViolations: 100
      },
      retentionPeriodMs: 86400000, // 24 hours
      enableRealTimeAlerts: true
    };

    this.loadStoredData();
  }

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  /**
   * Initialize monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.setupCSPMonitoring();
    this.scheduleDataCleanup();
    this.isMonitoring = true;
    
    securityUtils.logSecurityEvent('SecurityMonitoringStarted');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    securityUtils.logSecurityEvent('SecurityMonitoringStopped');
  }

  /**
   * Setup Content Security Policy monitoring
   */
  private setupCSPMonitoring(): void {
    if (typeof document === 'undefined') {
      return; // Not in browser environment
    }

    // Listen for CSP violation reports
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation: CSPViolation = {
        blockedURI: event.blockedURI,
        documentURI: event.documentURI,
        referrer: event.referrer,
        violatedDirective: event.violatedDirective,
        effectiveDirective: event.effectiveDirective,
        originalPolicy: event.originalPolicy,
        disposition: event.disposition,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
        statusCode: event.statusCode,
        sample: event.sample,
        timestamp: Date.now()
      };

      this.handleCSPViolation(violation);
    });
  }

  /**
   * Handle CSP violation
   */
  private handleCSPViolation(violation: CSPViolation): void {
    securityUtils.logSecurityEvent('CSPViolationDetected', violation);
    
    // Store violation for analysis
    this.storeCSPViolation(violation);
    
    // Trigger alert if high severity
    if (this.isHighSeverityViolation(violation)) {
      this.triggerSecurityAlert('CSP Violation', violation, 'high');
    }

    // Check alert thresholds
    this.checkAlertThresholds();
  }

  /**
   * Store CSP violation
   */
  private storeCSPViolation(violation: CSPViolation): void {
    this.cspViolations.push(violation);
    
    // Keep only the most recent violations
    if (this.cspViolations.length > this.config.maxViolationsStored) {
      this.cspViolations = this.cspViolations.slice(-this.config.maxViolationsStored);
    }
    
    this.saveDataToStorage();
  }

  /**
   * Check if violation is high severity
   */
  private isHighSeverityViolation(violation: CSPViolation): boolean {
    const highSeverityDirectives = [
      'script-src',
      'object-src',
      'base-uri',
      'frame-ancestors',
      'form-action'
    ];

    return highSeverityDirectives.includes(violation.effectiveDirective) ||
           violation.blockedURI.includes('javascript:') ||
           violation.blockedURI.includes('data:');
  }

  /**
   * Trigger security alert
   */
  private triggerSecurityAlert(type: string, data: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): void {
    const alert: SecurityAlert = {
      id: securityUtils.generateSecureToken(),
      type,
      severity,
      timestamp: Date.now(),
      data,
      acknowledged: false,
      resolved: false
    };

    this.securityAlerts.push(alert);

    // Keep only recent alerts
    if (this.securityAlerts.length > this.config.maxViolationsStored) {
      this.securityAlerts = this.securityAlerts.slice(-this.config.maxViolationsStored);
    }

    securityUtils.logSecurityEvent('SecurityAlertTriggered', { type, severity, alertId: alert.id });

    if (this.config.enableRealTimeAlerts) {
      this.processAlert(alert);
    }

    this.saveDataToStorage();
  }

  /**
   * Process security alert (could send to external monitoring)
   */
  private processAlert(alert: SecurityAlert): void {
    // In production, this could send to external monitoring services
    // For now, we'll log to console in development
    if (process.env['NODE_ENV'] === 'development') {
      console.warn(`🚨 Security Alert [${alert.severity.toUpperCase()}]: ${alert.type}`, alert.data);
    }
  }

  /**
   * Check alert thresholds and trigger alerts if needed
   */
  private checkAlertThresholds(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    // Count recent CSP violations
    const recentCSPViolations = this.cspViolations.filter(v => v.timestamp > oneHourAgo);
    if (recentCSPViolations.length >= this.config.alertThresholds.cspViolations) {
      this.triggerSecurityAlert(
        'High CSP Violation Rate',
        { count: recentCSPViolations.length, threshold: this.config.alertThresholds.cspViolations },
        'medium'
      );
    }

    // Check for other threshold violations
    // Additional threshold checks would go here
  }

  /**
   * Get basic security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const recentViolations = this.cspViolations.filter(v => v.timestamp > oneHourAgo);
    const highSeverityViolations = recentViolations.filter(v => this.isHighSeverityViolation(v));

    // Calculate average risk score (simplified)
    const totalRiskScore = this.securityMetrics.get('total_risk_score') || 0;
    const totalEvents = this.securityMetrics.get('total_events') || 1;
    const averageRiskScore = totalRiskScore / totalEvents;

    return {
      totalViolations: recentViolations.length,
      highSeverityViolations: highSeverityViolations.length,
      uniqueIPAddresses: this.securityMetrics.get('unique_ips') || 0,
      blockedRequests: this.securityMetrics.get('blocked_requests') || 0,
      rateLimitEntries: this.securityMetrics.get('rate_limit_entries') || 0,
      averageRiskScore: Math.round(averageRiskScore * 100) / 100
    };
  }

  /**
   * Get comprehensive security statistics
   */
  getComprehensiveSecurityStats(): CompliantSecurityStats {
    const now = Date.now();
    const twentyFourHoursAgo = now - 86400000;

    const recentViolations = this.cspViolations.filter(v => v.timestamp > twentyFourHoursAgo);
    const recentAlerts = this.securityAlerts.filter(a => a.timestamp > twentyFourHoursAgo);

    // Analyze top threats
    const threatCounts = new Map<string, number>();
    recentViolations.forEach(violation => {
      const threat = violation.effectiveDirective;
      threatCounts.set(threat, (threatCounts.get(threat) || 0) + 1);
    });

    const topThreats = Array.from(threatCounts.entries())
      .map(([threat, count]) => ({ threat, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate security score (0-100)
    const securityScore = this.calculateSecurityScore(recentViolations, recentAlerts);

    return {
      totalViolations: recentViolations.length,
      cspViolations: recentViolations.length,
      wafEvents: this.securityMetrics.get('waf_events') || 0,
      rateLimitViolations: this.securityMetrics.get('rate_limit_violations') || 0,
      blockedRequests: this.securityMetrics.get('blocked_requests') || 0,
      activeIPAddresses: this.securityMetrics.get('unique_ips') || 0,
      topThreats,
      securityScore
    };
  }

  /**
   * Calculate security score based on recent events
   */
  private calculateSecurityScore(violations: CSPViolation[], alerts: SecurityAlert[]): number {
    let baseScore = 100;

    // Deduct points for violations
    baseScore -= violations.length * 2;

    // Deduct more for high severity violations
    const highSeverityViolations = violations.filter(v => this.isHighSeverityViolation(v));
    baseScore -= highSeverityViolations.length * 10;

    // Deduct points for unacknowledged alerts
    const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged && a.severity !== 'low');
    baseScore -= unacknowledgedAlerts.length * 5;

    // Ensure score doesn't go below 0
    return Math.max(0, baseScore);
  }

  /**
   * Manually record security event
   */
  recordSecurityEvent(type: string, data: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'low'): void {
    this.securityMetrics.set('total_events', (this.securityMetrics.get('total_events') || 0) + 1);

    switch (type) {
      case 'waf_block':
        this.securityMetrics.set('waf_events', (this.securityMetrics.get('waf_events') || 0) + 1);
        break;
      case 'rate_limit_violation':
        this.securityMetrics.set('rate_limit_violations', (this.securityMetrics.get('rate_limit_violations') || 0) + 1);
        break;
      case 'blocked_request':
        this.securityMetrics.set('blocked_requests', (this.securityMetrics.get('blocked_requests') || 0) + 1);
        break;
      case 'unique_ip':
        this.securityMetrics.set('unique_ips', (this.securityMetrics.get('unique_ips') || 0) + 1);
        break;
    }

    if (severity !== 'low') {
      this.triggerSecurityAlert(type, data, severity);
    }

    securityUtils.logSecurityEvent('SecurityEventRecorded', { type, severity });
  }

  /**
   * Acknowledge security alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.securityAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.saveDataToStorage();
      securityUtils.logSecurityEvent('AlertAcknowledged', { alertId });
      return true;
    }
    return false;
  }

  /**
   * Resolve security alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.securityAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.acknowledged = true;
      this.saveDataToStorage();
      securityUtils.logSecurityEvent('AlertResolved', { alertId });
      return true;
    }
    return false;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50): SecurityAlert[] {
    return this.securityAlerts
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: 'low' | 'medium' | 'high' | 'critical'): SecurityAlert[] {
    return this.securityAlerts.filter(alert => alert.severity === severity);
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): SecurityAlert[] {
    return this.securityAlerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Schedule data cleanup
   */
  private scheduleDataCleanup(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Clean every hour
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): number {
    const now = Date.now();
    const cutoffTime = now - this.config.retentionPeriodMs;
    let cleanedCount = 0;

    // Clean old violations
    const originalViolationCount = this.cspViolations.length;
    this.cspViolations = this.cspViolations.filter(v => v.timestamp > cutoffTime);
    cleanedCount += originalViolationCount - this.cspViolations.length;

    // Clean old alerts
    const originalAlertCount = this.securityAlerts.length;
    this.securityAlerts = this.securityAlerts.filter(a => a.timestamp > cutoffTime);
    cleanedCount += originalAlertCount - this.securityAlerts.length;

    if (cleanedCount > 0) {
      this.saveDataToStorage();
      securityUtils.logSecurityEvent('DataCleanup', { cleanedCount });
    }

    return cleanedCount;
  }

  /**
   * Save data to localStorage
   */
  private saveDataToStorage(): void {
    try {
      localStorage.setItem('csp_violations', JSON.stringify(this.cspViolations));
      localStorage.setItem('security_alerts', JSON.stringify(this.securityAlerts));
    } catch (error) {
      securityUtils.logSecurityEvent('StorageSaveError', { error });
    }
  }

  /**
   * Load stored data
   */
  private loadStoredData(): void {
    try {
      // Load CSP violations
      const storedViolations = localStorage.getItem('csp_violations');
      if (storedViolations) {
        this.cspViolations = JSON.parse(storedViolations);
      }

      // Load security alerts
      const storedAlerts = localStorage.getItem('security_alerts');
      if (storedAlerts) {
        this.securityAlerts = JSON.parse(storedAlerts);
      }
    } catch (error) {
      securityUtils.logSecurityEvent('StorageLoadError', { error });
    }
  }

  /**
   * Reset all monitoring data
   */
  resetMonitoringData(): void {
    this.cspViolations = [];
    this.securityAlerts = [];
    this.securityMetrics.clear();
    this.saveDataToStorage();
    securityUtils.logSecurityEvent('MonitoringDataReset');
  }

  /**
   * Get current configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    securityUtils.logSecurityEvent('MonitoringConfigUpdated', { newConfig });
  }

  /**
   * Export monitoring data for analysis
   */
  exportMonitoringData(): {
    violations: CSPViolation[];
    alerts: SecurityAlert[];
    metrics: Record<string, number>;
    exportedAt: number;
  } {
    return {
      violations: this.cspViolations,
      alerts: this.securityAlerts,
      metrics: Object.fromEntries(this.securityMetrics),
      exportedAt: Date.now()
    };
  }
}

// Export singleton instance for convenience
export const securityMonitoring = SecurityMonitoringService.getInstance();