import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    outDir: 'dist',
    sourcemap: process.env['NODE_ENV'] !== 'production' ? 'hidden' : false,
    target: 'esnext',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: (id) => {
          // Enhanced chunking for better Vercel edge performance
          if (id.includes('node_modules')) {
            // React ecosystem - split core and optional for better optimization
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-core';
            }
            if (id.includes('react-router') || id.includes('react-is')) {
              return 'react-routing';
            }
            
            // Supabase - isolated for better connection pooling
            if (id.includes('@supabase')) {
              // Separate realtime and storage for better caching
              if (id.includes('@supabase/realtime-js')) {
                return 'supabase-realtime';
              }
              if (id.includes('@supabase/storage-js')) {
                return 'supabase-storage';
              }
              return 'supabase-vendor';
            }
            
            // AI services - split by usage patterns for conditional loading
            if (id.includes('@google/genai')) {
              if (id.includes('generators') || id.includes('models')) {
                return 'ai-models';
              }
              if (id.includes('chat') || id.includes('streaming')) {
                return 'ai-chat';
              }
              return 'ai-core';
            }
            
            // Chart libraries - heavily optimized for lazy loading
            if (id.includes('recharts')) {
              // Core chart types - load on demand
              if (id.includes('AreaChart') || id.includes('LineChart')) {
                return 'chart-core';
              }
              if (id.includes('PieChart') || id.includes('BarChart')) {
                return 'chart-misc';
              }
              // Chart utilities and components
              if (id.includes('ResponsiveContainer') || id.includes('Tooltip')) {
                return 'chart-utils';
              }
              // Heavy chart components - separate for optimal loading
              if (id.includes('ComposedChart') || id.includes('ScatterChart') || id.includes('RadarChart')) {
                return 'chart-advanced';
              }
              return 'chart-vendor';
            }
            
            // Split vendor-misc into specific categories
            // Date and time utilities
            if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
              return 'vendor-date';
            }
            // HTTP and fetch utilities
            if (id.includes('axios') || id.includes('node-fetch') || id.includes('whatwg-fetch')) {
              return 'vendor-http';
            }
            // Utility libraries
            if (id.includes('lodash') || id.includes('underscore') || id.includes('ramda')) {
              return 'vendor-utils';
            }
            // Form handling
            if (id.includes('formik') || id.includes('react-hook-form') || id.includes('yup') || id.includes('zod')) {
              return 'vendor-forms';
            }
            // State management
            if (id.includes('zustand') || id.includes('redux') || id.includes('mobx') || id.includes(' recoil')) {
              return 'vendor-state';
            }
            // UI component libraries
            if (id.includes('@radix-ui') || id.includes('@headlessui') || id.includes('framer-motion')) {
              return 'vendor-ui';
            }
            // Development and testing tools - should not be in production
            if (id.includes('@testing-library') || id.includes('vitest') || id.includes('jsdom') || id.includes('msw')) {
              return 'vendor-dev';
            }
            
            // Security utilities - bundled together
            if (id.includes('dompurify') || id.includes('lz-string') || id.includes('crypto-js')) {
              return 'security-vendor';
            }
            
            // All other vendor libraries - reduced by aggressive categorization
            return 'vendor-misc';
          }
          
          // Enhanced service chunking for edge functions
          if (id.includes('services/')) {
            // AI-specific services - isolated for edge optimization
            if (id.includes('gemini') || id.includes('ai') || id.includes('gpt')) {
              return 'services-ai';
            }
            // Database and edge services - optimized for Supabase
            if (id.includes('supabase') || id.includes('database') || id.includes('db') || id.includes('edge') || id.includes('cdn') || id.includes('vercel')) {
              return 'services-data';
            }
            // Performance and security services
            if (id.includes('cache') || id.includes('performance') || id.includes('optimization') || id.includes('security') || id.includes('auth') || id.includes('validation')) {
              return 'services-core';
            }
            // All other services
            return 'services-misc';
          }
          
          // Component chunking with edge optimization
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
            if (id.includes('Chart') || id.includes('Analysis')) {
              return 'component-charts';
            }
            if (id.includes('StrategyConfig')) {
              return 'component-config';
            }
            if (id.includes('Market') || id.includes('Ticker')) {
              return 'component-trading';
            }
            // UI components consolidated
            if (id.includes('Modal') || id.includes('Dialog') || id.includes('Toast') || id.includes('ErrorBoundary') || id.includes('LoadingState')) {
              return 'component-ui';
            }
            // Core components
            return 'components-core';
          }
          
          // Route-based code splitting for edge caching
          if (id.includes('pages/')) {
            if (id.includes('Generator')) {
              return 'route-generator';
            }
            if (id.includes('Dashboard')) {
              return 'route-dashboard';
            }
            if (id.includes('About') || id.includes('FAQ') || id.includes('Wiki') || id.includes('Blog') || id.includes('Features')) {
              return 'route-static';
            }
            return 'pages';
          }
          
          // Utility chunking for performance
          if (id.includes('utils/')) {
            // Performance and monitoring utilities
            if (id.includes('performance') || id.includes('monitor') || id.includes('analytics') || id.includes('seo') || id.includes('meta') || id.includes('structured')) {
              return 'utils-performance';
            }
            // Security and validation utilities
            if (id.includes('validation') || id.includes('security') || id.includes('encryption') || id.includes('errorHandler')) {
              return 'utils-security';
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
        chunkFileNames: (chunkInfo) => {
          // Enhanced chunk naming for better caching strategy
          if (chunkInfo.name.includes('vendor')) {
            return `assets/vendor/${chunkInfo.name}-[hash].js`;
          }
          if (chunkInfo.name.includes('chart')) {
            return `assets/charts/${chunkInfo.name}-[hash].js`;
          }
          if (chunkInfo.name.includes('ai')) {
            return `assets/ai/${chunkInfo.name}-[hash].js`;
          }
          return `assets/js/${chunkInfo.name}-[hash].js`;
        },
        entryFileNames: (entryInfo) => {
          if (entryInfo.name === 'main') {
            return 'assets/js/[name]-[hash].js';
          }
          return `assets/entries/${entryInfo.name}-[hash].js`;
        },
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
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3, // Triple pass for better compression
        sequences: true,
        properties: true,
        dead_code: true,
        conditionals: true,
        comparisons: true,
        evaluate: true,
        booleans: true,
        loops: true,
        unused: true,
        hoist_funs: true,
        if_return: true,
        join_vars: true,
        collapse_vars: true,
        reduce_vars: true,
        module: true,
        ecma: 2020,
        // Additional compression options for bundle size
        arrows: true,
        inline: true,
        reduce_funcs: true,
        toplevel: true,
        typeofs: false, // Avoid transforming typeof to void 0
      },
      mangle: {
        properties: {
          regex: /^_/, // Mangle private properties
        },
      },
      format: {
        comments: false,
      }
    },
    chunkSizeWarningLimit: 100, // More aggressive optimization for edge performance
    reportCompressedSize: true,
    cssCodeSplit: true,
    cssMinify: true, // Add CSS minification
    // Enhanced edge optimization
    assetsInlineLimit: 256, // Optimized for edge performance
    modulePreload: {
      polyfill: false,
      resolveDependencies: (_, deps) => {
        // Prioritize critical dependencies
        const critical = ['react', 'react-dom'];
        const important = ['react-router-dom', '@supabase/supabase-js'];
        const deferred = ['@google/genai', 'recharts'];
        
        return deps.sort((a, b) => {
          const aImportance = critical.includes(a) ? 0 : important.includes(a) ? 1 : deferred.includes(a) ? 2 : 3;
          const bImportance = critical.includes(b) ? 0 : important.includes(b) ? 1 : deferred.includes(b) ? 2 : 3;
          return aImportance - bImportance;
        });
      }
    },
    // Additional build optimizations
    emptyOutDir: true,
    // Dynamic import optimization
    dynamicImportVarsOptions: {
      warnOnError: false
    }
    
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
      // Core dependencies - pre-bundle for optimal performance
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'dompurify',
      'lz-string'
    ],
    exclude: [
      // Conditional/lazy-loaded dependencies - don't pre-bundle
      '@google/genai',
      'recharts',
      '@supabase/realtime-js',
      '@supabase/storage-js',
      
      // Exclude edge-specific modules from pre-bundling
      'node:fs',
      'node:path',
      'node:crypto',
      'node:fs/promises',
      'node:worker_threads',
      'node:child_process',
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
      
      // Chart libraries for lazy loading
      'recharts/es6',
      'recharts/es6/components/ResponsiveContainer',
      'recharts/es6/chart/AreaChart',
      'recharts/es6/chart/LineChart',
      'recharts/es6/chart/BarChart',
      'recharts/es6/chart/PieChart',
      'recharts/es6/chart/ComposedChart',
      'recharts/es6/chart/ScatterChart',
      'recharts/es6/chart/RadarChart',
      
      // AI libraries for conditional loading
      '@google/genai/dist/generators',
      '@google/genai/dist/chat',
      '@google/genai/dist/models',
      
      // Security libraries - exclude heavy distributions
      'dompurify/dist/purify.cjs',
      
      // Development and testing tools
      '@testing-library/jest-dom',
      '@testing-library/react',
      '@testing-library/user-event',
      'jsdom',
      'vitest',
      '@vitest/coverage-v8',
      '@vitest/ui',
      
      // Optional vendor libraries that should be loaded on demand
      'date-fns',
      'dayjs',
      'moment',
      'lodash',
      'underscore',
      'ramda',
      'formik',
      'react-hook-form',
      'yup',
      'zod',
      'zustand',
      'redux',
      'mobx',
      'recoil',
      '@radix-ui',
      '@headlessui',
      'framer-motion',
      'axios',
      'node-fetch',
      'whatwg-fetch',
      'crypto-js'
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
  }
});