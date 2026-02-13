const { chromium } = require('playwright');

async function auditBrowserConsole() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleLogs = [];
  const errors = [];
  const warnings = [];
  
  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const log = { type, text, location: msg.location() };
    
    consoleLogs.push(log);
    
    if (type === 'error') {
      errors.push(log);
    } else if (type === 'warning') {
      warnings.push(log);
    }
  });
  
  // Capture page errors
  page.on('pageerror', error => {
    errors.push({
      type: 'pageerror',
      text: error.message,
      stack: error.stack
    });
  });
  
  console.log('🔍 Auditing browser console...');
  
  // Navigate to the app
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  
  // Wait for initial load
  await page.waitForTimeout(3000);
  
  // Try to interact with the app to trigger more console activity
  // Click on Generator button if exists
  try {
    const generatorLink = await page.$('a[href="/generator"]');
    if (generatorLink) {
      await generatorLink.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    // Ignore if not found
  }
  
  // Go to dashboard
  try {
    const dashboardLink = await page.$('a[href="/"]');
    if (dashboardLink) {
      await dashboardLink.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {
    // Ignore if not found
  }
  
  await browser.close();
  
  console.log('\n📊 CONSOLE AUDIT RESULTS:\n');
  
  console.log(`Total Console Messages: ${consoleLogs.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\n❌ ERRORS FOUND:');
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.type}] ${err.text.substring(0, 200)}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  WARNINGS FOUND:');
    warnings.forEach((warn, i) => {
      console.log(`  ${i + 1}. [${warn.type}] ${warn.text.substring(0, 200)}`);
    });
  }
  
  // Group by message type for better analysis
  const grouped = consoleLogs.reduce((acc, log) => {
    acc[log.type] = (acc[log.type] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📈 Message Types:');
  Object.entries(grouped).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  // Return results for further processing
  return {
    errors,
    warnings,
    consoleLogs,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0
  };
}

auditBrowserConsole()
  .then(results => {
    if (results.hasErrors) {
      console.log('\n❌ ERRORS DETECTED - Fix required!');
      process.exit(1);
    } else if (results.hasWarnings) {
      console.log('\n⚠️  WARNINGS DETECTED - Review recommended');
      process.exit(0);
    } else {
      console.log('\n✅ No console errors or warnings found!');
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
