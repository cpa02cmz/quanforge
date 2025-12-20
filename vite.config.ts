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
            // React ecosystem - ultra-aggressive splitting to reduce bundle sizes
            if (id.includes('react')) {
              // Core React DOM - ultra aggressive approach
              if (id.includes('react-dom')) {
                // Aggressively split client-side modules to reduce chunk size
                if (id.includes('client') || id.includes('Client')) {
                  // Split client modules further
                  if (id.includes('dom-client')) {
                    // Split specific client functionalities
                    if (id.includes('events') || id.includes('event')) {
                      return 'react-dom-client-events';
                    }
                    if (id.includes('schedule') || id.includes('scheduler')) {
                      return 'react-dom-client-scheduler';
                    }
                    if (id.includes('fiber') || id.includes('reconciler')) {
                      return 'react-dom-client-fiber';
                    }
                    // Split by specific client files
                    if (id.includes('react-dom-client')) {
                      const filename = id.split('/').pop();
                      if (filename && filename !== 'index') {
                        return `react-dom-client-${filename.replace(/\.(js|mjs|cjs)$/, '')}`;
                      }
                    }
                    return 'react-dom-client-core';
                  }
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
                
                // Ultra granular react-dom submodule splitting
                if (id.includes('react-dom/cjs') || id.includes('react-dom/esm')) {
                  const filename = id.split('/').pop();
                  if (filename && filename !== 'index.js' && filename !== 'react-dom.js') {
                    // Group similar files
                    if (filename.includes('events') || filename.includes('event')) {
                      return 'react-dom-events';
                    }
                    if (filename.includes('fiber') || filename.includes('scheduler')) {
                      return 'react-dom-fiber';
                    }
                    if (filename.includes('component') || filename.includes('mount')) {
                      return 'react-dom-components';
                    }
                    return `react-dom-${filename.replace(/\.(js|mjs|cjs)$/, '')}`;
                  }
                }
                
                // Additional client splitting strategies
                if (id.includes('react-dom')) {
                  const pathEnd = id.split('/').pop();
                  if (pathEnd && pathEnd.includes('client')) {
                    // Extract the part before client
                    const baseName = pathEnd.replace('-client', '').replace('.client', '');
                    if (baseName && baseName !== 'react-dom') {
                      return `react-dom-${baseName}`;
                    }
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
            // AI services - ultra-aggressive splitting for better bundle sizes
            if (id.includes('@google/genai')) {
              // Split by core modules first - ultra aggressive approach
              if (id.includes('index.js') || id.includes('index.mjs')) {
                // Split index further by size
                if (id.includes('/dist/') || id.includes('/lib/')) {
                  const pathParts = id.split('/');
                  const parentDir = pathParts[pathParts.length - 2];
                  if (parentDir === 'dist' || parentDir === 'lib') {
                    // Even more granular splitting for index
                    if (id.includes('genai/index')) {
                      return 'ai-index-core';
                    }
                    return 'ai-index-sub';
                  }
                }
                return 'ai-index';
              }
              
              // Core generation modules - split aggressively
              if (id.includes('generateContent') || id.includes('generate_content')) {
                if (id.includes('stream') || id.includes('Stream')) {
                  return 'ai-generate-stream';
                }
                return 'ai-generate-content';
              }
              if (id.includes('/generators/') || id.includes('generate')) {
                // Split different generator types
                if (id.includes('text') || id.includes('chat')) {
                  return 'ai-generators-text';
                }
                if (id.includes('embed') || id.includes('embedding')) {
                  return 'ai-generators-embed';
                }
                return 'ai-generators-core';
              }
              
              // Chat and content modules
              if (id.includes('/chat/') || id.includes('chat') || id.includes('Chat')) {
                return 'ai-chat';
              }
              if (id.includes('/models/') || id.includes('getModel') || id.includes('listModels')) {
                return 'ai-models';
              }
              
              // Protocols and gRPC - split very granularly
              if (id.includes('protos') || id.includes('grpc') || id.includes('proto')) {
                if (id.includes('protobuf') || id.includes('proto.js')) {
                  return 'ai-protobuf';
                }
                if (id.includes('google') || id.includes('gax')) {
                  return 'ai-gax';
                }
                return 'ai-protocol';
              }
              
              // Client and authentication - split carefully
              if (id.includes('client')) {
                if (id.includes('auth') || id.includes('credentials')) {
                  return 'ai-client-auth';
                }
                return 'ai-client-core';
              }
              
              // Streaming and network
              if (id.includes('stream') || id.includes('Stream')) {
                return 'ai-streaming';
              }
              if (id.includes('request') || id.includes('response')) {
                return 'ai-requests';
              }
              
              // AI utilities - split by functionality
              if (id.includes('util') || id.includes('helper') || id.includes('validate')) {
                if (id.includes('transform') || id.includes('convert')) {
                  return 'ai-utils-transform';
                }
                if (id.includes('base64') || id.includes('encoding')) {
                  return 'ai-utils-encoding';
                }
                return 'ai-utils-core';
              }
              
              // Function calls and tools
              if (id.includes('function_call') || id.includes('function-call') || id.includes('tool')) {
                return 'ai-function-calls';
              }
              
              // Specialized AI functionality
              if (id.includes('embedding') || id.includes('embed')) {
                return 'ai-embeddings';
              }
              if (id.includes('text') || id.includes('content')) {
                return 'ai-content';
              }
              if (id.includes('error') || id.includes('exception') || id.includes('fault')) {
                return 'ai-errors';
              }
              if (id.includes('config') || id.includes('setting') || id.includes('option')) {
                return 'ai-config';
              }
              
              // Split remaining modules by path
              if (id.includes('/dist/') || id.includes('/lib/')) {
                const pathParts = id.split('/');
                const moduleName = pathParts[pathParts.length - 1]?.replace(/\.(js|mjs|cjs)$/, '');
                if (moduleName && moduleName !== 'index') {
                  return `ai-module-${moduleName}`;
                }
              }
              
              return 'ai-vendor-core';
            }
            // Chart libraries - ultra-aggressive splitting to minimize bundle sizes
            if (id.includes('recharts')) {
              // Major chart types - split very granularly
              if (id.includes('AreaChart')) {
                return 'chart-area';
              }
              if (id.includes('LineChart')) {
                return 'chart-line';
              }
              if (id.includes('ComposedChart')) {
                return 'chart-composed';
              }
              if (id.includes('PieChart')) {
                return 'chart-pie';
              }
              if (id.includes('BarChart')) {
                return 'chart-bar';
              }
              if (id.includes('RadarChart')) {
                return 'chart-radar';
              }
              if (id.includes('ScatterChart')) {
                return 'chart-scatter';
              }
              if (id.includes('Treemap') || id.includes('Sankey') || id.includes('Funnel')) {
                return 'chart-specialized';
              }
              
              // Core charts consolidation
              if (id.includes('Chart')) {
                if (id.includes('Cartesian') || id.includes('cartesian')) {
                  return 'chart-cartesian';
                }
                if (id.includes('Polar') || id.includes('polar')) {
                  return 'chart-polar';
                }
                // Generic chart components
                if (id.includes('chart')) {
                  const chartType = id.split('/').pop();
                  if (chartType && chartType !== 'index') {
                    return `chart-${chartType.replace(/\.(js|mjs|cjs)$/, '')}`;
                  }
                }
                return 'chart-core';
              }
              
              // Individual chart components - split more aggressively
              if (id.includes('XAxis')) {
                return 'chart-xaxis';
              }
              if (id.includes('YAxis')) {
                return 'chart-yaxis';
              }
              if (id.includes('CartesianGrid')) {
                return 'chart-grid';
              }
              if (id.includes('Tooltip')) {
                return 'chart-tooltip';
              }
              if (id.includes('Legend')) {
                return 'chart-legend';
              }
              if (id.includes('Brush')) {
                return 'chart-brush';
              }
              if (id.includes('ReferenceLine')) {
                return 'chart-reference';
              }
              if (id.includes('ReferenceArea')) {
                return 'chart-areas';
              }
              if (id.includes('ResponsiveContainer')) {
                return 'chart-responsive';
              }
              
              // Core recharts utilities - split further
              if (id.includes('shape')) {
                const shapeType = id.split('/').pop();
                if (shapeType && shapeType !== 'index') {
                  if (shapeType.includes('Symbol') || shapeType.includes('symbol')) {
                    return 'chart-symbols';
                  }
                  if (shapeType.includes('Cross') || shapeType.includes('Rect')) {
                    return 'chart-shapes-basic';
                  }
                }
                return 'chart-shapes';
              }
              if (id.includes('scale')) {
                const scaleType = id.split('/').pop();
                if (scaleType && scaleType !== 'index') {
                  return `chart-scale-${scaleType.replace(/\.(js|mjs|cjs)$/, '')}`;
                }
                return 'chart-scales';
              }
              if (id.includes('Animation') || id.includes('animation')) {
                return 'chart-animations';
              }
              if (id.includes('util')) {
                const utilType = id.split('/').pop();
                if (utilType && utilType !== 'index') {
                  if (utilType.includes('Chart') || utilType.includes('Data')) {
                    return 'chart-utils-data';
                  }
                  return `chart-util-${utilType.replace(/\.(js|mjs|cjs)$/, '')}`;
                }
                return 'chart-utils';
              }
              
              // Polar components split
              if (id.includes('PolarAngleAxis')) {
                return 'chart-polar-angle';
              }
              if (id.includes('PolarRadiusAxis')) {
                return 'chart-polar-radius';
              }
              if (id.includes('PolarGrid')) {
                return 'chart-polar-grid';
              }
              
              // Cartesian components split
              if (id.includes('XAxis')) {
                return 'chart-xaxis';
              }
              if (id.includes('YAxis')) {
                return 'chart-yaxis';
              }
              if (id.includes('ZAxis')) {
                return 'chart-zaxis';
              }
              
              // Generic recharts modules - ultra granular split
              const modulePath = id.split('/');
              const moduleName = modulePath[modulePath.length - 1]?.replace(/\.(js|mjs|cjs)$/, '');
              if (moduleName && moduleName !== 'index' && !moduleName.includes('Chart')) {
                return `chart-module-${moduleName}`;
              }
              
              return 'chart-vendor-light';
            }
            // Security utilities - bundled together
            if (id.includes('dompurify') || id.includes('lz-string')) {
              return 'security-vendor';
            }
            // Ultra-aggressive vendor-misc splitting to reduce bundle sizes
            if (id.includes('lodash')) {
              // Split lodash modules very granularly
              if (id.includes('lodash.fp')) {
                return 'vendor-lodash-fp';
              }
              if (id.includes('lodash-es')) {
                return 'vendor-lodash-es';
              }
              const lodashModule = id.split('/').pop()?.replace(/\.(js|mjs|cjs)$/, '');
              if (lodashModule && lodashModule !== 'lodash' && lodashModule !== 'index') {
                return `vendor-lodash-${lodashModule}`;
              }
              return 'vendor-lodash-core';
            }
            if (id.includes('es-toolkit')) {
              return 'vendor-utils';
            }
            // Date libraries - split individually
            if (id.includes('moment')) {
              return 'vendor-moment';
            }
            if (id.includes('dayjs')) {
              return 'vendor-dayjs';
            }
            if (id.includes('date') || id.includes('date-fns')) {
              return 'vendor-date';
            }
            // Crypto and security libraries
            if (id.includes('crypto') || id.includes('hash') || id.includes('encryption')) {
              if (id.includes('crypto-js')) {
                return 'vendor-crypto-js';
              }
              return 'vendor-crypto';
            }
            // HTTP and networking libraries
            if (id.includes('axios')) {
              return 'vendor-axios';
            }
            if (id.includes('fetch') || id.includes('node-fetch')) {
              return 'vendor-fetch';
            }
            if (id.includes('xhr') || id.includes('xmlhttprequest')) {
              return 'vendor-xhr';
            }
            // String manipulation libraries
            if (id.includes('string') || id.includes('sprintf') || id.includes('format')) {
              return 'vendor-string';
            }
            // Validation and schema libraries
            if (id.includes('joi') || id.includes('yup') || id.includes('zod') || id.includes('ajv')) {
              return 'vendor-validation';
            }
            // Promise and async utilities
            if (id.includes('promise') || id.includes('async') || id.includes('rxjs')) {
              return 'vendor-async';
            }
            // Event handling
            if (id.includes('event') || id.includes('emitter') || id.includes('mitt')) {
              return 'vendor-events';
            }
            // Math utilities
            if (id.includes('math') || id.includes('big') || id.includes('decimal')) {
              return 'vendor-math';
            }
            // Object utilities
            if (id.includes('deep') || id.includes('merge') || id.includes('clone')) {
              return 'vendor-object';
            }
            // File/path utilities
            if (id.includes('path') || id.includes('file') || id.includes('fs')) {
              return 'vendor-file';
            }
            // Type checking and utilities
            if (id.includes('typeof') || id.includes('is') || id.includes('type')) {
              return 'vendor-types';
            }
            
            // Split remaining vendor modules by package name
            const vendorPath = id.split('node_modules/')[1];
            if (vendorPath) {
              const packageName = vendorPath.split('/')[0];
              if (packageName && packageName !== 'lodash' && packageName !== 'moment' && packageName !== 'dayjs') {
                return `vendor-${packageName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
              }
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