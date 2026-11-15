-- 새싹책방 2.0: 내 화단 꾸미기 소품(GPT 시안 14종)
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전하고 기존 데이터는 그대로임.
-- · 받는 법(악세서리처럼 보상): 자유롭게 읽기로 목표보다 20분 더 읽을 때마다 1개, 책을 완독할 때마다 1개(그 책으로 남긴 기록이 있을 때, 책마다 한 번)
-- · 귀함 단계: 기본 65% / 조금 귀함 27% / 귀함 8%
-- · 처음에는 모두 "이름 팻말" 1개를 선물로 받음
-- · 화분 둘레 3자리에 놓음(decor_placed: 길이 3 배열, 빈자리는 null). 선생님 자리(is_teacher)는 14종 모두 놓아 볼 수 있음
-- · supabase/teacher_reader.sql 을 먼저 실행해 둘 것(is_teacher 칸 사용)

alter table students add column if not exists decor_counts jsonb not null default '{"prop_name_sign": 1}'::jsonb;
alter table students add column if not exists decor_placed jsonb not null default '[null, null, null]'::jsonb;
alter table books add column if not exists decor_granted boolean not null default false;
revoke update (decor_counts, decor_placed) on students from anon, authenticated;

-- 소품 n개를 귀함 단계에 따라 무작위로 줌
create or replace function grant_decor(p_student_id uuid, p_n int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_basic text[] := array['prop_wood_chair', 'prop_mushroom_stool', 'prop_name_sign', 'prop_stepping_stones', 'prop_flower_pot', 'prop_low_fence', 'prop_watering_can', 'prop_book_stack'];
  v_some text[] := array['prop_lantern', 'prop_birdhouse_pole', 'prop_butterfly_light', 'prop_rainbow_pinwheel'];
  v_rare text[] := array['prop_bunny_doll', 'prop_firefly_jar'];
  v_counts jsonb; v_pick text; v_r float; v_list text[]; i int;
begin
  if coalesce(p_n, 0) <= 0 then return; end if;
  select decor_counts into v_counts from students where id = p_student_id;
  if v_counts is null then return; end if;
  for i in 1..least(p_n, 10) loop
    v_r := random();
    v_list := case when v_r < 0.65 then v_basic when v_r < 0.92 then v_some else v_rare end;
    v_pick := v_list[1 + floor(random() * array_length(v_list, 1))::int];
    v_counts := jsonb_set(v_counts, array[v_pick], to_jsonb(coalesce((v_counts ->> v_pick)::int, 0) + 1));
  end loop;
  update students set decor_counts = v_counts where id = p_student_id;
end;
$$;
revoke all on function grant_decor(uuid, int) from public, anon, authenticated;

-- 자유롭게 더 읽은 시간(overflow_minutes)이 20분을 넘길 때마다 1개(처음 저장할 때와 보너스로 더할 때 모두)
create or replace function decor_for_overflow()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_before int := case when tg_op = 'UPDATE' then coalesce(old.overflow_minutes, 0) else 0 end;
begin
  perform grant_decor(new.student_id, floor(coalesce(new.overflow_minutes, 0) / 20.0)::int - floor(v_before / 20.0)::int);
  return new;
end;
$$;
drop trigger if exists trg_decor_for_overflow on logs;
create trigger trg_decor_for_overflow
  after insert or update of overflow_minutes on logs
  for each row execute function decor_for_overflow();

-- 완독하면 1개(그 책으로 남긴 기록이 있을 때만, 책마다 한 번만)
create or replace function decor_for_completed_book()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.decor_granted := coalesce(old.decor_granted, false);   -- 학생이 이 표시를 직접 바꿔서 다시 받는 것을 막음
  if new.is_completed and not coalesce(old.is_completed, false) and not new.decor_granted
     and exists (select 1 from logs l where l.book_id = new.id) then
    new.decor_granted := true;
    perform grant_decor(new.student_id, 1);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_decor_for_completed_book on books;
create trigger trg_decor_for_completed_book
  before update on books
  for each row execute function decor_for_completed_book();

-- 내 화분 둘레 3자리에 놓기(가진 개수만큼만)
create or replace function student_set_decor(p_items text[])
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_student students%rowtype;
  v_catalog text[] := array['prop_wood_chair', 'prop_mushroom_stool', 'prop_name_sign', 'prop_stepping_stones', 'prop_flower_pot', 'prop_lantern',
    'prop_birdhouse_pole', 'prop_low_fence', 'prop_bunny_doll', 'prop_watering_can', 'prop_book_stack', 'prop_butterfly_light', 'prop_rainbow_pinwheel', 'prop_firefly_jar'];
  v_items text[] := coalesce(p_items, array[]::text[]);
  v_out jsonb := '[]'::jsonb;
  v_item text; i int;
begin
  select * into v_student from students where students.auth_user_id = auth.uid();
  if not found then raise exception '로그인 정보를 찾을 수 없어요'; end if;
  if coalesce(array_length(v_items, 1), 0) > 3 then raise exception '소품은 3개까지 놓을 수 있어요'; end if;
  for i in 1..3 loop
    v_item := case when i <= coalesce(array_length(v_items, 1), 0) then v_items[i] else null end;
    if v_item is not null then
      if not (v_item = any(v_catalog)) then raise exception '알 수 없는 소품이에요'; end if;
      -- 선생님 자리(선생님도 함께 읽기, is_teacher)는 모든 소품을 놓아 볼 수 있음
      if not coalesce(v_student.is_teacher, false)
         and (select count(*) from unnest(v_items) x where x = v_item) > coalesce((v_student.decor_counts ->> v_item)::int, 0) then
        raise exception '가지고 있지 않은 소품이에요';
      end if;
    end if;
    v_out := v_out || jsonb_build_array(v_item);   -- 빈자리도 null 로 자리를 지킴
  end loop;
  update students set decor_placed = v_out where id = v_student.id;
end;
$$;
revoke all on function student_set_decor(text[]) from public;
grant execute on function student_set_decor(text[]) to anon, authenticated;
