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
// Consolidated chunk strategy for optimal HTTP/2 performance
          if (id.includes('node_modules')) {
             // React ecosystem - split for better caching and loading
             if (id.includes('react') && id.includes('react-jsx')) {
               return 'vendor-react-jsx';
             }
             if (id.includes('react') && id.includes('react-dom')) {
               return 'vendor-react-dom';
             }
             if (id.includes('react') && !id.includes('react-dom') && !id.includes('jsx')) {
               return 'vendor-react-core';
             }
             if (id.includes('react-router')) {
               return 'vendor-react-router';
             }
            
            // Charts library - consolidated to reduce HTTP overhead
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            
            // AI services
            if (id.includes('@google/genai')) {
              return 'vendor-ai';
            }
            
            // Supabase - consolidated
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            
            // Security utilities
            if (id.includes('dompurify') || id.includes('lz-string')) {
              return 'vendor-security';
            }
            
// Charts library - consolidated to reduce HTTP overhead
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            
            // All other node_modules
            return 'vendor-misc';
          }
          
          // App chunks - simplified for better performance
          if (id.includes('services/')) {
            if (id.includes('gemini') || id.includes('ai')) {
              return 'services-ai';
            }
            if (id.includes('supabase') || id.includes('database')) {
              return 'services-db';
            }
            return 'services-other';
          }
          
          if (id.includes('components/')) {
            if (id.includes('CodeEditor') || id.includes('ChatInterface')) {
              return 'components-heavy';
            }
            if (id.includes('Chart') || id.includes('Backtest')) {
              return 'components-charts';
            }
            return 'components-ui';
          }
          
          if (id.includes('pages/')) {
            if (id.includes('Generator') || id.includes('Dashboard')) {
              return 'pages-main';
            }
            return 'pages-static';
          }
          
          if (id.includes('utils/')) {
            return 'utils';
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
chunkSizeWarningLimit: 200, // Optimized for better edge performance
    target: ['es2020', 'edge101'], // More specific targets for edge compatibility
    reportCompressedSize: true,
    cssCodeSplit: true,
    cssMinify: true, // Add CSS minification
    // Enhanced edge optimization
    assetsInlineLimit: 512, // 0.5KB for optimal edge caching
    modulePreload: {
      polyfill: false
    },
    // Additional build optimizations
    emptyOutDir: true,
    // Dynamic import optimization
    dynamicImportVarsOptions: {
      warnOnError: false
    },
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
      'node:child_process',
      // Add missing edge-specific exclusions
      'node:buffer',
      'node:stream',
      'node:util',
      'node:url',
      'node:querystring',
      'node:assert',
      'node:os',
      'node:process'
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
