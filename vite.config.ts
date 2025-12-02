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
          // Enhanced vendor chunks with better splitting for optimal caching
          if (id.includes('node_modules')) {
            // React core split for better caching
            if (id.includes('react') && !id.includes('react-router') && !id.includes('react-helmet')) {
              return 'react-core';
            }
            if (id.includes('react-dom')) {
              return 'react-dom';
            }
            if (id.includes('react-router-dom')) {
              return 'react-router';
            }
            // Charts and visualization
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            // AI and ML libraries
            if (id.includes('@google/genai')) {
              return 'vendor-ai';
            }
            // Database and backend
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // SEO and meta
            if (id.includes('react-helmet-async')) {
              return 'vendor-seo';
            }
            // Security utilities
            if (id.includes('dompurify')) {
              return 'vendor-security';
            }
            // Compression utilities
            if (id.includes('lz-string')) {
              return 'vendor-compression';
            }
            // Development and build tools
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
            // Remaining vendors
            return 'vendor-misc';
          }
          
          // Enhanced app chunks with better granularity
          if (id.includes('services/')) {
            // Database and connection services
            if (id.includes('supabase') || id.includes('database') || id.includes('connectionPool') || id.includes('readReplica')) {
              return 'services-database';
            }
            // AI and simulation services
            if (id.includes('gemini') || id.includes('simulation') || id.includes('ai')) {
              return 'services-ai';
            }
            // Cache and performance services
            if (id.includes('cache') || id.includes('queryOptimizer') || id.includes('performance') || id.includes('edge')) {
              return 'services-performance';
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
          
          // Enhanced component chunks with lazy loading optimization
          if (id.includes('components/')) {
            // Heavy components that should be lazy-loaded
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
            // UI components
            if (id.includes('LoadingState') || id.includes('ErrorBoundary') || id.includes('Toast')) {
              return 'component-ui';
            }
            // Form and input components
            if (id.includes('NumericInput') || id.includes('AISettingsModal') || id.includes('DatabaseSettingsModal')) {
              return 'component-forms';
            }
            // Layout components
            if (id.includes('Layout') || id.includes('Auth') || id.includes('MarketTicker')) {
              return 'component-layout';
            }
            return 'components-misc';
          }
          
          // Page chunks with route-based splitting
          if (id.includes('pages/')) {
            if (id.includes('Generator')) {
              return 'page-generator';
            }
            if (id.includes('Dashboard')) {
              return 'page-dashboard';
            }
            // Static pages that can be pre-rendered
            if (id.includes('About') || id.includes('FAQ') || id.includes('Features') || id.includes('Wiki')) {
              return 'page-static';
            }
            // Content pages
            if (id.includes('Blog')) {
              return 'page-blog';
            }
            return 'pages-misc';
          }
          
          // Utility chunks
          if (id.includes('utils/')) {
            // Performance utilities
            if (id.includes('performance') || id.includes('monitor')) {
              return 'utils-performance';
            }
            // SEO utilities
            if (id.includes('seo') || id.includes('meta')) {
              return 'utils-seo';
            }
            // Security utilities
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
          const name = assetInfo.name || 'unknown';
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
    chunkSizeWarningLimit: 200, // Stricter limit for better edge performance
    target: 'es2020',
    reportCompressedSize: true,
    cssCodeSplit: true,
    // Enhanced edge optimization
    assetsInlineLimit: 512, // Reduced for better caching
    modulePreload: {
      polyfill: false
    },
    // Additional build optimizations
    emptyOutDir: true
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
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-helmet-async'
    ],
    exclude: [
      '@supabase/supabase-js', // Load dynamically
      '@google/genai', // Load dynamically
      'recharts', // Load dynamically for charts
      'dompurify', // Load dynamically for security
      'lz-string' // Load dynamically for compression
    ]
  },
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { js: `/${filename}` };
      } else {
        return { relative: true };
      }
    }
  },
  // Edge optimization for Vercel deployment
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      'X-Edge-Optimized': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
  }
});
