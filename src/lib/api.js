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
    .select('id, name, code, start_date, goal_pct')
    .eq('id', classId)
    .single();
  if (error) throw error;
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
}
