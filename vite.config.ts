import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { getBuildConfig } from './constants/config';

// Get dynamic build configuration
const buildConfig = getBuildConfig();

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    outDir: 'dist',
    sourcemap: buildConfig.SOURCE_MAP_DEV,
    target: 'esnext',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: (id) => {
          // Enhanced chunking for better Vercel edge performance
          if (id.includes('node_modules')) {
            // React ecosystem - split more granularly for better caching
            if (id.includes('react')) {
              // React core library
              if (id.includes('react/index') || id.includes('react/umd/react')) {
                return 'react-core';
              }
              // React DOM
              if (id.includes('react-dom') || id.includes('ReactDOM')) {
                return 'react-dom';
              }
              // React Router - split further
              if (id.includes('react-router')) {
                if (id.includes('dom') || id.includes('BrowserRouter')) {
                  return 'react-router-dom';
                }
                if (id.includes('memory') || id.includes('MemoryRouter')) {
                  return 'react-router-memory';
                }
                return 'react-router';
              }
              // React dev tools
              if (id.includes('react-devtools')) {
                return 'react-devtools';
              }
              // React hooks API
              if (id.includes('react/dist/react-jsx-dev') || id.includes('react/jsx-runtime')) {
                return 'react-jsx';
              }
              // React reconciliation and scheduler
              if (id.includes('scheduler') || id.includes('reconciler')) {
                return 'react-scheduler';
              }
              // React is utility
              if (id.includes('react-is')) {
                return 'react-is';
              }
              // Default react catch-all
              return 'react-misc';
            }
            // Supabase - split more aggressively for better connection pooling
            if (id.includes('@supabase')) {
              // Supabase auth - isolated for authentication flows
              if (id.includes('auth') || id.includes('Auth') || id.includes('gotrue')) {
                return 'supabase-auth';
              }
              // Supabase real-time - isolated for WebSocket connections
              if (id.includes('realtime') || id.includes('Realtime') || id.includes('websocket') || id.includes('ws')) {
                return 'supabase-realtime';
              }
              // Supabase storage - isolated for file operations
              if (id.includes('storage') || id.includes('Storage') || id.includes('upload') || id.includes('file')) {
                return 'supabase-storage';
              }
              // Supabase database - core client
              if (id.includes('postgrest') || id.includes('database') || id.includes('db')) {
                return 'supabase-database';
              }
              // Supabase functions - isolated for edge functions
              if (id.includes('functions') || id.includes('edge') || id.includes('invoke')) {
                return 'supabase-functions';
              }
              // Default supabase vendor - much smaller now
              return 'supabase-vendor';
            }
            // AI services - split more aggressively to reduce chunk sizes
            if (id.includes('@google/genai')) {
              // Core AI models and generators - split further
              if (id.includes('generators') || id.includes('generate')) {
                if (id.includes('text') || id.includes('Text')) {
                  return 'ai-text-generation';
                }
                if (id.includes('chat') || id.includes('Chat')) {
                  return 'ai-chat-generation';
                }
                return 'ai-generators';
              }
              // AI models - split further
              if (id.includes('models') || id.includes('Model')) {
                if (id.includes('gemini') || id.includes('Gemini')) {
                  return 'ai-gemini-models';
                }
                if (id.includes('embedding') || id.includes('Embedding')) {
                  return 'ai-embedding-models';
                }
                return 'ai-models';
              }
              // Text processing and embeddings - split further
              if (id.includes('embeddings')) {
                return 'ai-embeddings';
              }
              if (id.includes('tokens') || id.includes('Token')) {
                return 'ai-tokenization';
              }
              if (id.includes('text') || id.includes('Text')) {
                return 'ai-text-processing';
              }
              if (id.includes('embeddings') || id.includes('tokens') || id.includes('text')) {
                return 'ai-processors';
              }
              // AI client and configuration - split further
              if (id.includes('client')) {
                return 'ai-client-core';
              }
              if (id.includes('config') || id.includes('Config')) {
                return 'ai-config';
              }
              if (id.includes('auth') || id.includes('Auth')) {
                return 'ai-auth';
              }
              if (id.includes('client') || id.includes('config') || id.includes('auth')) {
                return 'ai-client';
              }
              // Chat and conversation handling - split further
              if (id.includes('chat') || id.includes('conversation') || id.includes('messages')) {
                if (id.includes('history') || id.includes('History')) {
                  return 'ai-chat-history';
                }
                if (id.includes('streaming') || id.includes('Stream')) {
                  return 'ai-chat-streaming';
                }
                return 'ai-chat';
              }
              // AI request/response handling
              if (id.includes('request') || id.includes('Response') || id.includes('http')) {
                return 'ai-api-handlers';
              }
              // AI error handling and retry logic
              if (id.includes('error') || id.includes('retry') || id.includes('circuit')) {
                return 'ai-error-handling';
              }
              // AI content generation and processing
              if (id.includes('generate') || id.includes('completion') || id.includes('model')) {
                if (id.includes('text') || id.includes('content')) {
                  return 'ai-text-generation';
                }
                if (id.includes('code') || id.includes('compile')) {
                  return 'ai-code-generation';
                }
                return 'ai-generation';
              }
              // AI vendor SDKs - split by provider
              if (id.includes('google') || id.includes('gemini')) {
                if (id.includes('vertex') || id.includes('cloud')) {
                  return 'ai-google-cloud';
                }
                // Google AI core SDK components
                if (id.includes('generators') || id.includes('generateText') || id.includes('generateContent')) {
                  return 'ai-google-generators';
                }
                // Google AI models and configuration
                if (id.includes('models') || id.includes('Model') || id.includes('config')) {
                  return 'ai-google-models';
                }
                // Google AI transport and networking
                if (id.includes('transport') || id.includes('http') || id.includes('request')) {
                  return 'ai-google-transport';
                }
                // Google AI authentication and credentials
                if (id.includes('auth') || id.includes('credentials') || id.includes('google-auth')) {
                  return 'ai-google-auth';
                }
                // Google AI error handling
                if (id.includes('error') || id.includes('errors') || id.includes('exception')) {
                  return 'ai-google-errors';
                }
                return 'ai-google-gemini';
              }
              if (id.includes('openai') || id.includes('gpt') || id.includes('chatgpt')) {
                return 'ai-openai';
              }
              if (id.includes('anthropic') || id.includes('claude')) {
                return 'ai-anthropic';
              }
              // AI validation and parsing
              if (id.includes('validate') || id.includes('parse') || id.includes('extract')) {
                return 'ai-validation';
              }
              // Default AI vendor - much smaller now
              return 'ai-vendor';
            }
            // Chart libraries - split more aggressively to reduce chunk sizes
            if (id.includes('recharts')) {
              // Core chart components - split further
              if (id.includes('AreaChart') || id.includes('LineChart')) {
                if (id.includes('chart') && id.includes('Area')) {
                  return 'chart-area';
                }
                if (id.includes('chart') && id.includes('Line')) {
                  return 'chart-line';
                }
                return 'chart-core';
              }
              // Pie and bar charts - split further
              if (id.includes('PieChart')) {
                return 'chart-pie';
              }
              if (id.includes('BarChart')) {
                return 'chart-bar';
              }
              if (id.includes('PieChart') || id.includes('BarChart')) {
                return 'chart-misc';
              }
              // Responsive components - usually larger
              if (id.includes('ResponsiveContainer')) {
                return 'chart-responsive';
              }
              // Axes and grid components - split further
              if (id.includes('CartesianGrid')) {
                return 'chart-grid';
              }
              if (id.includes('XAxis')) {
                return 'chart-xaxis';
              }
              if (id.includes('YAxis')) {
                return 'chart-yaxis';
              }
              if (id.includes('CartesianGrid') || id.includes('XAxis') || id.includes('YAxis')) {
                return 'chart-axes';
              }
              // Tooltip and legend components - split further
              if (id.includes('Tooltip')) {
                return 'chart-tooltip';
              }
              if (id.includes('Legend')) {
                return 'chart-legend';
              }
              if (id.includes('Tooltip') || id.includes('Legend')) {
                return 'chart-tooltips';
              }
              // Cells and styling - split further
              if (id.includes('Cell')) {
                return 'chart-cells';
              }
              if (id.includes('Brush')) {
                return 'chart-brush';
              }
              if (id.includes('Cell') || id.includes('Brush')) {
                return 'chart-styling';
              }
              // Recharts shape components
              if (id.includes('shapes') || id.includes('Shape') || id.includes('Rectangle')) {
                return 'chart-shapes';
              }
              // Recharts scale and math utilities
              if (id.includes('scale') || id.includes('utils') || id.includes('math')) {
                return 'chart-utils';
              }
              // Recharts animation components
              if (id.includes('animation') || id.includes('Transition')) {
                return 'chart-animation';
              }
              // Core recharts chart types - split by function
              if (id.includes('LineChart') || id.includes('Line') || id.includes('AreaChart')) {
                return 'chart-line';
              }
              if (id.includes('ScatterChart') || id.includes('ComposedChart') || id.includes('RadarChart')) {
                return 'chart-advanced';
              }
              // Recharts data processing and transformation
              if (id.includes('Data') || id.includes('model') || id.includes('scale')) {
                return 'chart-data';
              }
              // Recharts core engine - split further
              if (id.includes('recharts/es6') || id.includes('recharts/umd')) {
                // Recharts Cartesian components
                if (id.includes('Cartesian') || id.includes('Chart')) {
                  return 'chart-cartesian-components';
                }
                // Recharts primitives and utilities
                if (id.includes('util') || id.includes('pureFn') || id.includes('Surface')) {
                  return 'chart-primitives';
                }
                // Recharts context and providers
                if (id.includes('context') || id.includes('Context') || id.includes('Provider')) {
                  return 'chart-context';
                }
                // Recharts hooks and reactive components
                if (id.includes('hooks') || id.includes('useRef') || id.includes('useState')) {
                  return 'chart-hooks';
                }
                // Recharts event handlers
                if (id.includes('event') || id.includes('handler') || id.includes('listener')) {
                  return 'chart-events';
                }
                // Recharts SVG rendering components
                if (id.includes('svg') || id.includes('render') || id.includes('draw')) {
                  return 'chart-rendering';
                }
                return 'chart-core-engine';
              }
              // Recharts cartesian system (X/Y coordinate system)
              if (id.includes('cartesian') || id.includes('PolarRadiusAxis') || id.includes('PolarAngleAxis')) {
                return 'chart-cartesian';
              }
              // Recharts polygon and shape components
              if (id.includes('Polygon') || id.includes('Sector') || id.includes('Cross')) {
                return 'chart-polygon';
              }
              // Default recharts vendor - much smaller now
              return 'chart-vendor';
            }
            // Security utilities - bundled together
            if (id.includes('dompurify') || id.includes('lz-string')) {
              return 'security-vendor';
            }
// All other vendor libraries - split more aggressively
            if (id.includes('lodash')) {
              return 'vendor-lodash';
            }
            if (id.includes('moment') || id.includes('date-fns') || id.includes('dayjs')) {
              return 'vendor-date';
            }
            if (id.includes('axios') || id.includes('fetch') || id.includes('request')) {
              return 'vendor-http';
            }
            if (id.includes('zod') || id.includes('yup') || id.includes('joi')) {
              return 'vendor-validation';
            }
            if (id.includes('classnames') || id.includes('clsx') || id.includes('cva')) {
              return 'vendor-classes';
            }
            if (id.includes('uuid') || id.includes('nanoid')) {
              return 'vendor-uuid';
            }
            if (id.includes('crypto-js') || id.includes('bcrypt') || id.includes('hash')) {
              return 'vendor-crypto';
            }
            if (id.includes('lodash') || id.includes('underscore')) {
              return 'vendor-utils';
            }
            // Miscellaneous vendor libraries - split more aggressively
            // Third-party component libraries
            if (id.includes('react-icons') || id.includes('@heroicons') || id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Date and time libraries
            if (id.includes('date-fns') || id.includes('moment') || id.includes('dayjs')) {
              return 'vendor-datetime';
            }
            // String manipulation utilities
            if (id.includes('string') || id.includes('text') || id.includes('format')) {
              return 'vendor-strings';
            }
            // Array and object manipulation utilities
            if (id.includes('array') || id.includes('object') || id.includes('collection')) {
              return 'vendor-collections';
            }
            // Math and calculation libraries
            if (id.includes('math') || id.includes('calculation') || id.includes('statistics')) {
              return 'vendor-math';
            }
            // Browser and DOM utilities
            if (id.includes('dom') || id.includes('browser') || id.includes('window')) {
              return 'vendor-browser';
            }
            // Default miscellaneous vendor - much smaller now
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
        drop_console: buildConfig.DROP_CONSOLE,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: buildConfig.TERSER_COMPRESSION_PASSES, // Dynamic configuration for optimal compression
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
    chunkSizeWarningLimit: buildConfig.CHUNK_SIZE_WARNING_LIMIT, // Dynamic configuration for edge performance
    reportCompressedSize: true,
    cssCodeSplit: buildConfig.CSS_CODE_SPLIT,
    cssMinify: buildConfig.CSS_MINIFY, // Dynamic configuration
    // Enhanced edge optimization
    assetsInlineLimit: buildConfig.ASSETS_INLINE_LIMIT, // Dynamic configuration for edge performance
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
    port: parseInt(process.env['DEV_PORT'] || '3000'),
    host: process.env['DEV_HOST'] || '0.0.0.0',
    headers: {
      'X-Edge-Optimized': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Edge-Region': process.env['VERCEL_REGION'] || 'local',
    }
  }
});