/**
 * Integration Testing Utilities - Mock Adapters and Test Helpers
 * 
 * Provides comprehensive testing infrastructure for integrations:
 * - Mock adapters for all integration types
 * - Test harness for integration testing
 * - State simulation utilities
 * - Assertion helpers for integration behavior
 */

import { createScopedLogger } from '../../utils/logger';
import {
  IntegrationPriority,
  IntegrationEventType,
  type IntegrationConfig,
  type IntegrationHealthCheckResult,
  type IntegrationEvent,
} from './types';
import { IntegrationType, CircuitBreakerState } from '../integrationResilience';

const logger = createScopedLogger('integration-testing');

// ============================================================================
// Mock Types and Interfaces
// ============================================================================

/**
 * Mock behavior configuration
 */
export interface MockBehavior {
  /** Simulated latency in ms (can be a range) */
  latency?: number | { min: number; max: number };
  /** Failure probability (0-1) */
  failureRate?: number;
  /** Custom error to throw */
  error?: Error;
  /** Response data to return */
  response?: unknown;
  /** Whether to track calls */
  trackCalls?: boolean;
}

/**
 * Mock state for an integration
 */
export interface MockIntegrationState {
  healthy: boolean;
  latency: number;
  lastHealthCheck: Date;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  circuitBreakerState: CircuitBreakerState;
  degradedLevel: number;
  callCount: number;
  lastError?: string;
  lastCallTime?: Date;
}

/**
 * Mock adapter interface
 */
export interface MockAdapter {
  name: string;
  type: IntegrationType;
  state: MockIntegrationState;
  behavior: MockBehavior;
  healthCheck: () => Promise<IntegrationHealthCheckResult>;
  simulateFailure: (error?: Error) => void;
  simulateRecovery: () => void;
  simulateLatency: (latency: number | { min: number; max: number }) => void;
  reset: () => void;
  getCallHistory: () => Array<{ timestamp: Date; args: unknown[] }>;
}

// ============================================================================
// Base Mock Adapter
// ============================================================================

/**
 * Base mock adapter implementation
 */
export class BaseMockAdapter implements MockAdapter {
  name: string;
  type: IntegrationType;
  state: MockIntegrationState;
  behavior: MockBehavior;
  
  protected callHistory: Array<{ timestamp: Date; args: unknown[] }> = [];
  protected readonly initialState: MockIntegrationState;

  constructor(
    name: string,
    type: IntegrationType,
    behavior: MockBehavior = {}
  ) {
    this.name = name;
    this.type = type;
    this.behavior = {
      latency: 10,
      failureRate: 0,
      trackCalls: true,
      ...behavior,
    };
    
    this.initialState = {
      healthy: true,
      latency: 10,
      lastHealthCheck: new Date(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      circuitBreakerState: CircuitBreakerState.CLOSED,
      degradedLevel: 1,
      callCount: 0,
    };
    
    this.state = { ...this.initialState };
  }

  async healthCheck(): Promise<IntegrationHealthCheckResult> {
    const startTime = Date.now();
    
    // Simulate latency
    const latency = this.getLatency();
    await this.simulateDelay(latency);
    
    // Track call
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [] });
      this.state.callCount++;
      this.state.lastCallTime = new Date();
    }
    
    // Simulate failure based on failure rate
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      const error = this.behavior.error || new Error(`Mock failure for ${this.name}`);
      this.state.healthy = false;
      this.state.consecutiveFailures++;
      this.state.consecutiveSuccesses = 0;
      this.state.lastError = error.message;
      
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error.message,
      };
    }
    
    // Success
    this.state.healthy = true;
    this.state.consecutiveSuccesses++;
    this.state.consecutiveFailures = 0;
    this.state.lastError = undefined;
    this.state.lastHealthCheck = new Date();
    this.state.latency = Date.now() - startTime;
    
    return {
      healthy: true,
      latency: this.state.latency,
    };
  }

  simulateFailure(error?: Error): void {
    this.behavior.error = error || new Error(`Simulated failure for ${this.name}`);
    this.behavior.failureRate = 1;
    this.state.healthy = false;
    this.state.circuitBreakerState = CircuitBreakerState.OPEN;
    logger.debug(`Mock ${this.name} set to fail`);
  }

  simulateRecovery(): void {
    this.behavior.error = undefined;
    this.behavior.failureRate = 0;
    this.state.healthy = true;
    this.state.circuitBreakerState = CircuitBreakerState.CLOSED;
    logger.debug(`Mock ${this.name} recovered`);
  }

  simulateLatency(latency: number | { min: number; max: number }): void {
    this.behavior.latency = latency;
    logger.debug(`Mock ${this.name} latency set to`, latency);
  }

  reset(): void {
    this.state = { ...this.initialState };
    this.callHistory = [];
    this.behavior = {
      latency: 10,
      failureRate: 0,
      trackCalls: true,
    };
    logger.debug(`Mock ${this.name} reset to initial state`);
  }

  getCallHistory(): Array<{ timestamp: Date; args: unknown[] }> {
    return [...this.callHistory];
  }

  protected getLatency(): number {
    const latency = this.behavior.latency ?? 10;
    
    if (typeof latency === 'number') {
      return latency;
    }
    
    // Range latency with random value
    return latency.min + Math.random() * (latency.max - latency.min);
  }

  protected async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Specialized Mock Adapters
// ============================================================================

/**
 * Mock Database Adapter
 */
export class MockDatabaseAdapter extends BaseMockAdapter {
  private data: Map<string, unknown> = new Map();

  constructor(behavior: MockBehavior = {}) {
    super('mock_database', IntegrationType.DATABASE, behavior);
  }

  async query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [sql, params] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      throw this.behavior.error || new Error('Mock database error');
    }
    
    // Return mock data
    return (this.behavior.response as T[]) || [];
  }

  async insert(table: string, data: Record<string, unknown>): Promise<{ id: string }> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [table, data] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      throw this.behavior.error || new Error('Mock insert error');
    }
    
    const id = `mock-${Date.now()}`;
    this.data.set(`${table}:${id}`, data);
    
    return { id };
  }

  async update(table: string, id: string, data: Record<string, unknown>): Promise<boolean> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [table, id, data] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      throw this.behavior.error || new Error('Mock update error');
    }
    
    const existingData = this.data.get(`${table}:${id}`) as Record<string, unknown> | undefined;
    this.data.set(`${table}:${id}`, { ...(existingData || {}), ...data });
    
    return true;
  }

  async delete(table: string, id: string): Promise<boolean> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [table, id] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      throw this.behavior.error || new Error('Mock delete error');
    }
    
    return this.data.delete(`${table}:${id}`);
  }

  seedData(table: string, records: Array<{ id: string; [key: string]: unknown }>): void {
    records.forEach(record => {
      this.data.set(`${table}:${record.id}`, record);
    });
  }

  getStoredData(): Map<string, unknown> {
    return new Map(this.data);
  }
}

/**
 * Mock AI Service Adapter
 */
export class MockAIServiceAdapter extends BaseMockAdapter {
  private generationCount = 0;

  constructor(behavior: MockBehavior = {}) {
    super('mock_ai_service', IntegrationType.AI_SERVICE, {
      latency: { min: 500, max: 2000 }, // AI typically takes longer
      ...behavior,
    });
  }

  async generate(prompt: string, options?: Record<string, unknown>): Promise<string> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [prompt, options] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      throw this.behavior.error || new Error('Mock AI generation error');
    }
    
    this.generationCount++;
    
    // Return mock generated content
    return (this.behavior.response as string) || `Mock AI response #${this.generationCount} for: ${prompt.substring(0, 50)}...`;
  }

  async analyze(content: string): Promise<Record<string, unknown>> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [content] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      throw this.behavior.error || new Error('Mock AI analysis error');
    }
    
    return (this.behavior.response as Record<string, unknown>) || {
      sentiment: 'neutral',
      confidence: 0.85,
      keywords: ['mock', 'analysis'],
    };
  }

  getGenerationCount(): number {
    return this.generationCount;
  }
}

/**
 * Mock Market Data Adapter
 */
export class MockMarketDataAdapter extends BaseMockAdapter {
  private prices: Map<string, { bid: number; ask: number; timestamp: Date }> = new Map();
  private subscribers: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(behavior: MockBehavior = {}) {
    super('mock_market_data', IntegrationType.MARKET_DATA, behavior);
    
    // Seed some initial prices
    this.prices.set('EURUSD', { bid: 1.0850, ask: 1.0852, timestamp: new Date() });
    this.prices.set('GBPUSD', { bid: 1.2650, ask: 1.2652, timestamp: new Date() });
    this.prices.set('USDJPY', { bid: 149.50, ask: 149.52, timestamp: new Date() });
  }

  async getQuote(symbol: string): Promise<{ bid: number; ask: number; timestamp: Date }> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [symbol] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      throw this.behavior.error || new Error('Mock market data error');
    }
    
    const quote = this.prices.get(symbol);
    if (!quote) {
      throw new Error(`Unknown symbol: ${symbol}`);
    }
    
    // Simulate price movement
    const movement = (Math.random() - 0.5) * 0.001;
    return {
      bid: quote.bid + movement,
      ask: quote.ask + movement,
      timestamp: new Date(),
    };
  }

  subscribe(symbol: string, callback: (data: unknown) => void): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    
    this.subscribers.get(symbol)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(symbol)?.delete(callback);
    };
  }

  simulatePriceUpdate(symbol: string, bid: number, ask: number): void {
    const quote = { bid, ask, timestamp: new Date() };
    this.prices.set(symbol, quote);
    
    // Notify subscribers
    this.subscribers.get(symbol)?.forEach(callback => {
      try {
        callback(quote);
      } catch (error) {
        logger.error('Error in market data subscriber:', error);
      }
    });
  }

  getSubscriberCount(): number {
    let count = 0;
    this.subscribers.forEach(set => {
      count += set.size;
    });
    return count;
  }
}

/**
 * Mock Cache Adapter
 */
export class MockCacheAdapter extends BaseMockAdapter {
  private cache: Map<string, { value: unknown; expiry?: number }> = new Map();

  constructor(behavior: MockBehavior = {}) {
    super('mock_cache', IntegrationType.CACHE, {
      latency: 1, // Cache is fast
      ...behavior,
    });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [key] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      throw this.behavior.error || new Error('Mock cache error');
    }
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check expiry
    if (entry.expiry && entry.expiry < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [key, value, ttlMs] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    if (this.behavior.error || Math.random() < (this.behavior.failureRate || 0)) {
      throw this.behavior.error || new Error('Mock cache set error');
    }
    
    this.cache.set(key, {
      value,
      expiry: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  async delete(key: string): Promise<boolean> {
    if (this.behavior.trackCalls) {
      this.callHistory.push({ timestamp: new Date(), args: [key] });
    }
    
    await this.simulateDelay(this.getLatency());
    
    return this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  getSize(): number {
    return this.cache.size;
  }
}

// ============================================================================
// Integration Test Harness
// ============================================================================

/**
 * Integration Test Harness
 * 
 * Provides a complete testing environment for integration scenarios
 */
export class IntegrationTestHarness {
  private adapters: Map<string, MockAdapter> = new Map();
  private eventLog: IntegrationEvent[] = [];
  private isRunning = false;

  constructor() {
    logger.info('Integration test harness created');
  }

  /**
   * Register a mock adapter
   */
  registerAdapter(adapter: MockAdapter): void {
    this.adapters.set(adapter.name, adapter);
    logger.debug(`Registered mock adapter: ${adapter.name}`);
  }

  /**
   * Get a mock adapter by name
   */
  getAdapter<T extends MockAdapter>(name: string): T | undefined {
    return this.adapters.get(name) as T | undefined;
  }

  /**
   * Create standard mock adapters
   */
  createStandardMocks(): {
    database: MockDatabaseAdapter;
    aiService: MockAIServiceAdapter;
    marketData: MockMarketDataAdapter;
    cache: MockCacheAdapter;
  } {
    const database = new MockDatabaseAdapter();
    const aiService = new MockAIServiceAdapter();
    const marketData = new MockMarketDataAdapter();
    const cache = new MockCacheAdapter();

    this.registerAdapter(database);
    this.registerAdapter(aiService);
    this.registerAdapter(marketData);
    this.registerAdapter(cache);

    return { database, aiService, marketData, cache };
  }

  /**
   * Create integration config for a mock adapter
   */
  createMockIntegrationConfig(adapter: MockAdapter): IntegrationConfig {
    return {
      name: adapter.name,
      type: adapter.type,
      priority: this.getPriorityForType(adapter.type),
      description: `Mock ${adapter.name} for testing`,
      healthCheck: () => adapter.healthCheck(),
      onStatusChange: (status) => {
        this.logEvent({
          type: IntegrationEventType.STATUS_CHANGED,
          integrationType: adapter.type,
          integrationName: adapter.name,
          timestamp: new Date(),
          newStatus: status.status,
        });
      },
      recoveryHandler: async () => {
        adapter.simulateRecovery();
        return true;
      },
      gracefulShutdown: async () => {
        adapter.reset();
      },
    };
  }

  /**
   * Start the test harness
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Test harness already running');
      return;
    }

    this.isRunning = true;
    this.eventLog = [];
    
    logger.info('Test harness started');
  }

  /**
   * Stop the test harness
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Reset all adapters
    this.adapters.forEach(adapter => adapter.reset());
    this.adapters.clear();
    this.eventLog = [];
    
    this.isRunning = false;
    logger.info('Test harness stopped');
  }

  /**
   * Log an event
   */
  logEvent(event: IntegrationEvent): void {
    this.eventLog.push(event);
  }

  /**
   * Get event log
   */
  getEventLog(): IntegrationEvent[] {
    return [...this.eventLog];
  }

  /**
   * Get events for a specific integration
   */
  getEventsForIntegration(name: string): IntegrationEvent[] {
    return this.eventLog.filter(e => e.integrationName === name);
  }

  /**
   * Assert that an integration is healthy
   */
  assertHealthy(name: string): void {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter ${name} not found`);
    }
    
    if (!adapter.state.healthy) {
      throw new Error(`Expected ${name} to be healthy, but it is unhealthy: ${adapter.state.lastError}`);
    }
  }

  /**
   * Assert that an integration is unhealthy
   */
  assertUnhealthy(name: string): void {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter ${name} not found`);
    }
    
    if (adapter.state.healthy) {
      throw new Error(`Expected ${name} to be unhealthy, but it is healthy`);
    }
  }

  /**
   * Assert call count for an adapter
   */
  assertCallCount(name: string, expected: number): void {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter ${name} not found`);
    }
    
    const actual = adapter.getCallHistory().length;
    if (actual !== expected) {
      throw new Error(`Expected ${name} to have ${expected} calls, but got ${actual}`);
    }
  }

  /**
   * Simulate a scenario
   */
  async simulateScenario(
    scenario: (harness: IntegrationTestHarness) => Promise<void>
  ): Promise<void> {
    await this.start();
    
    try {
      await scenario(this);
    } finally {
      await this.stop();
    }
  }

  private getPriorityForType(type: IntegrationType): IntegrationPriority {
    switch (type) {
      case IntegrationType.DATABASE:
        return IntegrationPriority.CRITICAL;
      case IntegrationType.AI_SERVICE:
      case IntegrationType.CACHE:
        return IntegrationPriority.HIGH;
      case IntegrationType.MARKET_DATA:
        return IntegrationPriority.MEDIUM;
      default:
        return IntegrationPriority.LOW;
    }
  }
}

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Condition not met within timeout');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

/**
 * Create a deferred promise for testing async behavior
 */
export function createDeferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * Create a test integration configuration
 */
export function createTestIntegrationConfig(
  name: string,
  type: IntegrationType,
  options: Partial<IntegrationConfig> = {}
): IntegrationConfig {
  return {
    name,
    type,
    priority: IntegrationPriority.MEDIUM,
    description: `Test integration: ${name}`,
    healthCheck: async () => ({
      healthy: true,
      latency: 10,
    }),
    ...options,
  };
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Create a pre-configured test harness with standard mocks
 */
export function createTestHarness(): IntegrationTestHarness {
  const harness = new IntegrationTestHarness();
  harness.createStandardMocks();
  return harness;
}
