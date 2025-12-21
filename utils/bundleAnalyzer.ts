/**
 * Bundle Analysis and Monitoring Module
 * Provides real-time insights into bundle loading performance and optimizations
 */

interface BundleMetrics {
  totalSize: number;
  totalLoadTime: number;
  chunkCount: number;
  largeChunks: Array<{ name: string; size: number }>;
  loadSequence: Array<{ name: string; loadTime: number; size: number }>;
  cacheUtilization: number;
}

class BundleAnalyzer {
  private metrics: BundleMetrics;
  private observer: PerformanceObserver | null = null;
  private startTime: number = 0;

  constructor() {
    this.metrics = {
      totalSize: 0,
      totalLoadTime: 0,
      chunkCount: 0,
      largeChunks: [],
      loadSequence: [],
      cacheUtilization: 0
    };
    this.initializeMonitoring();
  }

  private initializeMonitoring() {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'resource' && entry.name.includes('.js')) {
            this.processChunkLoad(entry as PerformanceResourceTiming);
          }
        });
      });
      
      this.observer.observe({ entryTypes: ['resource'] });
      this.startTime = performance.now();
    }
  }

  private processChunkLoad(entry: PerformanceResourceTiming) {
    const name = this.extractChunkName(entry.name);
    const size = entry.transferSize || 0;
    const loadTime = entry.duration;

    this.metrics.totalSize += size;
    this.metrics.totalLoadTime += loadTime;
    this.metrics.chunkCount++;

    // Track loading sequence
    this.metrics.loadSequence.push({
      name,
      loadTime,
      size
    });

    // Identify large chunks (> 100KB)
    if (size > 100000) {
      this.metrics.largeChunks.push({ name, size });
    }

    // Log progress for development
    if (process.env['NODE_ENV'] === 'development') {
      console.log(`📦 Chunk loaded: ${name} (${(size / 1024).toFixed(2)}KB, ${loadTime.toFixed(2)}ms)`);
    }

    // Calculate cache utilization
    this.updateCacheUtilization();

    // Show progress at milestones
    if (this.metrics.chunkCount % 5 === 0) {
      this.logProgress();
    }
  }

  private extractChunkName(url: string): string {
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    if (!fileName) return 'unknown-chunk';
    const nameWithoutHash = fileName.split('-')[0];
    const category = parts[parts.length - 2] || 'unknown';
    
    return `${category}/${nameWithoutHash}`;
  }

  private updateCacheUtilization() {
    const totalResources = performance.getEntriesByType('resource');
    
    // Estimate cache hits (resources with very fast load times are likely cached)
    const quickLoads = performance.getEntriesByType('resource')
      .filter(entry => entry.duration < 10 && (entry as PerformanceResourceTiming).transferSize > 0)
      .length;
    
    this.metrics.cacheUtilization = totalResources.length > 0 
      ? (quickLoads / totalResources.length) * 100 
      : 0;
  }

  private logProgress() {
    const avgTime = this.metrics.totalLoadTime / this.metrics.chunkCount;
    const avgSize = this.metrics.totalSize / this.metrics.chunkCount;
    
    console.log(`📊 Bundle Loading Progress (${this.metrics.chunkCount} chunks):`);
    console.log(`   Total Size: ${(this.metrics.totalSize / 1024).toFixed(2)}KB`);
    console.log(`   Avg Load Time: ${avgTime.toFixed(2)}ms per chunk`);
    console.log(`   Avg Chunk Size: ${(avgSize / 1024).toFixed(2)}KB`);
    console.log(`   Cache Utilization: ${this.metrics.cacheUtilization.toFixed(1)}%`);
  }

  /**
   * Get comprehensive bundle analysis
   */
  public getAnalysis(): BundleMetrics & {
    performanceGrade: string;
    optimizations: string[];
    recommendations: string[];
  } {
    const avgChunkSize = this.metrics.totalSize / this.metrics.chunkCount || 0;
    const totalSizeKB = this.metrics.totalSize / 1024;
    const totalSizeMB = totalSizeKB / 1024;

    // Calculate performance grade
    let grade = 'A';
    let issues: string[] = [];

    if (totalSizeMB > 2) {
      grade = 'C';
      issues.push('Bundle size exceeds 2MB');
    } else if (totalSizeMB > 1.5) {
      grade = 'B';
      issues.push('Bundle size approaching 1.5MB');
    }

    if (this.metrics.largeChunks.length > 0) {
      grade = grade === 'A' ? 'B' : 'C';
      issues.push(`${this.metrics.largeChunks.length} large chunks detected`);
    }

    if (avgChunkSize > 50000) { // 50KB
      issues.push('Average chunk size is high');
    }

    // Generate optimizations report
    const optimizations = this.detectOptimizations();
    
    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      ...this.metrics,
      performanceGrade: grade,
      optimizations,
      recommendations
    };
  }

  private detectOptimizations(): string[] {
    const optimizations: string[] = [];

    // Check for chunk splitting
    if (this.metrics.chunkCount > 15) {
      optimizations.push('✅ Advanced chunk splitting detected');
    }

    // Check for lazy loading
    const chartChunks = this.metrics.loadSequence.filter(chunk => 
      chunk.name.includes('charts')
    );
    if (chartChunks.length > 0) {
      optimizations.push('✅ Chart libraries lazy-loaded');
    }

    // Check for AI service optimization
    const aiChunks = this.metrics.loadSequence.filter(chunk => 
      chunk.name.includes('ai')
    );
    if (aiChunks.length > 1) {
      optimizations.push('✅ AI services split and optimized');
    }

    // Check for vendor optimization
    const vendorChunks = this.metrics.loadSequence.filter(chunk => 
      chunk.name.includes('vendor')
    );
    if (vendorChunks.length > 3) {
      optimizations.push('✅ Vendor libraries well-split');
    }

    // Check for cache performance
    if (this.metrics.cacheUtilization > 30) {
      optimizations.push('✅ Good cache utilization');
    }

    return optimizations;
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.largeChunks.length > 0) {
      recommendations.push('Consider further splitting large chunks');
    }

    if (this.metrics.totalSize > 1500000) { // 1.5MB
      recommendations.push('Analyze and remove unused dependencies');
    }

    if (this.metrics.cacheUtilization < 20) {
      recommendations.push('Implement better caching strategies');
    }

    if (this.metrics.totalLoadTime > 3000) { // 3 seconds
      recommendations.push('Consider implementing preloading for critical chunks');
    }

    return recommendations;
  }

  /**
   * Generate detailed report
   */
  public generateReport(): string {
    const analysis = this.getAnalysis();
    const totalSizeMB = (this.metrics.totalSize / 1024 / 1024).toFixed(2);
    
    let report = `\n📊 BUNDLE OPTIMIZATION REPORT
═══════════════════════════════════════

📏 TOTAL SIZE: ${totalSizeMB} MB
⏱️  TOTAL LOAD TIME: ${this.metrics.totalLoadTime.toFixed(2)}ms
🔢 CHUNK COUNT: ${this.metrics.chunkCount}
🎯 PERFORMANCE GRADE: ${analysis.performanceGrade}

OPTIMIZATIONS DETECTED:
${analysis.optimizations.map(opt => `  ${opt}`).join('\n') || '  None detected'}

LARGE CHUNKS (>100KB):
${this.metrics.largeChunks.map(chunk => `  📦 ${chunk.name}: ${(chunk.size / 1024).toFixed(2)}KB`).join('\n') || '  None'}

LOAD SEQUENCE (first 10):
${this.metrics.loadSequence.slice(0, 10).map((chunk, i) => 
  `  ${i + 1}. ${chunk.name}: ${(chunk.size / 1024).toFixed(1)}KB (${chunk.loadTime.toFixed(1)}ms)`
).join('\n')}

RECOMMENDATIONS:
${analysis.recommendations.map(rec => `  💡 ${rec}`).join('\n') || '  No recommendations needed'}

CACHE PERFORMANCE:
  🎯 Utilization: ${this.metrics.cacheUtilization.toFixed(1)}%
  📦 Average Chunk: ${(this.metrics.totalSize / this.metrics.chunkCount / 1024).toFixed(1)}KB
═══════════════════════════════════════
`;

    return report;
  }

  /**
   * Start monitoring
   */
  public start() {
    this.startTime = performance.now();
    console.log('🔍 Bundle analysis started');
  }

  /**
   * Stop monitoring and show report
   */
  public stop() {
    if (this.observer) {
      this.observer.disconnect();
    }
    
    setTimeout(() => {
      console.log(this.generateReport());
      
      // Report bundle loading completion
      const loadTime = performance.now() - this.startTime;
      console.log(`✅ Bundle loading completed in ${loadTime.toFixed(2)}ms`);
    }, 1000);
  }

  /**
   * Get real-time metrics
   */
  public getMetrics(): BundleMetrics {
    return { ...this.metrics };
  }
}

// Global instance
export const bundleAnalyzer = new BundleAnalyzer();

// Auto-start in development
if (process.env['NODE_ENV'] === 'development' && typeof window !== 'undefined') {
  bundleAnalyzer.start();
  
  // Auto-stop after reasonable time
  setTimeout(() => {
    bundleAnalyzer.stop();
  }, 5000);
}

export default bundleAnalyzer;