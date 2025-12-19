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
          // Simplified chunking strategy for better bundle management
          if (id.includes('node_modules')) {
            // React ecosystem - split React DOM from React for better caching
            if (id.includes('react-dom')) {
              return 'react-dom';
            }
            if (id.includes('react')) {
              return 'react-core';
            }
            
            // AI services - isolate heavy AI vendor
            if (id.includes('@google/genai')) {
              return 'ai-vendor';
            }
            
            // Chart libraries - optimized for better chunk distribution
            if (id.includes('recharts')) {
              // Core chart primitives (split into smaller chunks)
              if (id.includes('Cartesian')) {
                return 'chart-cartesian';
              }
              if (id.includes('Polar')) {
                return 'chart-polar';
              }
              if (id.includes('shape')) {
                return 'chart-shape';
              }
              if (id.includes('scale')) {
                return 'chart-scale';
              }
              // Individual chart components - smaller isolation
              if (id.includes('Chart') && !id.includes('Responsive')) {
                if (id.includes('Area')) return 'chart-area';
                if (id.includes('Line')) return 'chart-line';
                if (id.includes('Pie')) return 'chart-pie';
                if (id.includes('Bar')) return 'chart-bar';
                if (id.includes('Radar')) return 'chart-radar';
                if (id.includes('Scatter')) return 'chart-scatter';
                if (id.includes('Composed')) return 'chart-composed';
                if (id.includes('Funnel')) return 'chart-funnel';
              }
              // Responsive container and utilities
              if (id.includes('Responsive') || id.includes('Tooltip') || id.includes('Legend')) {
                return 'chart-utils';
              }
              return 'chart-vendor';
            }
            
            // Supabase split only if beneficial for chunk balance
            if (id.includes('@supabase/realtime-js')) {
              return 'supabase-realtime';
            }
            if (id.includes('@supabase/storage-js')) {
              return 'supabase-storage';
            }
            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }
            
            // Security libraries grouped
            if (id.includes('dompurify') || id.includes('lz-string')) {
              return 'security-vendor';
            }
            
            // Date libraries grouped
            if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
              return 'vendor-date';
            }
            
            // Utilities and other vendor libs
            if (id.includes('lodash') || id.includes('underscore')) {
              return 'vendor-misc';
            }
          }
          
          // Service and component splitting kept simple
          if (id.includes('services/')) {
            if (id.includes('gemini') || id.includes('ai')) {
              return 'services-ai';
            }
            if (id.includes('supabase') || id.includes('database')) {
              return 'services-data';
            }
            return 'services-core';
          }
          
          if (id.includes('components/')) {
            if (id.includes('ChatInterface')) return 'component-chat';
            if (id.includes('CodeEditor')) return 'component-editor';
            if (id.includes('Backtest')) return 'component-backtest';
            if (id.includes('Chart')) return 'component-charts';
            if (id.includes('StrategyConfig')) return 'component-config';
            if (id.includes('Market')) return 'component-trading';
            return 'components-core';
          }
          
          if (id.includes('pages/')) {
            if (id.includes('Generator')) return 'route-generator';
            if (id.includes('Dashboard')) return 'route-dashboard';
            return 'route-static';
          }
          
          if (id.includes('utils/')) {
            if (id.includes('performance')) return 'utils-performance';
            if (id.includes('validation') || id.includes('security')) return 'utils-security';
            return 'utils-core';
          }
          
          if (id.includes('constants/')) {
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
    chunkSizeWarningLimit: 300, // Realistic limit for complex chart libraries
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