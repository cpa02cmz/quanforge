#!/usr/bin/env node

/**
 * Production Health Check Script
 * Performs comprehensive health checks for production deployments
 * 
 * Usage: node scripts/production-health-check.js [options]
 * 
 * Options:
 *   --url <url>      Base URL to check (default: http://localhost:3000)
 *   --timeout <ms>   Request timeout in milliseconds (default: 10000)
 *   --json           Output results as JSON
 *   --ci             Exit with error code on failures
 */

import http from 'http';
import https from 'https';

// Configuration
const config = {
  baseUrl: process.argv.includes('--url') 
    ? process.argv[process.argv.indexOf('--url') + 1]
    : process.env.HEALTH_CHECK_URL || 'http://localhost:3000',
  timeout: process.argv.includes('--timeout')
    ? parseInt(process.argv[process.argv.indexOf('--timeout') + 1])
    : 10000,
  jsonOutput: process.argv.includes('--json'),
  ciMode: process.argv.includes('--ci'),
};

// Health check results
const results = {
  timestamp: new Date().toISOString(),
  baseUrl: config.baseUrl,
  checks: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
  },
};

/**
 * Make HTTP request with timeout
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: {
          'User-Agent': 'HealthCheck/1.0',
          'Accept': 'text/html,application/json',
          ...options.headers,
        },
        timeout: config.timeout,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      }
    );
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

/**
 * Add check result
 */
function addCheck(name, status, details = {}) {
  const check = {
    name,
    status,
    timestamp: new Date().toISOString(),
    ...details,
  };
  
  results.checks.push(check);
  results.summary.total++;
  
  if (status === 'passed') results.summary.passed++;
  else if (status === 'failed') results.summary.failed++;
  else if (status === 'warning') results.summary.warnings++;
  
  return check;
}

/**
 * Check 1: Homepage accessibility
 */
async function checkHomepage() {
  try {
    const response = await makeRequest(config.baseUrl);
    
    if (response.statusCode === 200) {
      const hasReactRoot = response.body.includes('root') || response.body.includes('app');
      
      if (hasReactRoot) {
        return addCheck('Homepage', 'passed', {
          message: 'Homepage accessible and contains app root',
          statusCode: response.statusCode,
        });
      } else {
        return addCheck('Homepage', 'warning', {
          message: 'Homepage accessible but may be missing app root',
          statusCode: response.statusCode,
        });
      }
    } else {
      return addCheck('Homepage', 'failed', {
        message: `Unexpected status code: ${response.statusCode}`,
        statusCode: response.statusCode,
      });
    }
  } catch (error) {
    return addCheck('Homepage', 'failed', {
      message: `Failed to access homepage: ${error.message}`,
      error: error.message,
    });
  }
}

/**
 * Check 2: Security headers
 */
async function checkSecurityHeaders() {
  try {
    const response = await makeRequest(config.baseUrl);
    const headers = response.headers;
    
    const requiredHeaders = [
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'strict-transport-security',
      'content-security-policy',
    ];
    
    const missingHeaders = [];
    
    for (const header of requiredHeaders) {
      if (!headers[header]) {
        missingHeaders.push(header);
      }
    }
    
    if (missingHeaders.length === 0) {
      return addCheck('Security Headers', 'passed', {
        message: 'All required security headers present',
        headers: requiredHeaders,
      });
    } else {
      return addCheck('Security Headers', 'failed', {
        message: `Missing security headers: ${missingHeaders.join(', ')}`,
        missing: missingHeaders,
      });
    }
  } catch (error) {
    return addCheck('Security Headers', 'failed', {
      message: `Failed to check headers: ${error.message}`,
      error: error.message,
    });
  }
}

/**
 * Check 3: Response time
 */
async function checkResponseTime() {
  try {
    const start = Date.now();
    await makeRequest(config.baseUrl);
    const duration = Date.now() - start;
    
    if (duration < 1000) {
      return addCheck('Response Time', 'passed', {
        message: `Response time excellent: ${duration}ms`,
        duration,
      });
    } else if (duration < 3000) {
      return addCheck('Response Time', 'warning', {
        message: `Response time acceptable: ${duration}ms`,
        duration,
      });
    } else {
      return addCheck('Response Time', 'failed', {
        message: `Response time too slow: ${duration}ms`,
        duration,
      });
    }
  } catch (error) {
    return addCheck('Response Time', 'failed', {
      message: `Failed to measure response time: ${error.message}`,
      error: error.message,
    });
  }
}

/**
 * Check 4: Static assets
 */
async function checkStaticAssets() {
  try {
    // Try to access a common static asset pattern
    const response = await makeRequest(`${config.baseUrl}/`);
    
    // Check for asset references in HTML
    const hasJsAssets = response.body.includes('.js') || response.body.includes('script');
    const hasCssAssets = response.body.includes('.css') || response.body.includes('style');
    
    if (hasJsAssets && hasCssAssets) {
      return addCheck('Static Assets', 'passed', {
        message: 'Static asset references found',
        jsAssets: hasJsAssets,
        cssAssets: hasCssAssets,
      });
    } else {
      return addCheck('Static Assets', 'warning', {
        message: 'Some static asset references may be missing',
        jsAssets: hasJsAssets,
        cssAssets: hasCssAssets,
      });
    }
  } catch (error) {
    return addCheck('Static Assets', 'failed', {
      message: `Failed to check static assets: ${error.message}`,
      error: error.message,
    });
  }
}

/**
 * Check 5: CORS configuration
 */
async function checkCorsConfiguration() {
  try {
    const response = await makeRequest(config.baseUrl, {
      headers: {
        'Origin': 'https://example.com',
      },
    });
    
    const corsHeader = response.headers['access-control-allow-origin'];
    
    if (!corsHeader) {
      // No CORS header is acceptable for same-origin apps
      return addCheck('CORS Configuration', 'passed', {
        message: 'No CORS header (acceptable for same-origin app)',
      });
    } else if (corsHeader === '*') {
      return addCheck('CORS Configuration', 'warning', {
        message: 'CORS allows all origins (*)',
        value: corsHeader,
      });
    } else {
      return addCheck('CORS Configuration', 'passed', {
        message: 'CORS properly configured',
        value: corsHeader,
      });
    }
  } catch (error) {
    return addCheck('CORS Configuration', 'warning', {
      message: `Could not verify CORS: ${error.message}`,
      error: error.message,
    });
  }
}

/**
 * Main health check runner
 */
async function runHealthChecks() {
  console.log('🔍 Running Production Health Checks...\n');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Timeout: ${config.timeout}ms\n`);
  
  // Run all checks
  await checkHomepage();
  await checkSecurityHeaders();
  await checkResponseTime();
  await checkStaticAssets();
  await checkCorsConfiguration();
  
  // Output results
  if (config.jsonOutput) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log('\n📊 Health Check Results:\n');
    console.log('─'.repeat(60));
    
    for (const check of results.checks) {
      const icon = check.status === 'passed' ? '✅' : 
                   check.status === 'failed' ? '❌' : '⚠️';
      console.log(`${icon} ${check.name}: ${check.message}`);
    }
    
    console.log('─'.repeat(60));
    console.log(`\n📈 Summary:`);
    console.log(`   Total: ${results.summary.total}`);
    console.log(`   ✅ Passed: ${results.summary.passed}`);
    console.log(`   ⚠️ Warnings: ${results.summary.warnings}`);
    console.log(`   ❌ Failed: ${results.summary.failed}`);
    
    if (results.summary.failed === 0) {
      console.log('\n🎉 All health checks passed!');
    } else {
      console.log('\n⚠️ Some health checks failed. Please review.');
    }
  }
  
  // Exit with error code in CI mode if there are failures
  if (config.ciMode && results.summary.failed > 0) {
    process.exit(1);
  }
}

// Run health checks
runHealthChecks().catch((error) => {
  console.error('Health check runner error:', error);
  process.exit(1);
});
