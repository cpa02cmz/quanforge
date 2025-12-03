import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    outDir: 'dist',
    sourcemap: process.env['NODE_ENV'] !== 'production' ? 'hidden' : false,
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: (id) => {
          // Enhanced vendor chunks for optimal edge caching and tree-shaking
          if (id.includes('node_modules')) {
            // React ecosystem - split more granularly for better caching
            if (id.includes('react') && !id.includes('react-dom') && !id.includes('react-router')) {
              return 'vendor-react-core';
            }
            if (id.includes('react-dom')) {
              return 'vendor-react-dom';
            }
            if (id.includes('react-router')) {
              return 'vendor-react-router';
            }
            // Enhanced Charts splitting - more granular for better performance
            if (id.includes('recharts')) {
              // Core chart components
              if (id.includes('BarChart') || id.includes('LineChart') || id.includes('AreaChart')) {
                return 'vendor-charts-core';
              }
              // Chart components and utilities
              if (id.includes('Tooltip') || id.includes('Legend') || id.includes('ResponsiveContainer')) {
                return 'vendor-charts-components';
              }
              // Advanced chart features
              return 'vendor-charts-advanced';
            }
            // AI services - isolated for better tree-shaking
            if (id.includes('@google/genai')) {
              return 'vendor-ai-gemini-dynamic';
            }
            // Enhanced Supabase splitting for better tree-shaking
            if (id.includes('@supabase/realtime-js')) {
              return 'vendor-supabase-realtime';
            }
            if (id.includes('@supabase/storage-js')) {
              return 'vendor-supabase-storage';
            }
            if (id.includes('@supabase/functions-js')) {
              return 'vendor-supabase-functions';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase-core';
            }
            // Security and utilities - consolidated
            if (id.includes('dompurify') || id.includes('lz-string')) {
              return 'vendor-security';
            }
            // Development tools - excluded from production
            if (id.includes('typescript') || id.includes('@types') || id.includes('@testing-library') || id.includes('vitest') || id.includes('eslint')) {
              return 'dev-tools';
            }
            // All other node_modules
            return 'vendor-misc';
          }
          
          // Enhanced app chunks with better separation
          if (id.includes('services/')) {
            // Core database services - critical path
            if (id.includes('supabase') || id.includes('database') || id.includes('cache')) {
              return 'services-database-critical';
            }
            // AI and simulation services
            if (id.includes('gemini') || id.includes('simulation') || id.includes('ai')) {
              return 'services-ai';
            }
            // Edge and performance services - critical for edge deployment
            if (id.includes('edge') || id.includes('performance') || id.includes('vercel')) {
              return 'services-edge-critical';
            }
            // Security services
            if (id.includes('security') || id.includes('validation')) {
              return 'services-security';
            }
            return 'services-other';
          }
          
          // Enhanced component chunks for optimal lazy loading
          if (id.includes('components/')) {
            // Heavy components - isolated for lazy loading
            if (id.includes('CodeEditor') || id.includes('ChatInterface')) {
              return 'components-heavy';
            }
            // Chart and visualization components
            if (id.includes('BacktestPanel') || id.includes('ChartComponents')) {
              return 'components-charts';
            }
            // Modal components
            if (id.includes('Modal') || id.includes('AISettingsModal') || id.includes('DatabaseSettingsModal')) {
              return 'components-modals';
            }
            // Form and configuration components
            if (id.includes('StrategyConfig') || id.includes('NumericInput')) {
              return 'components-forms';
            }
            // Layout and core UI components
            if (id.includes('Layout') || id.includes('Auth') || id.includes('LoadingState') || id.includes('ErrorBoundary')) {
              return 'components-core';
            }
            return 'components-other';
          }
          
          // Enhanced page chunks with better route splitting
          if (id.includes('pages/')) {
            if (id.includes('Generator')) {
              return 'page-generator';
            }
            if (id.includes('Dashboard')) {
              return 'page-dashboard';
            }
            // Static pages grouped together
            if (id.includes('About') || id.includes('FAQ') || id.includes('Features') || id.includes('Wiki') || id.includes('Blog')) {
              return 'page-static';
            }
            return 'pages-other';
          }
          
          // Enhanced utility chunks
          if (id.includes('utils/')) {
            if (id.includes('lazyLoader') || id.includes('performance')) {
              return 'utils-performance';
            }
            if (id.includes('seo') || id.includes('enhancedSEO')) {
              return 'utils-seo';
            }
            if (id.includes('security') || id.includes('validation')) {
              return 'utils-security';
            }
            return 'utils-other';
          }
          
          // Constants and assets
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
        if (warning.code === 'UNUSED_EXTERNAL_IMPORT') return;
        warn(warning);
      },
      // Enhanced tree-shaking
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
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'],
        passes: 5, // Increased for maximum compression
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
        side_effects: true,
        // New optimizations for better tree-shaking
        toplevel: true,
        // Add missing optimizations for better compression
        arrows: true,
        computed_props: true,
        hoist_props: true,
        properties: true,
        // Edge-specific optimizations
        keep_fargs: false,
        keep_fnames: false,
        ecma: 2020
      },
      mangle: {
        safari10: true,
        // Enhanced mangling for better compression
        toplevel: true,
        properties: {
          regex: /^_/
        },
        reserved: ['React', 'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'lazy'],
        // Add missing mangling options
        keep_classnames: false,
        keep_fnames: false,
        module: false
      },
      format: {
        comments: false
      }
    },
    chunkSizeWarningLimit: 150, // Further reduced for optimal edge performance
    target: ['es2020', 'edge101'], // More specific targets for edge compatibility
    reportCompressedSize: true,
    cssCodeSplit: true,
    cssMinify: true, // Add CSS minification
    // Enhanced edge optimization
    assetsInlineLimit: 1024, // 1KB for better caching and smaller initial chunks
    modulePreload: {
      polyfill: false
    },
    // Additional build optimizations
    emptyOutDir: true,
    // Dynamic import optimization
    dynamicImportVarsOptions: {
      warnOnError: false
    },
    // Add missing optimizations for better edge performance
    // Enhanced tree-shaking is handled in rollupOptions
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
      'node:child_process'
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
  // Experimental features for edge optimization
  experimental: {
    renderBuiltUrl(filename: string, { hostType }: { hostType: string }) {
      if (hostType === 'js') {
        return { js: `/${filename}` };
      } else {
        return { relative: true };
      }
    },
  },
});
