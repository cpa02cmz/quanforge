import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
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
            return 'vendor';
          }
          
          // App chunks
          if (id.includes('services/')) {
            if (id.includes('supabase') || id.includes('settingsManager')) {
              return 'services-db';
            }
            if (id.includes('cache') || id.includes('queryOptimizer')) {
              return 'services-performance';
            }
            if (id.includes('security') || id.includes('realtime')) {
              return 'services-core';
            }
            return 'services';
          }
          
          if (id.includes('pages/')) {
            return 'pages';
          }
          
          if (id.includes('components/')) {
            return 'components';
          }
          
          if (id.includes('utils/')) {
            return 'utils';
          }
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2
      },
      mangle: {
        safari10: true,
      },
    },
    chunkSizeWarningLimit: 1000,
    target: 'esnext',
    reportCompressedSize: true,
    cssCodeSplit: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
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
  }
});
