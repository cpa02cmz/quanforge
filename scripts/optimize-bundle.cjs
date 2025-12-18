#!/usr/bin/env node

/**
 * Bundle Optimization Script
 * Analyzes production bundles for optimization opportunities
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class BundleOptimizer {
  constructor() {
    this.CHUNK_SIZE_LIMITS = {
      critical: 500000,  // 500KB
      warning: 300000,   // 300KB
      info: 150000       // 150KB
    };
  }

  async analyzeAndOptimize() {
    console.log('🔧 Starting bundle analysis...');
    
    const startTime = Date.now();
    
    // Check if build exists
    if (!fs.existsSync('dist')) {
      console.log('📦 No build found, running production build first...');
      try {
        execSync('npm run build:production', { stdio: 'inherit' });
      } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
      }
    }

    // Analyze bundle
    const manifestPath = 'dist/.vite/manifest.json';
    
    if (!fs.existsSync(manifestPath)) {
      console.error('❌ Build manifest not found');
      process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const chunks = this.analyzeChunks(manifest);
    
    // Generate optimization recommendations
    const optimizations = this.generateOptimizations(chunks);
    
    // Identify large chunks
    const largeChunks = this.identifyLargeChunks(chunks);
    
    // Calculate performance metrics
    const performance = this.calculatePerformanceMetrics(chunks);
    
    const buildTime = Date.now() - startTime;
    
    const report = {
      timestamp: new Date().toISOString(),
      buildTime,
      totalSize: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
      gzippedSize: chunks.reduce((sum, chunk) => sum + chunk.gzippedSize, 0),
      chunks,
      largeChunks,
      optimizations,
      performance
    };

    // Save report
    this.saveReport(report);
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }

  analyzeChunks(manifest) {
    const chunks = [];

    for (const [name, entry] of Object.entries(manifest)) {
      if (entry.file && entry.file.endsWith('.js')) {
        const filePath = path.join('dist', entry.file);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          
          chunks.push({
            name,
            size: stats.size,
            gzippedSize: Math.floor(stats.size * 0.3), // Estimate
            modules: entry.imports || []
          });
        }
      }
    }

    // Sort by size (largest first)
    chunks.sort((a, b) => b.size - a.size);
    
    return chunks;
  }

  generateOptimizations(chunks) {
    const optimizations = [];

    // Check total bundle size
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    if (totalSize > 2000000) { // 2MB
      optimizations.push({
        type: 'critical',
        message: `Total bundle size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds recommended limit`,
        impact: 'high',
        effort: 'moderate'
      });
    }

    // Check individual chunk sizes
    chunks.forEach(chunk => {
      if (chunk.size > this.CHUNK_SIZE_LIMITS.critical) {
        optimizations.push({
          type: 'critical',
          message: `Chunk "${chunk.name}" is ${(chunk.size / 1024).toFixed(2)}KB - should be split`,
          impact: 'high',
          effort: 'moderate'
        });
      } else if (chunk.size > this.CHUNK_SIZE_LIMITS.warning) {
        optimizations.push({
          type: 'warning',
          message: `Chunk "${chunk.name}" is ${(chunk.size / 1024).toFixed(2)}KB - consider splitting`,
          impact: 'medium',
          effort: 'easy'
        });
      }
    });

    // Check for optimization opportunities
    const vendorChunks = chunks.filter(chunk => chunk.name.includes('vendor'));
    if (vendorChunks.length > 3) {
      optimizations.push({
        type: 'warning',
        message: `Too many vendor chunks (${vendorChunks.length}) - consider consolidation`,
        impact: 'medium',
        effort: 'easy'
      });
    }

    return optimizations;
  }

  identifyLargeChunks(chunks) {
    return chunks
      .filter(chunk => chunk.size > this.CHUNK_SIZE_LIMITS.warning)
      .map(chunk => ({
        chunk,
        recommendations: this.getChunkRecommendations(chunk)
      }));
  }

  getChunkRecommendations(chunk) {
    const recommendations = [];
    const sizeKB = chunk.size / 1024;

    if (sizeKB > 500) {
      recommendations.push('Split this chunk into smaller pieces');
      recommendations.push('Consider lazy loading non-critical modules');
    }

    if (chunk.name.includes('vendor')) {
      recommendations.push('Move vendor dependencies to separate chunks');
      recommendations.push('Use dynamic imports for heavy libraries');
    }

    if (chunk.name.includes('react')) {
      recommendations.push('Use React.lazy() for code splitting');
    }

    if (chunk.name.includes('recharts')) {
      recommendations.push('Lazy load chart components only when needed');
    }

    if (chunk.name.includes('supabase')) {
      recommendations.push('Split Supabase client and real-time modules');
    }

    return recommendations;
  }

  calculatePerformanceMetrics(chunks) {
    const totalChunks = chunks.length;
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const averageChunkSize = totalSize / totalChunks;
    const largestChunkSize = Math.max(...chunks.map(chunk => chunk.size));
    const totalGzippedSize = chunks.reduce((sum, chunk) => sum + chunk.gzippedSize, 0);
    const compressionRatio = totalGzippedSize / totalSize;

    return {
      totalChunks,
      averageChunkSize,
      largestChunkSize,
      compressionRatio
    };
  }

  saveReport(report) {
    const reportPath = 'dist/bundle-optimization-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Optimization report saved to ${reportPath}`);
  }

  printSummary(report) {
    console.log('\n📊 Bundle Optimization Summary');
    console.log('================================');
    
    console.log(`📦 Total Size: ${(report.totalSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🗜️  Gzipped: ${(report.gzippedSize / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🧩 Total Chunks: ${report.performance.totalChunks}`);
    console.log(`📏 Average Chunk: ${(report.performance.averageChunkSize / 1024).toFixed(2)}KB`);
    console.log(`🏆 Largest Chunk: ${(report.performance.largestChunkSize / 1024).toFixed(2)}KB`);
    console.log(`🗜️  Compression Ratio: ${(report.performance.compressionRatio * 100).toFixed(1)}%`);
    console.log(`⏱️  Build Time: ${report.buildTime.toFixed(2)}ms`);

    if (report.optimizations.length > 0) {
      console.log('\n⚠️  Optimization Recommendations:');
      report.optimizations.forEach(opt => {
        const icon = opt.type === 'critical' ? '🚨' : opt.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${icon} ${opt.message} (${opt.impact} impact, ${opt.effort} effort)`);
      });
    }

    if (report.largeChunks.length > 0) {
      console.log('\n📏 Large Chunks:');
      report.largeChunks.forEach(({ chunk, recommendations }) => {
        console.log(`  📦 ${chunk.name}: ${(chunk.size / 1024).toFixed(2)}KB`);
        recommendations.forEach(rec => {
          console.log(`    💡 ${rec}`);
        });
      });
    }

    console.log('\n✅ Bundle analysis complete!');
  }
}

// Execute if run directly
if (require.main === module) {
  const optimizer = new BundleOptimizer();
  
  optimizer.analyzeAndOptimize()
    .then(report => {
      const criticalIssues = report.optimizations.filter(opt => opt.type === 'critical').length;
      process.exit(criticalIssues > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Bundle optimization failed:', error);
      process.exit(1);
    });
}

module.exports = { BundleOptimizer };