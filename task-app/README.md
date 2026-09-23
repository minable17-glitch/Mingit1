# 업무 챙김 — 업무 놓침 방지 웹앱 (1단계 MVP)

PRD(2026-09-23 초안)의 1단계 기능 8개를 구현한 앱입니다. 새싹책방 앱과는 **완전히 별개**이고, 이 폴더(`task-app/`) 안에서만 동작합니다. 새싹책방의 코드·배포에는 영향이 없습니다.

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

## PRD 열린 질문에 대해 이렇게 정했습니다 (나중에 바꿀 수 있음)

- **AI API**: Anthropic Claude(`claude-opus-5`). 업무 하나 쪼갤 때 보통 수백 원 이하입니다. 비용 한도는 [Anthropic 콘솔](https://console.anthropic.com) → Limits에서 월 한도를 걸어 두세요(예: 월 5달러).
- **캘린더에 단계 마감까지 넣을지**: 기본은 넣음. **설정**에서 끄면 업무 최종 마감만 들어갑니다.
- **방치 기준일을 분류별로 다르게**: 1단계는 전체 한 값만. 2~3주 써 보고 필요하면 추가.
- **아침 메일 브리핑**: 1단계 범위 밖(푸시 알림 제외 원칙과 같음). 2단계 위젯과 함께 검토.
- **방치 계산**: 매일 예약 작업 대신 앱을 열 때 “마지막 활동일”로 바로 계산합니다. 결과는 같고 설정할 것이 줄어듭니다.

## 설치 순서 (처음 한 번)

### 1. Supabase 새 프로젝트

새싹책방과 **다른 프로젝트**를 새로 만드세요(무료 요금제는 2개까지).

1. [supabase.com](https://supabase.com) → New project
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여넣고 Run
3. 같은 SQL Editor에서 본인 이메일 등록 (이 이메일로만 로그인 가능):
   ```sql
   insert into public.allowed_emails (email) values ('minable17@gmail.com');
   ```

### 2. 구글 클라우드 OAuth (로그인 + 캘린더 권한)

1. [Google Cloud Console](https://console.cloud.google.com) → 새 프로젝트
2. **API 및 서비스 → 라이브러리**에서 **Google Calendar API** 사용 설정
3. **OAuth 동의 화면**: 외부(External), 앱 이름 입력, 범위에 `.../auth/calendar.events` 추가
4. **게시 상태를 “프로덕션”으로 전환** — 테스트 모드면 7일마다 캘린더 연결이 끊깁니다. 로그인할 때 “확인되지 않은 앱” 경고가 뜨면 *고급 → 이동*을 누르면 됩니다(본인 전용이라 괜찮음).
5. **사용자 인증 정보 → OAuth 클라이언트 ID**(웹 애플리케이션)
   - 승인된 리디렉션 URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
6. 나온 **클라이언트 ID / 보안 비밀**을 Supabase 대시보드 **Authentication → Providers → Google**에 넣고 켜기
7. Supabase **Authentication → URL Configuration**의 Site URL / Redirect URLs에 앱 주소(예: `https://내앱.vercel.app`, 개발 중엔 `http://localhost:5173`) 추가

### 3. Edge Function 배포

[Supabase CLI](https://supabase.com/docs/guides/cli) 설치 후 이 폴더에서:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>

supabase secrets set ANTHROPIC_API_KEY=<Anthropic 콘솔에서 받은 키>
supabase secrets set GOOGLE_CLIENT_ID=<2단계 클라이언트 ID>
supabase secrets set GOOGLE_CLIENT_SECRET=<2단계 보안 비밀>

supabase functions deploy ai-breakdown
supabase functions deploy calendar-sync
```

### 4. 앱 실행·배포

```bash
cp .env.example .env.local   # 값 채우기 (Project Settings → API)
npm install
npm run dev                  # http://localhost:5173
```

배포는 [Vercel](https://vercel.com)에서 이 저장소를 가져오고 **Root Directory를 `task-app`**, 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 넣으면 됩니다. 배포 주소를 2-7단계 Redirect URLs에 추가하세요.

### 5. (선택) 주 1회 자동 백업

1. Supabase **Storage**에 `backups` 버킷(비공개) 만들기
2. 아무 긴 문자열을 정해 `supabase secrets set BACKUP_SECRET=<문자열>`
3. `supabase functions deploy weekly-backup --no-verify-jwt`
4. `schema.sql` 맨 아래 8번 주석의 `cron.schedule(...)`을 본인 값으로 바꿔 실행

Supabase 무료 요금제는 1주일간 활동이 없으면 일시 정지되는데, 매일 앱을 열면 문제없습니다.

## 폴더 구조

```
task-app/
  src/
    App.jsx               로그인·탭 전환·데이터 불러오기
    screens/              브리핑, 업무 상세, AI 쪼개기, 보관함, 분류, 설정
    lib/api.js            DB·Edge Function 호출 모음
    lib/briefing.js       브리핑 정렬·방치/마감 판단 (테스트 있음)
    lib/date.js           한국 시간 기준 날짜 계산
  supabase/
    schema.sql            테이블·보안 규칙 (SQL Editor에서 수동 실행)
    functions/ai-breakdown    AI 쪼개기 (Claude 호출, 저장 안 함)
    functions/calendar-sync   구글 캘린더 일정 생성·수정·삭제
    functions/weekly-backup   주 1회 JSON 백업
```

## 개발 명령

```bash
npm test        # 브리핑 정렬·날짜 계산 테스트
npm run lint
npm run build
```
