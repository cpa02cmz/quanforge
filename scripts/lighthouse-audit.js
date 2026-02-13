import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';

async function runLighthouseAudit() {
  console.log('🔍 BroCula: Running Lighthouse audit...\n');
  
  try {
    // Launch Chrome via Playwright
    const browser = await chromium.launch({ headless: true });
    const wsEndpoint = browser.wsEndpoint();
    
    // Get Chrome path from Playwright
    const chromePath = chromium.executablePath();
    console.log(`Using Chrome: ${chromePath}`);
    
    // Launch Chrome for Lighthouse
    const chrome = await chromeLauncher.launch({
      chromePath,
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
    });
    
    // Run Lighthouse
    const options = {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port
    };
    
    const runnerResult = await lighthouse('http://localhost:3000', options);
    
    // Save report
    const reportJson = runnerResult.report;
    fs.writeFileSync('lighthouse-report.json', reportJson);
    
    // Parse results
    const report = JSON.parse(reportJson);
    const categories = report.categories;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 LIGHTHOUSE SCORES');
    console.log('='.repeat(60));
    
    Object.entries(categories).forEach(([key, category]) => {
      const score = Math.round(category.score * 100);
      const emoji = score >= 90 ? '✅' : score >= 70 ? '⚠️' : '❌';
      console.log(`${emoji} ${category.title}: ${score}/100`);
    });
    
    // Get opportunities
    console.log('\n' + '='.repeat(60));
    console.log('🚀 PERFORMANCE OPPORTUNITIES');
    console.log('='.repeat(60));
    
    const opportunities = report.audits;
    const perfOpportunities = Object.values(opportunities).filter(audit => 
      audit.details && audit.details.type === 'opportunity' && audit.numericValue > 0
    );
    
    perfOpportunities
      .sort((a, b) => b.numericValue - a.numericValue)
      .slice(0, 10)
      .forEach(audit => {
        const savings = (audit.numericValue / 1000).toFixed(2);
        console.log(`⚡ ${audit.title}: ${savings}s potential savings`);
        if (audit.description) {
          console.log(`   ${audit.description.substring(0, 100)}...`);
        }
      });
    
    // Get diagnostics
    console.log('\n' + '='.repeat(60));
    console.log('🔧 DIAGNOSTICS');
    console.log('='.repeat(60));
    
    const diagnostics = Object.values(opportunities).filter(audit =>
      audit.details && audit.details.type === 'table' && audit.score !== null && audit.score < 1
    );
    
    diagnostics.slice(0, 10).forEach(audit => {
      const score = Math.round((audit.score || 0) * 100);
      const emoji = score >= 90 ? '✅' : score >= 70 ? '⚠️' : '❌';
      console.log(`${emoji} ${audit.title}: ${score}/100`);
      if (audit.displayValue) {
        console.log(`   ${audit.displayValue}`);
      }
    });
    
    // Get accessibility issues
    console.log('\n' + '='.repeat(60));
    console.log('♿ ACCESSIBILITY ISSUES');
    console.log('='.repeat(60));
    
    const a11yAudits = Object.values(opportunities).filter(audit =>
      audit.score !== null && audit.score < 1 && 
      ['accessibility'].includes(report.audits[audit.id]?.group || '')
    );
    
    if (a11yAudits.length === 0) {
      console.log('✅ No accessibility issues found!');
    } else {
      a11yAudits.slice(0, 10).forEach(audit => {
        console.log(`⚠️  ${audit.title}`);
      });
    }
    
    await chrome.kill();
    await browser.close();
    
    console.log('\n✅ Lighthouse audit complete! Report saved to lighthouse-report.json');
    
  } catch (error) {
    console.error('❌ Lighthouse audit failed:', error.message);
    process.exit(1);
  }
}

runLighthouseAudit();
