import { createClient } from '@supabase/supabase-js';

// 새싹책방과 같은 수파베이스 프로젝트를 쓰되, 로그인 세션 저장 칸(storageKey)을 따로 둠.
// 같은 브라우저에서 새싹책방과 캐치볼 페이지를 같이 열어도 서로 로그인을 끊지 않음.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: 'sb-catchball-auth', persistSession: true, autoRefreshToken: true },
});

export const VIDEO_BUCKET = 'catchball-videos';
