import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 설정 화면 맨 아래에 보이는 앱 버전(만든 시각, 한국 시간) — 새 버전이 올라갔는지 확인용
const built = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

export default defineConfig({
  plugins: [react()],
  define: { __BUILD_TIME__: JSON.stringify(built) },
});
