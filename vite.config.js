import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GH_PAGES ? '/Mingit1/' : '/',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      workbox: {
        cleanupOutdatedCaches: true,
        // 기본 네비게이션 폴백(캐시 우선)을 끄고, 아래 NetworkFirst 규칙이
        // 모든 화면 이동 요청을 대신 처리하게 함
        navigateFallback: null,
        // 카카오톡 인앱 브라우저처럼 서비스워커 업데이트가 느리거나 잘 안 잡히는
        // 환경에서도, 페이지를 열 때마다 일단 네트워크에서 최신 버전을 먼저
        // 시도하도록 함 (오프라인일 때만 캐시된 화면으로 대체됨)
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shell',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      manifest: {
        name: '새싹책방',
        short_name: '새싹책방',
        description: '하루 10분, 우리 반이 함께 키우는 숲',
        theme_color: '#3F7E4E',
        background_color: '#FCEFCF',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
