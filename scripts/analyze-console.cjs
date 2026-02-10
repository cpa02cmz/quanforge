const { chromium } = require('playwright-core');

async function analyzeConsole() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    const consoleLogs = [];
    const errors = [];
    const warnings = [];
    
    // Listen to console messages
    page.on('console', msg => {
        const entry = {
            type: msg.type(),
            text: msg.text(),
            location: msg.location(),
            timestamp: new Date().toISOString()
        };
        
        consoleLogs.push(entry);
        
        if (msg.type() === 'error') {
            errors.push(entry);
        } else if (msg.type() === 'warning') {
            warnings.push(entry);
        }
    });
    
    // Listen to page errors
    page.on('pageerror', error => {
        errors.push({
            type: 'pageerror',
            text: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    });
    
    try {
        // Navigate to the app
        console.log('Navigating to http://localhost:3000...');
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
        
        // Wait a bit for any async operations
        await page.waitForTimeout(3000);
        
        // Navigate to dashboard
        console.log('Navigating to dashboard...');
        await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        // Navigate to generator
        console.log('Navigating to generator...');
        await page.goto('http://localhost:3000/generator', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        
        // Output results
        console.log('\n=== CONSOLE ANALYSIS REPORT ===\n');
        
        console.log(`Total Console Entries: ${consoleLogs.length}`);
        console.log(`Errors: ${errors.length}`);
        console.log(`Warnings: ${warnings.length}`);
        
        if (errors.length > 0) {
            console.log('\n--- ERRORS ---');
            errors.forEach((err, i) => {
                console.log(`\n[${i + 1}] ${err.type}: ${err.text.substring(0, 200)}`);
            });
        }
        
        if (warnings.length > 0) {
            console.log('\n--- WARNINGS ---');
            warnings.forEach((warn, i) => {
                console.log(`\n[${i + 1}] ${warn.type}: ${warn.text.substring(0, 200)}`);
            });
        }
        
        // Output summary for CI
        console.log('\n=== SUMMARY ===');
        console.log(JSON.stringify({
            total: consoleLogs.length,
            errors: errors.length,
            warnings: warnings.length,
            errorDetails: errors.map(e => ({ type: e.type, text: e.text.substring(0, 100) })),
            warningDetails: warnings.map(w => ({ type: w.type, text: w.text.substring(0, 100) }))
        }, null, 2));
        
    } catch (error) {
        console.error('Analysis failed:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

analyzeConsole();
