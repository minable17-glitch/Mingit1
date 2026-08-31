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
      // 오프라인 지원용 서비스워커가 /Mingit1/ 하위 모든 주소를 새싹책방 화면으로 가로채는데,
      // 같은 Pages 사이트에 별도로 얹은 /zombie-run/ 게임은 그 대상에서 제외해야 함
      workbox: {
        navigateFallbackDenylist: [/\/zombie-run\//],
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
