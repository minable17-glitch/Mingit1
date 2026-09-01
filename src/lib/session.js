import { todayKST } from './date';

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
    const today = todayKST();
    const parsed = JSON.parse(raw);
    if (parsed.date !== today) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setReadingProgress(studentId, { mode, secs }) {
  const today = todayKST();
  try {
    localStorage.setItem(`${PROGRESS_KEY}_${studentId}`, JSON.stringify({ date: today, mode, secs }));
  } catch { /* 저장 실패해도 앱은 계속 사용 가능 */ }
}

export function clearReadingProgress(studentId) {
  localStorage.removeItem(`${PROGRESS_KEY}_${studentId}`);
}

const PENDING_REFLECTION_KEY = 'saesak_pending_reflection';

// 10분 다 읽고 느낀점을 쓰다가 폰이 꺼지거나 앱이 강제 종료돼도, 다시 켰을 때
// 처음부터 다시 읽지 않고 느낀점 화면으로 바로 이어지도록 저장해둠
export function getPendingReflection(studentId) {
  try {
    const raw = localStorage.getItem(`${PENDING_REFLECTION_KEY}_${studentId}`);
    if (!raw) return null;
    const today = todayKST();
    const parsed = JSON.parse(raw);
    if (parsed.date !== today) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setPendingReflection(studentId, { minutes, note = "", quote = "", pages = "" }) {
  const today = todayKST();
  try {
    localStorage.setItem(`${PENDING_REFLECTION_KEY}_${studentId}`, JSON.stringify({ date: today, minutes, note, quote, pages }));
  } catch { /* 저장 실패해도 앱은 계속 사용 가능 */ }
}

export function clearPendingReflection(studentId) {
  localStorage.removeItem(`${PENDING_REFLECTION_KEY}_${studentId}`);
}

const TEACHER_ID_KEY = 'saesak_saved_teacher_id';

// 선생님 로그인 화면의 "아이디 저장" — 비밀번호는 저장하지 않음
export function getSavedTeacherUsername() {
  try {
    return localStorage.getItem(TEACHER_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function setSavedTeacherUsername(username) {
  try {
    localStorage.setItem(TEACHER_ID_KEY, username);
  } catch { /* 저장 실패해도 로그인은 계속 가능 */ }
}

export function clearSavedTeacherUsername() {
  localStorage.removeItem(TEACHER_ID_KEY);
}

const CHEERS_SEEN_KEY = 'saesak_cheers_seen_at';

// 마지막으로 응원 알림을 확인한 시각 — 이후에 온 응원만 팝업으로 보여주기 위함
export function getCheersSeenAt(studentId) {
  try {
    return localStorage.getItem(`${CHEERS_SEEN_KEY}_${studentId}`) || null;
  } catch {
    return null;
  }
}

export function setCheersSeenAt(studentId, iso) {
  try {
    localStorage.setItem(`${CHEERS_SEEN_KEY}_${studentId}`, iso);
  } catch { /* 저장 실패해도 앱은 계속 사용 가능 */ }
}
