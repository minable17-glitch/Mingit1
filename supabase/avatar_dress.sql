-- 새싹책방 2.0: 학생 캐릭터 꾸미기(성별·머리·옷) 저장
-- Supabase SQL Editor에서 한 번 실행. 여러 번 실행해도 안전하고 기존 데이터는 그대로임.
-- 적용 전에는 앱이 꾸미기를 그 기기에만 저장함(다른 기기에서는 다시 골라야 함).

alter table students add column if not exists avatar jsonb;   -- { g, hs, hc, sc, b, bc } (없으면 기본 모습)

-- 학생 본인만 자기 캐릭터를 바꿀 수 있음. 허용된 값만 저장
create or replace function student_set_avatar(p_avatar jsonb)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_g text := p_avatar ->> 'g';
  v_hs text := p_avatar ->> 'hs';
  v_b text := p_avatar ->> 'b';
  v_hc int; v_sc int; v_bc int;
begin
  select s.id into v_id from students s where s.auth_user_id = auth.uid();
  if v_id is null then raise exception '로그인 정보를 찾을 수 없어요'; end if;
  if v_g is null or v_g not in ('boy', 'girl') then raise exception '알 수 없는 성별이에요'; end if;
  if v_hs is null or v_hs not in ('short', 'bob', 'pigtails', 'long') then raise exception '알 수 없는 머리 모양이에요'; end if;
  if v_b is null or v_b not in ('shorts', 'pants', 'skirt') then raise exception '알 수 없는 아래옷이에요'; end if;
  begin
    v_hc := (p_avatar ->> 'hc')::int; v_sc := (p_avatar ->> 'sc')::int; v_bc := (p_avatar ->> 'bc')::int;
  exception when others then raise exception '알 수 없는 색이에요';
  end;
  if v_hc is null or v_hc not between 0 and 3 or v_sc is null or v_sc not between 0 and 5 or v_bc is null or v_bc not between 0 and 4 then
    raise exception '알 수 없는 색이에요';
  end if;
  update students set avatar = jsonb_build_object('g', v_g, 'hs', v_hs, 'hc', v_hc, 'sc', v_sc, 'b', v_b, 'bc', v_bc) where id = v_id;
end;
$$;

revoke all on function student_set_avatar(jsonb) from public;
grant execute on function student_set_avatar(jsonb) to authenticated;
