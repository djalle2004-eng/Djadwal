import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './', // Utiliser des chemins relatifs au lieu de chemins absolus
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
      strict: false
    },
    cors: true,
    proxy: {
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
        secure: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.svg')) {
            return 'assets/images/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['better-sqlite3', 'sqlite3'],
  },
});