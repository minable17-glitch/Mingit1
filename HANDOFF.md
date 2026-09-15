# LEVEL-UP ARCHERY (양궁 성장일지) — 프로젝트 인수인계 문서

이 문서는 다른 AI 코딩 도구/세션이 처음부터 맥락을 파악할 수 있도록 작성된 인수인계 문서입니다.

## 1. 프로젝트 개요

- **무엇**: 중학교 체육(양궁) 수업용 웹앱. 학생이 (1) 자기 활·조준 데이터를 관리하며 오조준(조준 보정)을 스스로 하고, (2) 심리기술을 읽고·배우고·기록하고·성찰하며, (3) 이 기록이 수행평가 자료로 축적되게 한다.
- **누구를 위해**: 비개발자 교사(minable17@gmail.com)가 실제 학급에서 운영할 예정. 학생은 모바일에서 주로 사용.
- **이 저장소의 다른 브랜치**: `claude/saesak-book-app-gsi00u` 브랜치에는 완전히 별개의 앱("새싹책방", 독서 챌린지)이 있다. **두 앱은 서로 다른 Supabase 프로젝트를 써야 한다** — 절대 같은 Supabase 프로젝트/키를 공유하면 안 됨 (테이블 이름이 겹치지 않아 당장 에러는 안 나지만, RPC 함수 이름이 겹치거나 데이터가 섞일 위험이 있음).
- **원본 기획서**: 교사가 제공한 구현 명세서(사용자 메시지)와, 같은 교사의 러닝 성찰일지 앱에서 얻은 교훈을 정리한 인수인계서(업로드 파일)를 함께 참고해서 만들었다. 명세서는 Google Apps Script 스택을 제안했지만, 실제로는 이 저장소의 다른 브랜치(새싹책방)에서 이미 검증된 **React + Vite + Supabase** 스택을 그대로 재사용했다 (같은 교사가 관리하기 쉽고, 이미 겪은 함정을 피할 수 있어서).

## 2. 기술 스택

```
React 19 + Vite 8, 단일 페이지 앱 (탭 전환은 JS state로 구현, 라우터 없음)
Supabase (Postgres + Auth) — 이 앱 전용 프로젝트를 새로 만들어야 함
vite-plugin-pwa (기존 새싹책방과 동일한 캐싱 전략 재사용)
```

인증 방식: 학생/교사 로그인 모두 내부적으로 Supabase **익명 인증**을 사용한다 (`ensureFreshAnonSession()` → signOut 후 signInAnonymously). 실제 신원 확인은 SECURITY DEFINER RPC 함수 안에서 `crypt()`/`gen_salt('bf')`로 해시된 PIN(학생)/관리자 코드(교사)를 검증한다. 이메일 인증은 전혀 쓰지 않는다.

### 환경변수

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env.example` 참고. 로컬 개발 시 `.env`로 복사해서 채운다 (`.gitignore`에 이미 등록됨).

### 배포

`.github/workflows/deploy-archery.yml`이 `claude/archery-growth-webapp-kmznwk` 브랜치 push 시 GitHub Pages로 빌드/배포한다. 빌드 시 `secrets.ARCHERY_SUPABASE_URL` / `secrets.ARCHERY_SUPABASE_ANON_KEY`를 저장소 Settings → Secrets and variables → Actions에 등록해야 한다. (다른 브랜치의 `deploy.yml`은 새싹책방 전용이며 별개로 동작한다.)

**주의**: 두 앱이 같은 저장소 안에서 각자 GitHub Pages에 배포를 시도하는 구조라, 두 워크플로가 동시에 활성화되면 같은 Pages 사이트를 두고 충돌할 수 있다. 두 앱을 동시에 운영하려면 학교 쪽에서 저장소를 분리하거나 배포 대상을 조정해야 한다.

## 3. 화면 구조

```
StudentLoginGate   학급 코드 + 학번 + 이름 + PIN(4자리) 로그인 (최초 로그인 = 자동 등록)
  └ 하단 탭 5개
      내 장비     활 번호 · 조/사대 위치 · 사이트 세팅 저장
      읽어보기    이미지 콘텐츠 카드 목록 → 상세(이미지 세로 스크롤)
      배워보기    영상(유튜브 embed 또는 직접 재생) + 이미지 + 설명, 박스 호흡 타이머 포함
      기록하기    과녁 탭 마커 기록 + 명중 수 자동 집계 + 조준 보정 코치 (핵심 기능)
      성찰하기    심리기법 체크 + 인내/자기조절/삶연계 서술형 (매일 업서트)
  └ 헤더의 "관리자" 버튼 → AdminTab (학생 세션과 별개)
      학급 생성/로그인(학급 이름 + 관리자 코드)
      읽어보기/배워보기 콘텐츠 CRUD
      학생 명단·슈팅 기록·성찰 기록 조회
```

## 4. 파일 지도

```
src/
  App.jsx                     세션 상태 + 하단 탭 네비게이션 셸
  index.css                   디자인 토큰(CSS 변수) + 유틸리티 클래스 (인라인 스타일 대신 클래스 사용)
  lib/
    supabaseClient.js         Supabase 클라이언트 (그대로 재사용 가능한 범용 코드)
    date.js                   KST 날짜 유틸 (그대로 재사용 가능한 범용 코드)
    session.js                localStorage 학생 세션 + 저장된 학급 코드
    api.js                    모든 Supabase RPC 호출 래퍼
    aimCoach.js                조준 보정 로직 (순수 함수, 아래 §5 참고)
    media.js                   유튜브 URL → embed 변환, 쉼표구분 URL 파싱
  components/
    StudentLoginGate.jsx
    EquipmentTab.jsx
    ReadTab.jsx / LearnTab.jsx
    TargetFace.jsx              과녁 SVG스러운 원형 탭 UI (실제로는 절대위치 div 레이어)
    RecordTab.jsx                기록하기 화면 본체
    BoxBreathing.jsx             박스 호흡(4-4-4-4) 타이머 위젯
    ReflectTab.jsx
    AdminTab.jsx                 관리자 로그인 + 서브탭 셸
    AdminContentEditor.jsx       읽어보기/배워보기 콘텐츠 CRUD (kind prop으로 공용화)
    AdminRecords.jsx             학생/슈팅기록/성찰기록 조회

supabase/schema.sql            전체 스키마 + RPC 함수 (Supabase SQL Editor에서 실행)
```

## 5. 조준 보정 로직 ("Follow the arrow", `src/lib/aimCoach.js`)

- 과녁 중심을 (0,0), 반지름을 1로 정규화한 좌표계 사용 (x: 오른쪽 +, y: 위쪽 +).
- 마커가 **3발 미만**이면 보정 안내를 하지 않고 "몇 발 더 필요해요"만 표시 (한 발의 실수에 휘둘리지 않도록).
- 탄착군 평균 좌표를 구해서, 중심에서 반지름의 10% 이상 벗어난 축만 방향을 판정.
- 규칙: 화살이 몰린 방향과 **같은 방향**으로 사이트를 옮기게 안내 (사이트를 그 방향으로 옮기면 재조준 과정에서 활 전체가 반대로 보정되어 다음 화살이 중앙으로 옴). 왼쪽으로 몰렸으면 "사이트를 왼쪽으로", 위로 몰렸으면 "사이트를 위로".
- 수치 보정량은 강제하지 않고 "조금씩 옮기고 다시 쏴서 확인" 원칙만 안내. 보정 후 세팅값은 학생이 `sight_after`에 직접 입력.
- 이 로직은 순수 함수라 유닛 테스트를 붙이기 쉽다 (아직 테스트 파일은 없음 — 필요하면 `computeAimAdvice`/`computeGroupCenter`를 대상으로 추가할 것).

## 6. DB 스키마 요약 (`supabase/schema.sql`)

| 테이블 | 용도 |
|---|---|
| `classes` | 학급 이름, 학급 코드(학생용), 관리자 코드 해시(교사용) |
| `students` | 학번+이름+PIN해시, `auth_user_id`로 현재 익명 세션과 연결 |
| `equipment` | 학생별 활 번호·조/사대·사이트 세팅 (student_id가 PK, upsert) |
| `read_contents` / `learn_contents` | 교사가 등록하는 콘텐츠 (이미지 URL은 쉼표로 여러 개, 학생에게는 `visible=true`만 노출) |
| `shooting_logs` | 회차별(학생당 하루 1건, `unique(student_id, log_date)`) 탄착 마커·명중수·조준보정 문구·사이트 전/후 |
| `reflections` | 회차별(학생당 하루 1건) 성찰 기록 |

**보안 설계**: 모든 테이블에 RLS를 켜두고, `read_contents`/`learn_contents`의 "visible=true row만 select" 정책 외에는 **직접 테이블 접근을 전부 막는다**. 모든 읽기/쓰기는 SECURITY DEFINER RPC 함수를 통해서만 하고, 함수 내부에서 `auth.uid()`(학생) 또는 관리자 코드 해시 비교(`assert_admin`, 교사)로 권한을 확인한다. 이 패턴은 새싹책방 앱에서 실제로 검증된 방식을 그대로 따른 것이다.

관리자 인증은 계정 시스템 없이 "학급 코드 + 관리자 코드(숫자 4자리 이상)" 조합만 쓰는 가벼운 방식이다 (명세서의 "간단한 접근 제한" 요구에 맞춤). 관리자 코드는 **로그인 상태 동안 브라우저 메모리(React state)에만 유지**하고 localStorage에 저장하지 않는다 — 관리자 화면을 새로고침하면 다시 로그인해야 한다 (의도된 동작).

## 7. 아직 안 한 것 / 다음 단계 후보

- **Supabase 프로젝트 아직 미생성**: 교사가 새 Supabase 프로젝트를 만들고, `supabase/schema.sql`을 SQL Editor에서 실행하고, Authentication → Providers에서 **Anonymous Sign-Ins**를 켜야 실제로 동작한다. 그 다음 `.env`(로컬)와 GitHub 저장소 Secrets(`ARCHERY_SUPABASE_URL`, `ARCHERY_SUPABASE_ANON_KEY`, 배포용)에 값을 넣어야 한다.
- **앱 아이콘**: `public/icon-192.png`, `public/icon-512.png`가 아직 새싹책방(나무 그림)의 아이콘 그대로 남아있다. `public/favicon.svg`만 과녁 모양으로 교체했다. 실제 배포 전에 학교 쪽에서 양궁 테마 아이콘으로 교체를 권한다.
- **콘텐츠는 관리자가 직접 입력**: 읽어보기/배워보기 이미지·영상은 교사가 어딘가(구글 드라이브 등)에 올린 뒤 "공유 가능한 URL"을 관리자 화면에 붙여넣는 방식이다. 구글 드라이브 OAuth 업로드 연동은 만들지 않았다(2단계 후보).
- **성장 그래프**: `getMyShootingHistory()`로 최근 기록을 가져오는 API는 만들어뒀고 `RecordTab`에서 간단한 리스트로만 보여준다. "성장" 느낌을 살리려면 `/my-records` 스타일의 꺾은선 그래프를 추가하면 좋다(러닝 앱 인수인계서 §8의 제안과 동일한 방향).
- **사진 증빙/AI 자동인식**: 이번 구현에는 포함하지 않았다. 필요해지면 러닝 앱 인수인계서 §6-6(구글 드라이브 업로드), §6-7(AI는 항상 선택지)의 패턴을 참고할 것.
- **관리자 학생 삭제/PIN 초기화**: 명세서에 명시되지 않아 이번 버전에는 없다. 필요하면 새싹책방의 `teacher_delete_student`, `teacher_reset_student_pin` RPC 패턴을 그대로 가져오면 된다.

## 8. 스모크 테스트 이력

`npm run build`, `npm run lint` 통과 확인. Playwright로 로그인 화면·관리자 화면·학생 4개 탭·과녁 탭 마커 찍기→저장 흐름까지 목(mock) Supabase 응답으로 콘솔 에러 없이 동작하는 것을 확인했다 (실제 Supabase 프로젝트가 없어서 진짜 로그인/저장까지는 검증하지 못함 — §7 참고).
