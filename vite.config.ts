import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    outDir: 'dist',
    sourcemap: process.env['NODE_ENV'] !== 'production' ? 'hidden' : false,
    target: 'esnext',
    rollupOptions: {
      input: {
        main: './index.html'
      },
      output: {
        manualChunks: (id) => {
          // Core chunking strategy - simplified but effective
          if (id.includes('node_modules')) {
            // React ecosystem
            if (id.includes('react')) {
              if (id.includes('react-dom')) {
                return id.includes('client') ? 'react-dom-client' : 'react-dom-server';
              }
              return 'react-core';
            }
            
            // Charts library - major source of bundle size
            if (id.includes('recharts')) {
              return 'chart-vendor';
            }
            
            // AI services
            if (id.includes('@google')) {
              return 'ai-vendor-core';
            }
            
            // Utility libraries
            if (id.includes('lodash')) {
              return 'vendor-utils';
            }
            
            // Date/time libraries
            if (id.includes('date-fns') || id.includes('moment')) {
              return 'vendor-date';
            }
            
            // Miscellaneous vendors
            return 'vendor-misc';
          }
        },
        chunkFileNames: (chunkInfo) => {
          // Generate cleaner chunk names for better debugging
          return chunkInfo.name ? `${chunkInfo.name}.js` : 'chunk-[hash].js';
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 4173,
    open: true
  }
});