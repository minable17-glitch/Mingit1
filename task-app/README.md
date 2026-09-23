# 업무 챙김 — 업무 놓침 방지 웹앱 (1·2단계)

PRD(2026-09-23 초안)의 1단계 기능 8개와 2단계 기능 8개를 구현한 앱입니다. 새싹책방 앱과는 **완전히 별개**이고, 이 폴더(`task-app/`) 안에서만 동작합니다. 새싹책방의 코드·배포에는 영향이 없습니다.

## 구현된 기능

| PRD 기능 | 어디서 |
| --- | --- |
| 분류 관리 | 하단 **분류** 탭. 추가·이름/색 수정·순서 변경·삭제(삭제 시 업무를 옮길 분류 선택). 첫 로그인 때 담임·수업·행정업무·개인 일정 자동 생성 |
| 업무 등록 | 브리핑 맨 위 한 줄 입력 + 분류 + 마감(선택) → 등록 |
| AI 업무 쪼개기 | 업무 화면 → **AI와 쪼개기**. 질문은 한 번에 하나, 최대 3개 → 단계·단계별 마감·첫 다음 행동 제안 → 고쳐서 **확정해서 저장**. 확정 전엔 저장 안 됨. AI 없이 **직접 적기**도 가능 |
| 다음 행동 | 모든 업무 카드에 “→ 다음 행동” 표시. 단계를 체크하면 남은 첫 단계로 자동 갱신. DB 규칙으로 진행 중 업무의 다음 행동은 비울 수 없음 |
| 맥락 메모 | 업무 화면 **멈추기 전에 한 줄**. 최신 메모가 업무 화면 맨 위와 브리핑 카드에 표시 |
| 오늘의 브리핑 | 첫 화면. 마감 지남 → 마감 임박(3일 이내) → 방치 → 나머지 순. 분류 필터·분류별 묶어 보기 |
| 방치 감지 | 마지막 활동 후 N일(기본 3일, **설정**에서 변경) 지나면 “n일 방치” 표시, 브리핑 상단으로 |
| 구글 캘린더 연동 | 업무·단계 마감을 종일 일정으로 등록, 마감을 바꾸면 일정도 수정, 업무 삭제 시 일정도 삭제. 업무 화면에서 작업 시간 블록 추가 |

마지막 단계를 체크하면 업무가 자동으로 **보관함**으로 옮겨집니다.

## 2단계 기능 (놓침 방지 강화)

| PRD 기능 | 어디서 |
| --- | --- |
| 공 넘겨놓은 일 추적 | 업무 화면 **⏳ 공 넘기기** → “교감 결재”처럼 기다리는 대상 입력. 기다리는 동안은 ‘방치’ 대신 **N일 무응답**(기본 3일, 설정에서 변경)으로 브리핑 상단에 표시. **답 받음**으로 해제 |
| 빠른 던져넣기 | 브리핑 입력칸 **던져넣기** 탭. 떠오른 한 줄을 넣으면 AI가 어느 업무의 단계·메모·다음 행동인지, 아니면 새 업무인지 제안 → **이대로 반영** |
| 주간 회고 | 하단 **회고** 탭(금요일엔 브리핑에도 안내). AI가 이번 주 활동을 정리하고 질문 최대 3개 → 다음 행동·마감 조정 제안(하나씩 반영) → 요약 저장 |
| 바탕화면·홈 화면 위젯 | **설정 → 위젯 주소 만들기**. 다음 행동과 경고만 보여주는 읽기 전용 주소(HTML·JSON·텍스트). 아이폰용 스크립트: `docs/widget-scriptable.js` |
| 공문 붙여넣기 | 브리핑 입력칸 **공문 붙여넣기** 탭. 본문을 붙이면 AI가 업무명·기한·제출물·단계를 뽑은 초안을 보여줌 → 고쳐서 확정 |
| 메일에서 업무 가져오기 | Gmail에서 **업무** 라벨(설정에서 변경)을 붙인 메일을 AI가 읽어 **받은 제안함**에 초안으로 넣음. 매시간 자동(선택) 또는 **지금 메일 확인** 버튼 |
| 자주 하는 업무 템플릿 | 새 업무 등록 시 템플릿 선택 → 단계와 날짜(마감 기준 며칠 전, 주말은 금요일로)가 한 번에. 기본 제공: 품의·출장·평가계획. 업무 화면 **템플릿으로 저장**, **설정 → 업무 템플릿**에서 관리 |
| 시간표 연동 짜투리 모드 | **설정 → 시간표**에서 종 시간과 수업 있는 교시 표시. 공강 시간에 앱을 열면 “지금 3교시 공강 · 32분 남음” → **작은 행동 추천** |

AI 원칙은 1단계와 같습니다. AI는 제안만 하고, 사용자가 확정해야 저장됩니다.

## PRD 열린 질문에 대해 이렇게 정했습니다 (나중에 바꿀 수 있음)

- **AI API**: Anthropic Claude(`claude-opus-5`). 업무 하나 쪼갤 때 보통 수백 원 이하입니다. 비용 한도는 [Anthropic 콘솔](https://console.anthropic.com) → Limits에서 월 한도를 걸어 두세요(예: 월 5달러).
- **캘린더에 단계 마감까지 넣을지**: 기본은 넣음. **설정**에서 끄면 업무 최종 마감만 들어갑니다.
- **방치 기준일을 분류별로 다르게**: 1단계는 전체 한 값만. 2~3주 써 보고 필요하면 추가.
- **아침 메일 브리핑**: 1단계 범위 밖(푸시 알림 제외 원칙과 같음). 2단계 위젯과 함께 검토.
- **방치 계산**: 매일 예약 작업 대신 앱을 열 때 “마지막 활동일”로 바로 계산합니다. 결과는 같고 설정할 것이 줄어듭니다.

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
- Supabase 무료 요금제는 켜 둔 프로젝트가 2개까지입니다. 새 프로젝트가 안 만들어져도 **새싹책방 프로젝트를 일시 정지하거나 지우면 안 됩니다** (학생들이 쓰는 중). 그럴 땐 다른 안 쓰는 프로젝트를 정리하거나 문의하세요.
- 새싹책방 Supabase의 인증 설정(Site URL, 카카오 로그인 등)은 건드리지 않습니다. 모든 설정은 `task-keeper` 프로젝트에서 합니다.

## 설치 순서 (처음 한 번, 모두 웹 브라우저에서)

프로그램 설치 없이 웹사이트 5곳에서 설정합니다. 1시간 정도 걸립니다. 순서가 중요합니다(앞 단계에서 나온 값을 뒤에서 씀).

준비물: 구글 계정, GitHub 계정(이미 있음), 해외 결제 카드(Anthropic AI 사용료 선불 충전용, 최소 5달러).

### 1단계 · Supabase 새 프로젝트 (데이터 저장소)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** (새싹책방과 **다른** 프로젝트. 무료 요금제는 2개까지)
   - 이름: `task-keeper`, 지역: **Northeast Asia (Seoul)**, DB 비밀번호는 아무거나(따로 쓸 일 없음)
2. 만들어지면 왼쪽 **SQL Editor** → `supabase/install_all.sql` 전체 붙여넣기 → **Run** (테이블 생성 + 2단계 + 본인 이메일 등록이 한 번에 됨. 다른 이메일을 쓰려면 파일 맨 아래 줄만 고치기)
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

### 3단계 · Anthropic API 키 (AI 기능)

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
   | `TASK_ANTHROPIC_API_KEY` | 3단계 API 키 |
   | `TASK_GOOGLE_CLIENT_ID` | 2단계 클라이언트 ID |
   | `TASK_GOOGLE_CLIENT_SECRET` | 2단계 보안 비밀번호 |
   | `TASK_CRON_SECRET` | (선택) 아무 긴 영문·숫자 — 메일 자동 확인용 |
   | `TASK_BACKUP_SECRET` | (선택) 아무 긴 영문·숫자 — 주간 백업용 |

3. 저장소 **Actions** 탭 → 왼쪽 **업무 챙김 서버 기능 배포** → 가장 최근 실행(빨간 ✕) 클릭 → 오른쪽 위 **Re-run all jobs**
4. 초록 ✓가 되면 끝. Supabase **Edge Functions** 메뉴에 함수 6개가 보입니다.

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

### 6단계 · 첫 로그인

Vercel 주소 접속 → **구글 계정으로 로그인** → 권한 허용(캘린더·Gmail 체크) → 브리핑 화면이 나오면 성공.
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
  supabase/
    schema.sql            테이블·보안 규칙 (SQL Editor에서 수동 실행)
    schema_phase2.sql     2단계 추가 테이블·열
    functions/ai-breakdown    AI 쪼개기 (Claude 호출, 저장 안 함)
    functions/calendar-sync   구글 캘린더 일정 생성·수정·삭제
    functions/weekly-backup   주 1회 JSON 백업
    functions/ai-assist       던져넣기·공문 분석·주간 회고·짜투리 추천 (저장 안 함)
    functions/gmail-import    Gmail 라벨 메일 → 받은 제안함
    functions/widget-summary  위젯용 읽기 전용 요약
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
