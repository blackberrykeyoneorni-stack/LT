import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // Beibehalten für das manuelle Update-Routing durch die UI
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3000000,
        
        // BUGFIX D: Harte Aktivierung erzwingen. 
        // Da der UpdateBlocker das UI sperrt, ist ein Warten auf "Tab-Schließen" unnötig.
        cleanupOutdatedCaches: true, 
        clientsClaim: true,          
        skipWaiting: false, // Bleibt false, damit der "prompt" erst durch den Klick triggert
        
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-images-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 Tage
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'LocalTasks',
        short_name: 'LocalTasks',
        description: 'Lokale Aufgabenverwaltung',
        theme_color: '#F3F4F6',
        background_color: '#F3F4F6',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ['recharts'],
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          vendor: ['react', 'react-dom', 'react-router-dom', '@mui/material', '@mui/icons-material']
        }
      }
    }
  }
});