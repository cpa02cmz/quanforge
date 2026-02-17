#!/usr/bin/env node

/**
 * Bundle Size Validator
 * 
 * Validates build output against defined size budgets.
 * Run after build: node scripts/validate-bundle-size.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUDGET_FILE = path.join(__dirname, '..', 'bundle-size-budget.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const MANIFEST_FILE = path.join(__dirname, '..', 'dist', '.vite', 'manifest.json');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function loadBudgets() {
  try {
    const content = fs.readFileSync(BUDGET_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading budget file:${colors.reset}`, error.message);
    process.exit(1);
  }
}

function loadManifest() {
  try {
    const content = fs.readFileSync(MANIFEST_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading manifest:${colors.reset}`, error.message);
    process.exit(1);
  }
}

function getChunkSize(filename) {
  try {
    const filepath = path.join(DIST_DIR, filename);
    const stats = fs.statSync(filepath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

function estimateGzipSize(bytes) {
  // Rough estimation: gzipped size is typically 25-30% of original
  return Math.floor(bytes * 0.28);
}

function validateBundles() {
  const budgets = loadBudgets();
  const manifest = loadManifest();
  
  console.log(`\n${colors.blue}📦 Bundle Size Validation${colors.reset}\n`);
  console.log(`${colors.gray}Budget file: ${BUDGET_FILE}${colors.reset}`);
  console.log(`${colors.gray}Dist directory: ${DIST_DIR}${colors.reset}\n`);

  const results = {
    passed: [],
    warnings: [],
    failed: []
  };

  let totalRaw = 0;
  let totalGzip = 0;

  // Check each budget
  for (const [chunkName, budget] of Object.entries(budgets.budgets)) {
    // Find matching file in manifest
    let matchingFile = null;
    for (const [key, value] of Object.entries(manifest)) {
      if (value.file && value.file.includes(chunkName)) {
        matchingFile = value.file;
        break;
      }
    }

    if (!matchingFile) {
      console.log(`${colors.gray}⚪ ${chunkName}: Not found in build${colors.reset}`);
      continue;
    }

    const rawSize = getChunkSize(matchingFile);
    const gzipSize = estimateGzipSize(rawSize);
    
    totalRaw += rawSize;
    totalGzip += gzipSize;

    const rawLimit = budget.raw;
    const gzipLimit = budget.gzip;
    const rawPercent = (rawSize / rawLimit * 100).toFixed(1);
    const gzipPercent = (gzipSize / gzipLimit * 100).toFixed(1);

    const status = {
      name: chunkName,
      file: matchingFile,
      raw: rawSize,
      rawLimit,
      rawPercent,
      gzip: gzipSize,
      gzipLimit,
      gzipPercent,
      notes: budget.notes
    };

    // Only check raw size for failure (gzip estimation can be inaccurate)
    if (rawSize > rawLimit) {
      results.failed.push(status);
    } else if (rawSize > rawLimit * budgets.warningThreshold) {
      results.warnings.push(status);
    } else {
      results.passed.push(status);
    }
  }

  // Print results
  console.log(`${colors.green}✅ Passed (${results.passed.length}):${colors.reset}`);
  results.passed.forEach(r => {
    console.log(`  ${r.name}: ${formatBytes(r.raw)} / ${formatBytes(r.rawLimit)} (${r.rawPercent}%)`);
  });

  if (results.warnings.length > 0) {
    console.log(`\n${colors.yellow}⚠️  Warnings (${results.warnings.length}):${colors.reset}`);
    results.warnings.forEach(r => {
      console.log(`  ${r.name}: ${formatBytes(r.raw)} / ${formatBytes(r.rawLimit)} (${r.rawPercent}%)`);
      if (r.notes) console.log(`    ${colors.gray}Note: ${r.notes}${colors.reset}`);
    });
  }

  if (results.failed.length > 0) {
    console.log(`\n${colors.red}❌ Failed (${results.failed.length}):${colors.reset}`);
    results.failed.forEach(r => {
      console.log(`  ${r.name}: ${formatBytes(r.raw)} / ${formatBytes(r.rawLimit)} (${r.rawPercent}%) - EXCEEDS BUDGET`);
      if (r.notes) console.log(`    ${colors.gray}Note: ${r.notes}${colors.reset}`);
    });
  }

  // Check total budget
  const totalRawLimit = budgets.total.raw;
  const totalGzipLimit = budgets.total.gzip;
  const totalRawPercent = (totalRaw / totalRawLimit * 100).toFixed(1);
  const totalGzipPercent = (totalGzip / totalGzipLimit * 100).toFixed(1);

  console.log(`\n${colors.blue}📊 Total Bundle Size:${colors.reset}`);
  console.log(`  Raw: ${formatBytes(totalRaw)} / ${formatBytes(totalRawLimit)} (${totalRawPercent}%)`);
  console.log(`  Gzipped (est.): ${formatBytes(totalGzip)} / ${formatBytes(totalGzipLimit)} (${totalGzipPercent}%)`);

  // Summary
  console.log(`\n${colors.blue}📋 Summary:${colors.reset}`);
  console.log(`  Passed: ${results.passed.length}`);
  console.log(`  Warnings: ${results.warnings.length}`);
  console.log(`  Failed: ${results.failed.length}`);

  // Exit with error if any failures
  if (results.failed.length > 0) {
    console.log(`\n${colors.red}❌ Bundle size validation FAILED${colors.reset}`);
    console.log(`${colors.gray}Some chunks exceed their defined budgets.${colors.reset}\n`);
    process.exit(1);
  }

  if (results.warnings.length > 0) {
    console.log(`\n${colors.yellow}⚠️  Bundle size validation PASSED with warnings${colors.reset}\n`);
  } else {
    console.log(`\n${colors.green}✅ Bundle size validation PASSED${colors.reset}\n`);
  }

  process.exit(0);
}

validateBundles();
