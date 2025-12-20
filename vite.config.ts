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
            // React ecosystem - split more granularly for better cache efficiency
            if (id.includes('react')) {
              // Core React - split more granularly
              if (id.includes('react-dom')) {
                // More aggressive react-dom splitting
                if (id.includes('client') || id.includes('Client')) {
                  return 'react-dom-client';
                }
                if (id.includes('server') || id.includes('Server')) {
                  return 'react-dom-server';
                }
                if (id.includes('test-utils') || id.includes('test')) {
                  return 'react-dom-test';
                }
                if (id.includes('unstable_') || id.includes('experimental')) {
                  return 'react-dom-experimental';
                }
                // Split by react-dom submodules
                if (id.includes('react-dom/cjs') || id.includes('react-dom/esm')) {
                  const filename = id.split('/').pop();
                  if (filename && filename !== 'index.js' && filename !== 'react-dom.js') {
                    return `react-dom-${filename.replace(/\.(js|mjs|cjs)$/, '')}`;
                  }
                }
                return 'react-dom';
              }
              if (id.includes('react/jsx-runtime') || id.includes('react/jsx-dev-runtime')) {
                return 'react-jsx';
              }
              if (id.includes('react/index')) {
                return 'react-core';
              }
              // React Router
              if (id.includes('react-router') || id.includes('react-router-dom')) {
                // Split router modules
                if (id.includes('dom') || id.includes('memory')) {
                  return 'react-router-bindings';
                }
                if (id.includes('server') || id.includes('ssr')) {
                  return 'react-router-server';
                }
                return 'react-router';
              }
              // React development tools
              if (id.includes('react-devtools') || id.includes('react-refresh')) {
                return 'react-dev';
              }
              // React hooks and utilities
              if (id.includes('react') && (id.includes('hooks') || id.includes('use'))) {
                return 'react-hooks';
              }
              // Additional react splitting
              if (id.includes('react/')) {
                const reactModule = id.split('/').pop()?.replace(/\.(js|mjs|cjs)$/, '');
                if (reactModule && reactModule !== 'react' && reactModule !== 'index') {
                  return `react-${reactModule}`;
                }
              }
              return 'react-vendor';
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
            // AI services - split more granularly for better performance
            if (id.includes('@google/genai')) {
              // Split AI vendor into specific functionality - more aggressive splitting
              if (id.includes('/chat/') || id.includes('generateContent') || id.includes('streamGenerateContent')) {
                return 'ai-chat';
              }
              if (id.includes('/models/') || id.includes('getModel') || id.includes('listModels')) {
                return 'ai-models';
              }
              if (id.includes('/generators/') || id.includes('generate')) {
                return 'ai-generators';
              }
              if (id.includes('protos') || id.includes('grpc') || id.includes('proto')) {
                // Split protocols further
                if (id.includes('proto') || id.includes('protobuf')) {
                  return 'ai-protobuf';
                }
                return 'ai-protocol';
              }
              if (id.includes('client') || id.includes('auth') || id.includes('credentials')) {
                // Split client functions
                if (id.includes('auth')) {
                  return 'ai-auth';
                }
                return 'ai-client';
              }
              // Split request/response handling
              if (id.includes('request') || id.includes('response') || id.includes('stream')) {
                return 'ai-streaming';
              }
              // Split AI utilities and helpers
              if (id.includes('util') || id.includes('helper') || id.includes('validate')) {
                return 'ai-utils';
              }
              // More aggressive splitting for ai-vendor-core
              if (id.includes('function_call') || id.includes('function-call')) {
                return 'ai-function-calls';
              }
              if (id.includes('embedding') || id.includes('embed')) {
                return 'ai-embeddings';
              }
              if (id.includes('text') || id.includes('content') || id.includes('prompt')) {
                return 'ai-text';
              }
              if (id.includes('error') || id.includes('exception') || id.includes('fault')) {
                return 'ai-errors';
              }
              if (id.includes('config') || id.includes('setting') || id.includes('option')) {
                return 'ai-config';
              }
              // Split by file types and modules - more aggressive to reduce ai-index size
              if (id.includes('index.js') || id.includes('index.mjs')) {
                // Further split index files by their path
                if (id.includes('/dist/genai/') || id.includes('/lib/genai/')) {
                  const pathParts = id.split('/');
                  const specificModule = pathParts[pathParts.length - 1];
                  if (specificModule && specificModule !== 'index.js' && specificModule !== 'index.mjs') {
                    return `ai-${specificModule.replace(/\.(js|mjs)$/, '')}`;
                  }
                  // If still too large, split ai-index into multiple parts
                  if (id.includes('/dist/') || id.includes('/lib/')) {
                    return 'ai-core-index';
                  }
                }
                return 'ai-index';
              }
              if (id.includes('/dist/') || id.includes('/lib/')) {
                // Further split dist/lib modules
                const pathParts = id.split('/');
                const modulePart = pathParts[pathParts.length - 2];
                if (modulePart && modulePart !== 'genai') {
                  return `ai-${modulePart}`;
                }
              }
              // Additional aggressive AI splitting to reduce ai-index size
              if (id.includes('genai') && (id.includes('index.js') || id.includes('index.mjs'))) {
                // Split Google AI index by specific patterns
                if (id.includes('node_modules/@google/genai/dist/index')) {
                  // Very aggressive splitting for the main genai index
                  if (id.includes('package.json') || id.includes('README')) {
                    return 'ai-meta';
                  }
                  // Split based on content patterns
                  if (id.includes('src') || id.includes('resources')) {
                    return 'ai-resources';
                  }
                  if (id.includes('protos') || id.includes('proto_files')) {
                    return 'ai-proto-files';
                  }
                  return 'ai-core-index';
                }
              }
              // Split remaining large AI chunks by their file structure
              if (id.includes('@google/genai')) {
                const filename = id.split('/').pop();
                if (filename && filename.includes('.')) {
                  const baseName = filename.replace(/\.(js|mjs)$/, '');
                  if (baseName !== 'index' && baseName.length > 0) {
                    return `ai-${baseName}`;
                  }
                }
              }
              return 'ai-vendor-core';
            }
            // Chart libraries - split more granularly to reduce bundle size
            if (id.includes('recharts')) {
              // Split Recharts into smaller chunks
              if (id.includes('AreaChart') || id.includes('LineChart') || id.includes('ComposedChart') || id.includes('Line')) {
                return 'chart-core';
              }
              if (id.includes('PieChart') || id.includes('BarChart') || id.includes('RadarChart') || id.includes('ScatterChart')) {
                return 'chart-misc';
              }
              // Split individual chart components
              if (id.includes('XAxis') || id.includes('YAxis') || id.includes('CartesianGrid') || id.includes('Tooltip') || id.includes('Legend')) {
                return 'chart-axes';
              }
              if (id.includes('ResponsiveContainer') || id.includes('Brush') || id.includes('ReferenceLine')) {
                return 'chart-interactive';
              }
              // Core recharts utilities and shapes - split further
              if (id.includes('shape')) {
                return 'chart-shapes';
              }
              if (id.includes('scale')) {
                return 'chart-scales';
              }
              if (id.includes('Animation') || id.includes('animation')) {
                return 'chart-animations';
              }
              if (id.includes('util')) {
                return 'chart-utils';
              }
              // Split cartesian and polar components
              if (id.includes('polar') || id.includes('Polar')) {
                return 'chart-polar';
              }
              if (id.includes('cartesian') || id.includes('Cartesian')) {
                return 'chart-cartesian';
              }
              // Fallback for remaining recharts modules
              return 'chart-vendor-light';
            }
            // Security utilities - bundled together
            if (id.includes('dompurify') || id.includes('lz-string')) {
              return 'security-vendor';
            }
            // Split vendor-misc more granularly
            if (id.includes('lodash') || id.includes('es-toolkit')) {
              return 'vendor-utils';
            }
            if (id.includes('date') || id.includes('moment') || id.includes('dayjs')) {
              return 'vendor-date';
            }
            if (id.includes('crypto') || id.includes('hash') || id.includes('encryption')) {
              return 'vendor-crypto';
            }
            if (id.includes('fetch') || id.includes('axios') || id.includes('xhr')) {
              return 'vendor-http';
            }
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
chunkSizeWarningLimit: 300, // Increased to 300KB to balance edge performance with realistic vendor bundle sizes
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
  },
  
  
});