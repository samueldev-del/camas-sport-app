import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'maskable-icon.svg',
      ],
      manifest: {
        name: 'CAMAS Sport — Dimanche Foot',
        short_name: 'CAMAS Foot',
        description: 'Suivi présences, équipes, statistiques et caisse du foot du dimanche de la CAMAS e.V.',
        theme_color: '#2e7d32',
        background_color: '#2e7d32',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen', 'minimal-ui'],
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        categories: ['sports', 'lifestyle', 'productivity'],
        lang: 'fr',
        icons: [
          { src: 'favicon.svg',          sizes: 'any',     type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png',         sizes: '192x192', type: 'image/png',     purpose: 'any' },
          { src: 'icon-512.png',         sizes: '512x512', type: 'image/png',     purpose: 'any' },
          { src: 'maskable-icon.svg',    sizes: 'any',     type: 'image/svg+xml', purpose: 'maskable' },
          { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png',     purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webmanifest,woff2}'],
        navigateFallback: '/index.html',
        // ⚠ /api/* ne doit pas tomber sur le fallback (sinon retourne du HTML)
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'camas-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'camas-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react';
          }
        },
      },
    },
  },
  server: {
    host: true,                     // accessible depuis le téléphone (même Wi-Fi)
    proxy: {
      // En dev : tous les /api/* partent vers le backend Express local
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
