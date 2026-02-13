const { chromium } = require('playwright');

async function runPerformanceAudit() {
  console.log('🚀 Starting Performance audit with Playwright...\n');
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Capture console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });
  
  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  // Navigate and measure
  const startTime = Date.now();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const loadTime = Date.now() - startTime;
  
  // Get performance metrics
  const performanceMetrics = await page.evaluate(() => {
    const timing = performance.timing;
    
    return {
      // Navigation Timing
      dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
      tcpConnection: timing.connectEnd - timing.connectStart,
      serverResponse: timing.responseEnd - timing.requestStart,
      domProcessing: timing.domComplete - timing.domLoading,
      totalLoadTime: timing.loadEventEnd - timing.navigationStart,
      
      // Resource count
      resourceCount: performance.getEntriesByType('resource').length,
      
      // DOM
      domNodes: document.querySelectorAll('*').length,
      scriptTags: document.querySelectorAll('script').length,
      styleTags: document.querySelectorAll('style, link[rel="stylesheet"]').length
    };
  });
  
  // Check for accessibility issues
  const accessibilityIssues = await page.evaluate(() => {
    const issues = [];
    
    // Check for images without alt
    document.querySelectorAll('img:not([alt])').forEach(img => {
      issues.push({ type: 'missing-alt', element: 'img' });
    });
    
    // Check for buttons without aria-label
    document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])').forEach(btn => {
      if (!btn.textContent || !btn.textContent.trim()) {
        issues.push({ type: 'missing-label', element: 'button' });
      }
    });
    
    // Check for form inputs without labels
    document.querySelectorAll('input:not([aria-label]):not([aria-labelledby]):not([id])').forEach(input => {
      issues.push({ type: 'missing-label', element: 'input', inputType: input.type });
    });
    
    return issues;
  });
  
  // Check for SEO issues
  const seoIssues = await page.evaluate(() => {
    const issues = [];
    
    // Check title
    if (!document.title || document.title.length < 10) {
      issues.push({ type: 'short-title', value: document.title });
    }
    
    // Check meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc || !metaDesc.content) {
      issues.push({ type: 'missing-meta-description' });
    }
    
    // Check viewport
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      issues.push({ type: 'missing-viewport' });
    }
    
    // Check canonical link
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      issues.push({ type: 'missing-canonical' });
    }
    
    // Check h1
    const h1s = document.querySelectorAll('h1');
    if (h1s.length === 0) {
      issues.push({ type: 'missing-h1' });
    } else if (h1s.length > 1) {
      issues.push({ type: 'multiple-h1', count: h1s.length });
    }
    
    return issues;
  });
  
  await browser.close();
  
  // Report results
  console.log('📊 PERFORMANCE AUDIT RESULTS\n');
  console.log('='.repeat(50));
  
  console.log('\n⏱️  LOAD TIMES:\n');
  console.log(`  Total Load Time: ${loadTime}ms`);
  console.log(`  DNS Lookup: ${performanceMetrics.dnsLookup}ms`);
  console.log(`  TCP Connection: ${performanceMetrics.tcpConnection}ms`);
  console.log(`  Server Response: ${performanceMetrics.serverResponse}ms`);
  console.log(`  DOM Processing: ${performanceMetrics.domProcessing}ms`);
  
  console.log('\n📦 RESOURCES:\n');
  console.log(`  Resource Count: ${performanceMetrics.resourceCount}`);
  console.log(`  DOM Nodes: ${performanceMetrics.domNodes}`);
  console.log(`  Scripts: ${performanceMetrics.scriptTags}`);
  console.log(`  Styles: ${performanceMetrics.styleTags}`);
  
  // Console issues
  const errors = consoleMessages.filter(m => m.type === 'error');
  const warnings = consoleMessages.filter(m => m.type === 'warning');
  
  console.log('\n🖥️  CONSOLE ISSUES:\n');
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Total Messages: ${consoleMessages.length}`);
  
  if (errors.length > 0) {
    console.log('\n  ❌ Console Errors:');
    errors.forEach((err, i) => {
      console.log(`    ${i + 1}. ${err.text.substring(0, 100)}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log('\n  ⚠️  Console Warnings:');
    warnings.forEach((warn, i) => {
      console.log(`    ${i + 1}. ${warn.text.substring(0, 100)}`);
    });
  }
  
  // Page errors
  if (pageErrors.length > 0) {
    console.log('\n  🚨 Page Errors:');
    pageErrors.forEach((err, i) => {
      console.log(`    ${i + 1}. ${err.message.substring(0, 100)}`);
    });
  }
  
  console.log('\n♿ ACCESSIBILITY ISSUES:\n');
  if (accessibilityIssues.length === 0) {
    console.log('  ✅ No accessibility issues found');
  } else {
    console.log(`  ⚠️  Found ${accessibilityIssues.length} issues:`);
    accessibilityIssues.slice(0, 10).forEach((issue, i) => {
      console.log(`    ${i + 1}. ${issue.type} (${issue.element})`);
    });
  }
  
  console.log('\n🔍 SEO ISSUES:\n');
  if (seoIssues.length === 0) {
    console.log('  ✅ No SEO issues found');
  } else {
    console.log(`  ⚠️  Found ${seoIssues.length} issues:`);
    seoIssues.forEach((issue, i) => {
      console.log(`    ${i + 1}. ${issue.type}`);
    });
  }
  
  // Performance recommendations
  console.log('\n💡 RECOMMENDATIONS:\n');
  
  if (loadTime > 3000) {
    console.log('  ⚠️  Page load time is slow (>3s). Consider:');
    console.log('     - Implementing code splitting');
    console.log('     - Optimizing images');
    console.log('     - Using lazy loading');
  }
  
  if (performanceMetrics.resourceCount > 50) {
    console.log('  ⚠️  High resource count. Consider:');
    console.log('     - Bundling resources');
    console.log('     - Removing unused dependencies');
  }
  
  if (performanceMetrics.domNodes > 1500) {
    console.log('  ⚠️  Large DOM size. Consider:');
    console.log('     - Virtual scrolling for lists');
    console.log('     - Lazy rendering components');
  }
  
  if (performanceMetrics.scriptTags > 10) {
    console.log('  ⚠️  Many script tags. Consider:');
    console.log('     - Bundling scripts');
    console.log('     - Using async/defer attributes');
  }
  
  console.log('\n' + '='.repeat(50));
  
  return {
    loadTime,
    performanceMetrics,
    errors,
    warnings,
    accessibilityIssues,
    seoIssues
  };
}

runPerformanceAudit()
  .then(results => {
    console.log('\n✅ Performance audit complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Performance audit failed:', err);
    process.exit(1);
  });
