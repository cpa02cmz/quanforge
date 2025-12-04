import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    outDir: 'dist',
    sourcemap: process.env['NODE_ENV'] !== 'production' ? 'hidden' : false,
    rollupOptions: {
      input: {
        main: './index.html'
      },
output: {
          manualChunks: (id) => {
            // Aggressive chunking for optimal bundle size and caching
            if (id.includes('node_modules')) {
              // AI services isolated for dynamic loading
              if (id.includes('@google/genai')) {
                return 'ai-services';
              }
              // Database services isolated
              if (id.includes('@supabase')) {
                return 'database-services';
              }
              // React core consolidated
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-core';
              }
              // Chart libraries isolated - loaded on demand
              if (id.includes('recharts')) {
                return 'chart-libs';
              }
              // Security utilities
              if (id.includes('dompurify') || id.includes('lz-string')) {
                return 'security-utils';
              }
              // All other vendor libraries
              return 'vendor-misc';
            }
            
            // Enhanced app chunks with granular separation
            if (id.includes('services/')) {
              // AI-specific services isolated for dynamic loading
              if (id.includes('gemini') || id.includes('ai') || id.includes('gpt')) {
                return 'services-ai';
              }
              // Database services consolidated
              if (id.includes('supabase') || id.includes('database') || id.includes('db')) {
                return 'services-database';
              }
              // Cache and performance services consolidated
              if (id.includes('cache') || id.includes('performance') || id.includes('optimization')) {
                return 'services-performance';
              }
              // Security services consolidated
              if (id.includes('security') || id.includes('auth') || id.includes('validation')) {
                return 'services-security';
              }
              // Edge services consolidated
              if (id.includes('edge') || id.includes('cdn') || id.includes('vercel')) {
                return 'services-edge';
              }
              // Core services
              return 'services-core';
            }
            
            if (id.includes('components/')) {
              // Heavy components isolated
              if (id.includes('ChatInterface')) {
                return 'component-chat';
              }
              if (id.includes('CodeEditor')) {
                return 'component-editor';
              }
              if (id.includes('Backtest') || id.includes('Simulation')) {
                return 'component-backtest';
              }
              if (id.includes('StrategyConfig')) {
                return 'component-config';
              }
              if (id.includes('Chart') || id.includes('Analysis')) {
                return 'component-charts';
              }
              if (id.includes('Market') || id.includes('Ticker')) {
                return 'component-market';
              }
              // UI components
              if (id.includes('Modal') || id.includes('Dialog') || id.includes('Toast')) {
                return 'component-ui';
              }
              // Core components
              return 'components-core';
            }
            
            // Route-based code splitting
            if (id.includes('pages/')) {
              if (id.includes('Generator')) {
                return 'route-generator';
              }
              if (id.includes('Dashboard')) {
                return 'route-dashboard';
              }
              if (id.includes('About') || id.includes('FAQ') || id.includes('Wiki')) {
                return 'route-static';
              }
              return 'pages';
            }
            
            if (id.includes('utils/')) {
              // Validation utilities
              if (id.includes('validation') || id.includes('security')) {
                return 'utils-validation';
              }
              // Performance utilities
              if (id.includes('performance') || id.includes('monitor') || id.includes('analytics')) {
                return 'utils-performance';
              }
              // SEO utilities
              if (id.includes('seo') || id.includes('meta') || id.includes('structured')) {
                return 'utils-seo';
              }
              // Core utilities
              return 'utils-core';
            }
            
            // Constants and translations
            if (id.includes('constants/') || id.includes('translations/')) {
              return 'assets-constants';
            }
            
            return 'chunk-default';
          },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || 'unknown';
          const info = name.split('.');
          const ext = info[info.length - 1] || 'unknown';
          
          // Media assets
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/.test(name)) {
            return `assets/media/[name]-[hash][extname]`;
          }
          // Image assets with optimization hints
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(name)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          // Font assets
          if (/\.(woff2?|eot|ttf|otf)$/.test(name)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          // CSS assets
          if (ext === 'css') {
            return `assets/css/[name]-[hash][extname]`;
          }
          // JSON and data assets
          if (ext === 'json') {
            return `assets/data/[name]-[hash][extname]`;
          }
          
          return `assets/${ext}/[name]-[hash][extname]`;
        }
      },
      onwarn(warning, warn) {
        // Suppress warnings about dynamic imports and other known issues
        if (warning.code === 'DYNAMIC_IMPORT') return;
        if (warning.code === 'THIS_IS_UNDEFINED') return;
        if (warning.code === 'EVAL') return;
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
        warn(warning);
      },
      // Enhanced tree-shaking with aggressive optimizations
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        unknownGlobalSideEffects: false
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env['NODE_ENV'] === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
        passes: 2, // Reduced from 3 for faster builds
        // Enhanced optimizations for Vercel Edge
        inline: 2,
        reduce_funcs: true,
        reduce_vars: true,
        sequences: true,
        dead_code: true,
        // Advanced optimizations
        join_vars: true,
        collapse_vars: true,
        negate_iife: true,
        evaluate: true,
        booleans: true,
        loops: true,
        unused: true,
        hoist_funs: true,
        if_return: true,
        // Additional edge optimizations
        switches: true,
        typeofs: true,
        comparisons: true,
        conditionals: true,
        side_effects: true,
        // New optimizations for better tree-shaking
        toplevel: true,
        // Add missing optimizations for better compression
        arrows: true,
        computed_props: true,
        hoist_props: true,
        properties: true,
        // Edge-specific optimizations
        keep_fargs: false,
        keep_fnames: false,
        ecma: 2020
      },
      mangle: {
        safari10: true,
        // Enhanced mangling for better compression
        toplevel: true,
        properties: {
          regex: /^_/
        },
        reserved: ['React', 'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'lazy'],
        // Add missing mangling options
        keep_classnames: false,
        keep_fnames: false,
        module: false
      },
      format: {
        comments: false
      }
    },
chunkSizeWarningLimit: 250, // Increased from 150 for better edge compatibility
    target: ['es2020', 'edge101'], // More specific targets for edge compatibility
    reportCompressedSize: true,
    cssCodeSplit: true,
    cssMinify: true, // Add CSS minification
    // Enhanced edge optimization
    assetsInlineLimit: 2048, // 2KB for better edge performance - increased from 1KB
    modulePreload: {
      polyfill: false
    },
    // Additional build optimizations
    emptyOutDir: true,
    // Dynamic import optimization
    dynamicImportVarsOptions: {
      warnOnError: false
    },
    // Enhanced tree-shaking is handled in rollupOptions
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] || 'development'),
    'process.env.EDGE_RUNTIME': JSON.stringify('true'),
    'process.env.VERCEL_EDGE': JSON.stringify('true'),
    'process.env.ENABLE_EDGE_CACHING': JSON.stringify('true'),
    'process.env.EDGE_REGION': JSON.stringify(process.env['VERCEL_REGION'] || 'unknown'),
    'process.env.ENABLE_EDGE_OPTIMIZATION': JSON.stringify('true'),
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@google/genai',
      'recharts',
      'dompurify',
      'lz-string'
    ],
    exclude: [
      // Exclude edge-specific modules from pre-bundling
      'node:fs',
      'node:path',
      'node:crypto',
      'node:fs/promises',
      'node:worker_threads',
      'node:child_process',
      // Add missing edge-specific exclusions
      'node:buffer',
      'node:stream',
      'node:util',
      'node:url',
      'node:querystring',
      'node:assert',
      'node:os',
      'node:process',
      'node:cluster',
      'node:dns',
      'node:http',
      'node:https',
      'node:net',
      'node:tls',
      'node:zlib',
      // Heavy dependencies for dynamic loading
      '@supabase/realtime-js',
      '@supabase/storage-js',
      'recharts/es6',
      'recharts/es6/components/ResponsiveContainer',
      'recharts/es6/chart/AreaChart',
      'recharts/es6/chart/LineChart',
      'recharts/es6/chart/BarChart',
      // Additional heavy modules
      '@testing-library/jest-dom',
      '@testing-library/react',
      '@testing-library/user-event',
      'jsdom',
      'vitest',
      '@vitest/coverage-v8',
      '@vitest/ui'
    ]
  },
  // Edge optimization for Vercel deployment
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      'X-Edge-Optimized': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Edge-Region': process.env['VERCEL_REGION'] || 'local',
    }
  },
  // Experimental features for edge optimization
  experimental: {
    renderBuiltUrl(filename: string, { hostType }: { hostType: string }) {
      if (hostType === 'js') {
        return { js: `/${filename}` };
      } else {
        return { relative: true };
      }
    },
  },
});
