import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // PWA-FIX: Caching-Strategie
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3000000,
        cleanupOutdatedCaches: false, // KORREKTUR: Verhindert das sofortige Löschen alter Chunks während der Nutzung
        clientsClaim: false,          // KORREKTUR: Verhindert sofortige Übernahme, die aktive Sitzungen stört
        skipWaiting: false,           // KORREKTUR: Wartet auf Tab-Schließung vor dem Update
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
          // Isoliert recharts in einen eigenen Chunk, um die zirkuläre Abhängigkeit zu beheben
          recharts: ['recharts'],
          // Isoliert Firebase, um den Main-Chunk drastisch zu verkleinern
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          // Isoliert React und Material UI
          vendor: ['react', 'react-dom', 'react-router-dom', '@mui/material', '@mui/icons-material']
        }
      }
    }
  }
});