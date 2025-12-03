#!/usr/bin/env node

/**
 * Edge Cache Warming Script
 * Proactively warms up edge cache and connections for optimal performance
 */

const https = require('https');
const http = require('http');

// Configuration
const CONFIG = {
  baseUrl: process.env.VERCEL_URL || 'https://quanforge.ai',
  regions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1'],
  endpoints: [
    '/',
    '/api/edge/metrics',
    '/api/edge/warmup',
    '/api/edge/health',
    '/dashboard',
    '/generator'
  ],
  patterns: [
    'robots_list',
    'user_session',
    'market_data',
    'strategy_types',
    'config_settings'
  ],
  maxRetries: 3,
  timeout: 10000,
  concurrency: 5
};

// Metrics tracking
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDuration: 0,
  regionResults: {}
};

/**
 * Make HTTP request with retry logic
 */
async function makeRequest(url, options = {}, retries = 0) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const duration = performance.now() - startTime;
        metrics.totalDuration += duration;
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          metrics.successfulRequests++;
          resolve({
            statusCode: res.statusCode,
            duration,
            size: data.length,
            headers: res.headers
          });
        } else {
          metrics.failedRequests++;
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        }
      });
    });
    
    req.on('error', (error) => {
      metrics.failedRequests++;
      
      if (retries < CONFIG.maxRetries) {
        console.warn(`Request failed, retrying (${retries + 1}/${CONFIG.maxRetries}):`, error.message);
        setTimeout(() => {
          makeRequest(url, options, retries + 1).then(resolve).catch(reject);
        }, 1000 * (retries + 1));
      } else {
        reject(error);
      }
    });
    
    req.on('timeout', () => {
      req.destroy();
      metrics.failedRequests++;
      reject(new Error('Request timeout'));
    });
    
    req.setTimeout(CONFIG.timeout);
    req.end();
  });
}

/**
 * Warm up edge endpoints
 */
async function warmupEndpoints() {
  console.log('🔥 Starting edge endpoint warmup...');
  
  const promises = [];
  
  for (const endpoint of CONFIG.endpoints) {
    for (const region of CONFIG.regions) {
      const url = `${CONFIG.baseUrl}${endpoint}`;
      promises.push(warmupEndpoint(url, region, endpoint));
    }
  }
  
  // Execute with concurrency control
  const results = await executeWithConcurrency(promises, CONFIG.concurrency);
  
  console.log(`✅ Endpoint warmup completed: ${results.filter(r => r.success).length}/${results.length} successful`);
}

/**
 * Warm up single endpoint
 */
async function warmupEndpoint(url, region, endpoint) {
  try {
    const response = await makeRequest(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Edge-Warmup/1.0',
        'X-Warmup-Request': 'true',
        'X-Target-Region': region,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!metrics.regionResults[region]) {
      metrics.regionResults[region] = { success: 0, failed: 0 };
    }
    metrics.regionResults[region].success++;
    
    return {
      success: true,
      url,
      region,
      endpoint,
      statusCode: response.statusCode,
      duration: response.duration
    };
  } catch (error) {
    if (!metrics.regionResults[region]) {
      metrics.regionResults[region] = { success: 0, failed: 0 };
    }
    metrics.regionResults[region].failed++;
    
    console.warn(`❌ Failed to warmup ${url} for region ${region}:`, error.message);
    return {
      success: false,
      url,
      region,
      endpoint,
      error: error.message
    };
  }
}

/**
 * Warm up cache patterns
 */
async function warmupCachePatterns() {
  console.log('🔄 Starting cache pattern warmup...');
  
  try {
    const response = await makeRequest(`${CONFIG.baseUrl}/api/edge/warmup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Warmup-Request': 'true'
      }
    });
    
    console.log('✅ Cache pattern warmup completed');
    return true;
  } catch (error) {
    console.warn('❌ Cache pattern warmup failed:', error.message);
    return false;
  }
}

/**
 * Execute promises with concurrency control
 */
async function executeWithConcurrency(promises, concurrency) {
  const results = [];
  const executing = [];
  
  for (const promise of promises) {
    const p = Promise.resolve(promise).then(result => {
      executing.splice(executing.indexOf(p), 1);
      return result;
    });
    
    results.push(p);
    
    if (promises.length >= concurrency) {
      executing.push(p);
      
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }
  
  return Promise.allSettled(results);
}

/**
 * Collect edge metrics
 */
async function collectMetrics() {
  console.log('📊 Collecting edge metrics...');
  
  try {
    const response = await makeRequest(`${CONFIG.baseUrl}/api/edge/metrics?detailed=true`, {
      method: 'GET',
      headers: {
        'X-Metrics-Request': 'true'
      }
    });
    
    console.log('✅ Edge metrics collected successfully');
    return response;
  } catch (error) {
    console.warn('❌ Failed to collect edge metrics:', error.message);
    return null;
  }
}

/**
 * Print summary report
 */
function printSummary() {
  console.log('\n📈 Edge Warmup Summary');
  console.log('========================');
  console.log(`Total Requests: ${metrics.totalRequests}`);
  console.log(`Successful: ${metrics.successfulRequests}`);
  console.log(`Failed: ${metrics.failedRequests}`);
  console.log(`Success Rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`);
  console.log(`Total Duration: ${metrics.totalDuration.toFixed(2)}ms`);
  console.log(`Average Duration: ${(metrics.totalDuration / metrics.totalRequests).toFixed(2)}ms`);
  
  console.log('\n🌍 Regional Results:');
  for (const [region, results] of Object.entries(metrics.regionResults)) {
    const total = results.success + results.failed;
    const successRate = total > 0 ? ((results.success / total) * 100).toFixed(2) : '0.00';
    console.log(`  ${region}: ${results.success}/${total} (${successRate}%)`);
  }
  
  console.log('\n🎯 Recommendations:');
  const failedRegions = Object.entries(metrics.regionResults)
    .filter(([_, results]) => results.failed > results.success)
    .map(([region]) => region);
  
  if (failedRegions.length > 0) {
    console.log(`  ⚠️  Consider investigating regions with high failure rates: ${failedRegions.join(', ')}`);
  }
  
  if (metrics.totalDuration / metrics.totalRequests > 2000) {
    console.log('  ⚠️  Average response time is high, consider optimization');
  }
  
  if ((metrics.successfulRequests / metrics.totalRequests) < 0.9) {
    console.log('  ⚠️  Success rate is below 90%, review error logs');
  }
  
  console.log('\n✨ Edge warmup completed successfully!');
}

/**
 * Main execution function
 */
async function main() {
  const startTime = performance.now();
  
  console.log('🚀 Starting Edge Cache Warmup');
  console.log('===============================');
  console.log(`Target: ${CONFIG.baseUrl}`);
  console.log(`Regions: ${CONFIG.regions.join(', ')}`);
  console.log(`Endpoints: ${CONFIG.endpoints.length}`);
  console.log(`Concurrency: ${CONFIG.concurrency}`);
  console.log('');
  
  try {
    // Update total requests count
    metrics.totalRequests = CONFIG.endpoints.length * CONFIG.regions.length + 2; // +2 for cache warmup and metrics
    
    // Execute warmup sequence
    await warmupEndpoints();
    await warmupCachePatterns();
    await collectMetrics();
    
    const totalDuration = performance.now() - startTime;
    metrics.totalDuration += totalDuration;
    
    printSummary();
    
    // Exit with appropriate code
    const successRate = metrics.successfulRequests / metrics.totalRequests;
    process.exit(successRate >= 0.8 ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Edge warmup failed:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main, warmupEndpoints, warmupCachePatterns, collectMetrics };