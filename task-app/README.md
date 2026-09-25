# 업무 챙김 — 교사용 업무 놓침 방지 웹앱 (범용 배포판)

PRD(2026-09-23 초안)의 1단계·2단계 기능을 구현하고, **누구나 구글 계정으로 가입해 쓰는 범용 배포** 구조로 만든 앱입니다.
새싹책방 앱과는 **완전히 별개**이고, 이 폴더(`task-app/`) 안에서만 동작합니다.

## 기본 원칙: AI·구글 심사 없이 모든 기능이 동작

| 구분 | 일반 사용자 (누구나 가입) | 관리자가 켜 준 사용자·관리자 |
| --- | --- | --- |
| 가입·로그인 | 구글 로그인 (이름·이메일만, 구글 심사 불필요) | 같음 |
| 업무 쪼개기 | **단계 정하기**: 템플릿·기본 단계로 시작해 고치기 | + **AI와 쪼개기** |
| 빠른 던져넣기 | 규칙으로 관련 업무를 추측 → 고쳐서 반영 | + AI에게 맡기기 |
| 공문 붙여넣기 | 규칙으로 제목·기한·붙임(제출물) 추출 → 초안 | + AI로 정리 |
| 주간 회고 | 이번 주 숫자 + 멈춘 업무 바로 손보기 + 질문 3개 | + AI와 대화하며 회고 |
| 짜투리 모드 | 급한 순서대로 다음 행동 보기 | + AI 추천 |
| 구글 캘린더 | **구독 주소**를 한 번 추가하면 마감이 캘린더에 표시 (몇 시간 간격 반영) | + 즉시 반영·작업 시간 블록 (고급 연동) |
| Gmail | — (공문 붙여넣기로 대신) | 라벨 메일 → 받은 제안함 (고급 연동) |
| 브리핑·다음 행동·메모·방치·무응답·템플릿·시간표·위젯 | 모두 사용 | 모두 사용 |

- **관리자**: `allowed_emails` 표에 들어 있는 이메일 (설치 때 `minable7@gmail.com`). 설정 화면 맨 아래 **관리자** 칸에서 새 가입 열기/닫기, 사용자별 AI·고급 연동 켜기를 합니다.
- **AI 비용**: AI는 관리자와 관리자가 켜 준 사람만 부를 수 있어서, 일반 사용자 수가 늘어도 API 비용이 늘지 않습니다. Anthropic 키를 아예 넣지 않아도 앱은 전부 동작합니다(AI 버튼만 실패).
- **구글 심사**: 일반 사용자는 기본 로그인 권한만 요청하므로 “확인되지 않은 앱” 경고 없이 쓸 수 있습니다. 캘린더·Gmail 권한은 고급 연동을 켜 준 사람이 직접 연결할 때만 요청합니다.
- **개인정보**: 개인정보처리방침(`/privacy.html`)·이용약관(`/terms.html`) 페이지, 회원 탈퇴(즉시 전체 삭제), 학생 개인정보 입력 금지 안내가 들어 있습니다. 두 문서의 “(운영자 문의 이메일)”은 배포 전에 채워야 하며, 법률 검토를 받은 문서가 아니므로 공개 전에 한 번 검토받기를 권합니다.

## 기능 목록

| 기능 | 어디서 |
| --- | --- |
| 오늘의 브리핑 | 첫 화면. 마감 지남 → 마감 임박(3일 이내) → 무응답·방치 → 나머지 순. 분류 필터·분류별 묶어 보기 |
| 업무 등록 | 브리핑 입력칸 **새 업무**: 한 줄 + 템플릿(선택) + 분류 + 마감 |
| 다음 행동 | 모든 업무에 “→ 다음 행동” 하나. 단계를 체크하면 남은 첫 단계로 자동 갱신 |
| 맥락 메모 | 업무 화면 **멈추기 전에 한 줄**. 최신 메모가 업무 맨 위와 브리핑 카드에 표시 |
| 방치 감지 | 마지막 활동 후 N일(기본 3일) 지나면 “n일 방치” |
| 공 넘겨놓은 일 | 업무 화면 **⏳ 공 넘기기** → 기다리는 동안은 “n일 무응답”. **답 받음**으로 해제 |
| 분류·템플릿·시간표 | **설정**에서 관리. 기본 템플릿: 품의·출장·평가계획 (단계 날짜는 마감 기준, 주말은 금요일로) |
| 위젯 | **설정 → 위젯 주소**. 다음 행동과 경고만 보여주는 읽기 전용 주소. 아이폰용: `docs/widget-scriptable.js` |
| 보관함 | 마지막 단계를 체크하거나 완료로 보관한 업무 |

## 새싹책방·다른 앱과 겹치지 않는 주소

업무 챙김은 모든 주소를 새로 만들어 따로 씁니다. 새싹책방 쪽 설정은 어느 단계에서도 열거나 바꾸지 않습니다.

| 구분 | 새싹책방 (그대로) | 업무 챙김 (새로 만듦) |
| --- | --- | --- |
| 앱 주소 | `minable17-glitch.github.io/Mingit1/` (GitHub Pages) | `task-keeper….vercel.app` (Vercel) |
| 데이터 저장소 | Supabase 프로젝트 `ikljkokebcqaxpctcjpy` | Supabase 새 프로젝트 `task-keeper` (새 ID) |
| 서버 기능 주소 | `ikljkokebcqaxpctcjpy.supabase.co/functions/...` | `<새 ID>.supabase.co/functions/...` |
| 로그인 | 학생 PIN·카카오 | 구글 (새 구글 클라우드 프로젝트 `task-keeper`) |
| 자동 배포 | `deploy.yml` (새싹책방 브랜치) | `task-app-functions.yml` (업무 챙김 브랜치), Vercel |
| 코드 | 저장소 루트 | `task-app/` 폴더 안에만 |

- 주소(도메인)가 다르므로 브라우저 저장공간·홈 화면 앱·오프라인 캐시도 서로 섞이지 않습니다.
- Supabase 무료 요금제는 켜 둔 프로젝트가 2개까지입니다. 새싹책방 계정은 이미 2개라서 **양궁 성장일지 계정**에 새 프로젝트를 만듭니다. 어느 계정에서든 새 프로젝트가 안 만들어진다고 **기존 앱 프로젝트를 일시 정지하거나 지우면 안 됩니다.**
- 안전장치: 설치 SQL은 다른 앱의 표가 하나라도 있는 프로젝트(새싹책방, 양궁 성장일지 등)에서는 아무것도 바꾸지 않고 멈춥니다. GitHub 자동 설치도 다른 앱의 서버 기능이 있는 프로젝트면 멈춥니다.
- 새싹책방 Supabase의 인증 설정(Site URL, 카카오 로그인 등)은 건드리지 않습니다. 모든 설정은 `task-keeper` 프로젝트에서 합니다.

## 설치 순서 (처음 한 번, 모두 웹 브라우저에서)

프로그램 설치 없이 웹사이트 5곳에서 설정합니다. 1시간 정도 걸립니다. 순서가 중요합니다(앞 단계에서 나온 값을 뒤에서 씀).

준비물: 구글 계정, GitHub 계정(이미 있음), 해외 결제 카드(Anthropic AI 사용료 선불 충전용, 최소 5달러).

### 1단계 · Supabase 새 프로젝트 (데이터 저장소)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** (새싹책방 계정은 무료 프로젝트 2개가 차 있어서 **양궁 성장일지 계정**으로 로그인해 만듦. 양궁 성장일지 프로젝트와는 **별개의 새 프로젝트**)
   - 이름: `task-keeper`, 지역: **Northeast Asia (Seoul)**, DB 비밀번호는 아무거나(따로 쓸 일 없음)
2. 만들어지면 왼쪽 **SQL Editor** → `supabase/install_all.sql` 전체 붙여넣기 → **Run** (모든 표 + 범용 배포 설정 + 관리자 이메일 등록이 한 번에 됨. 관리자 이메일을 바꾸려면 파일 맨 아래 줄만 고치기)
   - 예전 설치 파일로 이미 설치했다면 `supabase/schema_public.sql`만 추가로 실행하면 됩니다(기존 데이터는 그대로).
3. 적어 둘 값 — **Project Settings → General**의 *Project ID*(영문 20자, 이하 PROJECT_REF), **Project Settings → API Keys**의 *Publishable key*

### 2단계 · 구글 클라우드 (로그인 + 캘린더·Gmail 권한)

1. [console.cloud.google.com](https://console.cloud.google.com) → 상단 프로젝트 선택 → **새 프로젝트** (`task-keeper`)
2. **API 및 서비스 → 라이브러리**: **Google Calendar API**, **Gmail API** 각각 검색해서 **사용**
3. **API 및 서비스 → OAuth 동의 화면**(Google Auth Platform): 앱 이름 `업무 챙김`, 대상 **외부**, 연락처 이메일 입력
   - **데이터 액세스 → 범위 추가**: `.../auth/calendar.events`, `.../auth/gmail.readonly`
   - **대상 → 앱 게시**를 눌러 **프로덕션** 상태로 (테스트 상태면 7일마다 연결이 끊김)
4. **클라이언트 → 클라이언트 만들기**: 유형 **웹 애플리케이션**
   - 승인된 리디렉션 URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
5. 나온 **클라이언트 ID**와 **클라이언트 보안 비밀번호**를 적어 두기
6. Supabase로 돌아가 **Authentication → Sign In / Providers → Google** 켜고 위 두 값 붙여넣기 → Save

로그인할 때 “Google에서 확인하지 않은 앱” 화면이 뜨면 **고급 → 업무 챙김(으)로 이동**을 누르면 됩니다. 본인 전용 앱이라 괜찮습니다.

### 3단계 · Anthropic API 키 (AI 기능, 선택)

AI는 관리자와 관리자가 켜 준 사람만 씁니다. 건너뛰어도 앱은 전부 동작합니다.

1. [console.anthropic.com](https://console.anthropic.com) 가입 → **Billing**에서 5달러 충전
2. **Limits**에서 월 사용 한도를 5~10달러로 걸어 두기 (넘으면 AI만 멈추고 앱은 계속 동작)
3. **API Keys → Create Key** → 키를 복사해 두기 (한 번만 보여줌)

### 4단계 · GitHub에 비밀값 넣기 → 서버 기능 자동 설치

1. Supabase 오른쪽 위 계정 아이콘 → **Account preferences → Access Tokens → Generate new token** → 복사
2. GitHub 저장소 **Settings → Secrets and variables → Actions → New repository secret**으로 아래를 하나씩 추가

   | 이름 | 값 |
   | --- | --- |
   | `TASK_SUPABASE_ACCESS_TOKEN` | 방금 만든 Supabase 토큰 |
   | `TASK_SUPABASE_PROJECT_REF` | 1단계의 Project ID |
   | `TASK_ANTHROPIC_API_KEY` | (선택) 3단계 API 키 |
   | `TASK_GOOGLE_CLIENT_ID` | 2단계 클라이언트 ID |
   | `TASK_GOOGLE_CLIENT_SECRET` | 2단계 보안 비밀번호 |
   | `TASK_CRON_SECRET` | (선택) 아무 긴 영문·숫자 — 고급 연동 사용자의 메일 자동 확인용 |
   | `TASK_BACKUP_SECRET` | (선택) 아무 긴 영문·숫자 — 주간 백업용 |

3. 저장소 **Actions** 탭 → 왼쪽 **업무 챙김 서버 기능 배포** → 가장 최근 실행(빨간 ✕) 클릭 → 오른쪽 위 **Re-run all jobs**
4. 초록 ✓가 되면 끝. Supabase **Edge Functions** 메뉴에 함수 8개가 보입니다.

### 5단계 · 앱 화면 올리기 (Vercel, 무료)

1. [vercel.com](https://vercel.com) → **GitHub으로 가입** → **Add New → Project** → `Mingit1` 저장소 **Import**
2. **Project Name**: `task-keeper`로 바꾸기 (앱 주소가 `task-keeper….vercel.app`이 되어 새싹책방 주소와 헷갈리지 않음)
   **Root Directory**: `task-app` 선택
3. **Environment Variables**에 두 개 추가
   - `VITE_SUPABASE_URL` = `https://<PROJECT_REF>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = 1단계의 Publishable key
4. **Deploy** → 끝나면 나오는 주소(예: `https://mingit1-xxxx.vercel.app`)를 적어 두기
5. Vercel 프로젝트 **Settings → Git → Production Branch**를 `claude/new-session-oe1y4k`로 바꾸기
   (저장소 기본 브랜치는 새싹책방이라서, 이걸 안 바꾸면 업무 챙김 코드가 없는 브랜치를 올리려 함) → **Deployments**에서 다시 배포
   - 같은 화면 **Ignored Build Step**에 아래를 넣으면 새싹책방 브랜치에 코드를 올릴 때 Vercel이 괜히 빌드하지 않습니다(안 넣어도 새싹책방에는 영향 없음):
     `if [ "$VERCEL_GIT_COMMIT_REF" = "claude/new-session-oe1y4k" ]; then exit 1; else exit 0; fi`
6. Supabase **Authentication → URL Configuration**
   - **Site URL**: Vercel 주소
   - **Redirect URLs**에도 Vercel 주소 추가

### 6단계 · 공개 전 확인

- `public/privacy.html`, `public/terms.html`의 “(운영자 문의 이메일)”을 실제 문의 주소로 바꾸기
- 구글 클라우드 **Google 인증 플랫폼 → 브랜딩**에 앱 홈페이지(Vercel 주소), 개인정보처리방침(`…/privacy.html`), 서비스 약관(`…/terms.html`) 주소 넣기
- 가입을 잠시 막고 싶으면: 앱 **설정 → 관리자 → 새 가입 받기** 끄기

### 7단계 · 첫 로그인

Vercel 주소 접속 → **구글 계정으로 시작하기** → 브리핑 화면이 나오면 성공.
관리자는 **설정 → 고급 구글 연동 → 구글 캘린더·Gmail 연결**을 한 번 눌러 캘린더 즉시 반영·Gmail 가져오기를 켭니다.
폰에서는 브라우저 메뉴의 **홈 화면에 추가**로 앱처럼 쓸 수 있습니다.

### 선택 기능

- **Gmail 자동 확인(매시간)**, **주간 백업**: SQL Editor에서 `pg_cron`, `pg_net` 확장을 켜고 `schema_phase2.sql` 7번, `schema.sql` 8번 주석을 본인 값으로 바꿔 실행. 백업은 Storage에 `backups` 버킷(비공개)도 만들어야 합니다.
- **위젯**: 앱 **설정 → 위젯 주소 만들기**
  - 윈도우 **Lively Wallpaper**: 새 배경화면 → URL에 “HTML 주소”
  - 맥 **Plash**: 웹사이트 추가에 “HTML 주소”
  - 아이폰 **Scriptable**: `docs/widget-scriptable.js` 안내대로 “JSON 주소”
  - 갤럭시 **KWGT**: 텍스트 항목에서 웹 가져오기(`wg`) 함수로 주소를 읽어 표시. 주소 끝 `format=json`을 `format=text`로 바꾸면 요약 전체를 글자 그대로 받을 수 있어 가장 쉽습니다.

### (참고) 터미널로 설치하는 방법

4단계 대신 [Supabase CLI](https://supabase.com/docs/guides/cli)로 직접 올려도 됩니다.

```bash
cd task-app
supabase login
supabase secrets set --project-ref <PROJECT_REF> ANTHROPIC_API_KEY=... GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
supabase functions deploy --project-ref <PROJECT_REF>   # config.toml 설정대로 전체 배포
```

로컬 개발: `cp .env.example .env.local`에 값 채우고 `npm install && npm run dev` (Supabase Redirect URLs에 `http://localhost:5173` 추가).

## 폴더 구조

```
task-app/
  src/
    App.jsx               로그인·탭 전환·데이터 불러오기
    screens/              브리핑, 업무 상세, AI 쪼개기, 보관함, 회고, 받은 제안함,
                          공문 초안, 분류, 템플릿, 시간표, 설정
    lib/api.js            DB·Edge Function 호출 모음
    lib/briefing.js       브리핑 정렬·방치/마감 판단 (테스트 있음)
    lib/date.js           한국 시간 기준 날짜 계산
    lib/timetable.js      공강 시간 계산 (짜투리 모드)
    lib/templates.js      템플릿 날짜 계산, 기본 템플릿
    lib/rules.js          AI 없이 동작하는 규칙: 공문 읽기, 던져넣기 분류, 기본 단계 (테스트 있음)
  supabase/
    schema.sql            테이블·보안 규칙 (SQL Editor에서 수동 실행)
    schema_phase2.sql     2단계 추가 테이블·열
    schema_public.sql     범용 배포: 누구나 가입, 관리자·사용자별 기능 켜기, 캘린더 구독
    install_all.sql       위 세 파일 + 관리자 이메일을 한 번에
    functions/ai-breakdown    AI 쪼개기 (Claude 호출, 저장 안 함)
    functions/calendar-sync   구글 캘린더 일정 생성·수정·삭제
    functions/weekly-backup   주 1회 JSON 백업
    functions/ai-assist       던져넣기·공문 분석·주간 회고·짜투리 추천 (저장 안 함)
    functions/gmail-import    Gmail 라벨 메일 → 받은 제안함
    functions/widget-summary  위젯용 읽기 전용 요약
    functions/calendar-feed   캘린더 구독 주소 (.ics, 모든 사용자)
    functions/delete-account  회원 탈퇴 (계정·데이터 전체 삭제)
  public/
    privacy.html, terms.html  개인정보처리방침·이용약관
  docs/
    PRD.md                기획 문서 원본
    widget-scriptable.js  아이폰 위젯 스크립트
```

## 개발 명령

```bash
npm test        # 브리핑 정렬·날짜 계산 테스트
npm run lint
npm run build
```
