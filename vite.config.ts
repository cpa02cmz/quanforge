import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    ...(process.env['ANALYZE'] === 'true' ? [
      visualizer({
        open: false,
        gzipSize: true,
        brotliSize: true,
        filename: 'dist/bundle-stats.html',
        template: 'treemap'
      })
    ] : [])
  ],
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
          // Ultra-granular chunking for optimal bundle sizes (<100KB target)
          if (id.includes('node_modules')) {
            // React Router - separate for better caching (updates independently) - check first
            if (id.includes('react-router')) {
              return 'react-router';
            }
            // React ecosystem - split into smaller chunks
            if (id.includes('react')) {
              // React DOM split into chunks
              if (id.includes('react-dom/server')) {
                return 'react-dom-server';
              }
              if (id.includes('react-dom/client')) {
                return 'react-dom-client';
              }
              if (id.includes('react-dom')) {
                return 'react-dom-core';
              }
              // Core React
              if (id.includes('react-is') || id.includes('react/jsx')) {
                return 'react-jsx';
              }
              return 'react-core';
            }
            // Supabase - granular split
            if (id.includes('@supabase')) {
              if (id.includes('@supabase/realtime-js')) {
                return 'supabase-realtime';
              }
              if (id.includes('@supabase/storage-js')) {
                return 'supabase-storage';
              }
              if (id.includes('@supabase/postgrest-js')) {
                return 'supabase-postgrest';
              }
              if (id.includes('@supabase/gotrue-js')) {
                return 'supabase-auth';
              }
              return 'supabase-core';
            }
            // AI services - ultra-granular split
            if (id.includes('@google/genai')) {
              if (id.includes('tokenizer') || id.includes('/web/tokenizers')) {
                return 'ai-tokenizer';
              }
              if (id.includes('/web/') || id.includes('web.js')) {
                return 'ai-web-runtime';
              }
              if (id.includes('/node/')) {
                return 'ai-node-runtime';
              }
              if (id.includes('generators') || id.includes('streaming')) {
                return 'ai-generators';
              }
              return 'ai-core';
            }
            // Chart libraries - split by chart type for optimal loading
            if (id.includes('recharts')) {
              // Core utilities
              if (id.includes('util') || id.includes('DataUtils') || id.includes('ChartUtils')) {
                return 'chart-utils';
              }
              // Animation components
              if (id.includes('animation')) {
                return 'chart-animation';
              }
              // Cartesian charts (Line, Area, Bar)
              if (id.includes('Line')) {
                return 'chart-line';
              }
              if (id.includes('Area')) {
                return 'chart-area';
              }
              if (id.includes('Bar')) {
                return 'chart-bar';
              }
              // Pie and radial charts
              if (id.includes('Pie') || id.includes('Radial')) {
                return 'chart-radial';
              }
              // Core components
              if (id.includes('ResponsiveContainer') || id.includes('Legend') || id.includes('Tooltip')) {
                return 'chart-components';
              }
              // XAxis, YAxis, Grid
              if (id.includes('Axis') || id.includes('CartesianGrid') || id.includes('Grid')) {
                return 'chart-axes';
              }
              return 'chart-core';
            }
            // PrismJS - syntax highlighting (split if needed)
            if (id.includes('prismjs')) {
              return 'prism-vendor';
            }
            // Security utilities - isolated
            if (id.includes('dompurify')) {
              return 'security-dompurify';
            }
            if (id.includes('lz-string')) {
              return 'security-compression';
            }
            // Common vendor libraries - split individually
            if (id.includes('scheduler')) {
              return 'vendor-scheduler';
            }
            if (id.includes('use-sync-external-store')) {
              return 'vendor-sync-store';
            }
            if (id.includes('clsx') || id.includes('classnames')) {
              return 'vendor-classnames';
            }
            if (id.includes('tailwind')) {
              return 'vendor-tailwind';
            }
            if (id.includes('uuid')) {
              return 'vendor-uuid';
            }
            if (id.includes('lodash') || id.includes('underscore')) {
              return 'vendor-lodash';
            }
            if (id.includes('zod') || id.includes('yup') || id.includes('joi')) {
              return 'vendor-validation';
            }
            if (id.includes('date-fns') || id.includes('moment') || id.includes('dayjs')) {
              return 'vendor-dates';
            }
            // Remaining vendor libraries - smaller chunks
            return 'vendor-remaining';
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
    chunkSizeWarningLimit: 100, // Target: All chunks under 100KB raw size for optimal caching
                                 // Achieved through ultra-granular manual chunking strategy
    reportCompressedSize: true,
    cssCodeSplit: true,
    cssMinify: true, // Add CSS minification
    // Enhanced edge optimization
    assetsInlineLimit: 256, // Optimized for edge performance
    modulePreload: {
      polyfill: false
    },
    // Additional build optimizations
    emptyOutDir: true,
    // Dynamic import optimization
    dynamicImportVarsOptions: {
      warnOnError: false
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
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
      '@google/genai/dist/generators',
      'dompurify/dist/purify.cjs',
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
  }
});