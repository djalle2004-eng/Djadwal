import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['icon.ico'],
    //   manifest: {
    //     name: 'Djadwal',
    //     short_name: 'Djadwal',
    //     description: 'Application de gestion des emplois du temps',
    //     theme_color: '#ffffff',
    //     icons: [
    //       {
    //         src: 'icon.ico',
    //         sizes: '64x64 32x32 24x24 16x16',
    //         type: 'image/x-icon'
    //       }
    //     ]
    //   }
    // })
  ],
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
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
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
          if (assetInfo.name?.endsWith('.svg')) {
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