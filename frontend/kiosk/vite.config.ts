import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Billisan Kiosk',
        short_name: 'Billisan',
        description:
          '안면 인식을 활용한 공공 장소 내 우산 대여 서비스 키오스크',
        start_url: '/',
        display: 'fullscreen',
        orientation: 'portrait',
        background_color: '#fdfae9',
        theme_color: '#ffd700',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
