import { supabase } from './supabaseClient';

async function ensureFreshAnonSession() {
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

export async function createClass({ name, adminPassword, startDate, goalPct }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('create_class', {
    p_name: name,
    p_admin_password: adminPassword,
    p_start_date: startDate,
    p_goal_pct: goalPct,
  });
  if (error) throw error;
  return data[0];
}

export async function teacherLogin({ classCode, adminPassword }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('teacher_login', {
    p_class_code: classCode,
    p_admin_password: adminPassword,
  });
  if (error) throw error;
  return data[0];
}

export async function studentLogin({ classCode, nickname, pin }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('student_login', {
    p_class_code: classCode,
    p_nickname: nickname,
    p_pin: pin,
  });
  if (error) throw error;
  return data[0];
}

export async function getClassById(classId) {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, code, start_date, goal_pct, daily_target_minutes')
    .eq('id', classId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateClassSettings(classId, { goalPct, dailyTargetMinutes }) {
  const patch = {};
  if (goalPct !== undefined) patch.goal_pct = goalPct;
  if (dailyTargetMinutes !== undefined) patch.daily_target_minutes = dailyTargetMinutes;
  const { data, error } = await supabase
    .from('classes')
    .update(patch)
    .eq('id', classId)
    .select('id, name, code, start_date, goal_pct, daily_target_minutes')
    .single();
  if (error) throw error;
  return data;
}

export async function getClassProgress(classId) {
  const { data, error } = await supabase.rpc('get_class_progress', { p_class_id: classId });
  if (error) throw error;
  return data[0];
}

export async function getMyLogs(studentId) {
  const { data, error } = await supabase
    .from('logs')
    .select('id, log_date, minutes, note, book_id, books(title)')
    .eq('student_id', studentId)
    .order('log_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTodayLog(studentId) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('logs')
    .select('id, log_date, minutes, note')
    .eq('student_id', studentId)
    .eq('log_date', today)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCurrentBook(studentId) {
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, is_completed')
    .eq('student_id', studentId)
    .eq('is_completed', false)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function startBook(studentId, { title, author }) {
  const { data, error } = await supabase
    .from('books')
    .insert({ student_id: studentId, title, author })
    .select('id, title, author, is_completed')
    .single();
  if (error) throw error;
  return data;
}

export async function submitLog({ studentId, bookId, minutes, note, overflowMinutes = 0 }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('logs')
    .insert({ student_id: studentId, book_id: bookId, log_date: today, minutes, note, overflow_minutes: overflowMinutes })
    .select('id, log_date, minutes, note')
    .single();
  if (error) throw error;
  return data;
}

export async function markBookCompleted(bookId) {
  const { error } = await supabase
    .from('books')
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq('id', bookId);
  if (error) throw error;
}

export async function getClassLogsForTeacher(classId) {
  const { data, error } = await supabase
    .from('logs')
    .select('student_id, log_date, minutes, note, books(title), students!inner(nickname, class_id)')
    .eq('students.class_id', classId)
    .order('log_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getClassRoster(classId) {
  const { data, error } = await supabase
    .from('students')
    .select('id, nickname, total_days, communal_minutes')
    .eq('class_id', classId);
  if (error) throw error;
  return data;
}

export async function getClassCompletedBookCounts(studentIds) {
  if (!studentIds.length) return {};
  const { data, error } = await supabase
    .from('books')
    .select('student_id')
    .in('student_id', studentIds)
    .eq('is_completed', true);
  if (error) throw error;
  const byStudent = {};
  for (const row of data) byStudent[row.student_id] = (byStudent[row.student_id] || 0) + 1;
  return byStudent;
}

export async function getClassCheersSentCounts(studentIds) {
  if (!studentIds.length) return {};
  const { data, error } = await supabase
    .from('cheers')
    .select('from_student_id')
    .in('from_student_id', studentIds);
  if (error) throw error;
  const byStudent = {};
  for (const row of data) byStudent[row.from_student_id] = (byStudent[row.from_student_id] || 0) + 1;
  return byStudent;
}

export async function getClassCurrentBooks(studentIds) {
  if (!studentIds.length) return {};
  const { data, error } = await supabase
    .from('books')
    .select('student_id, title, started_at')
    .in('student_id', studentIds)
    .eq('is_completed', false)
    .order('started_at', { ascending: false });
  if (error) throw error;
  const byStudent = {};
  for (const row of data) {
    if (!byStudent[row.student_id]) byStudent[row.student_id] = row.title;
  }
  return byStudent;
}

export async function getClassReadingSessions(studentIds) {
  if (!studentIds.length) return {};
  const { data, error } = await supabase
    .from('reading_sessions')
    .select('student_id, is_reading')
    .in('student_id', studentIds)
    .eq('is_reading', true);
  if (error) throw error;
  const byStudent = {};
  for (const row of data) byStudent[row.student_id] = true;
  return byStudent;
}

export async function setReadingSession(studentId, isReading) {
  const { error } = await supabase
    .from('reading_sessions')
    .upsert({ student_id: studentId, is_reading: isReading, started_at: isReading ? new Date().toISOString() : null, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function sendCheer({ fromStudentId, toStudentId, emoji }) {
  const { error } = await supabase
    .from('cheers')
    .insert({ from_student_id: fromStudentId, to_student_id: toStudentId, emoji });
  if (error) throw error;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function searchBooks(query) {
  const { data, error } = await supabase.functions.invoke('search-books', { body: { query } });
  if (error) throw error;
  return data?.books || [];
}
