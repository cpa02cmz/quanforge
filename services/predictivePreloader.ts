// Predictive Preloading Service
// AI-powered user behavior prediction for intelligent resource preloading

import { createScopedLogger } from '../utils/logger';

const logger = createScopedLogger('predictivePreloader');

interface UserBehaviorPattern {
  route: string;
  nextRoutes: Array<{
    route: string;
    probability: number;
    avgTimeToAction: number; // in seconds
  }>;
  components: Array<{
    name: string;
    probability: number;
    priority: number;
  }>;
  lastUpdated: number;
}

interface PreloadAction {
  type: 'route' | 'component' | 'data' | 'service';
  target: string;
  priority: number;
  probability: number;
  timestamp: number;
}

class PredictivePreloader {
  private behaviorPatterns = new Map<string, UserBehaviorPattern>();
  private preloadQueue: PreloadAction[] = [];
  private isProcessing = false;
  private userSession: Array<{
    route: string;
    timestamp: number;
    action: string;
    duration?: number;
  }> = [];
  private sessionStartTime = Date.now();
  private readonly maxSessionLength = 50; // Keep last 50 actions
  private readonly maxPreloadQueue = 20; // Max concurrent preloads

  constructor() {
    this.initializeBehaviorPatterns();
    this.startBehaviorTracking();
    this.startPreloadProcessor();
  }

  private initializeBehaviorPatterns(): void {
    // Initialize with common patterns based on typical user behavior
    const commonPatterns: UserBehaviorPattern[] = [
      {
        route: '/dashboard',
        nextRoutes: [
          { route: '/generator', probability: 0.7, avgTimeToAction: 15 },
          { route: '/generator/new', probability: 0.5, avgTimeToAction: 30 },
          { route: '/about', probability: 0.1, avgTimeToAction: 120 }
        ],
        components: [
          { name: 'ChartComponents', probability: 0.6, priority: 8 },
          { name: 'CodeEditor', probability: 0.4, priority: 7 },
          { name: 'ChatInterface', probability: 0.3, priority: 6 }
        ],
        lastUpdated: Date.now()
      },
      {
        route: '/generator',
        nextRoutes: [
          { route: '/dashboard', probability: 0.4, avgTimeToAction: 45 },
          { route: '/generator/new', probability: 0.3, avgTimeToAction: 60 },
          { route: '/about', probability: 0.1, avgTimeToAction: 180 }
        ],
        components: [
          { name: 'CodeEditor', probability: 0.9, priority: 10 },
          { name: 'ChatInterface', probability: 0.8, priority: 9 },
          { name: 'StrategyConfig', probability: 0.7, priority: 8 },
          { name: 'ChartComponents', probability: 0.5, priority: 7 }
        ],
        lastUpdated: Date.now()
      },
      {
        route: '/generator/new',
        nextRoutes: [
          { route: '/generator', probability: 0.8, avgTimeToAction: 5 },
          { route: '/dashboard', probability: 0.3, avgTimeToAction: 90 }
        ],
        components: [
          { name: 'CodeEditor', probability: 0.9, priority: 10 },
          { name: 'ChatInterface', probability: 0.8, priority: 9 },
          { name: 'StrategyConfig', probability: 0.7, priority: 8 }
        ],
        lastUpdated: Date.now()
      }
    ];

    commonPatterns.forEach(pattern => {
      this.behaviorPatterns.set(pattern.route, pattern);
    });
  }

  private startBehaviorTracking(): void {
    // Track route changes
    this.trackRouteChanges();
    
    // Track user interactions
    this.trackUserInteractions();
    
    // Track time spent on pages
    this.trackPageDwellTime();
  }

  private trackRouteChanges(): void {
    // Listen for route changes (simplified for this implementation)
    let currentRoute = window.location.pathname;
    
    const checkRouteChange = () => {
      const newRoute = window.location.pathname;
      if (newRoute !== currentRoute) {
        this.recordRouteChange(currentRoute, newRoute);
        currentRoute = newRoute;
      }
    };

    // Check for route changes every second
    setInterval(checkRouteChange, 1000);
  }

  private recordRouteChange(fromRoute: string, toRoute: string): void {
    const now = Date.now();
    
    // Update user session
    this.userSession.push({
      route: fromRoute,
      timestamp: now,
      action: 'route_change',
      duration: now - (this.userSession[this.userSession.length - 1]?.timestamp || now)
    });

    // Trim session if too long
    if (this.userSession.length > this.maxSessionLength) {
      this.userSession = this.userSession.slice(-this.maxSessionLength);
    }

    // Update behavior patterns
    this.updateBehaviorPattern(fromRoute, toRoute);
    
    // Trigger predictive preloading
    this.triggerPredictivePreload(toRoute);
  }

  private updateBehaviorPattern(fromRoute: string, toRoute: string): void {
    let pattern = this.behaviorPatterns.get(fromRoute);
    
    if (!pattern) {
      pattern = {
        route: fromRoute,
        nextRoutes: [],
        components: [],
        lastUpdated: Date.now()
      };
      this.behaviorPatterns.set(fromRoute, pattern);
    }

    // Update next route probabilities
    const existingNext = pattern.nextRoutes.find(nr => nr.route === toRoute);
    if (existingNext) {
      // Increase probability with exponential moving average
      existingNext.probability = Math.min(1, existingNext.probability * 0.8 + 0.2);
    } else {
      pattern.nextRoutes.push({
        route: toRoute,
        probability: 0.1,
        avgTimeToAction: 30
      });
    }

    // Normalize probabilities
    const totalProb = pattern.nextRoutes.reduce((sum, nr) => sum + nr.probability, 0);
    if (totalProb > 0) {
      pattern.nextRoutes.forEach(nr => {
        nr.probability = nr.probability / totalProb;
      });
    }

    pattern.lastUpdated = Date.now();
  }

  private trackUserInteractions(): void {
    // Track clicks, scrolls, and other interactions
    let lastInteractionTime = Date.now();
    let interactionCount = 0;

    const recordInteraction = (action: string, element?: string) => {
      const now = Date.now();
      const timeSinceLastInteraction = now - lastInteractionTime;
      
      this.userSession.push({
        route: window.location.pathname,
        timestamp: now,
        action: `${action}_${element || 'unknown'}`,
        duration: timeSinceLastInteraction
      });

      lastInteractionTime = now;
      interactionCount++;

      // Trigger predictive preloading based on interaction patterns
      if (interactionCount % 5 === 0) {
        this.analyzeInteractionPatterns();
      }
    };

    // Track clicks
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const elementId = target.id || target.className || 'unknown';
      recordInteraction('click', elementId);
    });

    // Track scrolls
    let scrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        recordInteraction('scroll');
      }, 150);
    });

    // Track form inputs
    document.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      const elementId = target.id || target.className || 'unknown';
      recordInteraction('input', elementId);
    });
  }

  private trackPageDwellTime(): void {
    let pageStartTime = Date.now();
    let lastActiveTime = Date.now();

    const updateActiveTime = () => {
      lastActiveTime = Date.now();
    };

    // Track user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, updateActiveTime, true);
    });

    // Check for inactivity and update patterns
    setInterval(() => {
      const now = Date.now();
      const dwellTime = now - pageStartTime;
      const inactiveTime = now - lastActiveTime;

      // If user has been inactive for more than 30 seconds, consider the page session ended
      if (inactiveTime > 30000) {
        this.updateDwellTimePatterns(window.location.pathname, dwellTime);
        pageStartTime = now;
        lastActiveTime = now;
      }
    }, 5000);
  }

  private updateDwellTimePatterns(route: string, dwellTime: number): void {
    // Update patterns based on how long users stay on pages
    const pattern = this.behaviorPatterns.get(route);
    if (pattern) {
      // Could be used to adjust preload timing
      logger.debug(`Updated dwell time for ${route}: ${dwellTime}ms`);
    }
  }

  private analyzeInteractionPatterns(): void {
    const currentRoute = window.location.pathname;
    const recentInteractions = this.userSession.slice(-10);
    
    // Analyze interaction patterns to predict component usage
    const componentPredictions = this.predictComponentUsage(recentInteractions);
    
    // Queue component preloads
    componentPredictions.forEach(prediction => {
      this.queuePreload({
        type: 'component',
        target: prediction.name,
        priority: prediction.priority,
        probability: prediction.probability,
        timestamp: Date.now()
      });
    });
  }

  private predictComponentUsage(interactions: typeof this.userSession): Array<{ name: string; probability: number; priority: number }> {
    // Simple heuristic-based prediction
    const predictions: Array<{ name: string; probability: number; priority: number }> = [];
    
    const hasCodeInteractions = interactions.some(i => i.action.includes('input') || i.action.includes('CodeEditor'));
    const hasChatInteractions = interactions.some(i => i.action.includes('ChatInterface') || i.action.includes('click_send'));
    const hasChartInteractions = interactions.some(i => i.action.includes('Chart') || i.action.includes('Analysis'));
    
    if (hasCodeInteractions) {
      predictions.push({ name: 'CodeEditor', probability: 0.8, priority: 9 });
      predictions.push({ name: 'StrategyConfig', probability: 0.6, priority: 7 });
    }
    
    if (hasChatInteractions) {
      predictions.push({ name: 'ChatInterface', probability: 0.9, priority: 10 });
    }
    
    if (hasChartInteractions) {
      predictions.push({ name: 'ChartComponents', probability: 0.7, priority: 8 });
    }
    
    return predictions;
  }

  private triggerPredictivePreload(currentRoute: string): void {
    const pattern = this.behaviorPatterns.get(currentRoute);
    if (!pattern) return;

    // Preload likely next routes
    pattern.nextRoutes
      .filter(nr => nr.probability > 0.3) // Only preload routes with >30% probability
      .forEach(nr => {
        setTimeout(() => {
          this.queuePreload({
            type: 'route',
            target: nr.route,
            priority: Math.floor(nr.probability * 10),
            probability: nr.probability,
            timestamp: Date.now()
          });
        }, nr.avgTimeToAction * 500); // Preload at 50% of average time to action
      });

    // Preload likely components
    pattern.components
      .filter(comp => comp.probability > 0.4) // Only preload components with >40% probability
      .forEach(comp => {
        this.queuePreload({
          type: 'component',
          target: comp.name,
          priority: comp.priority,
          probability: comp.probability,
          timestamp: Date.now()
        });
      });
  }

  private queuePreload(action: PreloadAction): void {
    // Check if already queued
    const existing = this.preloadQueue.find(a => a.type === action.type && a.target === action.target);
    if (existing) {
      // Update priority if new action has higher priority
      if (action.priority > existing.priority) {
        existing.priority = action.priority;
        existing.probability = Math.max(existing.probability, action.probability);
      }
      return;
    }

    // Add to queue
    this.preloadQueue.push(action);

    // Sort by priority (descending)
    this.preloadQueue.sort((a, b) => b.priority - a.priority);

    // Trim queue if too long
    if (this.preloadQueue.length > this.maxPreloadQueue) {
      this.preloadQueue = this.preloadQueue.slice(0, this.maxPreloadQueue);
    }
  }

  private startPreloadProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.preloadQueue.length > 0) {
        this.processPreloadQueue();
      }
    }, 1000); // Process every second
  }

  private async processPreloadQueue(): Promise<void> {
    if (this.isProcessing || this.preloadQueue.length === 0) return;

    this.isProcessing = true;
    const action = this.preloadQueue.shift();

    if (!action) {
      this.isProcessing = false;
      return;
    }

    try {
      await this.executePreload(action);
      logger.debug(`Preloaded ${action.type}: ${action.target} (priority: ${action.priority}, probability: ${action.probability})`);
    } catch (error) {
      logger.warn(`Failed to preload ${action.type}: ${action.target}`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async executePreload(action: PreloadAction): Promise<void> {
    switch (action.type) {
      case 'route':
        await this.preloadRoute(action.target);
        break;
      case 'component':
        await this.preloadComponent(action.target);
        break;
      case 'data':
        await this.preloadData(action.target);
        break;
      case 'service':
        await this.preloadService(action.target);
        break;
    }
  }

  private async preloadRoute(route: string): Promise<void> {
    try {
      // Preload route component
      const routeModule = await import(`../pages${route}.tsx`);
      logger.debug(`Preloaded route: ${route}`);
    } catch (error) {
      // Route might not exist, which is fine
      logger.debug(`Route not found for preloading: ${route}`);
    }
  }

  private async preloadComponent(componentName: string): Promise<void> {
    try {
      // Preload component based on name
      switch (componentName) {
        case 'CodeEditor':
          await import('../components/CodeEditor');
          break;
        case 'ChatInterface':
          await import('../components/ChatInterface');
          break;
        case 'StrategyConfig':
          await import('../components/StrategyConfig');
          break;
        case 'ChartComponents':
          await import('../components/ChartComponents');
          break;
        default:
          logger.debug(`Unknown component for preloading: ${componentName}`);
      }
    } catch (error) {
      logger.warn(`Failed to preload component: ${componentName}`, error);
    }
  }

  private async preloadData(dataTarget: string): Promise<void> {
    // Preload common data based on target
    // This could be implemented based on specific data needs
    logger.debug(`Data preloading not implemented for: ${dataTarget}`);
  }

  private async preloadService(serviceName: string): Promise<void> {
    try {
      // Preload services
      switch (serviceName) {
        case 'ai':
          await import('../services/gemini');
          break;
        case 'database':
          await import('../services/supabase');
          break;
        default:
          logger.debug(`Unknown service for preloading: ${serviceName}`);
      }
    } catch (error) {
      logger.warn(`Failed to preload service: ${serviceName}`, error);
    }
  }

  // Public API
  getPreloadStats(): {
    queueLength: number;
    isProcessing: boolean;
    sessionLength: number;
    patternsCount: number;
  } {
    return {
      queueLength: this.preloadQueue.length,
      isProcessing: this.isProcessing,
      sessionLength: this.userSession.length,
      patternsCount: this.behaviorPatterns.size
    };
  }

  forcePreload(type: 'route' | 'component' | 'data' | 'service', target: string, priority: number = 5): void {
    this.queuePreload({
      type,
      target,
      priority,
      probability: 1.0,
      timestamp: Date.now()
    });
  }

  clearCache(): void {
    this.preloadQueue = [];
    this.userSession = [];
    this.sessionStartTime = Date.now();
    logger.info('Predictive preloader cache cleared');
  }
}

// Singleton instance
export const predictivePreloader = new PredictivePreloader();

export { PredictivePreloader };