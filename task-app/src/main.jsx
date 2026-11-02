import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { applyCachedAppearance } from './lib/appearance.js';

applyCachedAppearance(); // 이 기기에 저장해 둔 색·글씨 크기로 먼저 칠함 (깜빡임 방지)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
