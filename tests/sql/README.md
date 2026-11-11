# 정원 물주기 SQL 점검 (로컬 Postgres 전용 — 운영 DB에서 실행하지 말 것)

`supabase/garden_watering.sql` 이 기존 데이터와 예전 앱을 깨지 않는지, 물주기 규칙이 맞는지 확인하는 스크립트입니다.

1. 빈 로컬 Postgres 16을 띄움
2. `00-local-stubs.sql` (Supabase에만 있는 역할·`auth.uid()` 흉내) → `supabase/schema.sql` 순서로 실행
3. `01-before.sql` (예전 규칙으로 시험 데이터 넣기)
4. `supabase/garden_watering.sql` 을 **두 번** 실행 (여러 번 실행해도 안전한지)
5. `02-after.sql` — 각 줄 끝의 괄호 안 숫자가 기대값

확인하는 것: 기존 나무 일수 유지, 예전 앱 저장 = 즉시 물 준 것, 새 앱 저장 = 물은 나중에, 같은 기록에 두 번 못 줌,
남의 기록에 못 줌, 모두 주기, 읽은 날 수, 기록 삭제 시 일수 처리, 새 챌린지에서 안 준 물 자동 처리, 반 참여율 전체 학생 기준.

## 실시간 채널 보안 점검 (`supabase/realtime_library.sql`)

`00-local-stubs.sql` → `supabase/schema.sql` → `10-realtime-stub.sql`(Supabase Realtime 흉내) → `supabase/realtime_library.sql` → `11-realtime-access.sql`.
기대 결과: 그 반 학생·담당 선생님은 "들어갈 수 있음", 다른 반 학생·로그인 안 한 사람·다른 이름 채널은 "막힘".

## 캐릭터 꾸미기 점검 (`supabase/avatar_dress.sql`)

`00-local-stubs.sql` → `supabase/schema.sql` → `supabase/avatar_dress.sql`(두 번) → `20-avatar.sql`.
기대 결과: 본인 모습 저장(모르는 키는 버림), 다른 학생은 그대로, 이상한 성별·범위 밖 색·숫자 아닌 색·로그인 안 한 사람은 모두 "막힘".
