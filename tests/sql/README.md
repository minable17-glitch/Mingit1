# 정원 물주기 SQL 점검 (로컬 Postgres 전용 — 운영 DB에서 실행하지 말 것)

`supabase/garden_watering.sql` 이 기존 데이터와 예전 앱을 깨지 않는지, 물주기 규칙이 맞는지 확인하는 스크립트입니다.

1. 빈 로컬 Postgres 16을 띄움
2. `00-local-stubs.sql` (Supabase에만 있는 역할·`auth.uid()` 흉내) → `supabase/schema.sql` 순서로 실행
3. `01-before.sql` (예전 규칙으로 시험 데이터 넣기)
4. `supabase/garden_watering.sql` 을 **두 번** 실행 (여러 번 실행해도 안전한지)
5. `02-after.sql` — 각 줄 끝의 괄호 안 숫자가 기대값

확인하는 것: 기존 나무 일수 유지, 예전 앱 저장 = 즉시 물 준 것, 새 앱 저장 = 물은 나중에, 같은 기록에 두 번 못 줌,
남의 기록에 못 줌, 모두 주기, 읽은 날 수, 기록 삭제 시 일수 처리, 새 챌린지에서 안 준 물 자동 처리, 반 참여율 전체 학생 기준.
