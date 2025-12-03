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
          // Optimized vendor chunks for better caching and reduced fragmentation
          if (id.includes('node_modules')) {
            // Consolidated React ecosystem for optimal edge caching
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // Charts and visualization
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            // Backend services consolidated
            if (id.includes('@google/genai') || id.includes('@supabase')) {
              return 'vendor-backend';
            }
            // Security and utilities consolidated
            if (id.includes('dompurify') || id.includes('lz-string')) {
              return 'vendor-utils';
            }
            // Development tools (excluded from production chunks)
            if (id.includes('typescript') || id.includes('@types') || id.includes('@testing-library') || id.includes('vitest') || id.includes('eslint')) {
              return 'dev-tools';
            }
            // All other node_modules
            return 'vendor-misc';
          }
          
          // Optimized app chunks with reduced fragmentation
          if (id.includes('services/')) {
            // Core services that are frequently used together
            if (id.includes('supabase') || id.includes('database') || id.includes('cache')) {
              return 'services-core';
            }
            // AI and simulation services
            if (id.includes('gemini') || id.includes('simulation') || id.includes('ai')) {
              return 'services-ai';
            }
            // Edge and performance services
            if (id.includes('edge') || id.includes('performance') || id.includes('vercel')) {
              return 'services-edge';
            }
            return 'services-other';
          }
          
          // Component chunks optimized for lazy loading
          if (id.includes('components/')) {
            // Heavy components that should be lazy-loaded
            if (id.includes('CodeEditor') || id.includes('ChatInterface')) {
              return 'components-heavy';
            }
            // Chart and visualization components
            if (id.includes('BacktestPanel') || id.includes('ChartComponents')) {
              return 'components-charts';
            }
            // Form and configuration components
            if (id.includes('StrategyConfig') || id.includes('NumericInput') || id.includes('AISettingsModal')) {
              return 'components-forms';
            }
            // Layout and core UI components
            if (id.includes('Layout') || id.includes('Auth') || id.includes('LoadingState') || id.includes('ErrorBoundary')) {
              return 'components-core';
            }
            return 'components-other';
          }
          
          // Page chunks with route-based splitting
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
          
          // Utility chunks consolidated
          if (id.includes('utils/')) {
            if (id.includes('performance') || id.includes('seo') || id.includes('security') || id.includes('validation')) {
              return 'utils-core';
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
    chunkSizeWarningLimit: 250, // Optimized for edge performance - smaller chunks
    target: 'es2020',
    reportCompressedSize: true,
    cssCodeSplit: true,
    // Enhanced edge optimization
    assetsInlineLimit: 4096, // 4KB for better caching
    modulePreload: {
      polyfill: false
    },
    // Additional build optimizations
    emptyOutDir: true,
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
