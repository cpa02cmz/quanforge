import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
          // Serve index.html for SPA routing
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

// Routes to test
const routes = [
  { name: 'Home/Dashboard', path: '/' },
  { name: 'Generator', path: '/generator' },
  { name: 'About', path: '/about' }
];

async function auditBrowserConsole() {
  console.log('🧛 BroCula Browser Console Audit Starting...\n');
  
  // Start server
  const server = createServer();
  await new Promise(resolve => server.listen(3456, '127.0.0.1', resolve));
  console.log('✅ Server started on http://localhost:3456\n');
  
  const browser = await chromium.launch({ headless: true });
  const allErrors = [];
  const allWarnings = [];
  
  try {
    for (const route of routes) {
      console.log(`\n📍 Testing route: ${route.name} (${route.path})`);
      
      const context = await browser.newContext();
      const page = await context.newPage();
      
      const routeErrors = [];
      const routeWarnings = [];
      
      // Capture console messages
      page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        const location = msg.location ? ` (${msg.location.url}:${msg.location.lineNumber})` : '';
        
        if (type === 'error') {
          // Skip expected errors (e.g., network issues, missing env vars in dev)
          const isExpected = 
            text.includes('favicon') ||
            text.includes('Manifest') ||
            text.includes('network') && text.includes('Failed to fetch') ||
            text.includes('Supabase') && text.includes('env') ||
            text.includes('Redis') && text.includes('env') ||
            text.includes('Gemini') && text.includes('key') ||
            text.includes('401') && text.includes('Unauthorized') ||
            text.includes('WebSocket') && text.includes('connection');
          
          if (!isExpected) {
            routeErrors.push({ text, location, route: route.name });
          }
        } else if (type === 'warning') {
          // Skip expected warnings
          const isExpected =
            text.includes('deprecated') ||
            text.includes('source map') ||
            text.includes('dev') ||
            text.includes('HMR');
          
          if (!isExpected) {
            routeWarnings.push({ text, location, route: route.name });
          }
        }
      });
      
      // Capture page errors
      page.on('pageerror', error => {
        const isExpected = 
          error.message.includes('favicon') ||
          error.message.includes('Supabase') ||
          error.message.includes('Redis');
        
        if (!isExpected) {
          routeErrors.push({ text: error.message, location: '', route: route.name, pageError: true });
        }
      });
      
      // Navigate to the route
      await page.goto(`http://127.0.0.1:3456${route.path}`, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });
      
      // Wait a bit for any delayed console messages
      await page.waitForTimeout(2000);
      
      console.log(`   Errors: ${routeErrors.length}, Warnings: ${routeWarnings.length}`);
      
      if (routeErrors.length > 0) {
        routeErrors.forEach(err => {
          console.log(`   ❌ ERROR: ${err.text.substring(0, 100)}`);
        });
      }
      
      if (routeWarnings.length > 0) {
        routeWarnings.forEach(warn => {
          console.log(`   ⚠️  WARNING: ${warn.text.substring(0, 100)}`);
        });
      }
      
      allErrors.push(...routeErrors);
      allWarnings.push(...routeWarnings);
      
      await context.close();
    }
    
  } finally {
    await browser.close();
    server.close();
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 BROWSER CONSOLE AUDIT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Routes Tested: ${routes.length}`);
  console.log(`Total Errors: ${allErrors.length}`);
  console.log(`Total Warnings: ${allWarnings.length}`);
  
  if (allErrors.length === 0 && allWarnings.length === 0) {
    console.log('\n✅ Browser console is CLEAN - No errors or warnings found!');
  } else {
    if (allErrors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      allErrors.forEach((err, i) => {
        console.log(`\n${i + 1}. [${err.route}] ${err.pageError ? '(Page Error)' : ''}`);
        console.log(`   ${err.text.substring(0, 200)}`);
      });
    }
    
    if (allWarnings.length > 0) {
      console.log('\n⚠️  WARNINGS FOUND:');
      allWarnings.forEach((warn, i) => {
        console.log(`\n${i + 1}. [${warn.route}]`);
        console.log(`   ${warn.text.substring(0, 200)}`);
      });
    }
  }
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      routes: routes.length,
      errors: allErrors.length,
      warnings: allWarnings.length,
      status: allErrors.length === 0 && allWarnings.length === 0 ? 'CLEAN' : 'ISSUES_FOUND'
    },
    details: {
      errors: allErrors,
      warnings: allWarnings
    }
  };
  
  fs.writeFileSync('browser-audit-report.json', JSON.stringify(report, null, 2));
  console.log('\n📝 Report saved to browser-audit-report.json');
  
  // Exit with error code if issues found
  process.exit(allErrors.length > 0 ? 1 : 0);
}

auditBrowserConsole().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
