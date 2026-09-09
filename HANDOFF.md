# 새싹책방 (Saesak Bookroom) — 프로젝트 인수인계 문서

이 문서는 다른 AI 코딩 도구/세션이 처음부터 맥락을 파악할 수 있도록 작성된 인수인계 문서입니다.
(Handoff doc for another AI coding assistant picking up this project cold.)

## 1. 프로젝트 개요

- **무엇**: 초·중학생 대상 "학급 독서 챌린지" PWA. 학생이 매일 일정 시간(예: 10분) 책을 읽고 소감을 남기면, 반 전체의 "숲"(나무들)이 함께 자라는 게이미피케이션 앱.
- **누구를 위해**: 비개발자 교사(낙원중학교 교사 민동수, minable17@gmail.com)가 실제 학급에서 운영 중. 사용자는 기술 용어를 모르므로 항상 쉬운 말로 설명해야 함.
- **역할**: 교사(반 생성/관리, 학생 등록, 진행 현황 확인) / 학생(PIN 로그인, 매일 읽기 기록 제출, 내 나무 성장 확인).
- **배포 상태**: 실제 운영 중(live). GitHub Pages로 배포되어 학생들이 매일 사용 중이므로, 변경 시 항상 하위호환/안전성에 주의.

## 2. 기술 스택 & 아키텍처

- **프론트엔드**: React 19 + Vite 8, 단일 페이지 앱. 거의 모든 UI/상태/로직이 `src/App.jsx` 한 파일에 있음 (매우 큼 — 화면 전환은 `screen` state 문자열로 분기).
- **백엔드**: Supabase (Postgres + Auth + RLS). 프로젝트 ref: `ikljkokebcqaxpctcjpy` ("minable17-glitch's Project"). DB 스키마/RPC 함수는 `supabase/schema.sql`에 정의되어 있으나 **자동 적용되지 않음** — 사용자가 Supabase SQL Editor에서 수동으로 실행해야 실제 반영됨. 이 레포의 schema.sql은 "현재 DB가 이래야 한다"는 참고 문서이지, 마이그레이션 도구가 아님.
- **인증 방식**: 모든 로그인(학생 PIN 로그인 + 교사 계정 로그인)이 내부적으로 Supabase **익명 인증**(`supabase.auth.signInAnonymously()`)을 사용. 매 로그인 시 `ensureFreshAnonSession()`(signOut → signInAnonymously)을 먼저 호출한 뒤 RPC를 호출하는 패턴.
- **PWA**: `vite-plugin-pwa`(v1.3.0), Workbox `generateSW` 전략. `registerType: 'autoUpdate'`.
- **배포**: GitHub Actions → GitHub Pages. 브랜치 `claude/saesak-book-app-gsi00u`에 push하면 자동 배포되는 워크플로 "Deploy to GitHub Pages" 존재.
- **OCR**: `tesseract.js`로 사진 속 텍스트(인상 깊은 구절) 인식.

## 3. 핵심 파일 구조

```
src/
  App.jsx              — 거의 모든 UI/상태/로직 (매우 큰 단일 파일)
  main.jsx             — PWA 서비스워커 등록 + 업데이트 감지 로직
  index.css
  lib/
    api.js             — Supabase RPC 호출 래퍼 함수들 (아래 §5 참고)
    session.js         — localStorage 기반 로컬 세션/진행상황 저장 (오늘 날짜 기준)
    date.js            — KST(한국시간) 기준 날짜 계산 유틸 (아래 §6 참고, 매우 중요)
    supabaseClient.js  — Supabase 클라이언트 생성 (.env의 VITE_SUPABASE_URL/ANON_KEY 사용)
  assets/forest-bg.jpg — 앱 내 숲 배경 이미지 (홍보 이미지 제작에도 재사용됨)
vite.config.js         — PWA 캐싱 전략 설정 (아래 §7 참고, 트러블슈팅 이력 있음)
supabase/schema.sql    — DB 테이블 + RPC 함수 정의 (수동 실행용 참고 문서)
public/icon-192.png, icon-512.png — 앱 아이콘 (나무+책 일러스트, 사용자 제공 이미지로 교체됨)
```

## 4. DB 스키마 (schema.sql 기준)

**테이블**: `teachers`, `classes`, `students`, `books`, `logs`, `cheers`, `reading_sessions` — 모두 RLS(Row Level Security) 활성화.

**주요 RPC 함수** (SECURITY DEFINER 패턴, `auth.uid()`로 본인 확인):
- 인증/계정: `teacher_account_signup`, `teacher_account_login`, `teacher_login`, `student_login`, `teacher_kakao_bootstrap`, `teacher_reset_password`, `teacher_change_password`, `student_verify_pin`, `student_change_pin`
- 반 관리: `create_class`, `pause_challenge`, `resume_challenge`, `teacher_delete_class`, `teacher_delete_student`, `teacher_reset_student_pin`
- 기록: `student_update_log` (지난 기록도 수정 가능, 날짜 제한 없음 — 최근에 `student_update_today_log`에서 이름 변경됨), `teacher_delete_log`, `add_bonus_reading`
- 기타: `student_set_equipped`(악세서리 장착), `grant_accessories`, `bump_student_days`, `my_class_ids`, `is_class_teacher`

**주의**: `public.profiles` 테이블과 `on_auth_user_created` 트리거(→ `handle_new_user()` 함수)는 **schema.sql에 없는, Supabase 프로젝트 초기 템플릿의 잔재**였음. 이 트리거가 익명 로그인 시 `profiles.username` NOT NULL 제약을 위반해 **모든 로그인이 실패하는 심각한 버그**를 일으켰고, `drop trigger on_auth_user_created on auth.users;`로 제거하는 수정을 안내함 (§9의 최근 이슈 참고). 이 프로젝트 코드에는 `profiles` 관련 로직이 전혀 없음.

## 5. `src/lib/api.js` 함수 목록 (Supabase RPC 래퍼)

인증/계정: `teacherSignUp`, `teacherSignIn`, `teacherLogin`, `studentLogin`, `requestPasswordReset`, `requestUsernameReminder`, `resetTeacherPassword`, `changeTeacherPassword`, `resetStudentPin`, `verifyStudentPin`, `changeStudentPin`, `getAuthSession`, `logout`

반/학급: `createClassForAccount`, `createClass`, `getMyClasses`, `getClassById`, `updateClassSettings`, `pauseChallenge`, `resumeChallenge`, `getClassProgress`, `deleteClass`, `getClassRoster`, `getClassLogsForTeacher`, `getClassCompletedBookCounts`, `getClassCheersSentCounts`, `getClassCurrentBooks`, `getClassReadingSessions`

학생/기록: `deleteStudent`, `deleteLog`, `updateTodayLog`(→ RPC `student_update_log` 호출), `getMyAccessories`, `setEquippedAccessories`, `addBonusReading`, `getMyLogs`, `getTodayLog`, `getCurrentBook`, `startBook`, `getCompletedBooks`, `submitLog`, `markBookCompleted`, `setReadingSession`

응원/책 검색: `sendCheer`, `getCheersReceivedSince`, `searchBooks`, `getBestsellers`

## 6. 중요한 설계 결정: KST(한국시간) 날짜 처리

**배경 버그**: `new Date().toISOString().slice(0,10)`은 UTC 기준 날짜라서, 한국 자정(KST, UTC+9)이 지나도 9시간 동안은 여전히 어제 날짜로 계산됨. 이게 "오늘의 반 목표가 자정에 초기화 안 됨" 버그의 진짜 원인이었음(클라이언트 JS뿐 아니라 **Postgres DB 세션 타임존도 UTC였음** — `alter database postgres set timezone to 'Asia/Seoul';`로 서버 쪽도 수정함).

**해결**: `src/lib/date.js`(신규 파일)에 순수 함수로 KST 날짜 유틸을 만들어 `App.jsx`, `api.js`, `session.js` 전체에서 UTC 기반 계산을 대체:

```js
export function todayKST() {
  const kstMs = Date.now() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}
export function addDaysToDateString(dateStr, days) { /* Date.UTC()를 순수 정수 날짜 카운터로만 사용 */ }
export function daysBetweenDateStrings(startStr, endStr) { /* 두 날짜 문자열 간 일수 차이 */ }
```

앞으로 날짜 관련 로직을 추가할 때는 반드시 `todayKST()`를 쓰고 `new Date().toISOString()`을 직접 쓰지 말 것.

또한 백그라운드 탭/화면 꺼짐 상태에서는 `setInterval`이 브라우저에 의해 지연/중단될 수 있으므로, 자정 롤오버 감지는 `visibilitychange` 이벤트로도 트리거되도록 이중 처리함 (`App.jsx`의 `checkDateRollover` 참고).

## 7. PWA 캐싱 전략 (트러블슈팅 이력 있음)

카카오톡 인앱 브라우저 등에서 링크로 들어가면 업데이트가 반영 안 되는 문제가 있었음. **핵심 발견**: vite-plugin-pwa는 기본적으로 `navigateFallback`을 자동 설정해서 모든 네비게이션 요청에 대해 캐시 우선(cache-first) `NavigationRoute`를 등록하는데, 이게 커스텀 `runtimeCaching` 규칙보다 **먼저** 등록되어 커스텀 규칙이 아예 실행되지 않는 문제가 있었음(Workbox는 first-match-wins). 해결: `navigateFallback: null`을 명시해서 기본 라우트를 끄고, `NetworkFirst` + `fetchOptions: { cache: 'no-store' }` 커스텀 규칙만 남김 (현재 `vite.config.js` 상태, §3 참고).

`main.jsx`에도 보조 안전장치: `registerSW({ immediate: true })`, 60초마다 `registration.update()` 폴링, `visibilitychange` 시 업데이트 확인, `controllerchange` 시 `window.location.reload()`.

## 8. 최근 완료된 기능/버그 수정 (최신순, git log 기준)

1. OCR 스캔 시 사진에서 원하는 부분만 드래그로 선택해서 인식하는 크롭 기능 추가
2. 목표 읽기 시간(예: 10분)을 다 채워도 강제로 소감 작성 화면으로 넘어가지 않고, 끊김 없이 자유읽기로 자연스럽게 이어지도록 변경 (소감은 나중에 "다 읽었어요" 누를 때 작성)
3. 기록 수정 기능을 "오늘 기록만"에서 "지난 모든 기록"으로 범위 확장 (사용자가 명시적으로 요청 정정함)
4. 카카오톡 인앱 브라우저 캐시 문제 추가 조치 (HTTP 캐시까지 우회)
5. 오늘 기록 수정 버튼이 새로고침 후 사라지던 버그 수정 — 원인: 표시용 문자열 `"오늘"`과 실제 날짜(`log_date`)를 잘못 비교하고 있었음
6. 카카오톡 인앱 브라우저 등에서 캐시 전략 전면 변경 (§7)
7. 백그라운드 탭에서 재진입 시 오늘 완료 여부 재확인 (`visibilitychange`)
8. 학생이 오늘 이미 제출한 느낀점/인상 깊은 구절 수정 기능 최초 추가
9. 챌린지 기간을 달력(시작일~종료일)으로 직접 지정하는 기능 추가
10. 자정 초기화 문제 진짜 원인(UTC/KST) 수정 (§6)
11. 앱 아이콘 나무 일러스트로 2차 교체 (사용자 제공 이미지)
12. 악세서리 표시 버그, 자유읽기 이어읽기 버그, 책 등록/검색 개선 등 다수

## 9. 진행 중/최근 해결된 이슈: 로그인 전면 장애

**증상**: "Database error creating anonymous user" — 학생 PIN 로그인, 교사 로그인 **전부** 실패.

**원인 규명 과정**: Rate limit(익명 로그인 시간당 30회 제한) 의심 → 아님. Supabase Auth Logs에서 `POST /auth/v1/signup → 500` + Postgres 에러 `23502 null value in column "username" of relation "profiles"` 발견 → `auth.users`에 걸린 `on_auth_user_created` 트리거(→ `handle_new_user()` 함수)가 익명 사용자 생성 시 `public.profiles`에 INSERT를 시도하다가 `username` NOT NULL 제약 위반으로 실패하는 것이 원인. 이 트리거/테이블은 **이 앱의 schema.sql과 무관한, Supabase 프로젝트 초기 템플릿 잔재**.

**안내한 수정 SQL** (사용자가 Supabase SQL Editor에서 직접 실행):
```sql
drop trigger if exists on_auth_user_created on auth.users;
-- 완전히 정리하려면(선택):
drop function if exists public.handle_new_user();
```
**상태**: 사용자에게 SQL을 안내했고, 실행 후 재테스트 결과를 기다리는 중 — 아직 "됐다"는 최종 확인은 받지 못함. 다음 세션에서 이어서 확인 필요.

## 10. 작업 시 유의사항 (다음 AI 세션을 위한 팁)

- **사용자는 비개발자**입니다. SQL/코드 설명 시 "이거 실행해도 기존 데이터 안 없어져요" 같은 안심 문구를 항상 포함할 것.
- **직접 라이브 시스템에 접근 불가**: 이 개발 환경은 아웃바운드 네트워크가 제한되어 있어 `*.supabase.co`, 배포된 GitHub Pages 사이트(`*.github.io`)에 직접 curl/fetch 불가능. 모든 라이브 DB 진단은 사용자가 Supabase 대시보드 스크린샷을 캡처해서 붙여주는 방식으로 진행해야 함.
- **DB 변경은 schema.sql만 고쳐서는 반영 안 됨** — 반드시 사용자에게 실행할 SQL을 명확히 안내하고, 실행 확인을 받아야 함.
- **날짜 계산은 항상 `src/lib/date.js`의 `todayKST()` 사용**, `new Date().toISOString()` 직접 쓰지 말 것.
- **git 브랜치**: `claude/saesak-book-app-gsi00u`에 커밋/푸시하면 자동 배포됨. 커밋 메시지는 한국어로 "무엇을 왜 고쳤는지" 간결하게 작성하는 기존 스타일을 따름 (`git log` 참고).
- **PWA 캐시 이슈 재발 시** `vite.config.js`의 `navigateFallback: null` 설정이 유지되어 있는지 먼저 확인 (§7).
