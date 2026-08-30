import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// 새 버전이 배포되면 앱을 자동으로 새로고침해서 최신 코드를 바로 받도록 함
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // 탭을 오래 켜두거나 다시 돌아왔을 때도 새 버전이 있는지 주기적으로 다시 확인
    setInterval(() => registration.update(), 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update();
    });
  },
});

// 새 버전이 활성화되면 확실히 새로고침되도록 하는 안전장치
let refreshingForUpdate = false;
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (refreshingForUpdate) return;
  refreshingForUpdate = true;
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
