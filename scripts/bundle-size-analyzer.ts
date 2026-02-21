/**
 * Bundle Size Analyzer
 * Analyzes the production build bundle sizes and provides optimization recommendations
 * 
 * Usage: npx tsx scripts/bundle-size-analyzer.ts
 * 
 * @module scripts/bundle-size-analyzer
 */

import { readdirSync, statSync, existsSync } from 'fs';
import { join, extname } from 'path';

// ========== TYPES ==========

interface BundleStats {
  name: string;
  size: number;
  gzippedSize: number;
  type: 'js' | 'css' | 'asset';
  chunk: string;
}

interface ChunkGroup {
  name: string;
  totalSize: number;
  files: BundleStats[];
}

interface AnalysisResult {
  totalSize: number;
  totalGzipped: number;
  chunks: ChunkGroup[];
  largeBundles: BundleStats[];
  recommendations: string[];
  score: number;
}

// ========== CONSTANTS ==========

const SIZE_THRESHOLDS = {
  WARNING: 100 * 1024, // 100 KB
  LARGE: 200 * 1024,   // 200 KB
  HUGE: 300 * 1024,    // 300 KB
};

const GZIP_RATIO = 0.3; // Approximate gzip compression ratio

// ========== UTILITIES ==========

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getChunkCategory(filename: string): string {
  if (filename.includes('ai-') || filename.includes('gemini')) return 'AI Services';
  if (filename.includes('react-')) return 'React';
  if (filename.includes('supabase-')) return 'Supabase';
  if (filename.includes('chart-')) return 'Charts';
  if (filename.includes('vendor-')) return 'Vendor';
  if (filename.includes('services-')) return 'Services';
  if (filename.includes('component-')) return 'Components';
  if (filename.includes('route-')) return 'Routes';
  if (filename.includes('utils-')) return 'Utils';
  if (filename.includes('security-')) return 'Security';
  return 'Other';
}

function analyzeDirectory(dir: string, baseDir: string = dir): BundleStats[] {
  const results: BundleStats[] = [];
  
  if (!existsSync(dir)) {
    return results;
  }

  const files = readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = join(dir, file.name);
    
    if (file.isDirectory()) {
      // Recursively analyze subdirectories
      results.push(...analyzeDirectory(fullPath, baseDir));
      continue;
    }
    
    const ext = extname(file.name);
    
    if (ext !== '.js' && ext !== '.css') continue;
    
    const stats = statSync(fullPath);
    const size = stats.size;
    
    results.push({
      name: file.name,
      size,
      gzippedSize: Math.round(size * GZIP_RATIO),
      type: ext === '.js' ? 'js' : 'css',
      chunk: getChunkCategory(file.name),
    });
  }
  
  return results.sort((a, b) => b.size - a.size);
}

function generateRecommendations(largeBundles: BundleStats[], totalSize: number): string[] {
  const recommendations: string[] = [];
  
  // Check for very large bundles
  for (const bundle of largeBundles) {
    if (bundle.size > SIZE_THRESHOLDS.HUGE) {
      recommendations.push(`🔴 CRITICAL: ${bundle.name} is ${formatSize(bundle.size)}. Consider code splitting or lazy loading.`);
    } else if (bundle.size > SIZE_THRESHOLDS.LARGE) {
      recommendations.push(`🟡 WARNING: ${bundle.name} is ${formatSize(bundle.size)}. Consider optimization.`);
    }
  }
  
  // Check total bundle size
  if (totalSize > 3 * 1024 * 1024) { // 3 MB
    recommendations.push('🔴 Total bundle size exceeds 3 MB. Consider aggressive code splitting.');
  } else if (totalSize > 2 * 1024 * 1024) { // 2 MB
    recommendations.push('🟡 Total bundle size exceeds 2 MB. Review chunking strategy.');
  }
  
  // Check for duplicate dependencies
  const chunkGroups = new Map<string, number>();
  for (const bundle of largeBundles) {
    const chunk = bundle.chunk;
    chunkGroups.set(chunk, (chunkGroups.get(chunk) || 0) + bundle.size);
  }
  
  for (const [chunk, size] of chunkGroups) {
    if (size > 500 * 1024 && chunk !== 'Vendor' && chunk !== 'React') {
      recommendations.push(`💡 Consider splitting ${chunk} category (${formatSize(size)}) into smaller chunks.`);
    }
  }
  
  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push('✅ Bundle sizes are within acceptable limits.');
    recommendations.push('💡 Continue monitoring bundle sizes as the application grows.');
  }
  
  return recommendations;
}

function calculateScore(largeBundles: BundleStats[], totalSize: number): number {
  let score = 100;
  
  // Penalize for large bundles
  for (const bundle of largeBundles) {
    if (bundle.size > SIZE_THRESHOLDS.HUGE) score -= 15;
    else if (bundle.size > SIZE_THRESHOLDS.LARGE) score -= 10;
    else if (bundle.size > SIZE_THRESHOLDS.WARNING) score -= 5;
  }
  
  // Penalize for total size
  if (totalSize > 3 * 1024 * 1024) score -= 20;
  else if (totalSize > 2 * 1024 * 1024) score -= 10;
  else if (totalSize > 1.5 * 1024 * 1024) score -= 5;
  
  return Math.max(0, score);
}

// ========== MAIN ANALYSIS ==========

function analyzeBundles(): AnalysisResult {
  const distDir = join(process.cwd(), 'dist', 'assets', 'js');
  const stats = analyzeDirectory(distDir);
  
  const totalSize = stats.reduce((sum, s) => sum + s.size, 0);
  const totalGzipped = stats.reduce((sum, s) => sum + s.gzippedSize, 0);
  
  const largeBundles = stats.filter(s => s.size > SIZE_THRESHOLDS.WARNING);
  
  // Group by chunk category
  const chunkGroups = new Map<string, ChunkGroup>();
  for (const stat of stats) {
    const chunk = stat.chunk;
    if (!chunkGroups.has(chunk)) {
      chunkGroups.set(chunk, { name: chunk, totalSize: 0, files: [] });
    }
    const group = chunkGroups.get(chunk)!;
    group.totalSize += stat.size;
    group.files.push(stat);
  }
  
  const chunks = Array.from(chunkGroups.values()).sort((a, b) => b.totalSize - a.totalSize);
  const recommendations = generateRecommendations(largeBundles, totalSize);
  const score = calculateScore(largeBundles, totalSize);
  
  return {
    totalSize,
    totalGzipped,
    chunks,
    largeBundles,
    recommendations,
    score,
  };
}

// ========== OUTPUT ==========

function printReport(result: AnalysisResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 BUNDLE SIZE ANALYSIS REPORT');
  console.log('='.repeat(60));
  
  console.log(`\n📈 Overall Score: ${result.score}/100`);
  console.log(`📦 Total Size: ${formatSize(result.totalSize)} (${formatSize(result.totalGzipped)} gzipped)`);
  console.log(`📄 Total Chunks: ${result.chunks.length}`);
  
  console.log('\n📁 Largest Chunks by Category:');
  console.log('-'.repeat(40));
  for (const chunk of result.chunks.slice(0, 10)) {
    const percentage = ((chunk.totalSize / result.totalSize) * 100).toFixed(1);
    console.log(`  ${chunk.name}: ${formatSize(chunk.totalSize)} (${percentage}%)`);
  }
  
  console.log('\n⚠️  Large Bundles (>100 KB):');
  console.log('-'.repeat(40));
  if (result.largeBundles.length === 0) {
    console.log('  ✅ No large bundles detected!');
  } else {
    for (const bundle of result.largeBundles) {
      const icon = bundle.size > SIZE_THRESHOLDS.HUGE ? '🔴' : 
                   bundle.size > SIZE_THRESHOLDS.LARGE ? '🟡' : '🟢';
      console.log(`  ${icon} ${bundle.name}: ${formatSize(bundle.size)} (${formatSize(bundle.gzippedSize)} gzipped)`);
    }
  }
  
  console.log('\n💡 Recommendations:');
  console.log('-'.repeat(40));
  for (const rec of result.recommendations) {
    console.log(`  ${rec}`);
  }
  
  console.log('\n' + '='.repeat(60));
}

// ========== EXECUTION ==========

function main(): void {
  console.log('🔍 Analyzing bundle sizes...');
  
  try {
    const result = analyzeBundles();
    printReport(result);
    
    // Exit with error code if score is too low
    if (result.score < 70) {
      console.error('\n❌ Bundle size score is too low. Please optimize before deploying.');
      process.exit(1);
    }
    
    console.log('\n✅ Bundle analysis complete.');
  } catch (error) {
    console.error('❌ Error analyzing bundles:', error);
    process.exit(1);
  }
}

main();
