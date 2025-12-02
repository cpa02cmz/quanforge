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
          // Vendor chunks - enhanced splitting for Vercel Edge caching
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
            if (id.includes('dompurify')) {
              return 'vendor-security';
            }
            // Split remaining vendors into smaller chunks for better edge caching
            if (id.includes('typescript') || id.includes('@types')) {
              return 'vendor-types';
            }
            if (id.includes('vite') || id.includes('@vitejs')) {
              return 'vendor-vite';
            }
            return 'vendor';
          }
          
          // App chunks - enhanced splitting for Vercel Edge optimization
          if (id.includes('services/')) {
            if (id.includes('supabase') || id.includes('settingsManager') || id.includes('databaseOptimizer')) {
              return 'services-db';
            }
            if (id.includes('gemini') || id.includes('simulation')) {
              return 'services-ai';
            }
            if (id.includes('cache') || id.includes('queryOptimizer') || id.includes('advancedCache') || id.includes('vercelEdgeOptimizer') || id.includes('enhancedEdgeOptimizer')) {
              return 'services-performance';
            }
            if (id.includes('security') || id.includes('realtime') || id.includes('resilientSupabase') || id.includes('databasePerformanceMonitor')) {
              return 'services-core';
            }
            if (id.includes('marketData') || id.includes('i18n')) {
              return 'services-data';
            }
            return 'services';
          }
          
          // Separate heavy components with enhanced edge optimization
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
        // Suppress warnings about dynamic imports for edge optimization
        if (warning.code === 'DYNAMIC_IMPORT') return;
        if (warning.code === 'THIS_IS_UNDEFINED') return;
        warn(warning);
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env['NODE_ENV'] === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3, // Enhanced optimization passes for Vercel Edge
        // Advanced optimizations for edge deployment
        inline: 3,
        reduce_funcs: true,
        reduce_vars: true,
        sequences: true,
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
        side_effects: true
      },
      mangle: {
        safari10: true,
        // Enhanced mangling for better edge compression
        toplevel: true,
        properties: {
          regex: /^_/
        },
        reserved: ['React', 'useState', 'useEffect'] // Preserve React hooks
      },
      format: {
        comments: false,
        ascii_only: true // Better for edge compression
      }
    },
    chunkSizeWarningLimit: 500, // More aggressive for edge optimization
    target: 'es2020', // Better edge compatibility
    reportCompressedSize: true,
    cssCodeSplit: true,
    // Enhanced optimization for Vercel Edge
    assetsInlineLimit: 2048, // Smaller for better edge caching
    modulePreload: {
      polyfill: false
    },
    // Additional edge optimizations completed
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
