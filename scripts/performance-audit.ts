import { chromium } from 'playwright';
import { preview } from 'vite';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PerformanceMetrics {
  route: string;
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  resourceCount: number;
  resourceSize: number;
  jsSize: number;
  cssSize: number;
  imageSize: number;
  errors: string[];
  warnings: string[];
}

interface BundleAnalysis {
  chunkName: string;
  size: number;
  type: string;
}

async function runPerformanceAudit() {
  console.log('🧛‍♂️ BroCula initiating performance audit...\n');
  
  const metrics: PerformanceMetrics[] = [];
  let previewServer: any = null;
  let browser: any = null;
  
  try {
    // Analyze bundle sizes first
    console.log('📦 Analyzing bundle sizes...');
    const distPath = join(__dirname, '..', 'dist', 'assets', 'js');
    const bundles: BundleAnalysis[] = [];
    
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath);
      files.forEach(file => {
        if (file.endsWith('.js')) {
          const stats = fs.statSync(join(distPath, file));
          bundles.push({
            chunkName: file,
            size: stats.size,
            type: file.includes('vendor') ? 'vendor' : 
                  file.includes('route') ? 'route' : 
                  file.includes('component') ? 'component' : 'other'
          });
        }
      });
      
      bundles.sort((a, b) => b.size - a.size);
      
      console.log(`   Found ${bundles.length} JavaScript chunks`);
      console.log(`   Top 5 largest bundles:`);
      bundles.slice(0, 5).forEach((b, i) => {
        const sizeKB = (b.size / 1024).toFixed(2);
        console.log(`   ${i + 1}. ${b.chunkName} - ${sizeKB} KB`);
      });
      
      // Check for bundles > 300KB
      const largeBundles = bundles.filter(b => b.size > 300 * 1024);
      if (largeBundles.length > 0) {
        console.log(`\n   ⚠️  Warning: ${largeBundles.length} bundle(s) exceed 300KB threshold`);
      } else {
        console.log(`\n   ✅ All bundles under 300KB threshold`);
      }
    }
    
    console.log('\n🌐 Starting audit server...');
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
    console.log(`✅ Server running at ${serverUrl}\n`);

    browser = await chromium.launch({ headless: true });
    
    const routes = [
      { path: '/', name: 'Home/Dashboard' },
      { path: '/generator', name: 'Generator' },
      { path: '/about', name: 'About' }
    ];

    for (const route of routes) {
      console.log(`🔍 Auditing: ${route.name}`);
      
      const context = await browser.newContext();
      const page = await context.newPage();
      
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Capture console messages
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        } else if (msg.type() === 'warning') {
          warnings.push(msg.text());
        }
      });
      
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });
      
      // Collect performance data
      const startTime = Date.now();
      const url = `${serverUrl}${route.path}`;
      
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      const loadTime = Date.now() - startTime;
      
      // Get performance metrics
      const perfMetrics = await page.evaluate(() => {
        const perf = performance;
        const nav = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = perf.getEntriesByType('paint');
        
        return {
          domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        };
      });
      
      // Get resource metrics
      const resources = await page.evaluate(() => {
        return performance.getEntriesByType('resource').map(r => ({
          name: r.name,
          size: (r as PerformanceResourceTiming).encodedBodySize || 0,
          type: (r as PerformanceResourceTiming).initiatorType
        }));
      });
      
      const resourceCount = resources.length;
      const resourceSize = resources.reduce((sum, r) => sum + (r.size || 0), 0);
      const jsSize = resources
        .filter(r => r.name.endsWith('.js'))
        .reduce((sum, r) => sum + (r.size || 0), 0);
      const cssSize = resources
        .filter(r => r.name.endsWith('.css'))
        .reduce((sum, r) => sum + (r.size || 0), 0);
      const imageSize = resources
        .filter(r => r.type === 'img' || /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(r.name))
        .reduce((sum, r) => sum + (r.size || 0), 0);
      
      metrics.push({
        route: route.name,
        loadTime,
        domContentLoaded: perfMetrics.domContentLoaded,
        firstPaint: perfMetrics.firstPaint,
        resourceCount,
        resourceSize,
        jsSize,
        cssSize,
        imageSize,
        errors,
        warnings
      });
      
      console.log(`   ⏱️  Load Time: ${loadTime}ms`);
      console.log(`   📄 Resources: ${resourceCount} (${(resourceSize / 1024).toFixed(2)} KB total)`);
      console.log(`   📜 JS: ${(jsSize / 1024).toFixed(2)} KB`);
      console.log(`   🎨 CSS: ${(cssSize / 1024).toFixed(2)} KB`);
      console.log(`   🖼️  Images: ${(imageSize / 1024).toFixed(2)} KB`);
      console.log(`   ⚡ FCP: ${(perfMetrics.firstPaint / 1000).toFixed(2)}s`);
      console.log(`   📥 DCL: ${(perfMetrics.domContentLoaded / 1000).toFixed(2)}s`);
      
      if (errors.length > 0) {
        console.log(`   ❌ Errors: ${errors.length}`);
      }
      if (warnings.length > 0) {
        console.log(`   ⚠️  Warnings: ${warnings.length}`);
      }
      console.log('');
      
      await context.close();
    }

    // Summary
    console.log('='.repeat(60));
    console.log('🧛‍♂️ BROCULA PERFORMANCE AUDIT SUMMARY');
    console.log('='.repeat(60));
    
    const avgLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0) / metrics.length;
    const totalErrors = metrics.reduce((sum, m) => sum + m.errors.length, 0);
    const totalWarnings = metrics.reduce((sum, m) => sum + m.warnings.length, 0);
    
    console.log(`\n📊 Performance Summary:`);
    console.log(`   Average Load Time: ${avgLoadTime.toFixed(0)}ms`);
    console.log(`   Total Resources: ${metrics[0]?.resourceCount || 0}`);
    console.log(`   Total JS Size: ${((metrics[0]?.jsSize || 0) / 1024).toFixed(2)} KB`);
    console.log(`   Total Errors: ${totalErrors}`);
    console.log(`   Total Warnings: ${totalWarnings}`);
    
    // Check thresholds
    console.log('\n🎯 Quality Gates:');
    if (avgLoadTime < 3000) {
      console.log(`   ✅ Load time < 3000ms (${avgLoadTime.toFixed(0)}ms)`);
    } else {
      console.log(`   ❌ Load time > 3000ms (${avgLoadTime.toFixed(0)}ms)`);
    }
    
    if (totalErrors === 0) {
      console.log(`   ✅ No console errors`);
    } else {
      console.log(`   ❌ ${totalErrors} console error(s) detected`);
    }
    
    const largestBundle = bundles[0];
    if (largestBundle && largestBundle.size < 300 * 1024) {
      console.log(`   ✅ Largest bundle < 300KB (${(largestBundle.size / 1024).toFixed(2)} KB)`);
    } else if (largestBundle) {
      console.log(`   ⚠️  Largest bundle > 300KB (${(largestBundle.size / 1024).toFixed(2)} KB)`);
    }
    
    // Check for optimization opportunities
    console.log('\n⚡ Optimization Opportunities:');
    const opportunities: string[] = [];
    
    if (bundles.some(b => b.size > 300 * 1024)) {
      opportunities.push('Large JavaScript bundles detected - consider further code splitting');
    }
    
    if (metrics.some(m => m.jsSize > 1000 * 1024)) {
      opportunities.push('Total JS size > 1MB - consider lazy loading strategies');
    }
    
    if (metrics.some(m => m.resourceCount > 50)) {
      opportunities.push('High resource count (>50) - consider resource consolidation');
    }
    
    if (avgLoadTime > 2000) {
      opportunities.push('Load time > 2000ms - consider preloading critical resources');
    }
    
    if (opportunities.length === 0) {
      console.log('   ✅ No major optimization opportunities detected');
    } else {
      opportunities.forEach((opp, i) => {
        console.log(`   ${i + 1}. ${opp}`);
      });
    }
    
    // Save report
    const reportPath = join(__dirname, '..', 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      bundles,
      metrics
    }, null, 2));
    console.log(`\n📝 Report saved to: ${reportPath}`);
    
    // Final verdict
    console.log('\n' + '='.repeat(60));
    if (totalErrors === 0 && totalWarnings === 0 && avgLoadTime < 3000) {
      console.log('✅ PASSED - All quality gates met!');
    } else if (totalErrors === 0) {
      console.log('⚠️  PARTIAL - No errors, but some optimizations possible');
    } else {
      console.log('❌ FAILED - Errors detected that require attention');
    }
    console.log('='.repeat(60));
    
    await browser.close();
    await previewServer.close();
    
    process.exit(totalErrors > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    if (browser) await browser.close();
    if (previewServer) await previewServer.close();
    process.exit(1);
  }
}

runPerformanceAudit();
