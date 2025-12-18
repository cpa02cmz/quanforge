#!/usr/bin/env node

/**
 * Enhanced Edge Optimization Script
 * Optimizes the application for Vercel Edge deployment with advanced caching and performance improvements
 */

const fs = require('fs');
const path = require('path');
const { gzipSync, brotliCompressSync } = require('zlib');

class EdgeOptimizer {
  constructor() {
    this.buildDir = path.join(process.cwd(), 'dist');
    this.optimizations = {
      compression: true,
      cacheHeaders: true,
      bundleAnalysis: true,
      edgeManifest: true,
      preloading: true,
    };
    this.stats = {
      filesProcessed: 0,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      optimizationsApplied: [],
    };
  }

  async optimize() {
    console.log('🚀 Starting Enhanced Edge Optimization...');
    
    try {
      // Check if build directory exists
      if (!fs.existsSync(this.buildDir)) {
        throw new Error('Build directory not found. Run `npm run build` first.');
      }

      // Apply optimizations
      await this.applyCompression();
      await this.generateEdgeManifest();
      await this.optimizeCacheHeaders();
      await this.generatePreloadHints();
      await this.analyzeBundles();

      // Generate optimization report
      this.generateReport();

      console.log('✅ Edge optimization completed successfully!');
      console.log(`📊 Processed ${this.stats.filesProcessed} files`);
      console.log(`📦 Compression ratio: ${(this.stats.compressionRatio * 100).toFixed(2)}%`);
      console.log(`⚡ Optimizations applied: ${this.stats.optimizationsApplied.join(', ')}`);

    } catch (error) {
      console.error('❌ Edge optimization failed:', error.message);
      process.exit(1);
    }
  }

  async applyCompression() {
    if (!this.optimizations.compression) return;

    console.log('🗜️  Applying compression optimization...');

    const staticDir = path.join(this.buildDir, 'static');
    if (!fs.existsSync(staticDir)) return;

    const processFile = (filePath) => {
      try {
        const content = fs.readFileSync(filePath);
        const originalSize = content.length;
        this.stats.originalSize += originalSize;

        // Apply Brotli compression for better edge performance
        const brotliCompressed = brotliCompressSync(content, {
          params: {
            [require('zlib').constants.BROTLI_PARAM_QUALITY]: 11,
            [require('zlib').constants.BROTLI_PARAM_MODE]: require('zlib').constants.BROTLI_MODE_TEXT,
          }
        });

        // Apply Gzip as fallback
        const gzipCompressed = gzipSync(content, { level: 9 });

        // Write compressed files
        const brotliPath = filePath + '.br';
        const gzipPath = filePath + '.gz';

        fs.writeFileSync(brotliPath, brotliCompressed);
        fs.writeFileSync(gzipPath, gzipCompressed);

        const minCompressedSize = Math.min(brotliCompressed.length, gzipCompressed.length);
        this.stats.compressedSize += minCompressedSize;

        this.stats.filesProcessed++;
      } catch (error) {
        console.warn(`Warning: Failed to compress ${filePath}:`, error.message);
      }
    };

    // Process JS and CSS files
    this.processFiles(staticDir, ['.js', '.css'], processFile);
    this.stats.optimizationsApplied.push('compression');
  }

  async generateEdgeManifest() {
    if (!this.optimizations.edgeManifest) return;

    console.log('📋 Generating edge manifest...');

    const manifest = {
      version: '3.0.0',
      buildTime: new Date().toISOString(),
      edgeRegions: ['hkg1', 'iad1', 'sin1', 'fra1', 'sfo1', 'arn1', 'gru1', 'cle1', 'syd1', 'nrt1'],
      assets: {},
      routes: {},
      cacheStrategy: {
        static: 'max-age=31536000, immutable',
        api: 'max-age=600, s-maxage=1800, stale-while-revalidate=600',
        pages: 'max-age=900, s-maxage=3600, stale-while-revalidate=900',
      },
      compression: {
        brotli: true,
        gzip: true,
        threshold: 256,
      },
      optimizations: {
        treeShaking: true,
        codeSplitting: true,
        deadCodeElimination: true,
        minification: 'aggressive',
      }
    };

    // Scan assets and create manifest entries
    const staticDir = path.join(this.buildDir, 'static');
    if (fs.existsSync(staticDir)) {
      this.scanDirectory(staticDir, '', (filePath, relativePath) => {
        const stats = fs.statSync(filePath);
        manifest.assets[relativePath] = {
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          type: path.extname(filePath).slice(1),
        };
      });
    }

    // Write edge manifest
    const manifestPath = path.join(this.buildDir, 'edge-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    this.stats.optimizationsApplied.push('edge-manifest');
  }

  async optimizeCacheHeaders() {
    if (!this.optimizations.cacheHeaders) return;

    console.log('🔧 Optimizing cache headers...');

    const headersConfig = {
      version: '3.0.0',
      rules: [
        {
          source: '/static/(.*)',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
            { key: 'X-Edge-Cache-Tag', value: 'static-asset' },
            { key: 'Vary', value: 'Accept-Encoding' },
          ]
        },
        {
          source: '/api/robots/(.*)',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=900, stale-while-revalidate=300' },
            { key: 'X-Edge-Cache-Tag', value: 'api-robots' },
          ]
        },
        {
          source: '/api/strategies/(.*)',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=600, s-maxage=1800, stale-while-revalidate=600' },
            { key: 'X-Edge-Cache-Tag', value: 'api-strategies' },
          ]
        },
        {
          source: '/(dashboard|generator)/',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=180, s-maxage=600, stale-while-revalidate=180' },
            { key: 'X-Edge-Cache-Tag', value: 'critical-page' },
          ]
        }
      ]
    };

    const headersPath = path.join(this.buildDir, 'edge-headers.json');
    fs.writeFileSync(headersPath, JSON.stringify(headersConfig, null, 2));

    this.stats.optimizationsApplied.push('cache-headers');
  }

  async generatePreloadHints() {
    if (!this.optimizations.preloading) return;

    console.log('⚡ Generating preload hints...');

    const criticalAssets = [
      '/static/js/main.js',
      '/static/css/main.css',
      '/static/fonts/inter.woff2',
    ];

    const preloadHints = criticalAssets.map(asset => ({
      rel: 'preload',
      href: asset,
      as: this.getAssetType(asset),
      type: this.getAssetMimeType(asset),
      crossorigin: 'anonymous',
    }));

    const preconnectHints = [
      { href: 'https://fonts.googleapis.com', crossorigin: 'anonymous' },
      { href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
      { href: 'https://*.supabase.co', crossorigin: 'anonymous' },
    ];

    const hints = {
      preload: preloadHints,
      preconnect: preconnectHints,
      dnsPrefetch: [
        { href: 'https://www.google-analytics.com' },
        { href: 'https://generativelanguage.googleapis.com' },
      ]
    };

    const hintsPath = path.join(this.buildDir, 'preload-hints.json');
    fs.writeFileSync(hintsPath, JSON.stringify(hints, null, 2));

    this.stats.optimizationsApplied.push('preload-hints');
  }

  async analyzeBundles() {
    if (!this.optimizations.bundleAnalysis) return;

    console.log('📊 Analyzing bundles...');

    const analysis = {
      timestamp: new Date().toISOString(),
      bundles: {},
      recommendations: [],
    };

    const staticDir = path.join(this.buildDir, 'static');
    if (fs.existsSync(staticDir)) {
      this.processFiles(staticDir, ['.js'], (filePath) => {
        const stats = fs.statSync(filePath);
        const relativePath = path.relative(this.buildDir, filePath);
        const sizeKB = Math.round(stats.size / 1024);

        analysis.bundles[relativePath] = {
          size: stats.size,
          sizeKB,
          compressed: fs.existsSync(filePath + '.gz') ? fs.statSync(filePath + '.gz').size : null,
        };

        // Generate recommendations
        if (sizeKB > 500) {
          analysis.recommendations.push(`Consider code splitting for ${relativePath} (${sizeKB}KB)`);
        }
      });
    }

    const analysisPath = path.join(this.buildDir, 'bundle-analysis.json');
    fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2));

    this.stats.optimizationsApplied.push('bundle-analysis');
  }

  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.stats,
      optimizations: this.optimizations,
      edgeReady: true,
      recommendations: this.generateRecommendations(),
    };

    const reportPath = path.join(this.buildDir, 'edge-optimization-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('📄 Optimization report generated:', reportPath);
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.stats.compressionRatio < 0.7) {
      recommendations.push('Consider enabling more aggressive compression');
    }

    if (this.stats.filesProcessed > 100) {
      recommendations.push('Consider implementing more granular code splitting');
    }

    recommendations.push('Enable Edge Functions for dynamic content');
    recommendations.push('Implement CDN-level caching for static assets');
    recommendations.push('Use Vercel Analytics for performance monitoring');

    return recommendations;
  }

  // Helper methods
  processFiles(dir, extensions, callback) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.processFiles(filePath, extensions, callback);
      } else if (extensions.includes(path.extname(file))) {
        callback(filePath, file);
      }
    }
  }

  scanDirectory(dir, relativePath, callback) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      const fileRelativePath = path.join(relativePath, file);
      
      if (stat.isDirectory()) {
        this.scanDirectory(filePath, fileRelativePath, callback);
      } else {
        callback(filePath, fileRelativePath);
      }
    }
  }

  getAssetType(asset) {
    const ext = path.extname(asset);
    switch (ext) {
      case '.js': return 'script';
      case '.css': return 'style';
      case '.woff2':
      case '.woff':
      case '.ttf': return 'font';
      default: return 'fetch';
    }
  }

  getAssetMimeType(asset) {
    const ext = path.extname(asset);
    switch (ext) {
      case '.js': return 'application/javascript';
      case '.css': return 'text/css';
      case '.woff2': return 'font/woff2';
      case '.woff': return 'font/woff';
      case '.ttf': return 'font/ttf';
      default: return 'application/octet-stream';
    }
  }
}

// Run optimization if called directly
if (require.main === module) {
  const optimizer = new EdgeOptimizer();
  optimizer.optimize().catch(console.error);
}

module.exports = EdgeOptimizer;