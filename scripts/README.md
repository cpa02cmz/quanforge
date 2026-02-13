# Browser Audit Scripts

This directory contains scripts for auditing the browser console and performance.

## Scripts

### check-console.js
Checks the browser console for errors and warnings using Playwright.

```bash
# Start dev server first
npm run dev &

# Run console check
node scripts/check-console.js
```

### performance-audit.js
Runs a comprehensive performance audit including:
- Load time metrics
- Core Web Vitals (LCP, CLS)
- Resource analysis
- Console error detection

```bash
# Start dev server first
npm run dev &

# Run performance audit
node scripts/performance-audit.js
```

### lighthouse-audit.js
Runs Google Lighthouse audits (requires Chrome/Chromium).

```bash
# Start dev server first
npm run dev &

# Run Lighthouse audit
node scripts/lighthouse-audit.js
```

## Usage Notes

- All scripts require the dev server to be running on http://localhost:3000
- Scripts use Playwright's bundled Chromium for consistency
- Audit results are saved to JSON files for further analysis
- Exit codes: 0 = success, 1 = errors found

## BroCula Workflow

As BroCula, use these scripts to:
1. Find browser console errors/warnings and fix immediately
2. Find Lighthouse optimization opportunities
3. Optimize code based on audit results
4. Ensure build/lint pass (errors are fatal)
