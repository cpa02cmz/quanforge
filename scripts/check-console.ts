import { chromium, Page } from '@playwright/test';
import { ConsoleMessage } from 'playwright-core';

interface ConsoleError {
  type: string;
  text: string;
  location?: string;
}

interface ConsoleResults {
  errors: ConsoleError[];
  warnings: ConsoleError[];
  logs: ConsoleError[];
}

async function checkBrowserConsole(): Promise<ConsoleResults> {
  const results: ConsoleResults = {
    errors: [],
    warnings: [],
    logs: []
  };

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  // Capture all console messages
  page.on('console', (msg: ConsoleMessage) => {
    const entry: ConsoleError = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location().url
    };

    if (msg.type() === 'error') {
      results.errors.push(entry);
      console.error(`[CONSOLE ERROR] ${msg.text()}`);
    } else if (msg.type() === 'warning') {
      results.warnings.push(entry);
      console.warn(`[CONSOLE WARNING] ${msg.text()}`);
    } else {
      results.logs.push(entry);
    }
  });

  // Capture page errors
  page.on('pageerror', (error: Error) => {
    const entry: ConsoleError = {
      type: 'pageerror',
      text: error.message,
      location: error.stack
    };
    results.errors.push(entry);
    console.error(`[PAGE ERROR] ${error.message}`);
  });

  // Capture network errors
  page.on('requestfailed', (request) => {
    const entry: ConsoleError = {
      type: 'network_error',
      text: `Failed to load: ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`,
      location: request.url()
    };
    results.errors.push(entry);
    console.error(`[NETWORK ERROR] ${request.url()}`);
  });

  try {
    console.log('Navigating to http://localhost:3000...');
    
    // Navigate to the app
    await page.goto('http://localhost:3000', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    console.log('Page loaded, waiting for initial render...');
    
    // Wait for the app to fully render
    await page.waitForTimeout(3000);

    // Interact with the app - click on Dashboard
    console.log('Interacting with app...');
    
    // Try to find and click on Dashboard link
    try {
      const dashboardLink = page.locator('text=Dashboard').first();
      if (await dashboardLink.isVisible({ timeout: 5000 })) {
        await dashboardLink.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('Dashboard link not found or not clickable');
    }

    // Navigate to Generator page
    try {
      const generatorLink = page.locator('text=Generator').first();
      if (await generatorLink.isVisible({ timeout: 5000 })) {
        await generatorLink.click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      console.log('Generator link not found or not clickable');
    }

    // Wait a bit more for any async operations
    await page.waitForTimeout(2000);

    console.log('Console check completed');

  } catch (error) {
    console.error('Error during navigation:', error);
  } finally {
    await browser.close();
  }

  return results;
}

// Run the check
(async () => {
  console.log('=== BroCula Browser Console Check ===\n');
  
  const results = await checkBrowserConsole();

  console.log('\n=== CONSOLE CHECK SUMMARY ===');
  console.log(`Errors found: ${results.errors.length}`);
  console.log(`Warnings found: ${results.warnings.length}`);
  console.log(`Logs found: ${results.logs.length}`);

  if (results.errors.length > 0) {
    console.log('\n=== ERRORS ===');
    results.errors.forEach((err, i) => {
      console.log(`${i + 1}. [${err.type}] ${err.text}`);
      if (err.location) console.log(`   Location: ${err.location}`);
    });
  }

  if (results.warnings.length > 0) {
    console.log('\n=== WARNINGS ===');
    results.warnings.forEach((warn, i) => {
      console.log(`${i + 1}. [${warn.type}] ${warn.text}`);
    });
  }

  // Exit with error code if errors found
  if (results.errors.length > 0) {
    console.log('\n❌ Console errors detected!');
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.log('\n⚠️  Console warnings detected (no errors)');
    process.exit(0);
  } else {
    console.log('\n✅ No console errors or warnings!');
    process.exit(0);
  }
})();
