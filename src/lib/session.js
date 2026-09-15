const KEY = 'archery_student_session';

export function getSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch { /* 저장 실패해도 앱은 계속 사용 가능 */ }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

const TEACHER_KEY = 'archery_teacher_session';

export function getTeacherSession() {
  try {
    const raw = localStorage.getItem(TEACHER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTeacherSession(session) {
  try {
    localStorage.setItem(TEACHER_KEY, JSON.stringify(session));
  } catch { /* 저장 실패해도 앱은 계속 사용 가능 */ }
}

export function clearTeacherSession() {
  localStorage.removeItem(TEACHER_KEY);
}

const CLASS_CODE_KEY = 'archery_saved_class_code';

export function getSavedClassCode() {
  try {
    return localStorage.getItem(CLASS_CODE_KEY) || '';
  } catch {
    return '';
  }
}

export function setSavedClassCode(code) {
  try {
    localStorage.setItem(CLASS_CODE_KEY, code);
  } catch { /* 저장 실패해도 로그인은 계속 가능 */ }
}
