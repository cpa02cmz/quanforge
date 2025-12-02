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
          // Vendor chunks - more aggressive splitting for better caching
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-is')) {
              return 'vendor-react';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('@google/genai')) {
              return 'vendor-ai';
            }
            if (id.includes('react-router-dom')) {
              return 'vendor-router';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('react-helmet-async')) {
              return 'vendor-seo';
            }
            if (id.includes('lz-string')) {
              return 'vendor-utils';
            }
            // Split remaining vendors into smaller chunks
            if (id.includes('typescript') || id.includes('@types')) {
              return 'vendor-types';
            }
            if (id.includes('vite') || id.includes('@vitejs')) {
              return 'vendor-vite';
            }
            return 'vendor';
          }
          
          // App chunks - more granular splitting with lazy loading optimization
          if (id.includes('services/')) {
            if (id.includes('supabase') || id.includes('settingsManager') || id.includes('databaseOptimizer')) {
              return 'services-db';
            }
            if (id.includes('gemini') || id.includes('simulation')) {
              return 'services-ai';
            }
            if (id.includes('cache') || id.includes('queryOptimizer') || id.includes('advancedCache')) {
              return 'services-performance';
            }
            if (id.includes('security') || id.includes('realtime') || id.includes('resilientSupabase')) {
              return 'services-core';
            }
            if (id.includes('marketData') || id.includes('i18n')) {
              return 'services-data';
            }
            return 'services';
          }
          
          // Separate heavy components with more specific splitting
          if (id.includes('components/')) {
            if (id.includes('CodeEditor')) {
              return 'component-editor';
            }
            if (id.includes('ChatInterface')) {
              return 'component-chat';
            }
            if (id.includes('BacktestPanel')) {
              return 'component-backtest';
            }
            if (id.includes('StrategyConfig')) {
              return 'component-config';
            }
            if (id.includes('ChartComponents')) {
              return 'component-charts';
            }
            return 'components';
          }
          
          if (id.includes('pages/')) {
            if (id.includes('Generator')) {
              return 'pages-generator';
            }
            if (id.includes('Dashboard')) {
              return 'pages-dashboard';
            }
            return 'pages';
          }
          
          if (id.includes('utils/')) {
            return 'utils';
          }
          
          return 'default';
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      },
      onwarn(warning, warn) {
        // Suppress warnings about dynamic imports
        if (warning.code === 'DYNAMIC_IMPORT') return;
        warn(warning);
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env['NODE_ENV'] === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3,
        // Additional optimizations for Vercel Edge
        inline: 2,
        reduce_funcs: true,
        reduce_vars: true,
        sequences: true,
        dead_code: true,
        // Enhanced optimizations
        join_vars: true,
        collapse_vars: true,
        negate_iife: true,
        evaluate: true,
        booleans: true,
        loops: true,
        unused: true,
        hoist_funs: true,
        if_return: true
      },
      mangle: {
        safari10: true,
        // Additional mangling for better compression
        toplevel: true,
        properties: {
          regex: /^_/
        },
        reserved: ['React', 'useState', 'useEffect']
      }
    },
    chunkSizeWarningLimit: 600,
    target: 'esnext',
    reportCompressedSize: true,
    cssCodeSplit: true,
    // Optimize for Vercel Edge
    assetsInlineLimit: 4096,
    modulePreload: {
      polyfill: false
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] || 'development'),
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'recharts', '@google/genai', '@supabase/supabase-js', 'react-router-dom', 'react-helmet-async'],
  },
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { js: `/${filename}` };
      } else {
        return { relative: true };
      }
    }
  },
  // Edge optimization for Vercel deployment
  server: {
    port: 3000,
    host: '0.0.0.0',
    headers: {
      'X-Edge-Optimized': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
  }
});
