import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages 에 올릴 때는 저장소 이름이 주소에 붙음 (예: https://아이디.github.io/catchball-eval/)
// 배포 워크플로가 GH_PAGES_BASE 를 "/저장소이름/" 으로 넣어 줌
export default defineConfig({
  base: process.env.GH_PAGES_BASE || '/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html', // 학생 제출 페이지 (대문)
        admin: 'admin.html', // 선생님 채점 페이지 (관리자)
      },
    },
  },
  plugins: [react()],
})
