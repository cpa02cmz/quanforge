#!/usr/bin/env node

/**
 * Bundle Size Monitor
 * 
 * Monitors bundle sizes and enforces performance budgets.
 * Run automatically in CI or manually to check bundle sizes.
 * 
 * Usage:
 *   node scripts/bundle-size-monitor.js [options]
 * 
 * Options:
 *   --check    Fail if budgets are exceeded (CI mode)
 *   --json     Output results as JSON
 *   --help     Show this help message
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance budgets (in bytes)
const BUDGETS = {
  // Individual chunk limits
  chunks: {
    'ai-vendor': 300 * 1024,        // 300KB - Large but lazy loaded
    'chart-vendor': 250 * 1024,     // 250KB - Charts are heavy
    'react-core': 200 * 1024,       // 200KB
    'react-router': 50 * 1024,      // 50KB
    'vendor-misc': 150 * 1024,      // 150KB
    'supabase-vendor': 120 * 1024,  // 120KB
    'security-vendor': 35 * 1024,   // 35KB
    'main': 40 * 1024,              // 40KB
    default: 100 * 1024,            // 100KB default for other chunks
  },
  // Total bundle limits
  total: {
    uncompressed: 2.5 * 1024 * 1024,  // 2.5MB total uncompressed
    gzipped: 800 * 1024,              // 800KB total gzipped
  },
  // Critical path (initial load) - adjusted based on current bundle analysis
  initial: {
    uncompressed: 1100 * 1024,  // 1.1MB for initial JS (current: ~1014KB)
    gzipped: 350 * 1024,        // 350KB gzipped (current: ~304KB)
  }
};

// Chunks that are lazy loaded (don't count toward initial bundle)
const LAZY_LOADED_CHUNKS = [
  'ai-vendor',
  'chart-vendor',
  'chart-core',
  'chart-misc',
  'services-ai',
  'component-backtest',
  'component-charts',
];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getChunkBudget(chunkName) {
  // Check for exact match
  if (BUDGETS.chunks[chunkName]) {
    return BUDGETS.chunks[chunkName];
  }
  
  // Check for partial match (e.g., "react-core-Cq6IOD6q.js" matches "react-core")
  for (const [key, budget] of Object.entries(BUDGETS.chunks)) {
    if (chunkName.includes(key)) {
      return budget;
    }
  }
  
  return BUDGETS.chunks.default;
}

function isLazyLoaded(chunkName) {
  return LAZY_LOADED_CHUNKS.some(lazyChunk => chunkName.includes(lazyChunk));
}

function analyzeBundle() {
  const distPath = path.join(process.cwd(), 'dist', 'assets');
  const jsPath = path.join(distPath, 'js');
  
  if (!fs.existsSync(jsPath)) {
    console.error(`${colors.red}Error: Build output not found at ${jsPath}${colors.reset}`);
    console.error('Please run "npm run build" first.');
    process.exit(1);
  }
  
  const files = fs.readdirSync(jsPath).filter(f => f.endsWith('.js'));
  
  if (files.length === 0) {
    console.error(`${colors.red}Error: No JavaScript files found in build output${colors.reset}`);
    process.exit(1);
  }
  
  const results = {
    chunks: [],
    totalUncompressed: 0,
    totalGzipped: 0,
    initialUncompressed: 0,
    initialGzipped: 0,
    violations: [],
    passed: true,
  };
  
  for (const file of files) {
    const filePath = path.join(jsPath, file);
    const stats = fs.statSync(filePath);
    const size = stats.size;
    
    // Estimate gzipped size (rough approximation: 30% of original)
    const gzippedSize = Math.round(size * 0.3);
    
    const chunkName = file.replace(/-[a-zA-Z0-9]+\.js$/, '');
    const budget = getChunkBudget(chunkName);
    const lazyLoaded = isLazyLoaded(chunkName);
    
    const chunk = {
      name: file,
      size,
      gzippedSize,
      budget,
      lazyLoaded,
      overBudget: size > budget,
    };
    
    results.chunks.push(chunk);
    results.totalUncompressed += size;
    results.totalGzipped += gzippedSize;
    
    if (!lazyLoaded) {
      results.initialUncompressed += size;
      results.initialGzipped += gzippedSize;
    }
    
    if (chunk.overBudget) {
      results.violations.push({
        type: 'chunk',
        name: file,
        size,
        budget,
        message: `${file} (${formatBytes(size)}) exceeds budget (${formatBytes(budget)})`,
      });
    }
  }
  
  // Check total budget
  if (results.totalUncompressed > BUDGETS.total.uncompressed) {
    results.violations.push({
      type: 'total',
      name: 'Total Bundle',
      size: results.totalUncompressed,
      budget: BUDGETS.total.uncompressed,
      message: `Total bundle (${formatBytes(results.totalUncompressed)}) exceeds budget (${formatBytes(BUDGETS.total.uncompressed)})`,
    });
  }
  
  // Check initial bundle budget
  if (results.initialUncompressed > BUDGETS.initial.uncompressed) {
    results.violations.push({
      type: 'initial',
      name: 'Initial Bundle',
      size: results.initialUncompressed,
      budget: BUDGETS.initial.uncompressed,
      message: `Initial bundle (${formatBytes(results.initialUncompressed)}) exceeds budget (${formatBytes(BUDGETS.initial.uncompressed)})`,
    });
  }
  
  results.passed = results.violations.length === 0;
  
  return results;
}

function printResults(results) {
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}  BUNDLE SIZE ANALYSIS${colors.reset}`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log();
  
  // Individual chunks
  console.log(`${colors.bold}Individual Chunks:${colors.reset}`);
  console.log('─'.repeat(70));
  console.log(`${colors.bold}${'Chunk Name'.padEnd(35)} ${'Size'.padStart(12)} ${'Budget'.padStart(12)} ${'Status'.padStart(10)}${colors.reset}`);
  console.log('─'.repeat(70));
  
  // Sort by size descending
  const sortedChunks = [...results.chunks].sort((a, b) => b.size - a.size);
  
  for (const chunk of sortedChunks) {
    const status = chunk.overBudget 
      ? `${colors.red}FAIL${colors.reset}` 
      : `${colors.green}OK${colors.reset}`;
    const lazyBadge = chunk.lazyLoaded ? `${colors.blue}[lazy]${colors.reset}` : '';
    
    console.log(
      `${chunk.name.substring(0, 34).padEnd(35)}` +
      `${formatBytes(chunk.size).padStart(12)}` +
      `${formatBytes(chunk.budget).padStart(12)}` +
      `${status.padStart(10)}` +
      ` ${lazyBadge}`
    );
  }
  
  console.log('─'.repeat(70));
  console.log();
  
  // Summary
  console.log(`${colors.bold}Summary:${colors.reset}`);
  console.log(`  Total Bundle:      ${formatBytes(results.totalUncompressed)} (gzipped: ~${formatBytes(results.totalGzipped)})`);
  console.log(`  Initial Bundle:    ${formatBytes(results.initialUncompressed)} (gzipped: ~${formatBytes(results.initialGzipped)})`);
  console.log(`  Lazy Loaded:       ${formatBytes(results.totalUncompressed - results.initialUncompressed)}`);
  console.log(`  Chunks Analyzed:   ${results.chunks.length}`);
  console.log(`  Violations:        ${results.violations.length}`);
  console.log();
  
  // Violations
  if (results.violations.length > 0) {
    console.log(`${colors.red}${colors.bold}⚠ BUDGET VIOLATIONS:${colors.reset}`);
    for (const violation of results.violations) {
      console.log(`  ${colors.red}✗${colors.reset} ${violation.message}`);
    }
    console.log();
  }
  
  // Overall status
  if (results.passed) {
    console.log(`${colors.green}${colors.bold}✓ All bundle size budgets passed${colors.reset}`);
  } else {
    console.log(`${colors.red}${colors.bold}✗ Bundle size budgets exceeded${colors.reset}`);
  }
  
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════${colors.reset}`);
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log('Bundle Size Monitor');
    console.log('');
    console.log('Usage: node scripts/bundle-size-monitor.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --check    Fail if budgets are exceeded (CI mode)');
    console.log('  --json     Output results as JSON');
    console.log('  --help     Show this help message');
    process.exit(0);
  }
  
  const checkMode = args.includes('--check');
  const jsonMode = args.includes('--json');
  
  try {
    const results = analyzeBundle();
    
    if (jsonMode) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      printResults(results);
    }
    
    if (checkMode && !results.passed) {
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

main();
