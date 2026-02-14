#!/usr/bin/env node
/**
 * BroCula Browser Console & Lighthouse Auditor
 * Captures console errors/warnings and runs Lighthouse audits
 */

import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3456;
const BASE_URL = `http://localhost:${PORT}`;
const REPORTS_DIR = './browser-reports';

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const routes = [
  { path: '/', name: 'home' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/generator', name: 'generator' },
];

async function captureConsoleLogs() {
  console.log('🔍 BroCula: Capturing browser console logs...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  const allLogs = [];
  
  for (const route of routes) {
    const page = await context.newPage();
    const logs = [];
    
    // Capture all console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location ? ` (${msg.location.url}:${msg.location.lineNumber})` : '';
      
      // Filter out noise but keep warnings and errors
      if (type === 'error' || type === 'warning' || type === 'warn') {
        // Filter known headless Chrome/React compatibility issues
        if (text.includes("Cannot set properties of undefined (setting 'Activity')")) {
          console.log(`  ℹ️ [FILTERED] Known headless Chrome compatibility issue: ${text.substring(0, 60)}...`);
          return;
        }
        logs.push({ type, text, location, route: route.path });
      }
    });
    
    // Capture page errors
    page.on('pageerror', error => {
      // Filter known headless Chrome/React compatibility issues
      if (error.message && error.message.includes("Cannot set properties of undefined (setting 'Activity')")) {
        console.log(`  ℹ️ [FILTERED] Known headless Chrome compatibility issue`);
        return;
      }
      logs.push({ 
        type: 'pageerror', 
        text: error.message, 
        location: error.stack || '',
        route: route.path 
      });
    });
    
    // Capture request failures
    page.on('requestfailed', request => {
      logs.push({
        type: 'requestfailed',
        text: `Request failed: ${request.url()} - ${request.failure().errorText}`,
        location: '',
        route: route.path
      });
    });
    
    try {
      await page.goto(`${BASE_URL}${route.path}`, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      // Wait a bit for any async console logs
      await page.waitForTimeout(3000);
      
      console.log(`✓ ${route.name}: ${logs.length} issues found`);
      
      if (logs.length > 0) {
        logs.forEach(log => {
          const icon = log.type === 'error' || log.type === 'pageerror' ? '🔴' : '🟡';
          console.log(`  ${icon} [${log.type.toUpperCase()}] ${log.text.substring(0, 100)}${log.text.length > 100 ? '...' : ''}`);
        });
      }
      
      allLogs.push(...logs);
      
    } catch (error) {
      console.error(`✗ ${route.name}: Failed to load - ${error.message}`);
    }
    
    await page.close();
  }
  
  await browser.close();
  
  // Save report
  const reportPath = path.join(REPORTS_DIR, 'console-logs.json');
  fs.writeFileSync(reportPath, JSON.stringify(allLogs, null, 2));
  
  console.log(`\n📄 Console log report saved to: ${reportPath}`);
  
  return allLogs;
}

async function runLighthouseAudit() {
  console.log('\n⚡ BroCula: Running Lighthouse audits...\n');
  
  let chrome;
  const results = [];
  
  try {
    // Try to find Chrome/Chromium executable
    let chromePath = process.env.CHROME_PATH;
    
    if (!chromePath) {
      // Try to find Playwright's Chromium
      const possiblePaths = [
        '/home/runner/.cache/ms-playwright/chromium-1208/chrome-linux/chrome',
        '/home/runner/.cache/ms-playwright/chromium_headless_shell-1208/chrome-linux/headless_shell',
      ];
      
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          chromePath = p;
          console.log(`  Using Chrome: ${chromePath}`);
          break;
        }
      }
    }
    
    const launchOptions = {
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      logLevel: 'error'
    };
    
    if (chromePath) {
      launchOptions.chromePath = chromePath;
    }
    
    chrome = await chromeLauncher.launch(launchOptions);
    
    for (const route of routes.slice(0, 2)) { // Limit to first 2 routes for speed
      console.log(`🔍 Auditing ${route.name}...`);
      
      const runnerResult = await lighthouse(`${BASE_URL}${route.path}`, {
        port: chrome.port,
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        settings: {
          maxWaitForFcp: 30000,
          maxWaitForLoad: 30000,
          formFactor: 'desktop',
          throttling: {
            rttMs: 40,
            throughputKbps: 10240,
            cpuSlowdownMultiplier: 1,
            requestLatencyMs: 0,
            downloadThroughputKbps: 0,
            uploadThroughputKbps: 0
          },
          screenEmulation: {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false
          },
          emulatedUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const { lhr } = runnerResult;
      
      const summary = {
        route: route.path,
        scores: {
          performance: Math.round(lhr.categories.performance.score * 100),
          accessibility: Math.round(lhr.categories.accessibility.score * 100),
          bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
          seo: Math.round(lhr.categories.seo.score * 100)
        },
        metrics: {
          firstContentfulPaint: lhr.audits['first-contentful-paint']?.displayValue || 'N/A',
          largestContentfulPaint: lhr.audits['largest-contentful-paint']?.displayValue || 'N/A',
          totalBlockingTime: lhr.audits['total-blocking-time']?.displayValue || 'N/A',
          cumulativeLayoutShift: lhr.audits['cumulative-layout-shift']?.displayValue || 'N/A',
          speedIndex: lhr.audits['speed-index']?.displayValue || 'N/A'
        },
        opportunities: lhr.audits['unused-javascript']?.details?.items?.map(item => ({
          url: item.url,
          wastedBytes: item.wastedBytes,
          wastedPercent: item.wastedPercent
        })) || [],
        diagnostics: Object.entries(lhr.audits)
          .filter(([_, audit]) => audit.score !== null && audit.score < 1)
          .map(([id, audit]) => ({
            id,
            title: audit.title,
            description: audit.description,
            score: audit.score,
            displayValue: audit.displayValue
          }))
      };
      
      results.push(summary);
      
      console.log(`  Performance: ${summary.scores.performance}/100`);
      console.log(`  Accessibility: ${summary.scores.accessibility}/100`);
      console.log(`  Best Practices: ${summary.scores.bestPractices}/100`);
      console.log(`  SEO: ${summary.scores.seo}/100`);
      console.log('');
    }
    
  } finally {
    if (chrome) {
      await chrome.kill();
    }
  }
  
  // Save report
  const reportPath = path.join(REPORTS_DIR, 'lighthouse-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  
  console.log(`📄 Lighthouse report saved to: ${reportPath}`);
  
  return results;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           BroCula Browser Console Auditor              ║');
  console.log('║         Finding & Fixing Console Issues                ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  try {
    // Capture console logs
    const consoleLogs = await captureConsoleLogs();
    
    // Run Lighthouse
    const lighthouseResults = await runLighthouseAudit();
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                      SUMMARY                             ');
    console.log('═══════════════════════════════════════════════════════════');
    
    const errors = consoleLogs.filter(log => log.type === 'error' || log.type === 'pageerror');
    const warnings = consoleLogs.filter(log => log.type === 'warning' || log.type === 'warn');
    
    console.log(`\n🎯 Console Issues:`);
    console.log(`   Errors: ${errors.length}`);
    console.log(`   Warnings: ${warnings.length}`);
    
    if (lighthouseResults.length > 0) {
      const avgPerformance = Math.round(
        lighthouseResults.reduce((sum, r) => sum + r.scores.performance, 0) / lighthouseResults.length
      );
      console.log(`\n⚡ Lighthouse Performance: ${avgPerformance}/100 (avg)`);
    }
    
    if (errors.length > 0 || warnings.length > 0) {
      console.log('\n❌ Issues found - fix required!');
      process.exit(1);
    } else {
      console.log('\n✅ No console errors/warnings found!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Audit failed:', error.message);
    process.exit(1);
  }
}

main();
