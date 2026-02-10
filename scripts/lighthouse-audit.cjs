const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');

async function runLighthouse() {
    let chrome;
    
    try {
        console.log('Launching Chrome...');
        chrome = await chromeLauncher.launch({ 
            chromeFlags: ['--headless', '--no-sandbox', '--disable-setuid-sandbox']
        });
        
        console.log('Running Lighthouse audit on http://localhost:3000...\n');
        
        const options = {
            logLevel: 'error',
            output: 'json',
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            port: chrome.port
        };
        
        const runnerResult = await lighthouse('http://localhost:3000', options);
        const lhr = runnerResult.lhr;
        
        console.log('=== LIGHTHOUSE AUDIT REPORT ===\n');
        
        // Scores
        console.log('SCORES:');
        console.log(`  Performance:     ${Math.round(lhr.categories.performance.score * 100)}`);
        console.log(`  Accessibility:   ${Math.round(lhr.categories.accessibility.score * 100)}`);
        console.log(`  Best Practices:  ${Math.round(lhr.categories['best-practices'].score * 100)}`);
        console.log(`  SEO:             ${Math.round(lhr.categories.seo.score * 100)}`);
        
        // Performance metrics
        console.log('\nPERFORMANCE METRICS:');
        const metrics = lhr.audits;
        if (metrics['first-contentful-paint']) {
            console.log(`  First Contentful Paint: ${metrics['first-contentful-paint'].displayValue || 'N/A'}`);
        }
        if (metrics['largest-contentful-paint']) {
            console.log(`  Largest Contentful Paint: ${metrics['largest-contentful-paint'].displayValue || 'N/A'}`);
        }
        if (metrics['total-blocking-time']) {
            console.log(`  Total Blocking Time: ${metrics['total-blocking-time'].displayValue || 'N/A'}`);
        }
        if (metrics['cumulative-layout-shift']) {
            console.log(`  Cumulative Layout Shift: ${metrics['cumulative-layout-shift'].displayValue || 'N/A'}`);
        }
        if (metrics['speed-index']) {
            console.log(`  Speed Index: ${metrics['speed-index'].displayValue || 'N/A'}`);
        }
        
        // Opportunities
        console.log('\nOPTIMIZATION OPPORTUNITIES:');
        const opportunities = Object.values(lhr.audits).filter(
            audit => audit.details && audit.details.type === 'opportunity' && audit.numericValue > 0
        );
        
        opportunities.sort((a, b) => b.numericValue - a.numericValue);
        
        if (opportunities.length === 0) {
            console.log('  No optimization opportunities found!');
        } else {
            opportunities.forEach(opp => {
                console.log(`\n  ${opp.title}`);
                console.log(`    Potential Savings: ${opp.displayValue}`);
                if (opp.description) {
                    console.log(`    Description: ${opp.description.substring(0, 100)}...`);
                }
            });
        }
        
        // Failed audits
        console.log('\nFAILED/NEEDS IMPROVEMENT AUDITS:');
        const failedAudits = Object.values(lhr.audits).filter(
            audit => audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== 'informative'
        );
        
        failedAudits.slice(0, 10).forEach(audit => {
            console.log(`\n  ${audit.title}: ${audit.score !== null ? Math.round(audit.score * 100) + '%' : 'N/A'}`);
            if (audit.description) {
                console.log(`    ${audit.description.substring(0, 100)}...`);
            }
        });
        
        // Save full report
        fs.writeFileSync('lighthouse-report.json', JSON.stringify(lhr, null, 2));
        console.log('\n✓ Full report saved to lighthouse-report.json');
        
    } catch (error) {
        console.error('Lighthouse audit failed:', error.message);
        console.error(error.stack);
    } finally {
        if (chrome) {
            await chrome.kill();
        }
    }
}

runLighthouse();
