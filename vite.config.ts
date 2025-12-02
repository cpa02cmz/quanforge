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
          // Enhanced vendor chunk splitting for optimal caching
          if (id.includes('node_modules')) {
            // Core React ecosystem
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-is') || id.includes('scheduler')) {
              return 'vendor-react-core';
            }
            // React router separately for better caching
            if (id.includes('react-router-dom') || id.includes('react-router')) {
              return 'vendor-router';
            }
            // Charts library - heavy and changes infrequently
            if (id.includes('recharts') || id.includes('d3') || id.includes('victory')) {
              return 'vendor-charts';
            }
            // AI/ML libraries
            if (id.includes('@google/genai') || id.includes('@tensorflow')) {
              return 'vendor-ai';
            }
            // Supabase and database libraries
            if (id.includes('@supabase') || id.includes('postgres') || id.includes('pg')) {
              return 'vendor-database';
            }
            // SEO and meta management
            if (id.includes('react-helmet-async') || id.includes('helmet')) {
              return 'vendor-seo';
            }
            // Utility libraries
            if (id.includes('lz-string') || id.includes('lodash') || id.includes('date-fns')) {
              return 'vendor-utils';
            }
            // Security and validation
            if (id.includes('dompurify') || id.includes('validator') || id.includes('xss')) {
              return 'vendor-security';
            }
            // Development and build tools
            if (id.includes('typescript') || id.includes('@types') || id.includes('esbuild')) {
              return 'vendor-dev';
            }
            // Vite-specific
            if (id.includes('vite') || id.includes('@vitejs')) {
              return 'vendor-vite';
            }
            // Catch-all for other vendors
            return 'vendor-misc';
          }
          
          // Enhanced service chunk splitting
          if (id.includes('services/')) {
            // Database and persistence services
            if (id.includes('supabase') || id.includes('settingsManager') || id.includes('databaseOptimizer') || id.includes('connectionPool')) {
              return 'services-database';
            }
            // AI and generation services
            if (id.includes('gemini') || id.includes('simulation') || id.includes('generation')) {
              return 'services-ai';
            }
            // Performance and caching services
            if (id.includes('cache') || id.includes('queryOptimizer') || id.includes('advancedCache') || id.includes('performanceMonitor')) {
              return 'services-performance';
            }
            // Core infrastructure services
            if (id.includes('security') || id.includes('realtime') || id.includes('resilientSupabase') || id.includes('errorHandler')) {
              return 'services-core';
            }
            // Data and market services
            if (id.includes('marketData') || id.includes('i18n') || id.includes('dataCompression')) {
              return 'services-data';
            }
            // Edge and deployment services
            if (id.includes('vercel') || id.includes('edge') || id.includes('optimization')) {
              return 'services-edge';
            }
            return 'services-shared';
          }
          
          // Enhanced component chunk splitting
          if (id.includes('components/')) {
            // Heavy editor components
            if (id.includes('CodeEditor') || id.includes('Editor')) {
              return 'component-editors';
            }
            // Chat and AI interaction components
            if (id.includes('ChatInterface') || id.includes('Chat') || id.includes('AI')) {
              return 'component-chat';
            }
            // Backtesting and analysis components
            if (id.includes('BacktestPanel') || id.includes('Analysis') || id.includes('Simulation')) {
              return 'component-analysis';
            }
            // Configuration and settings components
            if (id.includes('StrategyConfig') || id.includes('Settings') || id.includes('Config')) {
              return 'component-config';
            }
            // Chart and visualization components
            if (id.includes('ChartComponents') || id.includes('Chart') || id.includes('Visualization')) {
              return 'component-charts';
            }
            // Form and input components
            if (id.includes('Form') || id.includes('Input') || id.includes('Modal')) {
              return 'component-forms';
            }
            // Layout and navigation components
            if (id.includes('Layout') || id.includes('Nav') || id.includes('Header')) {
              return 'component-layout';
            }
            return 'components-shared';
          }
          
          // Enhanced page chunk splitting
          if (id.includes('pages/')) {
            if (id.includes('Generator')) {
              return 'pages-generator';
            }
            if (id.includes('Dashboard')) {
              return 'pages-dashboard';
            }
            if (id.includes('Wiki') || id.includes('Documentation')) {
              return 'pages-docs';
            }
            return 'pages-shared';
          }
          
          // Enhanced utility chunk splitting
          if (id.includes('utils/')) {
            if (id.includes('performance') || id.includes('optimization')) {
              return 'utils-performance';
            }
            if (id.includes('validation') || id.includes('security')) {
              return 'utils-validation';
            }
            if (id.includes('seo') || id.includes('meta')) {
              return 'utils-seo';
            }
            return 'utils-shared';
          }
          
          // Constants and translations
          if (id.includes('constants/') || id.includes('translations/')) {
            return 'assets-i18n';
          }
          
          return 'default';
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/js/[name]-[hash].js`;
        },
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          const info = name.split('.');
          const ext = info[info.length - 1] || '';
          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)$/.test(name)) {
            return `assets/media/[name]-[hash].[ext]`;
          }
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/.test(name)) {
            return `assets/images/[name]-[hash].[ext]`;
          }
          if (/\.(woff2?|eot|ttf|otf)$/.test(name)) {
            return `assets/fonts/[name]-[hash].[ext]`;
          }
          if (/\.css$/.test(name)) {
            return `assets/css/[name]-[hash].[ext]`;
          }
          return `assets/[ext]/[name]-[hash].[ext]`;
        }
      },
      onwarn(warning, warn) {
        // Suppress warnings about dynamic imports and other non-critical warnings
        if (warning.code === 'DYNAMIC_IMPORT') return;
        if (warning.code === 'THIS_IS_UNDEFINED') return;
        if (warning.code === 'EVAL') return;
        warn(warning);
      },
      external: [],
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env['NODE_ENV'] === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
        inline: 2,
        reduce_funcs: true,
        reduce_vars: true,
        sequences: true,
        dead_code: true,
      },
      mangle: {
        safari10: true,
        toplevel: true,
        properties: {
          regex: /^_/
        },
        keep_classnames: false,
        keep_fnames: false,
        reserved: []
      },
      format: {
        comments: false,
        ascii_only: true
      }
    },
    chunkSizeWarningLimit: 500,
    target: 'esnext',
    reportCompressedSize: true,
    cssCodeSplit: true,
    // Optimize for Vercel Edge
    assetsInlineLimit: 4096,
    modulePreload: {
      polyfill: false,
      resolveDependencies: (filename, deps) => {
        return deps.filter(dep => !dep.includes('node_modules'));
      }
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
    exclude: ['@types/react', '@types/react-dom'],
    force: true
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
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    },
    cors: true,
    strictPort: false,
    open: false
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    cors: true,
    headers: {
      'X-Edge-Optimized': 'true',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  }
});
