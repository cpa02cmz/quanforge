#!/usr/bin/env node
/**
 * Bundle Size Monitor
 * 
 * Checks build output against size budgets defined in bundle-size-budget.json
 * Exits with code 1 if budgets are exceeded
 * 
 * Usage:
 *   node scripts/check-bundle-size.js [--strict]
 * 
 * Options:
 *   --strict  Fail on warnings (90% of budget) in addition to errors (100%)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUDGET_FILE = path.join(process.cwd(), 'bundle-size-budget.json');
const MANIFEST_FILE = path.join(process.cwd(), 'dist', '.vite', 'manifest.json');
const DIST_DIR = path.join(process.cwd(), 'dist');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getGzipSize(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    // Simple gzip estimation (actual gzip would require zlib)
    // This is a rough estimate - real CI should use actual gzip
    return Math.floor(content.length * 0.3); // ~30% of raw size
  } catch {
    return 0;
  }
}

function getChunkName(fileName) {
  // Extract chunk name from filename (e.g., "ai-vendor-xxx.js" -> "ai-vendor")
  const match = fileName.match(/^([a-z-]+)-[a-zA-Z0-9]+\.js$/);
  return match ? match[1] : fileName.replace(/-[a-zA-Z0-9]+\.js$/, '');
}

async function checkBundleSize() {
  const isStrict = process.argv.includes('--strict');
  
  console.log(`${colors.blue}📦 Bundle Size Monitor${colors.reset}\n`);

  // Check if budget file exists
  if (!fs.existsSync(BUDGET_FILE)) {
    console.error(`${colors.red}✗ Budget file not found: ${BUDGET_FILE}${colors.reset}`);
    process.exit(1);
  }

  // Check if dist exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`${colors.red}✗ Build output not found. Run 'npm run build' first.${colors.reset}`);
    process.exit(1);
  }

  // Load budgets
  const budgets = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));
  const chunkBudgets = budgets.budgets || {};
  
  // Get all JS files from dist
  const jsFiles = [];
  function findJsFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        findJsFiles(filePath);
      } else if (file.endsWith('.js')) {
        jsFiles.push(filePath);
      }
    }
  }
  findJsFiles(path.join(DIST_DIR, 'assets', 'js'));

  if (jsFiles.length === 0) {
    console.error(`${colors.red}✗ No JS files found in dist/assets/js/${colors.reset}`);
    process.exit(1);
  }

  // Analyze chunks
  const results = [];
  let totalRaw = 0;
  let totalGzip = 0;

  for (const filePath of jsFiles) {
    const fileName = path.basename(filePath);
    const chunkName = getChunkName(fileName);
    const rawSize = fs.statSync(filePath).size;
    const gzipSize = getGzipSize(filePath);
    
    totalRaw += rawSize;
    totalGzip += gzipSize;

    const budget = chunkBudgets[chunkName];
    if (budget) {
      const rawPercent = rawSize / budget.raw;
      const gzipPercent = gzipSize / budget.gzip;
      const maxPercent = Math.max(rawPercent, gzipPercent);
      
      results.push({
        name: chunkName,
        fileName,
        rawSize,
        gzipSize,
        rawBudget: budget.raw,
        gzipBudget: budget.gzip,
        rawPercent,
        gzipPercent,
        maxPercent,
        notes: budget.notes,
      });
    } else {
      results.push({
        name: chunkName,
        fileName,
        rawSize,
        gzipSize,
        rawBudget: null,
        gzipBudget: null,
        rawPercent: 0,
        gzipPercent: 0,
        maxPercent: 0,
        notes: 'No budget defined',
      });
    }
  }

  // Sort by percentage of budget (highest first)
  results.sort((a, b) => b.maxPercent - a.maxPercent);

  // Print results
  console.log(`${colors.gray}Chunk Analysis:${colors.reset}`);
  console.log(`${colors.gray}${'─'.repeat(100)}${colors.reset}`);
  console.log(
    `${colors.gray}${'Chunk'.padEnd(25)} ${'Raw Size'.padEnd(15)} ${'Gzip Size'.padEnd(15)} ${'Budget %'.padEnd(12)} ${'Status'}${colors.reset}`
  );
  console.log(`${colors.gray}${'─'.repeat(100)}${colors.reset}`);

  let errors = 0;
  let warnings = 0;

  for (const result of results) {
    const rawStatus = result.rawBudget 
      ? result.rawSize > result.rawBudget 
        ? 'EXCEEDED' 
        : result.rawSize > result.rawBudget * 0.9 
          ? 'WARNING' 
          : 'OK'
      : 'N/A';
    
    const gzipStatus = result.gzipBudget
      ? result.gzipSize > result.gzipBudget
        ? 'EXCEEDED'
        : result.gzipSize > result.gzipBudget * 0.9
          ? 'WARNING'
          : 'OK'
      : 'N/A';

    const status = rawStatus === 'EXCEEDED' || gzipStatus === 'EXCEEDED' 
      ? 'EXCEEDED' 
      : rawStatus === 'WARNING' || gzipStatus === 'WARNING'
        ? 'WARNING'
        : 'OK';

    if (status === 'EXCEEDED') errors++;
    if (status === 'WARNING') warnings++;

    const statusColor = status === 'EXCEEDED' 
      ? colors.red 
      : status === 'WARNING' 
        ? colors.yellow 
        : colors.green;
    
    const percentStr = result.maxPercent > 0 
      ? `${(result.maxPercent * 100).toFixed(1)}%`
      : 'N/A';

    console.log(
      `${result.name.padEnd(25)} ` +
      `${formatBytes(result.rawSize).padEnd(15)} ` +
      `${formatBytes(result.gzipSize).padEnd(15)} ` +
      `${percentStr.padEnd(12)} ` +
      `${statusColor}${status}${colors.reset}`
    );

    if (result.notes && result.notes !== 'No budget defined') {
      console.log(`${colors.gray}  → ${result.notes}${colors.reset}`);
    }
  }

  console.log(`${colors.gray}${'─'.repeat(100)}${colors.reset}`);
  
  // Total summary
  console.log(`\n${colors.blue}Total Bundle Size:${colors.reset}`);
  console.log(`  Raw:  ${formatBytes(totalRaw)} (budget: ${formatBytes(budgets.total?.raw || 2500000)})`);
  console.log(`  Gzip: ${formatBytes(totalGzip)} (budget: ${formatBytes(budgets.total?.gzip || 700000)})`);

  // Summary
  console.log(`\n${colors.blue}Summary:${colors.reset}`);
  console.log(`  Total chunks: ${results.length}`);
  console.log(`  ${colors.red}Errors: ${errors}${colors.reset}`);
  console.log(`  ${colors.yellow}Warnings: ${warnings}${colors.reset}`);
  console.log(`  ${colors.green}OK: ${results.length - errors - warnings}${colors.reset}`);

  // Exit code
  if (errors > 0) {
    console.log(`\n${colors.red}✗ Bundle size check FAILED (${errors} errors)${colors.reset}`);
    process.exit(1);
  } else if (warnings > 0 && isStrict) {
    console.log(`\n${colors.yellow}⚠ Bundle size check has warnings (${warnings} warnings in strict mode)${colors.reset}`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`\n${colors.yellow}⚠ Bundle size check passed with ${warnings} warnings${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.green}✓ All bundle size checks passed${colors.reset}`);
    process.exit(0);
  }
}

checkBundleSize().catch(err => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
