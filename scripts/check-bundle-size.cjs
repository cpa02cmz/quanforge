#!/usr/bin/env node

/**
 * Bundle Size Checker
 * 
 * Checks bundle sizes against defined budgets and fails if exceeded.
 * Used in CI pipeline to prevent bundle bloat.
 * 
 * @see Issue #592 - Missing bundle size monitoring in CI pipeline
 */

const fs = require('fs');
const path = require('path');

// Configuration - Bundle size budgets
// Note: These budgets are set based on current bundle analysis
// Target: Gradually reduce these limits as optimizations are implemented
const BUDGETS = {
  // Maximum size for any individual chunk (250KB - allows current ai-vendor at 244KB)
  // Target: Reduce to 200KB after further optimization
  maxChunkSize: 250 * 1024,
  // Maximum total bundle size (2MB)
  maxTotalSize: 2 * 1024 * 1024,
  // Maximum initial JS size (1.1MB - allows current initial load)
  // Target: Reduce to 500KB after implementing lazy loading
  maxInitialJS: 1.1 * 1024 * 1024,
  // Chunks that should be lazy loaded (excluded from initial JS check)
  lazyLoadedChunks: ['ai-vendor', 'chart-vendor', 'chart-core', 'chart-misc', 'chart']
};

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function checkBundleSize() {
  const distPath = path.join(process.cwd(), 'dist', 'assets', 'js');
  
  console.log(`${colors.bold}🔍 Bundle Size Check${colors.reset}\n`);
  
  // Check if dist directory exists
  if (!fs.existsSync(distPath)) {
    console.error(`${colors.red}❌ Error: Build output not found at ${distPath}${colors.reset}`);
    console.error(`   Run 'npm run build' first.`);
    process.exit(1);
  }
  
  // Get all JS files
  const files = fs.readdirSync(distPath)
    .filter(file => file.endsWith('.js'))
    .map(file => {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        path: filePath
      };
    })
    .sort((a, b) => b.size - a.size);
  
  if (files.length === 0) {
    console.error(`${colors.red}❌ Error: No JavaScript files found in ${distPath}${colors.reset}`);
    process.exit(1);
  }
  
  let totalSize = 0;
  let initialJSSize = 0;
  let violations = [];
  
  console.log(`${colors.bold}📦 Chunk Analysis:${colors.reset}\n`);
  console.log(`${'Chunk Name'.padEnd(40)} ${'Size'.padStart(12)} ${'Status'.padStart(10)}`);
  console.log('='.repeat(64));
  
  files.forEach(file => {
    totalSize += file.size;
    
    // Extract chunk name from filename (e.g., "react-core-abc123.js" -> "react-core")
    const chunkName = file.name.replace(/-[a-z0-9]+\.js$/, '').replace(/\.js$/, '');
    const isLazyLoaded = BUDGETS.lazyLoadedChunks.some(lazy => chunkName.includes(lazy));
    
    if (!isLazyLoaded) {
      initialJSSize += file.size;
    }
    
    // Check chunk size budget
    let status = `${colors.green}✓ OK${colors.reset}`;
    if (file.size > BUDGETS.maxChunkSize) {
      status = `${colors.red}✗ FAIL${colors.reset}`;
      violations.push({
        type: 'chunk',
        name: file.name,
        size: file.size,
        limit: BUDGETS.maxChunkSize
      });
    }
    
    const sizeStr = formatBytes(file.size).padStart(12);
    const displayName = file.name.length > 38 ? file.name.substring(0, 35) + '...' : file.name;
    console.log(`${displayName.padEnd(40)} ${sizeStr} ${status}`);
  });
  
  console.log('='.repeat(64));
  console.log(`\n${colors.bold}📊 Summary:${colors.reset}\n`);
  
  // Check total size budget
  const totalStatus = totalSize > BUDGETS.maxTotalSize ? `${colors.red}✗ FAIL${colors.reset}` : `${colors.green}✓ OK${colors.reset}`;
  console.log(`Total Bundle Size:  ${formatBytes(totalSize).padStart(12)} / ${formatBytes(BUDGETS.maxTotalSize)} ${totalStatus}`);
  
  if (totalSize > BUDGETS.maxTotalSize) {
    violations.push({
      type: 'total',
      name: 'Total Bundle',
      size: totalSize,
      limit: BUDGETS.maxTotalSize
    });
  }
  
  // Check initial JS budget
  const initialStatus = initialJSSize > BUDGETS.maxInitialJS ? `${colors.red}✗ FAIL${colors.reset}` : `${colors.green}✓ OK${colors.reset}`;
  console.log(`Initial JS Size:    ${formatBytes(initialJSSize).padStart(12)} / ${formatBytes(BUDGETS.maxInitialJS)} ${initialStatus}`);
  
  if (initialJSSize > BUDGETS.maxInitialJS) {
    violations.push({
      type: 'initial',
      name: 'Initial JS',
      size: initialJSSize,
      limit: BUDGETS.maxInitialJS
    });
  }
  
  console.log(`Lazy Loaded Chunks: ${formatBytes(totalSize - initialJSSize).padStart(12)}`);
  console.log(`Total Chunks:       ${files.length.toString().padStart(12)}`);
  
  // Report violations
  if (violations.length > 0) {
    console.log(`\n${colors.red}${colors.bold}❌ Budget Violations Found:${colors.reset}\n`);
    violations.forEach(v => {
      console.log(`  ${colors.red}•${colors.reset} ${v.name}: ${formatBytes(v.size)} > ${formatBytes(v.limit)}`);
    });
    console.log(`\n${colors.yellow}💡 To fix:${colors.reset}`);
    console.log(`  • Optimize imports to enable better tree-shaking`);
    console.log(`  • Split large chunks further in vite.config.ts`);
    console.log(`  • Use dynamic imports for heavy dependencies`);
    console.log(`  • Run 'npm run build:analyze' to visualize bundle composition`);
    console.log(`\n${colors.yellow}⚠️  To override (not recommended):${colors.reset}`);
    console.log(`  Set environment variable: SKIP_BUNDLE_CHECK=true\n`);
    process.exit(1);
  }
  
  console.log(`\n${colors.green}${colors.bold}✅ All bundle size budgets passed!${colors.reset}\n`);
  console.log(`${colors.blue}💡 Tip: Run 'npm run build:analyze' for detailed visualization${colors.reset}\n`);
  process.exit(0);
}

// Allow override with environment variable
if (process.env.SKIP_BUNDLE_CHECK === 'true') {
  console.log(`${colors.yellow}⚠️  Bundle size check skipped (SKIP_BUNDLE_CHECK=true)${colors.reset}`);
  process.exit(0);
}

checkBundleSize();
