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
            // React ecosystem - split to reduce chunk size
            if (id.includes('react')) {
              if (id.includes('react-dom')) {
                return 'react-dom';
              }
              if (id.includes('react-is')) {
                return 'react-is';
              }
              return 'react-core';
            }
            if (id.includes('react-router')) {
              return 'react-router';
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
            // AI services - lazy loaded for edge optimization
            if (id.includes('@google/genai')) {
              return 'ai-vendor';
            }
            // Chart libraries - aggressive split to reduce largest chunk
            if (id.includes('recharts')) {
              // Split recharts more aggressively - isolate core primitives
              if (id.includes('chart') || id.includes('Chart')) {
                // Specific chart types - create separate chunks for each
                if (id.includes('AreaChart') || id.includes('Area')) {
                  return 'chart-area';
                }
                if (id.includes('LineChart') || id.includes('Line')) {
                  return 'chart-line';
                }
                if (id.includes('PieChart') || id.includes('Pie')) {
                  return 'chart-pie';
                }
                if (id.includes('BarChart') || id.includes('Bar')) {
                  return 'chart-bar';
                }
                if (id.includes('ComposedChart')) {
                  return 'chart-composed';
                }
                if (id.includes('RadarChart') || id.includes('Radar')) {
                  return 'chart-radar';
                }
                if (id.includes('ScatterChart') || id.includes('Scatter')) {
                  return 'chart-scatter';
                }
                if (id.includes('TreemapChart')) {
                  return 'chart-treemap';
                }
                if (id.includes('FunnelChart')) {
                  return 'chart-funnel';
                }
                // Split core chart primitives into their own chunks
                if (id.includes('Cartesian') || id.includes('Polar') || id.includes('Funnel') || id.includes('Sankey')) {
                  return 'chart-types-primitives';
                }
                if (id.includes('scale') || id.includes('time') || id.includes('data')) {
                  return 'chart-data-utils';
                }
                if (id.includes('shape') || id.includes('graphic') || id.includes('symbol')) {
                  return 'chart-shapes';
                }
                // Split remaining core chart logic further
                if (id.includes('Chart') || id.includes('compose') || id.includes('container')) {
                  return 'chart-containers';
                }
                if (id.includes('render') || id.includes('presentation') || id.includes('view')) {
                  return 'chart-renderers';
                }
                return 'chart-types-core';
              }
              // Chart utilities and containers
              if (id.includes('ResponsiveContainer')) {
                return 'chart-responsive';
              }
              if (id.includes('Tooltip')) {
                return 'chart-tooltip';
              }
              if (id.includes('Legend')) {
                return 'chart-legend';
              }
              // Chart primitives (axes, grids, etc.)
              if (id.includes('XAxis')) {
                return 'chart-xaxis';
              }
              if (id.includes('YAxis')) {
                return 'chart-yaxis';
              }
              if (id.includes('CartesianGrid')) {
                return 'chart-grid';
              }
              // Recharts core modules split further
              if (id.includes('polar') || id.includes('radial')) {
                return 'chart-polar';
              }
              // Cell and other specific components
              if (id.includes('Cell')) {
                return 'chart-cell';
              }
              if (id.includes('Brush')) {
                return 'chart-brush';
              }
              if (id.includes('ReferenceLine')) {
                return 'chart-reference';
              }
              // Recharts core utilities and hooks
              if (id.includes('hooks') || id.includes('context')) {
                return 'chart-internals';
              }
              if (id.includes('util') || id.includes('component')) {
                return 'chart-utils';
              }
              // General recharts vendor
              return 'chart-vendor';
            }
            // Security utilities - bundled together
            if (id.includes('dompurify') || id.includes('lz-string')) {
              return 'security-vendor';
            }
            // Other large vendor libraries split by type
            if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
              return 'vendor-date';
            }
            if (id.includes('lodash') || id.includes('underscore')) {
              return 'vendor-utils';
            }
            if (id.includes('axios') || id.includes('fetch') || id.includes('xhr')) {
              return 'vendor-http';
            }
            // Split vendor-misc to reduce size
              if (id.includes('node_modules')) {
                // Large libraries split out
                if (id.includes('lodash') || id.includes('underscore')) {
                  return 'vendor-utility';
                }
                if (id.includes('date') || id.includes('time') || id.includes('dayjs') || id.includes('moment')) {
                  return 'vendor-date';
                }
                if (id.includes('crypto') || id.includes('hash') || id.includes('buffer')) {
                  return 'vendor-crypto';
                }
                if (id.includes('stream') || id.includes('events') || id.includes('util')) {
                  return 'vendor-stream';
                }
                return 'vendor-misc';
              }
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