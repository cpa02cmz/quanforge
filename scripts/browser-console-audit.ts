import { chromium, Browser } from 'playwright';
import { ViteDevServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ConsoleMessage {
  type: string;
  text: string;
  location?: string;
}

interface AuditResult {
  route: string;
  errors: ConsoleMessage[];
  warnings: ConsoleMessage[];
  logs: ConsoleMessage[];
}

async function auditBrowserConsole() {
  console.log('🧛‍♂️ BroCula initiating browser console audit...\n');
  
  let _server: ViteDevServer | null = null;
  let browser: Browser | null = null;
  const results: AuditResult[] = [];
  
  // Routes to test
  const routes = [
    { path: '/', name: 'Home/Dashboard' },
    { path: '/generator', name: 'Generator' },
    { path: '/about', name: 'About' }
  ];

  try {
    // Start Vite preview server
    console.log('📦 Starting production build preview server...');
    const { preview } = await import('vite');
    const previewServer = await preview({
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

    // Launch browser
    console.log('🌐 Launching browser...');
    browser = await chromium.launch({ headless: true });
    
    for (const route of routes) {
      console.log(`🔍 Auditing route: ${route.name} (${route.path})`);
      
      const context = await browser.newContext();
      const page = await context.newPage();
      
      const consoleMessages: ConsoleMessage[] = [];
      
      // Capture all console messages
      page.on('console', (msg) => {
        const message: ConsoleMessage = {
          type: msg.type(),
          text: msg.text(),
          location: msg.location().url
        };
        consoleMessages.push(message);
      });
      
      // Capture page errors
      page.on('pageerror', (error) => {
        consoleMessages.push({
          type: 'pageerror',
          text: error.message,
          location: 'page'
        });
      });
      
      // Navigate to route
      const url = `${serverUrl}${route.path}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait a bit for any delayed console messages
      await page.waitForTimeout(2000);
      
      // Categorize messages
      const errors = consoleMessages.filter(m => 
        m.type === 'error' || m.type === 'pageerror'
      );
      const warnings = consoleMessages.filter(m => 
        m.type === 'warning'
      );
      const logs = consoleMessages.filter(m => 
        m.type === 'log' || m.type === 'info'
      );
      
      results.push({
        route: route.name,
        errors,
        warnings,
        logs
      });
      
      // Display results for this route
      if (errors.length > 0) {
        console.log(`  ❌ ${errors.length} error(s) found:`);
        errors.forEach(e => console.log(`     - ${e.text.substring(0, 100)}${e.text.length > 100 ? '...' : ''}`));
      }
      if (warnings.length > 0) {
        console.log(`  ⚠️  ${warnings.length} warning(s) found:`);
        warnings.forEach(w => console.log(`     - ${w.text.substring(0, 100)}${w.text.length > 100 ? '...' : ''}`));
      }
      if (errors.length === 0 && warnings.length === 0) {
        console.log(`  ✅ No console errors or warnings`);
      }
      if (logs.length > 0) {
        console.log(`  📝 ${logs.length} log message(s)`);
      }
      console.log('');
      
      await context.close();
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('🧛‍♂️ BROCULA AUDIT SUMMARY');
    console.log('='.repeat(60));
    
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    
    console.log(`\n📊 Results:`);
    console.log(`   Total Routes Tested: ${results.length}`);
    console.log(`   Total Errors: ${totalErrors}`);
    console.log(`   Total Warnings: ${totalWarnings}`);
    
    if (totalErrors === 0 && totalWarnings === 0) {
      console.log('\n✅ ALL CLEAR - No browser console issues detected!');
      console.log('🎉 Application is production-ready.\n');
    } else {
      console.log('\n⚠️  Issues detected that require attention:\n');
      results.forEach(r => {
        if (r.errors.length > 0 || r.warnings.length > 0) {
          console.log(`   ${r.route}:`);
          console.log(`     Errors: ${r.errors.length}`);
          console.log(`     Warnings: ${r.warnings.length}`);
        }
      });
    }
    
    // Clean up
    await browser.close();
    await previewServer.close();
    
    process.exit(totalErrors > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Audit failed:', error);
    if (browser) await browser.close();
    process.exit(1);
  }
}

auditBrowserConsole();
