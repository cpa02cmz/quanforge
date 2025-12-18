#!/usr/bin/env node

/**
 * Enhanced Edge Cache Warming Script
 * Optimized for Vercel Edge deployment with intelligent warming strategies
 */

const { performance } = require('perf_hooks');

class EnhancedEdgeWarmer {
  constructor() {
    this.regions = [
      { name: 'iad1', priority: 'high', latency: 30 },   // US East
      { name: 'hkg1', priority: 'high', latency: 150 },  // Hong Kong
      { name: 'sin1', priority: 'high', latency: 120 },  // Singapore
      { name: 'fra1', priority: 'medium', latency: 80 }, // Frankfurt
      { name: 'sfo1', priority: 'medium', latency: 60 }, // San Francisco
      { name: 'cle1', priority: 'low', latency: 40 },    // Cleveland
      { name: 'arn1', priority: 'low', latency: 100 },   // Stockholm
      { name: 'gru1', priority: 'low', latency: 140 },   // São Paulo
    ];

    this.WARMUP_ENDPOINTS = [
      '/api/edge/metrics',
      '/api/robots/route',
      '/api/market-data/route',
      '/api/analytics/performance',
      '/api/health'
    ];

    this.MAX_CONCURRENT_WARMUPS = 3;
    this.WARMUP_TIMEOUT = 10000; // 10 seconds
    this.RETRY_ATTEMPTS = 2;
  }

  async warmAllRegions() {
    const startTime = performance.now();
    console.log('🚀 Starting enhanced edge warming...');

    // Sort regions by priority and latency
    const sortedRegions = [...this.regions].sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.latency - b.latency;
    });

    const results = [];
    let successful = 0;
    let failed = 0;

    // Phase 1: Warm high-priority regions immediately
    const highPriorityRegions = sortedRegions.filter(r => r.priority === 'high');
    const highPriorityResults = await this.warmRegionsConcurrently(highPriorityRegions);
    results.push(...highPriorityResults);

    // Phase 2: Warm medium-priority regions with slight delay
    const mediumPriorityRegions = sortedRegions.filter(r => r.priority === 'medium');
    await this.delay(1000); // 1 second delay
    const mediumPriorityResults = await this.warmRegionsConcurrently(mediumPriorityRegions);
    results.push(...mediumPriorityResults);

    // Phase 3: Warm low-priority regions
    const lowPriorityRegions = sortedRegions.filter(r => r.priority === 'low');
    await this.delay(1000); // 1 second delay
    const lowPriorityResults = await this.warmRegionsConcurrently(lowPriorityRegions);
    results.push(...lowPriorityResults);

    // Count results
    successful = results.filter(r => r.success).length;
    failed = results.filter(r => !r.success).length;

    const duration = performance.now() - startTime;

    console.log(`✅ Edge warming completed in ${duration.toFixed(2)}ms`);
    console.log(`📊 Results: ${successful}/${this.regions.length} regions successful`);

    // Log individual region results
    results.forEach(result => {
      if (result.success) {
        console.log(`  ✅ ${result.region}: ${result.responseTime.toFixed(2)}ms`);
      } else {
        console.log(`  ❌ ${result.region}: ${result.error}`);
      }
    });

    return {
      totalRegions: this.regions.length,
      successful,
      failed,
      results,
      duration
    };
  }

  async warmRegionsConcurrently(regions) {
    const results = [];
    
    // Process regions in batches to avoid overwhelming the system
    for (let i = 0; i < regions.length; i += this.MAX_CONCURRENT_WARMUPS) {
      const batch = regions.slice(i, i + this.MAX_CONCURRENT_WARMUPS);
      const batchPromises = batch.map(region => this.warmRegion(region));
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            region: batch[index].name,
            success: false,
            responseTime: 0,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }

    return results;
  }

  async warmRegion(region) {
    const startTime = performance.now();
    
    try {
      // Warm primary endpoints for this region
      await this.warmEndpointsForRegion(region.name);
      
      const responseTime = performance.now() - startTime;
      region.lastWarmed = Date.now();
      
      return {
        region: region.name,
        success: true,
        responseTime
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      return {
        region: region.name,
        success: false,
        responseTime,
        error: error.message || 'Unknown error'
      };
    }
  }

  async warmEndpointsForRegion(regionName) {
    const warmupPromises = this.WARMUP_ENDPOINTS.map(endpoint => 
      this.warmEndpoint(endpoint, regionName)
    );

    await Promise.allSettled(warmupPromises);
  }

  async warmEndpoint(endpoint, region) {
    const url = this.buildEndpointUrl(endpoint, region);
    
    for (let attempt = 1; attempt <= this.RETRY_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Warmup-Request': 'true',
            'X-Edge-Region': region,
            'Cache-Control': 'no-cache',
            'User-Agent': 'QuantForge-Edge-Warmer/1.0.0'
          },
          signal: AbortSignal.timeout(this.WARMUP_TIMEOUT)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Successfully warmed
        return;
      } catch (error) {
        if (attempt === this.RETRY_ATTEMPTS) {
          throw error;
        }
        
        // Exponential backoff
        await this.delay(1000 * attempt);
      }
    }
  }

  buildEndpointUrl(endpoint, region) {
    const baseUrl = process.env.VERCEL_URL || 'https://quanforge.ai';
    const url = new URL(endpoint, baseUrl);
    
    // Add region-specific query parameters for edge routing
    url.searchParams.set('region', region);
    url.searchParams.set('warmup', 'true');
    url.searchParams.set('timestamp', Date.now().toString());
    
    return url.toString();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get warming statistics and health metrics
   */
  getWarmingStats() {
    const regionsByPriority = this.regions.reduce((acc, region) => {
      acc[region.priority] = (acc[region.priority] || 0) + 1;
      return acc;
    }, {});

    const lastWarmingTimes = this.regions.reduce((acc, region) => {
      acc[region.name] = region.lastWarmed;
      return acc;
    }, {});

    // Estimate latency reduction based on warmed regions
    const warmedRegions = this.regions.filter(r => r.lastWarmed).length;
    const estimatedLatencyReduction = (warmedRegions / this.regions.length) * 100;

    return {
      totalRegions: this.regions.length,
      regionsByPriority,
      lastWarmingTimes,
      estimatedLatencyReduction
    };
  }

  /**
   * Predictive warming based on usage patterns
   */
  async predictiveWarming() {
    console.log('🔮 Starting predictive edge warming...');
    
    // Analyze current time and determine likely active regions
    const currentHour = new Date().getHours();
    const activeRegions = this.getPredictiveActiveRegions(currentHour);
    
    // Warm predicted active regions first
    const highPriorityRegions = this.regions.filter(r => 
      activeRegions.includes(r.name) || r.priority === 'high'
    );
    
    await this.warmRegionsConcurrently(highPriorityRegions);
    console.log('🔮 Predictive warming completed');
  }

  getPredictiveActiveRegions(currentHour) {
    // Simplified predictive logic based on global business hours
    if (currentHour >= 9 && currentHour <= 17) {
      // Business hours - prioritize major business regions
      return ['iad1', 'fra1', 'hkg1', 'sin1'];
    } else if (currentHour >= 18 && currentHour <= 23) {
      // Evening hours - prioritize consumer regions
      return ['iad1', 'sfo1', 'hkg1', 'sin1'];
    } else {
      // Late night/early morning - prioritize APAC regions
      return ['hkg1', 'sin1', 'iad1'];
    }
  }
}

// Execute warming if run directly
if (require.main === module) {
  const warmer = new EnhancedEdgeWarmer();
  
  // Run predictive warming first
  warmer.predictiveWarming()
    .then(() => {
      // Then run full warming
      return warmer.warmAllRegions();
    })
    .then(results => {
      // Output metrics for monitoring
      console.log('\n📈 Warming Metrics:');
      console.log(`  Success Rate: ${((results.successful / results.totalRegions) * 100).toFixed(1)}%`);
      console.log(`  Average Response Time: ${(results.results.reduce((sum, r) => sum + r.responseTime, 0) / results.results.length).toFixed(2)}ms`);
      console.log(`  Total Duration: ${results.duration.toFixed(2)}ms`);
      
      // Exit with appropriate code
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Edge warming failed:', error);
      process.exit(1);
    });
}

module.exports = { EnhancedEdgeWarmer };