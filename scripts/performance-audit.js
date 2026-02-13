import { chromium } from 'playwright';
import fs from 'fs';

async function runPerformanceAudit() {
  console.log('🔍 BroCula: Running browser performance audit...\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Collect console messages
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    
    // Navigate and measure
    console.log('📱 Loading page...');
    const startTime = Date.now();
    const response = await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    const loadTime = Date.now() - startTime;
    
    // Wait for React to hydrate
    await page.waitForTimeout(2000);
    
    // Get performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const perf = performance;
      const timing = perf.timing;
      const nav = perf.getEntriesByType('navigation')[0];
      
      return {
        // Navigation Timing
        dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
        tcpConnection: timing.connectEnd - timing.connectStart,
        serverResponse: timing.responseEnd - timing.requestStart,
        domProcessing: timing.domComplete - timing.domLoading,
        totalLoadTime: timing.loadEventEnd - timing.navigationStart,
        
        // Resource counts
        resourceCount: perf.getEntriesByType('resource').length,
        
        // Memory (if available)
        memory: perf.memory ? {
          usedJSHeapSize: perf.memory.usedJSHeapSize,
          totalJSHeapSize: perf.memory.totalJSHeapSize
        } : null
      };
    });
    
    // Get LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry ? lastEntry.startTime : null);
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Timeout after 5 seconds
        setTimeout(() => resolve(null), 5000);
      });
    });
    
    // Get CLS (Cumulative Layout Shift)
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        });
        observer.observe({ entryTypes: ['layout-shift'] });
        
        setTimeout(() => resolve(clsValue), 5000);
      });
    });
    
    // Get resource loading details
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(r => ({
        name: r.name.split('/').pop() || r.name,
        type: r.initiatorType,
        duration: Math.round(r.duration * 100) / 100,
        size: r.transferSize || 0
      }));
    });
    
    // Check for images without dimensions (causes CLS)
    const imagesWithoutDimensions = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .filter(img => !img.width || !img.height)
        .map(img => ({
          src: img.src.split('/').pop() || img.src,
          hasWidth: !!img.width,
          hasHeight: !!img.height
        }));
    });
    
    // Check for missing alt text
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      return images
        .filter(img => !img.alt)
        .map(img => ({
          src: img.src.split('/').pop() || img.src
        }));
    });
    
    // Results
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE AUDIT RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n⏱️  TIMING METRICS:');
    console.log(`   Total Load Time: ${loadTime}ms`);
    console.log(`   DNS Lookup: ${performanceMetrics.dnsLookup}ms`);
    console.log(`   TCP Connection: ${performanceMetrics.tcpConnection}ms`);
    console.log(`   Server Response: ${performanceMetrics.serverResponse}ms`);
    console.log(`   DOM Processing: ${performanceMetrics.domProcessing}ms`);
    console.log(`   Resource Count: ${performanceMetrics.resourceCount}`);
    
    console.log('\n🎯 CORE WEB VITALS:');
    console.log(`   LCP (Largest Contentful Paint): ${lcp ? Math.round(lcp) + 'ms' : 'N/A'}`);
    console.log(`   CLS (Cumulative Layout Shift): ${cls}`);
    
    // Score interpretation
    let lcpScore, clsScore;
    if (lcp) {
      lcpScore = lcp < 2500 ? '✅ Good' : lcp < 4000 ? '⚠️ Needs Improvement' : '❌ Poor';
    } else {
      lcpScore = 'N/A';
    }
    clsScore = cls < 0.1 ? '✅ Good' : cls < 0.25 ? '⚠️ Needs Improvement' : '❌ Poor';
    
    console.log(`   LCP Score: ${lcpScore}`);
    console.log(`   CLS Score: ${clsScore}`);
    
    // Find slowest resources
    console.log('\n🐌 SLOWEST RESOURCES:');
    resources
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .forEach(r => {
        console.log(`   ${r.name}: ${r.duration}ms (${r.type})`);
      });
    
    // Largest resources
    console.log('\n📦 LARGEST RESOURCES:');
    resources
      .sort((a, b) => b.size - a.size)
      .slice(0, 10)
      .forEach(r => {
        const sizeKB = (r.size / 1024).toFixed(2);
        console.log(`   ${r.name}: ${sizeKB}KB (${r.type})`);
      });
    
    // Issues
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  ISSUES FOUND');
    console.log('='.repeat(60));
    
    const issues = [];
    
    if (imagesWithoutDimensions.length > 0) {
      issues.push({
        severity: 'high',
        title: 'Images without width/height attributes',
        description: `${imagesWithoutDimensions.length} images missing explicit dimensions. This causes Cumulative Layout Shift (CLS).`,
        fix: 'Add width and height attributes to all images'
      });
    }
    
    if (imagesWithoutAlt.length > 0) {
      issues.push({
        severity: 'medium',
        title: 'Images without alt text',
        description: `${imagesWithoutAlt.length} images missing alt text. This affects accessibility.`,
        fix: 'Add descriptive alt attributes to all images'
      });
    }
    
    if (performanceMetrics.resourceCount > 50) {
      issues.push({
        severity: 'medium',
        title: 'High number of resources',
        description: `${performanceMetrics.resourceCount} resources loaded. Consider code splitting or lazy loading.`,
        fix: 'Implement code splitting and lazy load non-critical resources'
      });
    }
    
    if (loadTime > 3000) {
      issues.push({
        severity: 'high',
        title: 'Slow initial load',
        description: `Page took ${loadTime}ms to load. Target is under 3000ms.`,
        fix: 'Optimize critical rendering path, reduce JS bundle size'
      });
    }
    
    // Console errors
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      issues.push({
        severity: 'high',
        title: 'Console errors detected',
        description: `${errors.length} JavaScript errors found in console.`,
        fix: 'Fix all console errors before production'
      });
    }
    
    if (issues.length === 0) {
      console.log('✅ No major issues found!');
    } else {
      issues.forEach((issue, i) => {
        const emoji = issue.severity === 'high' ? '❌' : issue.severity === 'medium' ? '⚠️' : 'ℹ️';
        console.log(`\n${emoji} ${issue.title}`);
        console.log(`   ${issue.description}`);
        console.log(`   💡 Fix: ${issue.fix}`);
      });
    }
    
    // Console summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 CONSOLE SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${consoleMessages.filter(m => m.type === 'warning').length}`);
    console.log(`   Logs: ${consoleMessages.filter(m => m.type === 'log').length}`);
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      performance: {
        loadTime,
        ...performanceMetrics,
        lcp,
        cls
      },
      resources: {
        count: performanceMetrics.resourceCount,
        slowest: resources.sort((a, b) => b.duration - a.duration).slice(0, 10),
        largest: resources.sort((a, b) => b.size - a.size).slice(0, 10)
      },
      issues,
      console: {
        errors: errors.length,
        warnings: consoleMessages.filter(m => m.type === 'warning').length
      }
    };
    
    fs.writeFileSync('performance-audit.json', JSON.stringify(report, null, 2));
    console.log('\n✅ Performance audit complete! Report saved to performance-audit.json');
    
    await browser.close();
    
    // Return issues for fixing
    return issues;
    
  } catch (error) {
    console.error('❌ Performance audit failed:', error.message);
    await browser.close();
    process.exit(1);
  }
}

const issues = await runPerformanceAudit();

// Exit with error code if there are high severity issues
const highSeverityIssues = issues.filter(i => i.severity === 'high');
process.exit(highSeverityIssues.length > 0 ? 1 : 0);
