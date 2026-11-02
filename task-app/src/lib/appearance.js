// 화면 꾸미기: 강조색 · 글씨 크기 · 글씨 진하기 · 바탕 (순수 함수, 테스트 가능)
// 설정 표(settings.appearance)에 저장하고, 첫 화면이 깜빡이지 않게 이 기기에도 같이 저장해 둠.

export const ACCENTS = [
  { key: 'blue', name: '파랑', color: '#3182f6' },
  { key: 'indigo', name: '남색', color: '#4f5bd5' },
  { key: 'purple', name: '보라', color: '#8b5cf6' },
  { key: 'pink', name: '분홍', color: '#e5488e' },
  { key: 'orange', name: '주황', color: '#f2711c' },
  { key: 'green', name: '초록', color: '#12a150' },
  { key: 'teal', name: '청록', color: '#0f9d9a' },
  { key: 'gray', name: '먹색', color: '#4e5968' },
];
export const SIZES = [
  { key: 'sm', name: '작게', px: 15 },
  { key: 'md', name: '보통', px: 16 },
  { key: 'lg', name: '크게', px: 17.5 },
  { key: 'xl', name: '아주 크게', px: 19 },
];
export const CONTRASTS = [
  { key: 'normal', name: '보통' },
  { key: 'high', name: '진하게' },
];
export const BACKGROUNDS = [
  { key: 'gray', name: '회색', color: '#f4f5f7' },
  { key: 'warm', name: '미색', color: '#f7f4ee' },
  { key: 'sky', name: '하늘', color: '#eef4fb' },
  { key: 'white', name: '흰색', color: '#ffffff' },
];
export const DEFAULT_APPEARANCE = { accent: '#3182f6', size: 'md', contrast: 'high', bg: 'gray' };

const HEX = /^#[0-9a-f]{6}$/i;

// 저장된 값이 이상해도 화면이 깨지지 않게 기본값으로 메움
export function normalizeAppearance(a) {
  const v = { ...DEFAULT_APPEARANCE, ...(a && typeof a === 'object' ? a : {}) };
  return {
    accent: HEX.test(v.accent) ? v.accent.toLowerCase() : DEFAULT_APPEARANCE.accent,
    size: SIZES.some((s) => s.key === v.size) ? v.size : DEFAULT_APPEARANCE.size,
    contrast: CONTRASTS.some((c) => c.key === v.contrast) ? v.contrast : DEFAULT_APPEARANCE.contrast,
    bg: BACKGROUNDS.some((b) => b.key === v.bg) ? v.bg : DEFAULT_APPEARANCE.bg,
  };
}

// 문서 맨 위(html)에 넣을 값: CSS 변수 + data-* 표시 + 글씨 크기
export function appearanceVars(a) {
  const v = normalizeAppearance(a);
  return {
    style: {
      '--primary': v.accent,
      '--primary-soft': `color-mix(in srgb, ${v.accent} 13%, var(--card))`,
      '--primary-text': `color-mix(in srgb, ${v.accent} 82%, var(--text))`,
      'font-size': `${SIZES.find((s) => s.key === v.size).px}px`,
    },
    data: { contrast: v.contrast, bg: v.bg },
  };
}

const KEY = 'task-keeper.appearance';

export function applyAppearance(a, root = document.documentElement) {
  const { style, data } = appearanceVars(a);
  for (const [k, val] of Object.entries(style)) root.style.setProperty(k, val);
  root.dataset.contrast = data.contrast;
  root.dataset.bg = data.bg;
  try { localStorage.setItem(KEY, JSON.stringify(normalizeAppearance(a))); } catch { /* 저장 안 돼도 이번 화면엔 적용 */ }
}

// 앱이 뜨기 전에 이 기기에 저장해 둔 값으로 먼저 칠함
export function applyCachedAppearance() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* 없으면 기본값 */ }
  applyAppearance(cached);
}
