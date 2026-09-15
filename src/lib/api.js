import { supabase } from './supabaseClient';

// 로그인(학생/관리자) 직전에는 항상 이전 익명 세션을 정리하고 새로 발급받아서,
// 이전에 로그인했던 다른 사람의 세션과 섞이지 않도록 함.
async function ensureFreshAnonSession() {
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

// ── 로그인 ──────────────────────────────────────────────

export async function teacherSignup({ username, password, email }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('teacher_signup', {
    p_username: username,
    p_password: password,
    p_email: email,
  });
  if (error) throw error;
  return data[0];
}

export async function teacherLogin({ username, password }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('teacher_login', { p_username: username, p_password: password });
  if (error) throw error;
  return data[0];
}

export async function teacherFindUsername({ email }) {
  const { data, error } = await supabase.rpc('teacher_find_username', { p_email: email });
  if (error) throw error;
  return data?.[0]?.username || null;
}

export async function teacherResetPassword({ username, email, newPassword }) {
  const { error } = await supabase.rpc('teacher_reset_password', {
    p_username: username,
    p_email: email,
    p_new_password: newPassword,
  });
  if (error) throw error;
}

export async function createClass({ name }) {
  const { data, error } = await supabase.rpc('create_class', { p_name: name });
  if (error) throw error;
  return data[0];
}

export async function getMyClasses() {
  const { data, error } = await supabase.rpc('get_my_classes');
  if (error) throw error;
  return data || [];
}

export async function studentLogin({ classCode, studentNumber, name, pin }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('student_login', {
    p_class_code: classCode,
    p_student_number: studentNumber,
    p_name: name,
    p_pin: pin,
  });
  if (error) throw error;
  return data[0];
}

export async function logout() {
  await supabase.auth.signOut();
}

// ── 내 장비 ──────────────────────────────────────────────

export async function saveEquipment({ bowNumber, laneInfo, sightVertical, sightHorizontal, sightNote }) {
  const { error } = await supabase.rpc('save_equipment', {
    p_bow_number: bowNumber,
    p_lane_info: laneInfo,
    p_sight_vertical: sightVertical,
    p_sight_horizontal: sightHorizontal,
    p_sight_note: sightNote,
  });
  if (error) throw error;
}

export async function getMyEquipment() {
  const { data, error } = await supabase.rpc('get_my_equipment');
  if (error) throw error;
  return data?.[0] || null;
}

// ── 읽어보기 / 배워보기 ────────────────────────────────

export async function listReadContents(classId) {
  const { data, error } = await supabase
    .from('read_contents')
    .select('*')
    .eq('class_id', classId)
    .eq('visible', true)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listLearnContents(classId) {
  const { data, error } = await supabase
    .from('learn_contents')
    .select('*')
    .eq('class_id', classId)
    .eq('visible', true)
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── 기록하기 ──────────────────────────────────────────────

export async function saveShootingLog(payload) {
  const { error } = await supabase.rpc('save_shooting_log', {
    p_log_date: payload.logDate,
    p_session_label: payload.sessionLabel,
    p_bow_number: payload.bowNumber,
    p_markers: payload.markers,
    p_hit_count: payload.hitCount,
    p_group_center_x: payload.groupCenterX,
    p_group_center_y: payload.groupCenterY,
    p_aim_advice: payload.aimAdvice,
    p_sight_before: payload.sightBefore,
    p_sight_after: payload.sightAfter,
  });
  if (error) throw error;
}

export async function getMyShootingLog(logDate) {
  const { data, error } = await supabase.rpc('get_my_shooting_log', { p_log_date: logDate });
  if (error) throw error;
  return data?.[0] || null;
}

export async function getMyShootingHistory(limit = 10) {
  const { data, error } = await supabase.rpc('get_my_shooting_history', { p_limit: limit });
  if (error) throw error;
  return data || [];
}

// ── 성찰하기 ──────────────────────────────────────────────

export async function saveReflection(payload) {
  const { error } = await supabase.rpc('save_reflection', {
    p_log_date: payload.logDate,
    p_used_skills: payload.usedSkills,
    p_short_note: payload.shortNote,
    p_endure: payload.endure,
    p_regulate: payload.regulate,
    p_life_link: payload.lifeLink,
  });
  if (error) throw error;
}

export async function getMyReflection(logDate) {
  const { data, error } = await supabase.rpc('get_my_reflection', { p_log_date: logDate });
  if (error) throw error;
  return data?.[0] || null;
}

// ── 관리자 (지금 로그인한 교사가 학급 소유자인지는 서버에서 확인) ──

export async function adminListReadContents(classId) {
  const { data, error } = await supabase.rpc('admin_list_read_contents', { p_class_id: classId });
  if (error) throw error;
  return data || [];
}

export async function adminUpsertReadContent(classId, content) {
  const { data, error } = await supabase.rpc('admin_upsert_read_content', {
    p_class_id: classId,
    p_id: content.id || null,
    p_title: content.title,
    p_category: content.category,
    p_image_urls: content.imageUrls,
    p_order_index: content.orderIndex ?? 0,
    p_visible: content.visible ?? true,
  });
  if (error) throw error;
  return data;
}

export async function adminDeleteReadContent(classId, id) {
  const { error } = await supabase.rpc('admin_delete_read_content', { p_class_id: classId, p_id: id });
  if (error) throw error;
}

export async function adminListLearnContents(classId) {
  const { data, error } = await supabase.rpc('admin_list_learn_contents', { p_class_id: classId });
  if (error) throw error;
  return data || [];
}

export async function adminUpsertLearnContent(classId, content) {
  const { data, error } = await supabase.rpc('admin_upsert_learn_content', {
    p_class_id: classId,
    p_id: content.id || null,
    p_title: content.title,
    p_category: content.category,
    p_video_url: content.videoUrl,
    p_image_urls: content.imageUrls,
    p_description: content.description,
    p_order_index: content.orderIndex ?? 0,
    p_visible: content.visible ?? true,
  });
  if (error) throw error;
  return data;
}

export async function adminDeleteLearnContent(classId, id) {
  const { error } = await supabase.rpc('admin_delete_learn_content', { p_class_id: classId, p_id: id });
  if (error) throw error;
}

export async function adminListStudents(classId) {
  const { data, error } = await supabase.rpc('admin_list_students', { p_class_id: classId });
  if (error) throw error;
  return data || [];
}

export async function adminListShootingLogs(classId, limit = 300) {
  const { data, error } = await supabase.rpc('admin_list_shooting_logs', { p_class_id: classId, p_limit: limit });
  if (error) throw error;
  return data || [];
}

export async function adminListReflections(classId, limit = 300) {
  const { data, error } = await supabase.rpc('admin_list_reflections', { p_class_id: classId, p_limit: limit });
  if (error) throw error;
  return data || [];
}
