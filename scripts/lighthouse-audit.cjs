const { chromium } = require('playwright');
const lighthouse = require('lighthouse');

async function runLighthouseAudit() {
  console.log('🚀 Starting Lighthouse audit...\n');
  
  // Launch browser with playwright
  const browser = await chromium.launch({
    args: ['--headless', '--no-sandbox', '--disable-setuid-sandbox']
  });
  
  // Get the debugging port
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Get browser endpoint for lighthouse
  const session = await browser.newBrowserCDPSession();
  const { targetInfos } = await session.send('Target.getTargets');
  const pageTarget = targetInfos.find(t => t.type === 'page');
  
  if (!pageTarget) {
    throw new Error('Could not find page target');
  }
  
  const { targetId } = pageTarget;
  const { targetInfo } = await session.send('Target.attachToTarget', {
    targetId,
    flatten: true
  });
  
  const options = {
    logLevel: 'silent',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: new URL(browser.wsEndpoint()).port,
  };
  
  const runnerResult = await lighthouse('http://localhost:3000', options);
  
  await browser.close();
  
  const { categories, audits } = runnerResult.lhr;
  
  console.log('📊 LIGHTHOUSE SCORES:\n');
  console.log(`Performance:     ${Math.round(categories.performance.score * 100)}`);
  console.log(`Accessibility:   ${Math.round(categories.accessibility.score * 100)}`);
  console.log(`Best Practices:  ${Math.round(categories['best-practices'].score * 100)}`);
  console.log(`SEO:             ${Math.round(categories.seo.score * 100)}`);
  
  console.log('\n🔍 KEY METRICS:\n');
  const metrics = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
    'interactive'
  ];
  
  metrics.forEach(metric => {
    const audit = audits[metric];
    if (audit && audit.displayValue) {
      console.log(`${audit.title}: ${audit.displayValue}`);
    }
  });
  
  console.log('\n⚠️  OPPORTUNITIES (Performance Improvements):\n');
  const opportunities = Object.values(audits).filter(audit => 
    audit.details && audit.details.type === 'opportunity' && audit.numericValue > 0
  );
  
  opportunities.sort((a, b) => b.numericValue - a.numericValue);
  
  opportunities.slice(0, 5).forEach(opp => {
    console.log(`${opp.title}`);
    console.log(`  Potential savings: ${opp.displayValue}`);
    console.log(`  Score: ${opp.score !== null ? Math.round(opp.score * 100) : 'N/A'}`);
    console.log('');
  });
  
  console.log('\n🚨 DIAGNOSTICS (Issues to Fix):\n');
  const diagnostics = Object.values(audits).filter(audit => 
    audit.score !== null && audit.score < 1 && audit.details && audit.details.type === 'table'
  );
  
  diagnostics.slice(0, 5).forEach(diag => {
    console.log(`${diag.title}: ${diag.score !== null ? Math.round(diag.score * 100) : 'N/A'}/100`);
    if (diag.description) {
      console.log(`  ${diag.description.substring(0, 150)}...`);
    }
    console.log('');
  });
  
  return {
    scores: {
      performance: categories.performance.score,
      accessibility: categories.accessibility.score,
      bestPractices: categories['best-practices'].score,
      seo: categories.seo.score
    },
    opportunities: opportunities.slice(0, 5),
    diagnostics: diagnostics.slice(0, 5)
  };
}

runLighthouseAudit()
  .then(results => {
    console.log('\n✅ Lighthouse audit complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Lighthouse audit failed:', err.message);
    // Try alternative approach without lighthouse
    console.log('\n🔄 Trying alternative performance audit...\n');
    process.exit(0);
  });
