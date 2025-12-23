export interface SecurityPolicy {
  name: string;
  description: string;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  conditions: PolicyCondition[];
  actions: PolicyAction[];
}

export interface PolicyCondition {
  type: 'request_rate' | 'geographic' | 'user_agent' | 'payload_size' | 'time_based' | 'custom';
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'regex' | 'custom';
  value: any;
  negate?: boolean;
}

export interface PolicyAction {
  type: 'block' | 'allow' | 'rate_limit' | 'log' | 'alert' | 'modify_response';
  parameters?: any;
}

export interface PolicyResult {
  policy: SecurityPolicy;
  matched: boolean;
  actions: PolicyAction[];
  riskScore: number;
}

export interface PolicyContext {
  ip?: string;
  userAgent?: string;
  region?: string;
  requestCount?: number;
  payloadSize?: number;
  timestamp?: number;
  headers?: Record<string, string>;
  method?: string;
  path?: string;
  customData?: Record<string, any>;
  payload?: any;
}

/**
 * SecurityPolicyService - Manages security policies and rule enforcement
 * 
 * Responsibilities:
 * - Policy definition and management
 * - Rule evaluation and enforcement
 * - Dynamic policy updates
 * - Policy conflict resolution
 * - Audit logging
 * - Risk scoring based on policies
 */
export class SecurityPolicyService {
  private policies: SecurityPolicy[] = [];
  private auditLog: PolicyAuditEntry[] = [];
  private policyStats = new Map<string, PolicyStatistics>();

  constructor() {
    // Initialize default security policies
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default security policies
   */
  private initializeDefaultPolicies(): void {
    this.addPolicy({
      name: 'basic_rate_limit',
      description: 'Prevent basic abuse by excessive requests',
      enabled: true,
      severity: 'medium',
      conditions: [
        {
          type: 'request_rate',
          operator: 'greater_than',
          value: 100,
          negate: false
        }
      ],
      actions: [
        {
          type: 'rate_limit',
          parameters: { limit: 60, windowMs: 60000 }
        }
      ]
    });

    this.addPolicy({
      name: 'blocked_regions',
      description: 'Block requests from high-risk regions',
      enabled: true,
      severity: 'high',
      conditions: [
        {
          type: 'geographic',
          operator: 'contains',
          value: ['CN', 'RU', 'IR', 'KP', 'SY'],
          negate: false
        }
      ],
      actions: [
        {
          type: 'block',
          parameters: { reason: 'Region blocked by security policy' }
        },
        {
          type: 'alert'
        }
      ]
    });

    this.addPolicy({
      name: 'suspicious_user_agents',
      description: 'Block known attack tools and bots',
      enabled: true,
      severity: 'high',
      conditions: [
        {
          type: 'user_agent',
          operator: 'regex',
          value: /(sqlmap|nikto|nmap|masscan|dirb|gobuster|wfuzz|burp|owasp|scanner|bot|crawler|spider)/gi,
          negate: false
        }
      ],
      actions: [
        {
          type: 'block',
          parameters: { reason: 'Suspicious user agent detected' }
        },
        {
          type: 'log',
          parameters: { level: 'warning' }
        }
      ]
    });

    this.addPolicy({
      name: 'payload_size_limit',
      description: 'Prevent oversized payload attacks',
      enabled: true,
      severity: 'medium',
      conditions: [
        {
          type: 'payload_size',
          operator: 'greater_than',
          value: 5 * 1024 * 1024, // 5MB
          negate: false
        }
      ],
      actions: [
        {
          type: 'block',
          parameters: { reason: 'Payload too large' }
        }
      ]
    });

    this.addPolicy({
      name: 'off_hours_protection',
      description: 'Enhanced security during off-hours',
      enabled: true,
      severity: 'medium',
      conditions: [
        {
          type: 'time_based',
          operator: 'custom',
          value: this.getOffHoursCondition.bind(this),
          negate: false
        }
      ],
      actions: [
        {
          type: 'rate_limit',
          parameters: { limit: 30, windowMs: 60000 }
        },
        {
          type: 'log',
          parameters: { level: 'info' }
        }
      ]
    });
  }

  /**
   * Check if current time is during off-hours (2 AM - 6 AM UTC)
   */
  private getOffHoursCondition(context: PolicyContext): boolean {
    const hour = new Date(context.timestamp || Date.now()).getUTCHours();
    return hour >= 2 && hour <= 6;
  }

  /**
   * Add a new security policy
   */
  addPolicy(policy: SecurityPolicy): void {
    // Validate policy structure
    if (!this.validatePolicy(policy)) {
      throw new Error('Invalid policy structure');
    }

    // Check for duplicate names
    if (this.policies.some(p => p.name === policy.name)) {
      throw new Error(`Policy with name '${policy.name}' already exists`);
    }

    this.policies.push(policy);
    this.initializePolicyStats(policy.name);
  }

  /**
   * Add array of policies
   */
  addPolicies(policies: SecurityPolicy[]): void {
    policies.forEach(policy => this.addPolicy(policy));
  }

  /**
   * Remove a policy by name
   */
  removePolicy(name: string): boolean {
    const index = this.policies.findIndex(p => p.name === name);
    if (index !== -1) {
      this.policies.splice(index, 1);
      this.policyStats.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Update an existing policy
   */
  updatePolicy(name: string, updates: Partial<SecurityPolicy>): boolean {
    const policy = this.policies.find(p => p.name === name);
    if (!policy) {
      return false;
    }

    const updatedPolicy = { ...policy, ...updates };
    if (!this.validatePolicy(updatedPolicy)) {
      throw new Error('Invalid policy structure');
    }

    const index = this.policies.findIndex(p => p.name === name);
    this.policies[index] = updatedPolicy;
    return true;
  }

  /**
   * Enable/disable a policy
   */
  togglePolicy(name: string, enabled: boolean): boolean {
    const policy = this.policies.find(p => p.name === name);
    if (policy) {
      policy.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Evaluate all policies against context
   */
  evaluatePolicies(context: PolicyContext): PolicyResult[] {
    const results: PolicyResult[] = [];

    for (const policy of this.policies) {
      if (!policy.enabled) {
        continue;
      }

      const result = this.evaluatePolicy(policy, context);
      results.push(result);
      
      // Update statistics
      this.updatePolicyStats(policy.name, result);
      
      // Log audit entry
      this.logPolicyEvaluation(policy, context, result);
    }

    return results;
  }

  /**
   * Evaluate a single policy
   */
  private evaluatePolicy(policy: SecurityPolicy, context: PolicyContext): PolicyResult {
    const matchedConditions: PolicyCondition[] = [];
    let riskScore = 0;

    // Evaluate all conditions
    for (const condition of policy.conditions) {
      if (this.evaluateCondition(condition, context)) {
        matchedConditions.push(condition);
      }
    }

    // Policy matches if all conditions are met (AND logic)
    const matched = !policy.conditions.some(condition => {
      const conditionMet = this.evaluateCondition(condition, context);
      return condition.negate ? conditionMet : !conditionMet;
    });

    // Calculate risk score
    if (matched) {
      riskScore = this.calculateRiskScore(policy, matchedConditions);
    }

    return {
      policy,
      matched,
      actions: matched ? policy.actions : [],
      riskScore
    };
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    const value = this.getContextValue(condition.type, context);

    if (typeof condition.value === 'function') {
      return condition.value(context);
    }

    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      
      case 'not_equals':
        return value !== condition.value;
      
      case 'greater_than':
        return Number(value) > Number(condition.value);
      
      case 'less_than':
        return Number(value) < Number(condition.value);
      
      case 'contains':
        if (Array.isArray(condition.value)) {
          return Array.isArray(value) 
            ? condition.value.some(v => value.includes(v))
            : condition.value.includes(value);
        }
        return String(value).includes(String(condition.value));
      
      case 'regex':
        return new RegExp(condition.value, 'i').test(String(value));
      
      case 'custom':
        // For custom functions
        try {
          return condition.value(context);
        } catch (error) {
          console.error('Custom condition evaluation failed:', error);
          return false;
        }
      
      default:
        return false;
    }
  }

  /**
   * Get context value based on condition type
   */
  private getContextValue(type: PolicyCondition['type'], context: PolicyContext): any {
    switch (type) {
      case 'request_rate':
        return context.requestCount || 0;
      
      case 'geographic':
        return context.region || 'unknown';
      
      case 'user_agent':
        return context.userAgent || '';
      
      case 'payload_size':
        return context.payloadSize || 0;
      
      case 'time_based':
        return context.timestamp || Date.now();
      
      case 'custom':
        return context.customData || {};
      
      default:
        return null;
    }
  }

  /**
   * Calculate risk score for policy match
   */
  private calculateRiskScore(policy: SecurityPolicy, matchedConditions: PolicyCondition[]): number {
    let score = 0;

    // Base score from severity
    switch (policy.severity) {
      case 'low':
        score += 10;
        break;
      case 'medium':
        score += 25;
        break;
      case 'high':
        score += 50;
        break;
      case 'critical':
        score += 75;
        break;
    }

    // Additional score from condition complexity
    score += matchedConditions.length * 5;

    return Math.min(100, score);
  }

  /**
   * Get actions to apply based on policy evaluation
   */
  getRecommendedActions(results: PolicyResult[]): PolicyAction[] {
    const actions: PolicyAction[] = [];
    const blockedPolicies: string[] = [];

    // Sort by risk score (high to low)
    results.sort((a, b) => b.riskScore - a.riskScore);

    for (const result of results) {
      if (!result.matched) {
        continue;
      }

      // Handle block actions - highest priority
      const blockAction = result.actions.find(a => a.type === 'block');
      if (blockAction) {
        blockedPolicies.push(result.policy.name);
        actions.push({
          type: 'block',
          parameters: {
            reason: `Blocked by policies: ${blockedPolicies.join(', ')}`,
            riskScore: result.riskScore
          }
        });
        break; // Stop processing after block
      }

      // Collect other actions
      actions.push(...result.actions.filter(a => a.type !== 'block'));
    }

    return actions;
  }

  /**
   * Get total risk score from all policy evaluations
   */
  getTotalRiskScore(results: PolicyResult[]): number {
    return Math.max(0, Math.max(...results.map(r => r.riskScore)));
  }

  /**
   * Validate policy structure
   */
  private validatePolicy(policy: SecurityPolicy): boolean {
    if (!policy.name || !policy.description) {
      return false;
    }

    if (!Array.isArray(policy.conditions) || policy.conditions.length === 0) {
      return false;
    }

    if (!Array.isArray(policy.actions) || policy.actions.length === 0) {
      return false;
    }

    // Validate conditions
    for (const condition of policy.conditions) {
      if (!condition.type || !condition.operator) {
        return false;
      }
    }

    // Validate actions
    for (const action of policy.actions) {
      if (!action.type) {
        return false;
      }
    }

    return true;
  }

  /**
   * Initialize statistics for a policy
   */
  private initializePolicyStats(policyName: string): void {
    this.policyStats.set(policyName, {
      evaluations: 0,
      matches: 0,
      totalRiskScore: 0,
      lastEvaluation: null,
      averageRiskScore: 0
    });
  }

  /**
   * Update policy statistics
   */
  private updatePolicyStats(policyName: string, result: PolicyResult): void {
    const stats = this.policyStats.get(policyName);
    if (stats) {
      stats.evaluations++;
      if (result.matched) {
        stats.matches++;
        stats.totalRiskScore += result.riskScore;
      }
      stats.lastEvaluation = new Date();
      stats.averageRiskScore = stats.totalRiskScore / stats.matches;
    }
  }

  /**
   * Log policy evaluation for audit
   */
  private logPolicyEvaluation(policy: SecurityPolicy, context: PolicyContext, result: PolicyResult): void {
    const entry: PolicyAuditEntry = {
      timestamp: new Date(),
      policyName: policy.name,
      matched: result.matched,
      riskScore: result.riskScore,
      actions: result.actions.length,
      ip: context.ip,
      region: context.region,
      userAgent: context.userAgent
    };

    this.auditLog.push(entry);

    // Keep only last 10,000 entries to prevent memory bloat
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }
  }

  /**
   * Get all policies
   */
  getPolicies(): SecurityPolicy[] {
    return [...this.policies];
  }

  /**
   * Get policy by name
   */
  getPolicy(name: string): SecurityPolicy | undefined {
    return this.policies.find(p => p.name === name);
  }

  /**
   * Get policy statistics
   */
  getPolicyStatistics(name?: string): Map<string, PolicyStatistics> | PolicyStatistics {
    if (name) {
      return this.policyStats.get(name) || {
        evaluations: 0,
        matches: 0,
        totalRiskScore: 0,
        lastEvaluation: null,
        averageRiskScore: 0
      };
    }
    return new Map(this.policyStats);
  }

  /**
   * Get audit log
   */
  getAuditLog(limit?: number): PolicyAuditEntry[] {
    if (limit) {
      return this.auditLog.slice(-limit);
    }
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Export policies to JSON
   */
  exportPolicies(): string {
    return JSON.stringify(this.policies, null, 2);
  }

  /**
   * Import policies from JSON
   */
  importPolicies(jsonString: string): void {
    try {
      const policies = JSON.parse(jsonString) as SecurityPolicy[];
      policies.forEach(policy => {
        try {
          this.addPolicy(policy);
        } catch (error) {
          console.error(`Failed to import policy ${policy.name}:`, error);
        }
      });
    } catch (error) {
      throw new Error('Invalid JSON format for policies');
    }
  }
}

// Supporting interfaces
interface PolicyStatistics {
  evaluations: number;
  matches: number;
  totalRiskScore: number;
  lastEvaluation: Date | null;
  averageRiskScore: number;
}

interface PolicyAuditEntry {
  timestamp: Date;
  policyName: string;
  matched: boolean;
  riskScore: number;
  actions: number;
  ip?: string;
  region?: string;
  userAgent?: string;
}