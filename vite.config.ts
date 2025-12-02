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
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        manualChunks: (id) => {
          // Enhanced tree shaking with more granular splitting
          if (id.includes('node_modules')) {
            // Core React ecosystem
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-is')) {
              return 'vendor-react';
            }
            // Charts and visualization
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            // AI and ML libraries
            if (id.includes('@google/genai')) {
              return 'vendor-ai';
            }
            // Routing
            if (id.includes('react-router-dom')) {
              return 'vendor-router';
            }
            // Database and backend
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // SEO and meta tags
            if (id.includes('react-helmet-async')) {
              return 'vendor-seo';
            }
            // Compression utilities
            if (id.includes('lz-string')) {
              return 'vendor-utils';
            }
            // Security and validation
            if (id.includes('dompurify') || id.includes('@types/dompurify')) {
              return 'vendor-security';
            }
            // Development and build tools (tree shake these out in production)
            if (id.includes('typescript') || id.includes('@types') || id.includes('vite') || id.includes('@vitejs')) {
              return 'vendor-dev';
            }
            // Miscellaneous vendors
            return 'vendor-misc';
          }
          
          // Enhanced service splitting with better tree shaking
          if (id.includes('services/')) {
            // Database services
            if (id.includes('supabase') || id.includes('settingsManager') || id.includes('databaseOptimizer') || id.includes('databasePerformanceMonitor')) {
              return 'services-db';
            }
            // AI and simulation services
            if (id.includes('gemini') || id.includes('simulation')) {
              return 'services-ai';
            }
            // Performance and caching services
            if (id.includes('cache') || id.includes('queryOptimizer') || id.includes('advancedCache') || id.includes('vercelEdgeOptimizer')) {
              return 'services-performance';
            }
            // Core services (security, realtime, resilience)
            if (id.includes('security') || id.includes('realtime') || id.includes('resilientSupabase') || id.includes('supabaseConnectionPool')) {
              return 'services-core';
            }
            // Data services
            if (id.includes('marketData') || id.includes('i18n') || id.includes('dataCompression')) {
              return 'services-data';
            }
            return 'services';
          }
          
          // Enhanced component splitting with lazy loading optimization
          if (id.includes('components/')) {
            // Heavy components that should be lazy loaded
            if (id.includes('CodeEditor')) {
              return 'component-editor';
            }
            if (id.includes('ChatInterface')) {
              return 'component-chat';
            }
            if (id.includes('BacktestPanel')) {
              return 'component-backtest';
            }
            if (id.includes('ChartComponents')) {
              return 'component-charts';
            }
            // Configuration components
            if (id.includes('StrategyConfig') || id.includes('AISettingsModal') || id.includes('DatabaseSettingsModal')) {
              return 'component-config';
            }
            // Layout and navigation components
            if (id.includes('Layout') || id.includes('Auth')) {
              return 'component-layout';
            }
            // Utility components
            if (id.includes('Toast') || id.includes('ErrorBoundary') || id.includes('NumericInput') || id.includes('MarketTicker')) {
              return 'component-utils';
            }
            return 'components';
          }
          
          // Page-level splitting for better code splitting
          if (id.includes('pages/')) {
            if (id.includes('Generator')) {
              return 'pages-generator';
            }
            if (id.includes('Dashboard')) {
              return 'pages-dashboard';
            }
            if (id.includes('Wiki')) {
              return 'pages-wiki';
            }
            return 'pages';
          }
          
          // Utility splitting
          if (id.includes('utils/')) {
            // Security utilities
            if (id.includes('encryption') || id.includes('validation') || id.includes('apiKeyUtils')) {
              return 'utils-security';
            }
            // Performance utilities
            if (id.includes('performance') || id.includes('performanceMonitor')) {
              return 'utils-performance';
            }
            // Error handling
            if (id.includes('errorHandler')) {
              return 'utils-error';
            }
            // SEO utilities
            if (id.includes('seo')) {
              return 'utils-seo';
            }
            return 'utils';
          }
          
          // Constants and translations
          if (id.includes('constants/')) {
            return 'constants';
          }
          
          // Hooks
          if (id.includes('hooks/')) {
            return 'hooks';
          }
          
          return 'default';
        },
        chunkFileNames: (chunkInfo) => {
          // Enhanced chunk naming for better caching
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/js/[name]-[hash].js`;
        },
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Enhanced asset organization
          const extType = assetInfo.name?.split('.').pop() || 'unknown';
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `assets/images/[name]-[hash].[ext]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(extType)) {
            return `assets/fonts/[name]-[hash].[ext]`;
          }
          if (/css/i.test(extType)) {
            return `assets/css/[name]-[hash].[ext]`;
          }
          return `assets/[ext]/[name]-[hash].[ext]`;
        }
      },
      onwarn(warning, warn) {
        // Suppress warnings about dynamic imports and tree shaking
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
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3, // Increased passes for better optimization
        // Enhanced optimizations for Vercel Edge
        inline: 3,
        reduce_funcs: true,
        reduce_vars: true,
        sequences: true,
        dead_code: true,
        // Additional tree shaking optimizations
        unused: true,
        hoist_funs: true,
        hoist_vars: true,
        if_return: true,
        join_vars: true,
        collapse_vars: true,
        negate_iife: true,
        evaluate: true,
        booleans: true,
        loops: true,
        toplevel: true,
        top_retain: null,
        typeofs: true,
      },
      mangle: {
        safari10: true,
        // Enhanced mangling for better compression
        toplevel: true,
        properties: {
          regex: /^_/
        },
        // Preserve class names for React components
        keep_classnames: false,
        keep_fnames: false,
      },
      format: {
        comments: false,
      }
    },
    chunkSizeWarningLimit: 600, // More aggressive optimization
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
    include: [
      'react', 
      'react-dom', 
      'recharts', 
      '@google/genai', 
      '@supabase/supabase-js', 
      'react-router-dom', 
      'react-helmet-async',
      'dompurify',
      'lz-string'
    ],
    // Pre-bundle dependencies for better performance
    force: true,
    // Exclude development dependencies from pre-bundling
    exclude: ['@types/node', '@types/react', '@types/react-dom', 'typescript'],
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
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    }
  }
});
