// Lighthouse audit script using Playwright's Chromium via CDP
import lighthouse from 'lighthouse';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { preview } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface LighthouseResult {
  route: string;
  score: number;
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    timeToInteractive: number;
    totalBlockingTime: number;
    cumulativeLayoutShift: number;
    speedIndex: number;
  };
  opportunities: Array<{
    title: string;
    description: string;
    score: number;
    savings?: string;
  }>;
  diagnostics: Array<{
    title: string;
    description: string;
  }>;
}

async function runLighthouseAudit() {
  console.log('🧛‍♂️ BroCula initiating Lighthouse performance audit...\n');
  
  const results: LighthouseResult[] = [];
  
  // Routes to test
  const routes = [
    { path: '/', name: 'Home/Dashboard' },
    { path: '/generator', name: 'Generator' },
    { path: '/about', name: 'About' }
  ];

  let browser: any = null;
  let previewServer: any = null;
  
  try {
    // Start Vite preview server
    console.log('📦 Starting production build preview server...');
    previewServer = await preview({
      preview: {
        port: 4173,
        host: 'localhost'
      },
      build: {
        outDir: 'dist'
      }
    });
    
    const serverUrl = `http://localhost:4173`;
    console.log(`✅ Preview server running at ${serverUrl}\n`);

    // Launch Chromium via Playwright
    console.log('🌐 Launching Chromium via Playwright...');
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9222']
    });
    
    console.log(`✅ Chromium launched on port 9222\n`);

    for (const route of routes) {
      console.log(`🔍 Auditing route: ${route.name} (${route.path})`);
      
      const url = `${serverUrl}${route.path}`;
      
      // Run Lighthouse
      const runnerResult = await lighthouse(url, {
        port: 9222,
        output: 'json',
        logLevel: 'silent',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      });
      
      if (!runnerResult) {
        console.log(`  ❌ Failed to audit ${route.name}`);
        continue;
      }
      
      const lhr = runnerResult.lhr;
      
      // Extract metrics
      const metrics = {
        firstContentfulPaint: lhr.audits['first-contentful-paint']?.numericValue || 0,
        largestContentfulPaint: lhr.audits['largest-contentful-paint']?.numericValue || 0,
        timeToInteractive: lhr.audits['interactive']?.numericValue || 0,
        totalBlockingTime: lhr.audits['total-blocking-time']?.numericValue || 0,
        cumulativeLayoutShift: lhr.audits['cumulative-layout-shift']?.numericValue || 0,
        speedIndex: lhr.audits['speed-index']?.numericValue || 0,
      };
      
      // Extract opportunities
      const opportunities: Array<any> = [];
      const opportunityAudits = [
        'unused-javascript',
        'unused-css-rules',
        'modern-image-formats',
        'efficiently-encode-images',
        'render-blocking-resources',
        'unminified-javascript',
        'unminified-css',
        'uses-long-cache-ttl',
        'server-response-time',
        'uses-text-compression',
        'uses-optimized-images',
      ];
      
      for (const auditId of opportunityAudits) {
        const audit = lhr.audits[auditId];
        if (audit && audit.score !== null && audit.score < 1) {
          opportunities.push({
            title: audit.title,
            description: audit.description,
            score: audit.score,
            savings: audit.displayValue,
          });
        }
      }
      
      // Sort by score (lowest first = most impactful)
      opportunities.sort((a, b) => a.score - b.score);
      
      // Extract diagnostics
      const diagnostics: Array<any> = [];
      const diagnosticAudits = [
        'mainthread-work-breakdown',
        'bootup-time',
        'uses-rel-preload',
        'uses-rel-preconnect',
        'font-display',
        'network-rtt',
        'network-server-latency',
        'third-party-summary',
      ];
      
      for (const auditId of diagnosticAudits) {
        const audit = lhr.audits[auditId];
        if (audit && audit.score !== null && audit.score < 1) {
          diagnostics.push({
            title: audit.title,
            description: audit.description,
          });
        }
      }
      
      results.push({
        route: route.name,
        score: (lhr.categories.performance?.score || 0) * 100,
        metrics,
        opportunities: opportunities.slice(0, 5), // Top 5 opportunities
        diagnostics: diagnostics.slice(0, 3), // Top 3 diagnostics
      });
      
      // Display results
      console.log(`  📊 Performance Score: ${Math.round((lhr.categories.performance?.score || 0) * 100)}/100`);
      console.log(`  ♿ Accessibility: ${Math.round((lhr.categories.accessibility?.score || 0) * 100)}/100`);
      console.log(`  ✅ Best Practices: ${Math.round((lhr.categories['best-practices']?.score || 0) * 100)}/100`);
      console.log(`  🔍 SEO: ${Math.round((lhr.categories.seo?.score || 0) * 100)}/100`);
      
      if (opportunities.length > 0) {
        console.log(`  ⚡ Top Opportunities:`);
        opportunities.slice(0, 3).forEach((opp, i) => {
          console.log(`     ${i + 1}. ${opp.title} ${opp.savings ? `(${opp.savings})` : ''}`);
        });
      } else {
        console.log(`  ✅ No significant optimization opportunities`);
      }
      console.log('');
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('🧛‍♂️ BROCULA LIGHTHOUSE AUDIT SUMMARY');
    console.log('='.repeat(60));
    
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    
    console.log(`\n📊 Overall Performance Score: ${Math.round(avgScore)}/100`);
    
    // Collect all unique opportunities
    const allOpportunities = new Map<string, { count: number; savings?: string }>();
    results.forEach(r => {
      r.opportunities.forEach(opp => {
        const existing = allOpportunities.get(opp.title);
        if (existing) {
          existing.count++;
        } else {
          allOpportunities.set(opp.title, { count: 1, savings: opp.savings });
        }
      });
    });
    
    if (allOpportunities.size > 0) {
      console.log('\n⚡ Optimization Opportunities (across all routes):');
      Array.from(allOpportunities.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([title, data], i) => {
          console.log(`   ${i + 1}. ${title} ${data.savings ? `(${data.savings})` : ''} - Found in ${data.count} route(s)`);
        });
    } else {
      console.log('\n✅ No significant optimization opportunities detected!');
    }
    
    console.log('\n🎯 Metrics Summary:');
    results.forEach(r => {
      console.log(`   ${r.route}:`);
      console.log(`     FCP: ${(r.metrics.firstContentfulPaint / 1000).toFixed(2)}s`);
      console.log(`     LCP: ${(r.metrics.largestContentfulPaint / 1000).toFixed(2)}s`);
      console.log(`     TTI: ${(r.metrics.timeToInteractive / 1000).toFixed(2)}s`);
      console.log(`     TBT: ${r.metrics.totalBlockingTime.toFixed(0)}ms`);
      console.log(`     CLS: ${r.metrics.cumulativeLayoutShift.toFixed(3)}`);
    });
    
    // Save detailed report
    const reportPath = join(__dirname, '..', 'lighthouse-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📝 Detailed report saved to: ${reportPath}`);
    
    if (avgScore >= 90) {
      console.log('\n✅ EXCELLENT - Performance score is 90+!');
    } else if (avgScore >= 70) {
      console.log('\n⚠️  GOOD - Performance score is 70-89. Some optimizations possible.');
    } else {
      console.log('\n❌ NEEDS IMPROVEMENT - Performance score is below 70.');
    }
    
    // Clean up
    await browser.close();
    await previewServer.close();
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Lighthouse audit failed:', error);
    if (browser) await browser.close();
    if (previewServer) await previewServer.close();
    process.exit(1);
  }
}

runLighthouseAudit();
