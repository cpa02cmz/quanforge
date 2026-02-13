import { chromium } from 'playwright';

async function checkConsole() {
  console.log('🔍 BroCula: Checking browser console for errors and warnings...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleMessages = [];
  const errors = [];
  const warnings = [];
  
  // Listen to console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    
    const entry = {
      type,
      text,
      url: location.url,
      line: location.lineNumber,
      column: location.columnNumber
    };
    
    consoleMessages.push(entry);
    
    if (type === 'error') {
      errors.push(entry);
      console.log(`❌ ERROR: ${text}`);
      if (location.url) console.log(`   at ${location.url}:${location.lineNumber}:${location.columnNumber}`);
    } else if (type === 'warning') {
      warnings.push(entry);
      console.log(`⚠️  WARNING: ${text}`);
    }
  });
  
  // Listen to page errors
  page.on('pageerror', error => {
    const entry = {
      type: 'pageerror',
      text: error.message,
      stack: error.stack
    };
    errors.push(entry);
    console.log(`💥 PAGE ERROR: ${error.message}`);
  });
  
  try {
    // Navigate to the app
    console.log('📱 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait a bit for any async errors
    await page.waitForTimeout(3000);
    
    // Navigate to different routes to check for route-specific errors
    console.log('\n📱 Checking /dashboard route...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('\n📱 Checking /generator route...');
    await page.goto('http://localhost:3000/generator', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 CONSOLE CHECK SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      errors.forEach((err, i) => {
        console.log(`\n${i + 1}. ${err.text}`);
        if (err.url) console.log(`   Location: ${err.url}:${err.line}:${err.column}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS FOUND:');
      warnings.slice(0, 10).forEach((warn, i) => {
        console.log(`${i + 1}. ${warn.text.substring(0, 100)}${warn.text.length > 100 ? '...' : ''}`);
      });
      if (warnings.length > 10) {
        console.log(`... and ${warnings.length - 10} more warnings`);
      }
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('\n✅ No console errors or warnings found!');
    }
    
    // Output JSON for programmatic use
    const result = {
      errors: errors.length,
      warnings: warnings.length,
      errorDetails: errors,
      warningDetails: warnings.slice(0, 20)
    };
    
    console.log('\n📋 JSON Output:');
    console.log(JSON.stringify(result, null, 2));
    
    await browser.close();
    
    // Exit with error code if there are errors
    process.exit(errors.length > 0 ? 1 : 0);
    
  } catch (e) {
    console.error('Failed to check console:', e.message);
    await browser.close();
    process.exit(1);
  }
}

checkConsole();
