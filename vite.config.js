import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GH_PAGES ? '/Mingit1/' : '/',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rolldownOptions: {
      output: {
        // 3D 도서관·정원 코드(three.js 포함)를 world3d-*.js 한 묶음으로 모음 → 아래에서 미리 받기 목록에서 뺌
        advancedChunks: {
          // 3D 코드가 쓰는 공용 코드(로그인·DB 연결 등)까지 끌고 오지 않도록, 딱 맞는 파일만 묶음
          includeDependenciesRecursively: false,
          groups: [{ name: 'world3d', test: /node_modules[\\/]three[\\/]|src[\\/]world3d[\\/]/ }],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg'],
      workbox: {
        cleanupOutdatedCaches: true,
        // 3D 코드는 3D를 켠 기기만 필요하므로 모든 학생 폰에 미리 받아 두지 않음(약 560KB 절약).
        // 3D를 켠 기기는 처음 열 때 받고, 아래 규칙으로 보관해 다음부터는 바로 열림
        globIgnores: ['**/world3d-*.js', '**/Library3D-*.js', '**/Garden3D-*.js'],
        // 기본 네비게이션 폴백(캐시 우선)을 끄고, 아래 NetworkFirst 규칙이
        // 모든 화면 이동 요청을 대신 처리하게 함
        navigateFallback: null,
        // 카카오톡 인앱 브라우저처럼 서비스워커 업데이트가 느리거나 잘 안 잡히는
        // 환경에서도, 페이지를 열 때마다 일단 네트워크에서 최신 버전을 먼저
        // 시도하도록 함 (오프라인일 때만 캐시된 화면으로 대체됨)
        runtimeCaching: [
          {
            // 3D 코드: 파일 이름에 버전 해시가 붙어 있어 한 번 받으면 바뀌지 않으므로 보관본을 먼저 씀
            urlPattern: ({ url }) => /\/assets\/(world3d|Library3D|Garden3D)-[^/]+\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'world3d', expiration: { maxEntries: 12 } },
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shell',
              networkTimeoutSeconds: 3,
              // 브라우저/웹뷰 자체의 HTTP 캐시까지 건너뛰고 항상 진짜 네트워크로
              // 요청하도록 함 (카카오톡 인앱 브라우저 등에서 오래된 응답이
              // 그대로 재사용되는 걸 방지)
              fetchOptions: { cache: 'no-store' },
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
