import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: process.env['NODE_ENV'] !== 'production',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: (id) => {
          // Enhanced vendor chunks with edge-optimized splitting
          if (id.includes('node_modules')) {
            // React core split for optimal edge caching
            if (id.includes('react') && !id.includes('react-router') && !id.includes('react-helmet')) {
              return 'react-core';
            }
            if (id.includes('react-dom')) {
              return 'react-dom';
            }
            // Combine react-router with react-core to avoid empty chunks
            if (id.includes('react-router-dom') || id.includes('react-router')) {
              return 'react-core';
            }
            // Charts and visualization - optimize recharts imports with tree-shaking
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            // AI and ML libraries - separate for edge optimization
            if (id.includes('@google/genai')) {
              return 'vendor-ai';
            }
            // Database and backend - optimized for edge connections
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            
            // Security utilities - critical for edge deployment
            if (id.includes('dompurify')) {
              return 'vendor-security';
            }
            // Compression utilities - essential for edge performance
            if (id.includes('lz-string')) {
              return 'vendor-compression';
            }
            // Development and build tools - excluded from production
            if (id.includes('typescript') || id.includes('@types')) {
              return 'dev-types';
            }
            // Testing libraries (should be dev-only)
            if (id.includes('@testing-library') || id.includes('vitest') || id.includes('jsdom')) {
              return 'dev-testing';
            }
            // ESLint and linting
            if (id.includes('eslint') || id.includes('@typescript-eslint')) {
              return 'dev-linting';
            }
            // Split remaining vendors into identifiable chunks
            if (id.includes('date-fns') || id.includes('moment') || id.includes('dayjs')) {
              return 'vendor-date';
            }
            if (id.includes('lodash') || id.includes('ramda')) {
              return 'vendor-utils';
            }
            return 'vendor-misc';
          }
          
          // Enhanced app chunks with edge-optimized granularity
          if (id.includes('services/')) {
            // Database and connection services - edge optimized
            if (id.includes('supabase') || id.includes('database') || id.includes('connectionPool') || id.includes('readReplica')) {
              return 'services-database';
            }
            // AI and simulation services
            if (id.includes('gemini') || id.includes('simulation') || id.includes('ai')) {
              return 'services-ai';
            }
            // Edge and performance services - critical for edge deployment
            if (id.includes('edge') || id.includes('cache') || id.includes('queryOptimizer') || id.includes('performance') || id.includes('vercel')) {
              return 'services-edge';
            }
            // Security and validation services
            if (id.includes('security') || id.includes('validation') || id.includes('encryption')) {
              return 'services-security';
            }
            // Real-time and sync services
            if (id.includes('realtime') || id.includes('sync') || id.includes('resilient')) {
              return 'services-realtime';
            }
            // Data and market services
            if (id.includes('marketData') || id.includes('data') || id.includes('analytics')) {
              return 'services-data';
            }
            // Core services
            return 'services-core';
          }
          
          // Enhanced component chunks with edge-optimized lazy loading
          if (id.includes('components/')) {
            // Heavy components that should be lazy-loaded for edge performance
            if (id.includes('CodeEditor')) {
              return 'component-editor';
            }
            if (id.includes('ChatInterface')) {
              return 'component-chat';
            }
            if (id.includes('BacktestPanel') || id.includes('ChartComponents')) {
              return 'component-charts';
            }
            if (id.includes('StrategyConfig')) {
              return 'component-config';
            }
            if (id.includes('VirtualScrollList')) {
              return 'component-virtual';
            }
            // UI components - critical for edge rendering
            if (id.includes('LoadingState') || id.includes('ErrorBoundary') || id.includes('Toast')) {
              return 'component-ui';
            }
            // Form and input components
            if (id.includes('NumericInput') || id.includes('AISettingsModal') || id.includes('DatabaseSettingsModal')) {
              return 'component-forms';
            }
            // Layout components - essential for edge SSR
            if (id.includes('Layout') || id.includes('Auth') || id.includes('MarketTicker')) {
              return 'component-layout';
            }
            return 'components-misc';
          }
          
          // Page chunks with edge-optimized route-based splitting
          if (id.includes('pages/')) {
            if (id.includes('Generator')) {
              return 'page-generator';
            }
            if (id.includes('Dashboard')) {
              return 'page-dashboard';
            }
            // Static pages that can be pre-rendered at edge
            if (id.includes('About') || id.includes('FAQ') || id.includes('Features') || id.includes('Wiki')) {
              return 'page-static';
            }
            // Content pages
            if (id.includes('Blog')) {
              return 'page-blog';
            }
            return 'pages-misc';
          }
          
          // Utility chunks with edge optimization
          if (id.includes('utils/')) {
            // Performance utilities - critical for edge monitoring
            if (id.includes('performance') || id.includes('monitor')) {
              return 'utils-performance';
            }
            // SEO utilities - essential for edge SEO
            if (id.includes('seo') || id.includes('meta')) {
              return 'utils-seo';
            }
            // Security utilities - critical for edge security
            if (id.includes('encryption') || id.includes('validation') || id.includes('errorHandler')) {
              return 'utils-security';
            }
            return 'utils-core';
          }
          
          // Constants and translations
          if (id.includes('constants/') || id.includes('translations/')) {
            return 'assets-i18n';
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
        warn(warning);
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env['NODE_ENV'] === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
        passes: 4, // Increased for better compression
        // Enhanced optimizations for Vercel Edge
        inline: 3,
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
        side_effects: true
      },
      mangle: {
        safari10: true,
        // Enhanced mangling for better compression
        toplevel: true,
        properties: {
          regex: /^_/
        },
        reserved: ['React', 'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo']
      },
      format: {
        comments: false
      }
    },
    chunkSizeWarningLimit: 250, // Optimized for edge performance - smaller chunks
    target: 'es2020',
    reportCompressedSize: true,
    cssCodeSplit: true,
    // Enhanced edge optimization
    assetsInlineLimit: 4096, // 4KB for better caching
    modulePreload: {
      polyfill: false
    },
    // Additional build optimizations
    emptyOutDir: true,
    // Edge-specific optimizations
    rollupExternalOptions: {
      // Externalize node-specific modules for edge runtime
      'node:fs': 'commonjs fs',
      'node:path': 'commonjs path',
      'node:crypto': 'commonjs crypto',
    },
    // Enable code splitting for edge
    splitVendorChunk: true,
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
    'process.env.EDGE_REGION': JSON.stringify(process.env.VERCEL_REGION || 'unknown'),
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
    ]
  },
  // Edge optimization for Vercel deployment
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      'X-Edge-Optimized': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Edge-Region': process.env.VERCEL_REGION || 'local',
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
    // Enable build-time optimizations
    buildTarget: 'es2020',
  },
});
