// 첨부(캡처·파일) 도우미 (순수 함수, 테스트 가능)

// 붙여넣기·끌어 놓기에서 파일만 꺼냄 (글자 붙여넣기는 그대로 둠)
export function filesFrom(dataTransfer) {
  if (!dataTransfer) return [];
  const files = [...(dataTransfer.files ?? [])];
  if (files.length) return files;
  return [...(dataTransfer.items ?? [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
}

// 캡처에는 이름이 'image.png' 뿐이라 시각을 붙여 알아보기 쉽게
export function nameCapture(file, now = Date.now()) {
  if (file.name && file.name !== 'image.png') return file;
  const d = new Date(now + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ').replace(':', '');
  const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
  return new File([file], `캡처 ${d}.${ext}`, { type: file.type });
}

export const isImage = (a) => (a.mime || a.type || '').startsWith('image/');
export const sizeLabel = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
