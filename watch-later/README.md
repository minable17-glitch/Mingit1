# 나중에 볼 영상 🔔

유튜브 영상 링크만 넣으면 제목·카테고리가 알아서 정리되고, 원하는 영상에 알림 시간을 정해 두면 그 시간에 휴대폰으로 알림이 와서 누르면 바로 영상이 열리는 웹앱(PWA)입니다.
누구나 구글 계정으로 로그인해서 쓸 수 있고, 각자 자기 목록만 보입니다.

## 어떻게 동작하나요

```
[휴대폰/PC 화면]  링크 + 시간 저장 ─────────▶ [Supabase DB]
                                                   │ 1분마다 확인 (pg_cron)
                                                   ▼ 알림 시간이 된 영상이 있으면
[휴대폰 알림] ◀── 웹 푸시 ──── [서버 함수 send-due-reminders]
     │ 누르면
     ▼
  유튜브 영상
```

- **화면 3개**: 아래 메뉴로 이동해요.
  - **영상 추가**: 링크 붙여넣고 저장 끝. (안드로이드는 유튜브 공유로 들어오면 자동 저장)
  - **내 영상**: 썸네일이 액자처럼 걸린 갤러리. 카테고리별로 보고, 액자를 누르면 영상 보기·알림 시간·카테고리 변경·다 봤어요·삭제.
  - **내 관심사**: 저장한 영상으로 관심사를 간단히 분석 — 가장 관심 많은 분야, 최근 늘어난 분야, 자주 나오는 키워드, 자주 저장한 채널, 저장만 하고 잘 안 보는 분야, 저장하는 시간대. (기기 안에서만 계산, 무료)
- **카테고리 자동 분류**: 저장할 때 ① 내가 전에 옮겨 둔 채널이면 그 카테고리 ② 같은 채널 영상이 이미 있으면 그 카테고리 ③ 아니면 유튜브 기본 분류(음악, 교육, 게임…)로 자동으로 넣어요. 카테고리는 언제든 바꿀 수 있고, 바꾸면 그 채널의 다음 영상부터는 바꾼 카테고리로 들어가요. 카테고리 이름 바꾸기·삭제·추가는 목록의 **⚙ 카테고리 관리**에서 해요.
- **화면**: 이 폴더의 HTML/CSS/JS 그대로 (빌드 과정 없음). Cloudflare Pages 또는 Netlify 에 올립니다.
- **안드로이드**: 크롬에서 바로 알림이 와요. 앱을 설치하면(홈 화면에 추가) 유튜브 앱의 **공유 → 나중에 볼 영상**으로 링크를 바로 보낼 수 있어요.
- **아이폰**: iOS 16.4 이상에서 사파리 **공유 → 홈 화면에 추가** 후, 홈 화면 아이콘으로 열어야 알림이 와요. (공유 버튼으로 보내기는 아이폰 웹앱에선 안 돼서 링크를 복사 → 붙여넣기 버튼을 쓰면 돼요.)

## 파일 구성

| 파일 | 하는 일 |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | 화면 |
| `insights.js` | 내 관심사 분석 |
| `config.js` | **직접 채워야 하는 설정값 3개** |
| `sw.js` | 서비스워커 (알림 받기, 알림 누르면 영상 열기) |
| `manifest.webmanifest`, `icons/` | 앱 이름·아이콘, 공유 받기 설정 |
| `_headers` | 호스팅 캐시 설정 (Cloudflare Pages, Netlify 공용) |
| `supabase/schema.sql` | DB 표와 보안 규칙 |
| `supabase/cron.sql` | 1분마다 알림 확인 예약 |
| `supabase/functions/send-due-reminders` | 알림 보내는 서버 함수 |
| `supabase/functions/youtube-info` | 링크에서 영상 제목·채널·썸네일·유튜브 분류를 가져오는 서버 함수 |

---

## 처음 설정하기 (한 번만)

### 0. 무료 플랜 조건 먼저 확인
조건이 자주 바뀌니 시작 전에 한 번 확인하세요.
- Supabase 무료 플랜은 **일정 기간(현재 약 1주일) 아무도 안 쓰면 프로젝트가 일시 정지**될 수 있어요. 정지되면 대시보드에서 다시 켜면 됩니다. 사람들이 꾸준히 쓰면 문제없어요.
- Cloudflare Pages / Netlify 무료 플랜 조건도 확인.

### 1. Supabase 프로젝트 만들기
새싹책방이 쓰는 프로젝트와 섞이지 않게 **새 프로젝트**를 만드는 걸 추천해요.
1. supabase.com → New project (지역: Northeast Asia (Seoul))
2. **SQL Editor** → `supabase/schema.sql` 내용을 통째로 붙여넣고 **Run**

### 2. 구글 로그인 연결
1. Google Cloud Console → API 및 서비스 → **OAuth 동의 화면**
   - 사용자 유형: **외부**, 앱 이름: "나중에 볼 영상"
   - 범위는 기본(email, profile, openid)만 쓰면 구글 심사 없이 공개할 수 있어요.
   - 여러 사람이 쓰려면 마지막에 **앱 게시(프로덕션으로 푸시)**를 눌러야 해요. "테스트" 상태로 두면 테스트 사용자로 등록한 사람만 로그인돼요.
2. **사용자 인증 정보 → OAuth 클라이언트 ID 만들기** (웹 애플리케이션)
   - 승인된 리디렉션 URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
3. Supabase → **Authentication → Sign In / Providers → Google** 켜고 클라이언트 ID·보안 비밀 붙여넣기
4. Supabase → **Authentication → URL Configuration**
   - Site URL: 앱 주소 (예: `https://watch-later.pages.dev`)
   - Redirect URLs 에도 같은 주소 추가 (내 PC에서 테스트하려면 `http://localhost:8080` 도)

### 3. 알림용 키(VAPID) 만들기
PC 터미널에서 한 번:
```bash
npx web-push generate-vapid-keys
```
**Public Key** 와 **Private Key** 가 나와요. Private Key 는 남에게 보여주거나 GitHub 에 올리면 안 돼요.

### 3-2. 유튜브 API 키 만들기 (자동 분류용, 무료)
1. Google Cloud Console (2번과 같은 프로젝트) → API 및 서비스 → **라이브러리** → "YouTube Data API v3" 검색 → **사용**
2. **사용자 인증 정보 → 사용자 인증 정보 만들기 → API 키**
3. 만든 키의 **API 제한사항**에서 "YouTube Data API v3" 만 고르기 (키가 새도 다른 데 못 쓰게)

무료 사용량은 하루 10,000 단위이고 영상 정보 1번 가져오기가 1 단위라, 하루 영상 1만 개까지 무료예요.
키가 없어도 앱은 동작하지만, 유튜브 기본 분류를 못 가져와서 처음 보는 채널은 '미분류'로 들어가요.

### 4. 서버 함수 올리기
Supabase → **Edge Functions → Secrets** 에 5개 추가:

| 이름 | 값 |
| --- | --- |
| `VAPID_PUBLIC_KEY` | 3번의 Public Key |
| `VAPID_PRIVATE_KEY` | 3번의 Private Key |
| `VAPID_SUBJECT` | `mailto:내이메일@gmail.com` |
| `CRON_SECRET` | 아무 긴 무작위 문자열 (예: 비밀번호 생성기로 40자) |
| `YOUTUBE_API_KEY` | 3-2번의 API 키 |

함수 배포 — 둘 중 편한 방법:
- **대시보드에서**: Edge Functions → Deploy a new function → Via Editor → 이름을 정확히 `send-due-reminders` 로 하고 `index.ts` 내용 붙여넣기 → Deploy. 배포 후 함수 설정(Details)에서 **Verify JWT 를 끄기**. `youtube-info` 도 같은 방법으로 올리되 **Verify JWT 는 켜 둔 채로**.
- **터미널에서** (이 `watch-later` 폴더에서):
  ```bash
  npx supabase login
  npx supabase link --project-ref <PROJECT_REF>
  npx supabase functions deploy send-due-reminders --no-verify-jwt
  npx supabase functions deploy youtube-info
  ```

### 5. 1분마다 알림 확인 켜기
`supabase/cron.sql` 에서 `<PROJECT_REF>` 와 `<CRON_SECRET>` 을 바꾼 뒤 SQL Editor 에서 **Run**.

### 6. config.js 채우기
```js
export const SUPABASE_URL = 'https://<PROJECT_REF>.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_...';   // Project Settings → API Keys 의 Publishable key
export const VAPID_PUBLIC_KEY = 'B...';                  // 3번의 Public Key
```
세 값 모두 공개돼도 괜찮은 값이에요. (데이터는 DB 보안 규칙이 지켜요)

### 7. 화면 올리기 — Cloudflare Pages (추천)
1. dash.cloudflare.com → Workers & Pages → Create → **Pages → Connect to Git** → 이 저장소 선택
2. 빌드 설정
   - Framework preset: **None**
   - Build command: **비워 두기**
   - Build output directory: **`watch-later`**
3. 배포가 끝나면 나온 주소(`https://xxxx.pages.dev`)를 2-4번의 Site URL / Redirect URLs 에 넣기

> Netlify 를 쓴다면: Add new site → Import from Git → Base directory `watch-later`, Build command 비움, Publish directory `watch-later`.

### 8. 확인
1. 휴대폰으로 앱 주소 열기 → 구글 로그인
2. (아이폰은 먼저 홈 화면에 추가 → 아이콘으로 열기)
3. **이 기기에서 알림 받기** → 허용 → **테스트** 눌러 알림이 오는지 확인
4. 영상 하나를 2~3분 뒤로 저장해 보고 알림이 오는지 확인

---

## 문제가 생기면

- **알림이 안 와요**
  - 목록에 "⚠ 알림 받을 기기가 없었어요"가 보이면 → 그 기기에서 알림을 다시 켜 주세요.
  - SQL Editor 에서 `select * from cron.job_run_details order by start_time desc limit 10;` 로 예약 실행이 도는지 확인.
  - Supabase → Edge Functions → send-due-reminders → **Logs** 에서 오류 확인.
- **로그인 후 다른 주소로 가요** → 2-4번 Redirect URLs 에 앱 주소가 정확히 들어갔는지 확인.
- **카테고리가 전부 '미분류'로 들어가요** → `YOUTUBE_API_KEY` 비밀값을 넣었는지, 키에서 YouTube Data API v3 를 허용했는지 확인. (Edge Functions → youtube-info → Logs)
- **제목이 안 나와요** → `youtube-info` 함수가 배포됐는지 확인. 제목이 없어도 링크·썸네일로 저장은 돼요.

## 내 PC에서 미리 보기
`watch-later` 폴더에서 `npx serve -l 8080` 실행 후 `http://localhost:8080` 열기.
(알림 기능은 https 또는 localhost 에서만 동작해요)
