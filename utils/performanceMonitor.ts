// Performance monitoring utilities

interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  timestamp: number;
  category: 'render' | 'network' | 'memory' | 'custom';
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      // Monitor navigation timing
      try {
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const navEntry = entry as PerformanceNavigationTiming;
              this.recordMetric({
                id: 'navigation',
                name: 'page-load',
                value: navEntry.loadEventEnd - navEntry.loadEventStart,
                timestamp: Date.now(),
                category: 'network'
              });
            }
          }
        });
        navObserver.observe({ entryTypes: ['navigation'] });
        this.observers.push(navObserver);
      } catch (error) {
        console.warn('Navigation observer not supported:', error);
      }

      // Monitor largest contentful paint
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric({
              id: 'lcp',
              name: 'largest-contentful-paint',
              value: entry.startTime,
              timestamp: Date.now(),
              category: 'render'
            });
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (error) {
        console.warn('LCP observer not supported:', error);
      }
    }
  }

  recordMetric(metric: Partial<PerformanceMetric>): void {
    const fullMetric: PerformanceMetric = {
      id: metric.id || Math.random().toString(36).substr(2, 9),
      name: metric.name || 'unknown',
      value: metric.value || 0,
      timestamp: metric.timestamp || Date.now(),
      category: metric.category || 'custom'
    };

    this.metrics.push(fullMetric);

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  getMetrics(category?: string): PerformanceMetric[] {
    if (category) {
      return this.metrics.filter(m => m.category === category);
    }
    return [...this.metrics];
  }

  getMetricByName(name: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === name);
  }

  getAverageMetric(name: string): number {
    const nameMetrics = this.getMetricByName(name);
    if (nameMetrics.length === 0) return 0;
    
    const sum = nameMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / nameMetrics.length;
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;