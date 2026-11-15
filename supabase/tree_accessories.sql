-- 새싹책방 2.0: 나무 꾸미기 악세서리 18종(GPT 시안) — 새 3종(클로버·도토리·작은 새) 추가 + 귀함 단계별 확률
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전하고, 학생들이 이미 받은 악세서리·단 악세서리는 그대로임.
-- · 받는 법은 그대로(자유롭게 읽기로 목표 시간을 10분 넘길 때마다 1개)
-- · 귀함 단계: 기본 65% / 조금 귀함 27% / 귀함 8%
--   기본: 사과·나비·방울·하트·벚꽃·클로버 / 조금 귀함: 리본·별·단풍잎·풍선·햇님·달님·무당벌레·도토리 / 귀함: 왕관·무지개·눈꽃·작은 새

create or replace function grant_accessories(p_student_id uuid, p_n int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_basic text[] := array['apple', 'butterfly', 'bell', 'heart', 'blossom', 'clover'];
  v_some text[] := array['ribbon', 'star', 'maple', 'balloon', 'sun', 'moon', 'ladybug', 'acorn'];
  v_rare text[] := array['crown', 'rainbow', 'snowflake', 'bird'];
  v_counts jsonb; v_pick text; v_r float; v_list text[]; i int;
begin
  if coalesce(p_n, 0) <= 0 then return; end if;
  select accessory_counts into v_counts from students where students.id = p_student_id;
  for i in 1..p_n loop
    v_r := random();
    v_list := case when v_r < 0.65 then v_basic when v_r < 0.92 then v_some else v_rare end;
    v_pick := v_list[1 + floor(random() * array_length(v_list, 1))::int];
    v_counts := jsonb_set(v_counts, array[v_pick], to_jsonb(coalesce((v_counts ->> v_pick)::int, 0) + 1));
  end loop;
  update students set accessory_counts = v_counts where students.id = p_student_id;
end;
$$;

create or replace function student_set_equipped(p_types text[])
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_student students%rowtype;
  v_catalog text[] := array['apple', 'ribbon', 'star', 'butterfly', 'maple', 'crown', 'balloon', 'rainbow', 'bell', 'heart', 'sun', 'moon', 'snowflake', 'blossom', 'ladybug', 'clover', 'acorn', 'bird'];
  v_types text[] := coalesce(p_types, array[]::text[]);
  v_type text;
begin
  select * into v_student from students where students.auth_user_id = auth.uid();
  if not found then
    raise exception '로그인 정보를 찾을 수 없어요';
  end if;
  if array_length(v_types, 1) > 4 then
    raise exception '악세서리는 최대 4개까지 달 수 있어요';
  end if;
  foreach v_type in array v_types loop
    if not (v_type = any(v_catalog)) then
      raise exception '알 수 없는 악세서리예요';
    end if;
    if coalesce((v_student.accessory_counts ->> v_type)::int, 0) < 1 then
      raise exception '가지고 있지 않은 악세서리예요';
    end if;
  end loop;
  update students set equipped_accessories = to_jsonb(v_types) where students.id = v_student.id;
end;
$$;

grant execute on function student_set_equipped(text[]) to anon, authenticated;
