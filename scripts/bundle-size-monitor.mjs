#!/usr/bin/env node

/**
 * Bundle Size Monitor
 * 
 * Monitors bundle sizes and enforces performance budgets.
 * Exits with error code 1 if budgets are exceeded.
 * 
 * Usage: node scripts/bundle-size-monitor.mjs
 */

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

// Performance budgets (in KB)
const BUDGETS = {
  // Individual chunk budgets
  'ai-vendor': 300,           // 300KB - AI libraries are large
  'chart-vendor': 250,        // 250KB - Chart libraries
  'react-core': 200,          // 200KB - React ecosystem
  'vendor-misc': 200,         // 200KB - Miscellaneous vendors
  'supabase-vendor': 150,     // 150KB - Supabase client
  'components-core': 100,     // 100KB - Core components
  'services-misc': 100,       // 100KB - Services
  'services-data': 100,       // 100KB - Data services
  
  // Default budget for any other chunks
  default: 150
};

// Total bundle budget (in KB)
const TOTAL_BUDGET = 2000; // 2MB

// Initial JS budget (main + critical chunks, in KB)
const INITIAL_JS_BUDGET = 500; // 500KB

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function formatSize(bytes) {
  const kb = bytes / 1024;
  return `${kb.toFixed(2)} KB`;
}

function getChunkBudget(chunkName) {
  // Check exact match first
  if (BUDGETS[chunkName]) {
    return BUDGETS[chunkName];
  }
  
  // Check prefix match
  for (const [prefix, budget] of Object.entries(BUDGETS)) {
    if (chunkName.startsWith(prefix)) {
      return budget;
    }
  }
  
  return BUDGETS.default;
}

function analyzeBundles() {
  const distPath = join(process.cwd(), 'dist', 'assets', 'js');
  
  console.log(`${colors.cyan}📦 Bundle Size Monitor${colors.reset}\n`);
  
  try {
    const files = readdirSync(distPath);
    const jsFiles = files.filter(f => f.endsWith('.js'));
    
    if (jsFiles.length === 0) {
      console.log(`${colors.yellow}⚠️  No JS bundles found in ${distPath}${colors.reset}`);
      console.log('   Run "npm run build" first.\n');
      process.exit(0);
    }
    
    let totalSize = 0;
    let initialJSSize = 0;
    const violations = [];
    const warnings = [];
    
    console.log(`${colors.blue}Chunk Analysis:${colors.reset}`);
    console.log('─'.repeat(70));
    
    jsFiles.forEach(file => {
      const filePath = join(distPath, file);
      const stats = statSync(filePath);
      const sizeKB = stats.size / 1024;
      const chunkName = file.replace(/-[a-zA-Z0-9]+\.js$/, '');
      const budget = getChunkBudget(chunkName);
      
      totalSize += sizeKB;
      
      // Track initial JS (main + react + router)
      if (['main', 'react-core', 'react-router'].some(prefix => chunkName.startsWith(prefix))) {
        initialJSSize += sizeKB;
      }
      
      const percentage = (sizeKB / budget * 100).toFixed(1);
      let status = colors.green + '✓' + colors.reset;
      
      if (sizeKB > budget) {
        status = colors.red + '✗' + colors.reset;
        violations.push({
          file,
          size: sizeKB,
          budget,
          percentage
        });
      } else if (sizeKB > budget * 0.9) {
        status = colors.yellow + '⚠' + colors.reset;
        warnings.push({
          file,
          size: sizeKB,
          budget,
          percentage
        });
      }
      
      console.log(
        `  ${status} ${chunkName.padEnd(25)} ` +
        `${formatSize(stats.size).padStart(10)} / ` +
        `${budget} KB `.padStart(10) + 
        `(${percentage}%)`
      );
    });
    
    console.log('─'.repeat(70));
    
    // Summary
    console.log(`\n${colors.blue}Summary:${colors.reset}`);
    console.log(`  Total Bundle Size: ${totalSize.toFixed(2)} KB / ${TOTAL_BUDGET} KB (${(totalSize/TOTAL_BUDGET*100).toFixed(1)}%)`);
    console.log(`  Initial JS Size:   ${initialJSSize.toFixed(2)} KB / ${INITIAL_JS_BUDGET} KB (${(initialJSSize/INITIAL_JS_BUDGET*100).toFixed(1)}%)`);
    console.log(`  Total Chunks:      ${jsFiles.length}`);
    
    if (violations.length > 0) {
      console.log(`\n${colors.red}❌ Budget Violations:${colors.reset}`);
      violations.forEach(v => {
        console.log(`   • ${v.file}: ${v.size.toFixed(2)} KB exceeds ${v.budget} KB budget`);
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\n${colors.yellow}⚠️  Warnings (within 10% of budget):${colors.reset}`);
      warnings.forEach(w => {
        console.log(`   • ${w.file}: ${w.size.toFixed(2)} KB (${w.percentage}% of budget)`);
      });
    }
    
    // Final status
    console.log('');
    if (violations.length > 0) {
      console.log(`${colors.red}✗ Bundle size check failed with ${violations.length} violation(s)${colors.reset}\n`);
      process.exit(1);
    } else if (warnings.length > 0) {
      console.log(`${colors.yellow}⚠ Bundle size check passed with ${warnings.length} warning(s)${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.green}✓ All bundle size budgets met${colors.reset}\n`);
      process.exit(0);
    }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`${colors.red}Error: Build directory not found at ${distPath}${colors.reset}`);
      console.log('Run "npm run build" first.\n');
      process.exit(1);
    }
    console.error(`${colors.red}Error analyzing bundles:${colors.reset}`, error.message);
    process.exit(1);
  }
}

analyzeBundles();
