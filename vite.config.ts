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
          // Optimized chunking for better bundle sizes and edge performance
          if (id.includes('node_modules')) {
<<<<<<< HEAD
            // React ecosystem - simplified for better caching
            if (id.includes('react-dom') || id.includes('ReactDOM')) {
              return 'react-dom';
            }
            if (id.includes('react-router')) {
              return 'react-router';
            }
            if (id.includes('react')) {
              if (id.includes('react/jsx-runtime') || id.includes('react-jsx')) {
                return 'react-jsx';
              }
              return 'react-core';
            }
            
            // AI SDK - force maximum possible splitting to minimize chunk sizes
            if (id.includes('@google/genai')) {
              // Ultra-aggressive detection - split by ANY unique pattern
              const idStr = id.toLowerCase();
              
              // Split by every identifiable component
              if (idStr.includes('client') || idStr.includes('googlegenai')) {
                return 'ai-client';
              }
              if (idStr.includes('generate') || idStr.includes('content')) {
                return 'ai-generators';
              }
              if (idStr.includes('model') || idStr.includes('gemini')) {
                return 'ai-models';
              }
              if (idStr.includes('type') || idStr.includes('schema')) {
                return 'ai-types';
              }
              if (idStr.includes('transport') || idStr.includes('http') || idStr.includes('request')) {
                return 'ai-transport';
              }
              if (idStr.includes('stream') || idStr.includes('sse')) {
                return 'ai-streaming';
              }
              if (idStr.includes('auth') || idStr.includes('credential')) {
                return 'ai-auth';
              }
              if (idStr.includes('error') || idStr.includes('exception')) {
                return 'ai-errors';
              }
              if (idStr.includes('util') || idStr.includes('helper')) {
                return 'ai-utils';
              }
              if (idStr.includes('vision') || idStr.includes('image')) {
                return 'ai-vision';
              }
              if (idStr.includes('chat') || idStr.includes('conversation')) {
                return 'ai-chat';
              }
              
              // Split by individual file names - most aggressive approach
              const segments = id.split('/');
              const lastSegment = segments[segments.length - 1];
              
              if (lastSegment && lastSegment.includes('.')) {
                const baseName = lastSegment.replace(/\.(js|mjs|ts|tsx)$/, '');
                if (baseName && baseName !== 'index' && baseName !== 'genai') {
                  return `ai-${baseName}`;
                }
              }
              
              // Split by any non-genai path segment
              for (let i = segments.length - 2; i >= 0; i--) {
                const segment = segments[i];
                if (segment && 
                    !segment.includes('@google') && 
                    !segment.includes('genai') && 
                    !segment.includes('node_modules') &&
                    segment.length > 1) {
                  return `ai-${segment.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
                }
              }
              
              // Last resort - create multiple smaller chunks
              const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const chunkSuffix = hash % 5; // Create 5 different chunks
              return `ai-part-${chunkSuffix}`;
            }
            
            // Charts - simplified usage-based splitting to fix 208KB chunk
            if (id.includes('recharts')) {
              // Split by actual chart types used in the app
              if (id.includes('PieChart') || id.includes('Pie')) {
                return 'chart-pie';
              }
              if (id.includes('AreaChart') || id.includes('Area')) {
                return 'chart-area';
              }
              if (id.includes('LineChart') || id.includes('Line')) {
                return 'chart-line';
              }
              if (id.includes('BarChart') || id.includes('Bar')) {
                return 'chart-bar';
              }
              // Core components that are shared
              if (id.includes('ResponsiveContainer') || id.includes('Tooltip') || id.includes('Legend')) {
                return 'chart-core';
              }
              if (id.includes('XAxis') || id.includes('YAxis') || id.includes('CartesianGrid')) {
                return 'chart-axes';
              }
              // Default recharts vendor - should be much smaller now
              return 'chart-vendor';
            }
            
            // Supabase - simplified splitting
            if (id.includes('@supabase')) {
              if (id.includes('auth') || id.includes('gotrue')) {
                return 'supabase-auth';
              }
              if (id.includes('realtime') || id.includes('websocket')) {
                return 'supabase-realtime';
              }
              if (id.includes('storage')) {
                return 'supabase-storage';
              }
              if (id.includes('postgrest') || id.includes('database')) {
                return 'supabase-database';
              }
              return 'supabase-core';
            }
            
            // Security utilities
            if (id.includes('dompurify') || id.includes('lz-string')) {
              return 'security-vendor';
            }
            
            // Enhanced vendor library splitting for better granulation
            if (id.includes('date-fns') || id.includes('moment') || id.includes('dayjs')) {
              return 'vendor-datetime';
            }
            if (id.includes('axios') || id.includes('fetch')) {
              return 'vendor-http';
            }
            if (id.includes('lodash') || id.includes('underscore')) {
              return 'vendor-utils';
            }
            if (id.includes('classnames') || id.includes('clsx')) {
              return 'vendor-classes';
            }
            if (id.includes('string') || id.includes('text')) {
              return 'vendor-strings';
            }
            if (id.includes('math') || id.includes('calculation')) {
              return 'vendor-math';
            }
            if (id.includes('event') || id.includes('promise')) {
              return 'vendor-events';
            }
            if (id.includes('collection') || id.includes('array')) {
              return 'vendor-collections';
            }
            if (id.includes('validation') || id.includes('zod') || id.includes('yup')) {
              return 'vendor-validation';
            }
            // Aggressively split vendor-misc (138KB) into smaller chunks
            if (id.includes('react') && !id.includes('react-dom') && !id.includes('react-router')) {
              if (id.includes('jsx') || id.includes('createElement')) {
                return 'vendor-react-jsx';
              }
              return 'vendor-react-core';
            }
            if (id.includes('dom') || id.includes('html') || id.includes('window')) {
              return 'vendor-dom';
            }
            if (id.includes('url') || id.includes('path') || id.includes('query')) {
              return 'vendor-url';
            }
            if (id.includes('buffer') || id.includes('stream') || id.includes('binary')) {
              return 'vendor-binary';
            }
            if (id.includes('crypto') || id.includes('hash') || id.includes('encryption')) {
              return 'vendor-crypto';
            }
            if (id.includes('json') || id.includes('parse') || id.includes('stringify')) {
              return 'vendor-json';
            }
            if (id.includes('async') || id.includes('promise') || id.includes('callback')) {
              return 'vendor-async';
            }
            // Split remaining misc by library name
            const libMatch = id.match(/node_modules\/([^\/]+)/);
            if (libMatch && libMatch[1]) {
              const libName = libMatch[1];
              if (libName !== '@google' && libName !== 'react' && libName !== 'recharts') {
                return `vendor-${libName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
              }
            }
            
            // Final fallback for misc
=======
            // React ecosystem - granular splitting for better performance
            if (id.includes('react')) {
              if (id.includes('react-dom')) {
                return 'react-dom';
              }
              if (id.includes('react-router') || id.includes('react-router-dom')) {
                return 'react-router';
              }
              return 'react-core';
            }
            // React additional libraries
            if (id.includes('react-is')) {
              return 'react-utils';
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
            
            // AI services - ultra granular splitting for better optimization
            if (id.includes('@google/genai')) {
              if (id.includes('generators')) {
                return 'ai-generators';
              }
              if (id.includes('models')) {
                return 'ai-models';
              }
              if (id.includes('chat') || id.includes('generation') || id.includes('content')) {
                return 'ai-generation';
              }
              if (id.includes('vertex') || id.includes('platform')) {
                return 'ai-platform';
              }
              if (id.includes('proto') || id.includes('grpc')) {
                return 'ai-proto';
              }
              return 'ai-core';
            }
            
            // Chart libraries - ultra granular splitting
            if (id.includes('recharts')) {
              if (id.includes('chart') && (id.includes('AreaChart') || id.includes('LineChart') || id.includes('ComposedChart'))) {
                return 'chart-line';
              }
              if (id.includes('chart') && (id.includes('PieChart') || id.includes('BarChart') || id.includes('RadarChart'))) {
                return 'chart-categorical';
              }
              if (id.includes('shape') || id.includes('Area') || id.includes('Line') || id.includes('Bar')) {
                return 'chart-shapes';
              }
              if (id.includes('cartesian') || id.includes('XAxis') || id.includes('YAxis') || id.includes('Grid')) {
                return 'chart-axes';
              }
              if (id.includes('ResponsiveContainer') || id.includes('Tooltip') || id.includes('Legend')) {
                return 'chart-containers';
              }
              return 'chart-core';
            }
            
            // Security utilities - split individually
            if (id.includes('dompurify')) {
              return 'security-dompurify';
            }
            if (id.includes('lz-string')) {
              return 'security-compression';
            }
            
            // Build and development tools
            if (id.includes('vite') || id.includes('@vitejs')) {
              return 'build-vendor';
            }
            
            // TypeScript and type-related
            if (id.includes('typescript') || id.includes('@types')) {
              return 'types-vendor';
            }
            
            // Testing libraries (should be separate)
            if (id.includes('@testing-library') || id.includes('vitest') || id.includes('jsdom')) {
              return 'testing-vendor';
            }
            
            // ESLint and linting
            if (id.includes('eslint') || id.includes('@typescript-eslint')) {
              return 'lint-vendor';
            }
            
            // Terser (minification)
            if (id.includes('terser')) {
              return 'minify-vendor';
            }
            
            // All other vendor libraries
>>>>>>> a50d27a (Optimize Bundle Splitting - Enhanced Performance v1.7)
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
          
          // Enhanced component chunking for optimal distribution
          if (id.includes('components/')) {
            // Heavy components isolated with better granularization
            if (id.includes('ChatInterface')) {
              return 'component-chat';
            }
            if (id.includes('CodeEditor')) {
              return 'component-editor';
            }
            if (id.includes('BacktestPanel')) {
              return 'component-backtest';
            }
            if (id.includes('ChartComponents') || id.includes('Chart')) {
              return 'component-charts';
            }
            if (id.includes('StrategyConfig')) {
              return 'component-config';
            }
            if (id.includes('MarketTicker')) {
              return 'component-trading';
            }
            // Split UI components into smaller chunks
            if (id.includes('Modal') || id.includes('Dialog')) {
              return 'component-modals';
            }
            if (id.includes('Toast') || id.includes('Notification')) {
              return 'component-notifications';
            }
            if (id.includes('ErrorBoundary') || id.includes('Error')) {
              return 'component-error-handling';
            }
            if (id.includes('LoadingState') || id.includes('Loading') || id.includes('Spinner')) {
              return 'component-loading';
            }
            // Auth components
            if (id.includes('Auth') || id.includes('Login') || id.includes('Signup')) {
              return 'component-auth';
            }
            // Form and input components
            if (id.includes('Input') || id.includes('Form') || id.includes('Field') || id.includes('NumericInput')) {
              return 'component-forms';
            }
            // Layout components
            if (id.includes('Layout') || id.includes('Sidebar') || id.includes('Header') || id.includes('Footer')) {
              return 'component-layout';
            }
            // List and table components
            if (id.includes('List') || id.includes('Table') || id.includes('Grid') || id.includes('VirtualScroll')) {
              return 'component-lists';
            }
            // Button and action components
            if (id.includes('Button') || id.includes('Action') || id.includes('Link')) {
              return 'component-actions';
            }
            // Core components fallback
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
<<<<<<< HEAD
      '@supabase/supabase-js',
      // Remove @google/genai from pre-bundling to force dynamic splitting
      'recharts',
      'dompurify',
      'lz-string'
=======
      '@supabase/supabase-js'
>>>>>>> a50d27a (Optimize Bundle Splitting - Enhanced Performance v1.7)
    ],
    exclude: [
      // Edge-specific modules
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
<<<<<<< HEAD
      // Force dynamic loading for heavy dependencies
      '@google/genai', // Completely exclude from pre-bundling
      '@google/genai/dist/generators',
      '@google/genai/dist/models',
      '@google/genai/dist/clients',
      '@google/genai/dist/transport',
      '@google/genai/dist/auth',
      '@google/genai/dist/streaming',
=======
      
      // Heavy dependencies for dynamic loading
      '@google/genai',
>>>>>>> a50d27a (Optimize Bundle Splitting - Enhanced Performance v1.7)
      '@supabase/realtime-js',
      '@supabase/storage-js',
      'recharts',
      'recharts/es6',
      'recharts/es6/components/ResponsiveContainer',
      'recharts/es6/chart/AreaChart',
      'recharts/es6/chart/LineChart',
      'recharts/es6/chart/BarChart',
      'recharts/es6/chart/PieChart',
<<<<<<< HEAD
=======
      'dompurify',
>>>>>>> a50d27a (Optimize Bundle Splitting - Enhanced Performance v1.7)
      'dompurify/dist/purify.cjs',
      'lz-string',
      
      // Testing and development dependencies
      '@testing-library/jest-dom',
      '@testing-library/react',
      '@testing-library/user-event',
      'jsdom',
      'vitest',
      '@vitest/coverage-v8',
      '@vitest/ui',
      'eslint',
      'eslint-plugin-react',
      'eslint-plugin-react-hooks',
      'eslint-plugin-react-refresh',
      '@typescript-eslint/eslint-plugin',
      '@typescript-eslint/parser',
      'terser'
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