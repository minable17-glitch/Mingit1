const KEY = 'saesak_session';

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

const PROGRESS_KEY = 'saesak_reading_progress';

// 오늘 읽다가 멈춘 지점을 저장해서, 나중에 다시 읽을 때 이어서 셀 수 있게 함
export function getReadingProgress(studentId) {
  try {
    const raw = localStorage.getItem(`${PROGRESS_KEY}_${studentId}`);
    if (!raw) return null;
    const today = new Date().toISOString().slice(0, 10);
    const parsed = JSON.parse(raw);
    if (parsed.date !== today) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setReadingProgress(studentId, { mode, secs }) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    localStorage.setItem(`${PROGRESS_KEY}_${studentId}`, JSON.stringify({ date: today, mode, secs }));
  } catch { /* 저장 실패해도 앱은 계속 사용 가능 */ }
}

export function clearReadingProgress(studentId) {
  localStorage.removeItem(`${PROGRESS_KEY}_${studentId}`);
}
