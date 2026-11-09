// 앱스크립트(구글 드라이브·시트 연동)와 통신하는 부분
//
// 요청은 Content-Type 을 text/plain 으로 보내야 앱스크립트가 CORS 사전 요청 없이 받아 줍니다.

const CONFIG_KEY = 'catchball_api_config_v1';

export function getApiConfig() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch { /* 무시 */ }
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('api');
  const scriptUrl = (fromUrl || saved.scriptUrl || import.meta.env.VITE_CATCHBALL_SCRIPT_URL || '').trim();
  if (fromUrl && fromUrl !== saved.scriptUrl) setApiConfig({ ...saved, scriptUrl: fromUrl });
  return { scriptUrl, teacherKey: saved.teacherKey || '', submitCode: saved.submitCode || '' };
}

export function setApiConfig(next) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
}

export function isValidScriptUrl(url) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test((url || '').trim()) || /^https?:\/\/(localhost|127\.0\.0\.1)/.test(url || '');
}

// 학생 제출 페이지 링크 (앱스크립트 주소가 함께 들어감)
export function studentUploadLink(scriptUrl) {
  const base = new URL('catchball-upload.html', window.location.href);
  base.searchParams.set('api', scriptUrl);
  return base.toString();
}

export async function apiPost(scriptUrl, action, payload = {}, { timeoutMs = 120000 } = {}) {
  if (!scriptUrl) throw new Error('앱스크립트 주소가 설정되지 않았습니다.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
      redirect: 'follow',
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('앱스크립트 응답을 읽을 수 없습니다. 배포 설정("모든 사용자")을 확인해 주세요.'); }
    if (!data.ok && !data.tooLarge) throw new Error(data.error || '앱스크립트 오류');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ── 학생 업로드 ──

// 드라이브 이어 올리기 세션에 영상 전체를 한 번에 PUT (진행률 표시 가능)
export function putToDrive(uploadUrl, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', blob.type || 'video/webm');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let fileId = null;
        try { fileId = JSON.parse(xhr.responseText).id || null; } catch { /* 응답을 못 읽어도 이름으로 찾음 */ }
        resolve({ fileId });
      } else {
        reject(new Error('드라이브 업로드 실패 (' + xhr.status + ')'));
      }
    };
    xhr.onerror = () => reject(new Error('드라이브에 직접 올리지 못했습니다.'));
    xhr.ontimeout = () => reject(new Error('드라이브 업로드 시간 초과'));
    xhr.timeout = 10 * 60 * 1000;
    xhr.send(blob);
  });
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export const MAX_RELAY_BYTES = 40 * 1024 * 1024;

/**
 * 영상 제출 전체 흐름. 1순위: 드라이브 직접 업로드, 실패하면 2순위: 앱스크립트 중계(40MB 이하).
 * onStatus(text), onProgress(0~1)
 */
export async function submitVideo({ scriptUrl, submitCode, info, blob, fileName, extra = {}, onStatus, onProgress }) {
  const meta = {
    submitCode,
    className: info.className, student1: info.student1, student2: info.student2, date: info.date,
    fileName, mimeType: blob.type || 'video/webm', size: blob.size,
  };
  let fileId = null, uploadedName = null, route = 'drive';
  try {
    onStatus?.('드라이브에 올릴 준비 중...');
    const start = await apiPost(scriptUrl, 'start_upload', { ...meta, origin: window.location.origin });
    uploadedName = start.fileName;
    onStatus?.('드라이브로 올리는 중...');
    const put = await putToDrive(start.uploadUrl, blob, onProgress);
    fileId = put.fileId;
  } catch (e) {
    console.warn('드라이브 직접 업로드 실패, 앱스크립트 중계로 다시 시도', e);
    if (blob.size > MAX_RELAY_BYTES) throw new Error('드라이브에 직접 올리지 못했고, 영상이 커서(' + Math.round(blob.size / 1048576) + 'MB) 다른 방법으로도 올릴 수 없습니다. 더 짧게 찍거나 압축해서 다시 올려 주세요.');
    route = 'relay';
    onStatus?.('다른 방법으로 올리는 중... (조금 더 걸립니다)');
    onProgress?.(0);
    const data = await blobToBase64(blob);
    const res = await apiPost(scriptUrl, 'upload_whole', { ...meta, data }, { timeoutMs: 10 * 60 * 1000 });
    fileId = res.fileId;
    uploadedName = res.fileName;
    onProgress?.(1);
  }
  onStatus?.('제출 기록 남기는 중...');
  const done = await apiPost(scriptUrl, 'finish_upload', { ...meta, ...extra, fileId, fileName: uploadedName });
  return { ...done, route };
}

// ── 선생님 ──

export async function listSubmissions(cfg) {
  const r = await apiPost(cfg.scriptUrl, 'list_submissions', { teacherKey: cfg.teacherKey });
  return r.items || [];
}

export async function listResults(cfg) {
  const r = await apiPost(cfg.scriptUrl, 'list_results', { teacherKey: cfg.teacherKey });
  return r.items || [];
}

export async function fetchDriveVideo(cfg, fileId) {
  const r = await apiPost(cfg.scriptUrl, 'get_file', { teacherKey: cfg.teacherKey, fileId }, { timeoutMs: 10 * 60 * 1000 });
  if (r.tooLarge) { const err = new Error(r.error); err.link = r.link; throw err; }
  const bin = atob(r.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: r.mimeType || 'video/webm' }), fileName: r.fileName };
}

export async function saveResultToSheet(cfg, record) {
  return apiPost(cfg.scriptUrl, 'save_result', { teacherKey: cfg.teacherKey, ...record });
}
