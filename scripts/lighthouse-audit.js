import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Simple static file server
const createServer = () => {
  return http.createServer((req, res) => {
    let filePath = path.join(process.cwd(), 'dist', req.url === '/' ? 'index.html' : req.url);
    
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        if (err.code === 'ENOENT') {
          fs.readFile(path.join(process.cwd(), 'dist', 'index.html'), (err, content) => {
            if (err) {
              res.writeHead(404);
              res.end('404 Not Found');
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(content);
            }
          });
        } else {
          res.writeHead(500);
          res.end('500 Server Error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
};

const routes = [
  { name: 'Home/Dashboard', path: '/' },
  { name: 'Generator', path: '/generator' }
];

async function runLighthouseAudit() {
  console.log('🧛 BroCula Lighthouse Audit Starting...\n');
  
  // Start server
  const server = createServer();
  await new Promise(resolve => server.listen(3457, '127.0.0.1', resolve));
  console.log('✅ Server started on http://127.0.0.1:3457\n');
  
  const results = [];
  
  try {
    for (const route of routes) {
      console.log(`\n📍 Auditing: ${route.name} (${route.path})`);
      
      const chromePath = chromium.executablePath();
      const chrome = await chromeLauncher.launch({
        chromePath,
        chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
      });
      
      const options = {
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        port: chrome.port,
      };
      
      const runnerResult = await lighthouse(`http://127.0.0.1:3457${route.path}`, options);
      
      const report = runnerResult.report;
      const lhr = JSON.parse(report);
      
      results.push({
        route: route.name,
        path: route.path,
        scores: {
          performance: Math.round(lhr.categories.performance.score * 100),
          accessibility: Math.round(lhr.categories.accessibility.score * 100),
          bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
          seo: Math.round(lhr.categories.seo.score * 100)
        },
        metrics: {
          firstContentfulPaint: lhr.audits['first-contentful-paint']?.displayValue || 'N/A',
          largestContentfulPaint: lhr.audits['largest-contentful-paint']?.displayValue || 'N/A',
          timeToInteractive: lhr.audits['interactive']?.displayValue || 'N/A',
          speedIndex: lhr.audits['speed-index']?.displayValue || 'N/A',
          totalBlockingTime: lhr.audits['total-blocking-time']?.displayValue || 'N/A',
          cumulativeLayoutShift: lhr.audits['cumulative-layout-shift']?.displayValue || 'N/A'
        },
        opportunities: Object.values(lhr.audits || {})
          .filter(audit => 
            audit.details && 
            audit.details.type === 'opportunity' && 
            audit.numericValue && 
            audit.numericValue > 0
          )
          .map(audit => ({
            title: audit.title,
            description: audit.description,
            savings: audit.displayValue || `${Math.round(audit.numericValue / 1024)} KiB`,
            score: audit.score
          }))
          .sort((a, b) => (b.score || 0) - (a.score || 0))
      });
      
      await chrome.kill();
    }
    
  } finally {
    server.close();
  }
  
  // Display results
  console.log('\n' + '='.repeat(70));
  console.log('📊 LIGHTHOUSE AUDIT SUMMARY');
  console.log('='.repeat(70));
  
  results.forEach(result => {
    console.log(`\n📍 ${result.route}`);
    console.log('-'.repeat(50));
    console.log(`Performance:     ${result.scores.performance}/100 ${getScoreEmoji(result.scores.performance)}`);
    console.log(`Accessibility:   ${result.scores.accessibility}/100 ${getScoreEmoji(result.scores.accessibility)}`);
    console.log(`Best Practices:  ${result.scores.bestPractices}/100 ${getScoreEmoji(result.scores.bestPractices)}`);
    console.log(`SEO:             ${result.scores.seo}/100 ${getScoreEmoji(result.scores.seo)}`);
    
    console.log('\n📈 Key Metrics:');
    console.log(`  First Contentful Paint:    ${result.metrics.firstContentfulPaint}`);
    console.log(`  Largest Contentful Paint:  ${result.metrics.largestContentfulPaint}`);
    console.log(`  Time to Interactive:       ${result.metrics.timeToInteractive}`);
    console.log(`  Speed Index:               ${result.metrics.speedIndex}`);
    console.log(`  Total Blocking Time:       ${result.metrics.totalBlockingTime}`);
    console.log(`  Cumulative Layout Shift:   ${result.metrics.cumulativeLayoutShift}`);
    
    if (result.opportunities && result.opportunities.length > 0) {
      console.log('\n⚡ Top Optimization Opportunities:');
      result.opportunities.slice(0, 5).forEach((opp, i) => {
        console.log(`  ${i + 1}. ${opp.title}`);
        console.log(`     Potential savings: ${opp.savings}`);
      });
    }
  });
  
  // Calculate average scores
  const avgScores = {
    performance: Math.round(results.reduce((a, b) => a + b.scores.performance, 0) / results.length),
    accessibility: Math.round(results.reduce((a, b) => a + b.scores.accessibility, 0) / results.length),
    bestPractices: Math.round(results.reduce((a, b) => a + b.scores.bestPractices, 0) / results.length),
    seo: Math.round(results.reduce((a, b) => a + b.scores.seo, 0) / results.length)
  };
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 AVERAGE SCORES ACROSS ALL ROUTES');
  console.log('='.repeat(70));
  console.log(`Performance:     ${avgScores.performance}/100 ${getScoreEmoji(avgScores.performance)}`);
  console.log(`Accessibility:   ${avgScores.accessibility}/100 ${getScoreEmoji(avgScores.accessibility)}`);
  console.log(`Best Practices:  ${avgScores.bestPractices}/100 ${getScoreEmoji(avgScores.bestPractices)}`);
  console.log(`SEO:             ${avgScores.seo}/100 ${getScoreEmoji(avgScores.seo)}`);
  
  // Save report
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: avgScores,
    routes: results
  };
  
  fs.writeFileSync('lighthouse-audit-report.json', JSON.stringify(reportData, null, 2));
  console.log('\n📝 Report saved to lighthouse-audit-report.json');
  
  // Exit with error if performance is below threshold
  if (avgScores.performance < 50) {
    console.log('\n❌ Performance score below 50 - optimization required!');
    process.exit(1);
  }
  
  console.log('\n✅ Lighthouse audit complete!');
  process.exit(0);
}

function getScoreEmoji(score) {
  if (score >= 90) return '🟢';
  if (score >= 70) return '🟡';
  if (score >= 50) return '🟠';
  return '🔴';
}

runLighthouseAudit().catch(err => {
  console.error('❌ Lighthouse audit failed:', err);
  process.exit(1);
});
