// 학급 그림 도우미: 붙여넣기 받기 · 올리기 · 임시 주소 붙이기 · 지우기 (화면은 screens/ClassImages.jsx)
import { useEffect, useRef } from 'react';
import * as api from './api.js';
import { filesFrom, isImage, nameCapture } from './files.js';

// 화면에 떠 있는 동안 Ctrl+V 로 붙인 그림을 받음 (글자 붙여넣기는 그대로 둠)
export function usePasteImages(onImages, active = true) {
  const ref = useRef(onImages);
  useEffect(() => { ref.current = onImages; });
  useEffect(() => {
    if (!active) return undefined;
    const onPaste = (e) => {
      const files = filesFrom(e.clipboardData).filter(isImage);
      if (!files.length) return;
      e.preventDefault();
      ref.current(files.map((f) => nameCapture(f)));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [active]);
}

export async function uploadAll(files, where) {
  const failed = [];
  for (const f of files) {
    try { await api.uploadClassImage(f, where); } catch (e) { failed.push(e.message); }
  }
  if (failed.length) alert(`못 넣은 그림: ${failed.join(' / ')}`);
}

export async function withUrls(list) {
  const urls = await api.attachmentUrls(list);
  return list.map((i) => ({ ...i, key: i.id, url: urls[i.path] }));
}

export async function removeImage(img, after) {
  if (!confirm('이 그림을 지울까요?')) return;
  try { await api.deleteClassImage(img); after(); } catch (e) { alert(`지우지 못했어요: ${e.message}`); }
}

