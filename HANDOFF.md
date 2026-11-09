# 새싹책방 (Saesak Bookroom) — 프로젝트 인수인계 문서

이 문서는 다른 AI 코딩 도구/세션에게 그대로 붙여넣어서 쓰는 인수인계 문서입니다. 두 가지 용도로 쓸 수 있습니다.

1. **이 프로젝트 이어서 작업하기** — §1~§10을 읽으면 지금까지의 구조/결정/이슈를 그대로 파악하고 이어서 개발할 수 있습니다.
2. **비슷한 앱을 처음부터 새로 만들기** — §11에 0단계부터 7단계까지, 실제로 이 프로젝트를 만들 때 쓴 코드를 그대로 정리해뒀습니다. 순서대로 따라 실행하면 같은 구조의 앱을 새로 만들 수 있습니다.

(Handoff doc for another AI coding assistant — either to continue this repo, or to replicate it from scratch.)

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

## 9. 해결된 이슈: 로그인 전면 장애 + 소감 화면 갇힘 (기록용)

**증상 1**: "Database error creating anonymous user" — 학생 PIN 로그인, 교사 로그인 **전부** 실패.

**원인**: `auth.users`에 걸린 `on_auth_user_created` 트리거(→ `handle_new_user()` 함수)가 익명 사용자 생성 시 `public.profiles`에 INSERT를 시도하다가 `username` NOT NULL 제약 위반(`23502`)으로 실패. 이 트리거/테이블은 **이 앱의 schema.sql과 무관한, Supabase 프로젝트 초기 템플릿 잔재**였음.

**해결 (완료)**: `drop trigger if exists on_auth_user_created on auth.users;` 실행 → 정상화 확인됨.

**증상 2**: 로그인 장애를 여러 번 재시도하는 과정에서, 같은 학생 계정으로 여러 세션이 겹쳐 `students.auth_user_id`가 엇갈리는 바람에 `submitLog()` 호출 시 `new row violates row-level security policy for table "logs"` 오류 발생. 게다가 "소감 작성" 모달에 닫기 버튼이 없어서 앱을 껐다 켜도 같은 실패 화면에 갇히는 부작용이 있었음.

**해결 (완료, `src/App.jsx`)**:
- 소감 작성 모달에 배경 클릭/`✕` 버튼으로 닫을 수 있게 함 (입력 중이던 내용은 `session.js`의 `pendingReflection`에 계속 자동 저장되므로 유실 안 됨).
- `submit()`의 catch 블록에서 에러 메시지에 `"row-level security"`가 포함되면 자동으로 `handleLogout()`을 호출해서, 재로그인만 하면 바로 정상 제출되도록 함.

**교훈**: 같은 계정으로 여러 기기/탭에서 동시 로그인하면 `auth_user_id`가 마지막 로그인 세션으로 덮어써지므로, 먼저 열어둔 세션은 그 다음 쓰기 작업에서 RLS 위반이 날 수 있음. 실제 학생 1인당 1세션이면 발생하지 않지만, 테스트 중 같은 계정을 여러 번/여러 곳에서 로그인하면 재현됨.

## 10. 작업 시 유의사항 (다음 AI 세션을 위한 팁)

- **사용자는 비개발자**입니다. SQL/코드 설명 시 "이거 실행해도 기존 데이터 안 없어져요" 같은 안심 문구를 항상 포함할 것.
- **직접 라이브 시스템에 접근 불가**: 이 개발 환경은 아웃바운드 네트워크가 제한되어 있어 `*.supabase.co`, 배포된 GitHub Pages 사이트(`*.github.io`)에 직접 curl/fetch 불가능. 모든 라이브 DB 진단은 사용자가 Supabase 대시보드 스크린샷을 캡처해서 붙여주는 방식으로 진행해야 함.
- **DB 변경은 schema.sql만 고쳐서는 반영 안 됨** — 반드시 사용자에게 실행할 SQL을 명확히 안내하고, 실행 확인을 받아야 함.
- **날짜 계산은 항상 `src/lib/date.js`의 `todayKST()` 사용**, `new Date().toISOString()` 직접 쓰지 말 것.
- **git 브랜치**: `claude/saesak-book-app-gsi00u`에 커밋/푸시하면 자동 배포됨. 커밋 메시지는 한국어로 "무엇을 왜 고쳤는지" 간결하게 작성하는 기존 스타일을 따름 (`git log` 참고).
- **PWA 캐시 이슈 재발 시** `vite.config.js`의 `navigateFallback: null` 설정이 유지되어 있는지 먼저 확인 (§7).

## 11. 처음부터 새로 만드는 법 (0~7단계, 실제 코드)

비슷한 구조의 앱을 새로 만들고 싶다면 아래 순서를 그대로 따라가면 됩니다. 실제로 이 프로젝트를 만들 때 쓴 코드를 그대로 옮겨뒀습니다.

### 0단계 · 환경 준비

```bash
npm create vite@latest my-reading-app -- --template react
cd my-reading-app
npm install @supabase/supabase-js tesseract.js xlsx
npm install -D vite-plugin-pwa
```

`.env.local`:
```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=발급받은_anon_key
```

Supabase 대시보드 → Authentication → Sign In/Providers 에서 **Anonymous Sign-Ins**를 켜야 함 (모든 로그인이 익명 인증 위에서 동작하는 구조이므로 필수).

### 1단계 · 화면 뼈대

화면마다 컴포넌트/라우터를 나누지 않고, `screen` 문자열 상태 하나로 분기하는 단순한 구조로 시작:

```jsx
const [screen, setScreen] = useState("role"); // "role" | "student-join" | "teacher-account" | "main" ...

return (
  <div className="app">
    {screen === "role" && <RoleSelect onPick={setScreen} />}
    {screen === "student-join" && <StudentJoin />}
    {screen === "main" && <MainScreen />}
  </div>
);
```

### 2단계 · Supabase 연결

`src/lib/supabaseClient.js`:
```js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

`supabase/schema.sql` (Supabase SQL Editor에 그대로 실행):
```sql
create extension if not exists pgcrypto;

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  auth_user_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  admin_password_hash text,
  daily_target_minutes int not null default 10,
  challenge_days int not null default 30,
  teacher_id uuid references teachers(id)
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  nickname text not null,
  pin_hash text not null,
  auth_user_id uuid,
  unique (class_id, nickname)
);

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  log_date date not null default current_date,
  minutes int not null default 10,
  note text not null,
  unique (student_id, log_date)
);

-- 모든 테이블에 행 단위 보안(RLS)을 켜서 자기 반/자기 기록만 접근 가능하게 함
alter table classes enable row level security;
alter table students enable row level security;
alter table logs enable row level security;
```

### 3단계 · 방(학급)·역할 시스템

학급 코드 생성 + 학생 PIN 로그인은 서버에서 실행되는 RPC 함수(SECURITY DEFINER)로 처리:

```sql
create or replace function student_login(
  p_class_code text, p_nickname text, p_pin text
) returns table(id uuid, class_id uuid, nickname text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class classes%rowtype;
  v_student students%rowtype;
begin
  select * into v_class from classes where classes.code = p_class_code;
  if not found then raise exception '학급 코드를 찾을 수 없어요'; end if;

  select * into v_student from students
    where students.class_id = v_class.id and students.nickname = p_nickname;

  if not found then
    insert into students (class_id, nickname, pin_hash, auth_user_id)
    values (v_class.id, p_nickname, crypt(p_pin, gen_salt('bf')), auth.uid())
    returning * into v_student;
  else
    if v_student.pin_hash <> crypt(p_pin, v_student.pin_hash) then
      raise exception 'PIN이 올바르지 않아요';
    end if;
    -- 로그인할 때마다 "지금 이 세션 = 이 학생"을 다시 연결해줌
    update students set auth_user_id = auth.uid() where students.id = v_student.id;
  end if;

  return query select v_student.id, v_student.class_id, v_student.nickname;
end;
$$;

grant execute on function student_login(text, text, text) to anon, authenticated;
```

프론트에서는 로그인 직전에 익명 세션을 새로 발급받고 곧바로 이 RPC를 호출 (`src/lib/api.js`):

```js
async function ensureFreshAnonSession() {
  await supabase.auth.signOut();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

export async function studentLogin({ classCode, nickname, pin }) {
  await ensureFreshAnonSession();
  const { data, error } = await supabase.rpc('student_login', {
    p_class_code: classCode, p_nickname: nickname, p_pin: pin,
  });
  if (error) throw error;
  return data[0];
}
```

> ⚠️ 같은 계정으로 동시에 여러 세션을 로그인하면 `auth_user_id`가 마지막 세션으로 덮어써짐 (§9 참고). 실사용에서는 문제 없지만, 테스트 시 유의.

### 4단계 · 핵심 루프 실데이터화 (읽기 기록 저장)

RLS 정책으로 "자기 학생 id로만 기록 삽입 가능"을 DB에서 강제:
```sql
create policy "logs_insert_own" on logs for insert
  with check (student_id in (select id from students where auth_user_id = auth.uid()));
```

```js
export async function submitLog({ studentId, bookId, minutes, note }) {
  const today = todayKST();
  const { data, error } = await supabase
    .from('logs')
    .insert({ student_id: studentId, book_id: bookId, log_date: today, minutes, note })
    .select('id, log_date, minutes, note').single();
  if (error) throw error;
  return data;
}
```

날짜는 반드시 한국시간(KST) 기준으로 계산해야 함 (`new Date().toISOString()`은 UTC라서 자정 처리가 9시간 밀림 — §6 참고):
```js
// src/lib/date.js
export function todayKST() {
  const kstMs = Date.now() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}
```

### 5단계 · 도서 검색 연결 (외부 API 키는 Edge Function 뒤에 숨기기)

`supabase/functions/search-books/index.ts` (Deno):
```ts
Deno.serve(async (req) => {
  const { query } = await req.json();
  const apiKey = Deno.env.get("KAKAO_API_KEY"); // 키는 Supabase 서버에만 저장됨
  const url = `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
  const data = await res.json();
  const books = (data.documents || []).map((d) => ({
    title: d.title, author: (d.authors || []).join(", "), cover: d.thumbnail,
  }));
  return new Response(JSON.stringify({ books }), { headers: { "Content-Type": "application/json" } });
});
```

배포:
```bash
supabase functions deploy search-books
supabase secrets set KAKAO_API_KEY=발급받은_카카오_키
```

프론트 호출:
```js
export async function searchBooks(query) {
  const { data, error } = await supabase.functions.invoke('search-books', { body: { query } });
  if (error) throw error;
  return data?.books || [];
}
```

### 6단계 · 부가 기능 (OCR + PWA)

사진 속 문장 인식 (`tesseract.js`, 브라우저 내에서 처리, 서버 불필요):
```js
const { default: Tesseract } = await import("tesseract.js");
const worker = await Tesseract.createWorker("kor+eng");
await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK });
const { data } = await worker.recognize(processedImage);
await worker.terminate();
```

PWA 캐싱 (기본 설정은 오래된 캐시를 보여주는 문제가 있어 아래처럼 변경 — §7 참고):
```js
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    navigateFallback: null, // 기본 캐시 우선 규칙을 끔
    runtimeCaching: [{
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: { networkTimeoutSeconds: 3, fetchOptions: { cache: 'no-store' } },
    }],
  },
})
```

### 7단계 · 배포 (GitHub Pages, 서버 비용 없음)

`.github/workflows/deploy.yml`:
```yaml
on:
  push:
    branches: [ main ]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run build
        env:
          GH_PAGES: "1"
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    steps:
      - uses: actions/deploy-pages@v4
```

`vite.config.js`의 `base`는 GitHub Pages 저장소 이름에 맞춰 설정:
```js
base: process.env.GH_PAGES ? '/저장소이름/' : '/',
```

이 7단계를 마치면 이 프로젝트(`src/App.jsx`)와 동일한 구조의 학급 독서 챌린지 앱의 뼈대가 완성됩니다. 이후 UI/기능을 붙여나가는 건 §1~§10에 정리된 실제 화면 구조와 트러블슈팅 이력을 참고하면 됩니다.

## 12. 캐치볼 영상 평가 도구 (별도 페이지 `catchball.html`, 2026-11 추가)

체육 수행평가용. 두 학생이 캐치볼하는 영상을 올리면 **노란 공**과 아이들의 **손목**을 인식해 성공(잡음)/실패(떨어뜨림) 횟수를 자동으로 세고, 선생님이 고쳐서 저장하는 도구. 새싹책방과 **코드·화면·캐시가 완전히 분리**되어 있고(온라인 학교 때와 같은 multi-page 방식), 운영 중인 새싹책방에는 영향이 없음. 나중에 별도 저장소로 떼어내기 쉽도록 `src/catchball/` 안에서만 완결됨 (Supabase 미사용).

**주소**: 배포 시 `/Mingit1/catchball.html`, 개발 시 `http://localhost:5173/catchball.html`

**동작 방식 (영상은 절대 서버로 올라가지 않음, 전부 브라우저 안에서 처리)**
1. 영상 파일 선택 즉시 자동으로 채점 시작 (`src/catchball/App.jsx` → `startAnalysis`).
2. `analyzer.js`: 영상을 초당 15장(설정 가능)으로 `currentTime` 을 옮겨가며 한 장씩 읽음. 분석용 너비 640px 로 축소.
3. 공: `analysis.js`의 `detectBall` — HSV 색 기준(기본 노란색: 색상 42~68, 채도 ≥45%, 밝기 ≥45%)으로 마스크 → 연결 덩어리 → 모양(동그란지)·크기·직전 위치와의 거리·직전 크기와의 비율로 고름. 오탐 방지 장치: (a) 속 픽셀 없는 얇은 테두리 제외(얼굴/옷 가장자리 색 섞임), (b) 3초 넘게 같은 자리에 있는 노란 것 제외(`createStaticMap`, 콘·표지판·옷), (c) 한 프레임에 화면 30% 넘게 점프 금지, (d) 직전 공 크기의 4배 이상/이하 제외.
4. 사람: `pose.js` — MediaPipe PoseLandmarker(lite, numPoses 2). wasm 은 npm 패키지에서 같이 번들되고(`?url` import, exports 에 없어서 `node_modules` 경로로 직접 가져옴), 모델 `.task` 파일(약 5MB)만 `storage.googleapis.com` 에서 받음. 못 받으면 손 없이 공 궤적만으로 판정하고 화면에 안내.
5. 판정: `analysis.js`의 `detectEvents` — 공 x 좌표의 **지그재그(방향 전환) 감지**. 화면 너비의 12%(설정 `최소 던지기 거리`) 이상 날아갔다 되돌아온 지점이 '잡힌 순간'. 그 전환점 전후(날아온 거리 70% 지점 ~ 되돌아간 거리 30% 지점)에 공이 바닥선(발목 기준, 없으면 y 0.88) 아래로 갔거나 튀어오른 흔적이 있으면 **실패**, 아니면 **성공**. 손목이 공 근처(화면 10%)에 있었으면 확신도 95%.
6. 결과 화면: 성공/실패/최대 연속/성공률 + 이벤트 목록(시각 누르면 그 장면으로 이동, 성공↔실패 토글, 삭제, 현재 장면에 추가). 영상 재생 중 공 궤적·손목·바닥선이 오버레이로 그려짐.
7. 저장: `records.js` — `localStorage`(`catchball_records_v1`)에 저장, 엑셀(`xlsx`)로 내려받기 (시트 2개: 평가기록, 캐치시점).

**검증 상태**: 실제 촬영 영상 없이 만들었음. 합성 영상(캔버스로 그린 두 사람 + 노란 공 + 고정된 노란 콘, 성공 9회·실패 1회)으로 브라우저 종단 테스트를 통과함(정확히 9/1). **사용자가 실제 영상 샘플을 주면 `scripts/catchball-offline.mjs` 로 먼저 돌려보고 색 기준값·판정 기준을 맞출 것.**

```
node scripts/catchball-offline.mjs 영상.mp4            # ffmpeg 필요. 포즈 인식 없이 공 궤적만으로 판정
DUMP=8-12 node scripts/catchball-offline.mjs 영상.mp4  # 8~12초 구간 프레임별 공 위치 출력
```
브라우저에서는 채점이 끝난 뒤 콘솔에서 `window.__catchballDebug` (track, events, groundY)로 같은 데이터를 볼 수 있음.

### 12-1. 학생 제출 페이지 + 구글 드라이브·시트 연동 (`catchball-upload.html`, `apps-script/`)

학생이 로그인 없이 영상을 선생님 구글 드라이브에 올리고, 제출 목록·채점 결과를 구글 시트에 남기는 구조. 선생님이 `apps-script/Code.gs` 를 앱스크립트 웹앱으로 한 번 배포하면 됨 (설치 순서는 `apps-script/README.md`).

- **앱스크립트 역할** (`Code.gs`, 선생님 계정으로 실행, 모든 사용자 접근): `start_upload`(드라이브 이어 올리기 세션 발급), `upload_whole`(예비: base64 중계, 40MB 이하), `finish_upload`(제출목록 시트 기록), 선생님 키 필요: `list_submissions`, `get_file`(영상 base64 반환, 40MB 이하), `save_result`, `list_results`. 스크립트 속성: `TEACHER_KEY`(필수), `SUBMIT_CODE`, `ROOT_FOLDER_ID`, `SHEET_ID`(선택).
- **학생 페이지** (`src/catchball/upload/`): 두 가지 모드.
  - 📹 **바로 촬영해서 제출** (`LiveCapture.jsx` + `live.js`): 카메라를 켜고 촬영하는 동안 같은 인식 코드로 실시간으로 공·손목(글러브)·발목(바닥선)을 잡아 성공/실패를 화면에 세어 줌(0.5초마다 `detectEvents` 재계산). 촬영 끝 버튼을 누르면 녹화 파일(MediaRecorder, 1.5Mbps)과 자동 카운트가 **자동으로 업로드**됨. 느린 기기에서는 포즈 인식을 프레임 건너뛰며 돌림(`skipPose`).
  - 📁 **찍어 둔 영상 올리기**: 브라우저에서 640px 로 다시 녹화해 압축(`compress.js`, 1분 100MB → 5~10MB, 영상 길이만큼 걸림) 후 업로드.
  - 업로드 경로(`api.js` `submitVideo`): 1순위 드라이브 세션에 직접 PUT → 실패하면 2순위 앱스크립트 base64 중계(40MB 이하). 요청은 `text/plain` 으로 보내 CORS 사전요청을 피함(앱스크립트 302 리다이렉트를 fetch 가 따라감).
  - 학생 링크는 선생님 페이지 설정에서 만들어짐: `catchball-upload.html?api=<앱스크립트 URL>` (주소가 localStorage 에 저장됨).
- **선생님 페이지 연동** (`App.jsx`): 설정 > 구글 드라이브·시트 연동에 주소·선생님 키 입력 → 연결 확인 → "학생이 제출한 영상" 목록(자동 카운트 표시) → 채점 버튼이 `get_file` 로 영상을 받아 자동 채점 → 저장 시 `save_result` 로 시트에 기록(+제출목록 상태 '채점완료'). 설정은 localStorage 에 저장되어 다음에 자동 연결.
- **검증 상태**: 실제 앱스크립트/드라이브는 선생님 계정이 필요해 **아직 실제로 돌려 보지 못함**. 대신 앱스크립트와 드라이브 PUT 을 흉내 낸 가짜 서버(`mock`)로 학생 압축·업로드 → 선생님 목록 → 가져와 채점 → 시트 저장 → 재접속 자동 연결까지, 그리고 가짜 카메라(y4m)로 실시간 촬영 모드까지 브라우저 종단 테스트를 통과함. **실제 배포 후 첫 확인 포인트**: (1) 드라이브 이어 올리기 세션에 브라우저가 직접 PUT 할 때 CORS 가 되는지(안 되면 자동으로 중계 경로로 감), (2) `get_file` 응답 크기(10MB 영상 → base64 13MB JSON)가 앱스크립트에서 정상 반환되는지.

**알려진 한계 / 다음 할 일**
- 공이 화면에서 **좌우로** 오가는 영상(옆에서 촬영)만 판정 가능. 카메라 쪽으로 던지는 영상은 안 됨.
- 두 아이 이외의 사람·다른 팀이 화면에 있으면 손목 기준이 흐려짐 (포즈 2명까지만).
- 실패 판정은 바닥선에 의존. 포즈가 안 잡히면 기본 바닥선(0.88)이라 낮게 떨어진 공을 놓칠 수 있음 → 선생님 수정 전제.
- 드라이브 연동을 안 쓰면 기록이 기기 localStorage 에만 저장됨.
- 선생님 페이지가 드라이브에서 가져올 수 있는 영상은 40MB 이하(앱스크립트 중계 한계). 앱 안 촬영·압축 업로드는 이 범위 안에 들어옴. 원본 그대로 올린 큰 영상은 링크로 내려받아 직접 올려 채점.
- `vite.config.js`의 `globIgnores: ['**/catchball*', '**/vision_wasm*']` 로 새싹책방 PWA 캐시에서 제외해 둠 (wasm 11MB).
