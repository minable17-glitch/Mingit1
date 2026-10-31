# 설정 진행 상황 (이어서 하기용 메모)

> 비밀번호·비밀 키(DB 비밀번호, 구글 보안 비밀번호, Secret key, VAPID Private Key)는 **절대 여기에 적지 않아요.**

마지막 업데이트: 2026-10-31

## ✅ 끝난 것

| 단계 | 내용 | 메모 |
| --- | --- | --- |
| 1. Supabase | 새 계정(**네이버 메일**로 가입) → 조직 `watch-later` → 프로젝트 `watch-later` 생성 | 원래 계정(minable17-glitch)은 무료 프로젝트 2개 한도라 새 계정 사용. 새싹책방 프로젝트는 건드리지 않음 |
| 1. DB 표 | `supabase/schema.sql` 실행 완료 | |
| 2-①~③ 구글 | Google Cloud 새 프로젝트 `watch-later` → OAuth 동의 화면(외부) → 웹 클라이언트 `watch-later` 생성 | 리디렉션 URI: `https://tjafwlllrkymffppzyya.supabase.co/auth/v1/callback` |

- Supabase Project URL: `https://tjafwlllrkymffppzyya.supabase.co` (공개돼도 되는 값)
- Supabase 프로젝트 ref: `tjafwlllrkymffppzyya`

## ⏭ 다음에 할 것 (여기서부터)

1. **2-④ Supabase에 구글 연결** — Authentication → Sign In / Providers → Google → Enable → Client ID / Client Secret 붙여넣기 → Save
   - https://supabase.com/dashboard/project/tjafwlllrkymffppzyya/auth/providers
2. **2-⑤ Publishable key 전달** — Project Settings → API Keys 의 `sb_publishable_...` 를 Claude 에게 알려 주기 → `config.js` 에 넣기
   - https://supabase.com/dashboard/project/tjafwlllrkymffppzyya/settings/api-keys
3. **3. 알림용 키(VAPID) 만들기**
4. **4. 유튜브 API 키 만들기** (Google Cloud `watch-later` 프로젝트에서 YouTube Data API v3 사용 설정 → API 키)
5. **5. 서버 함수 2개 올리기** (`send-due-reminders` — Verify JWT 끄기, `youtube-info`) + 비밀값 5개 + `cron.sql` 실행
6. **6. Cloudflare Pages 에 올리기** (빌드 출력 폴더 `watch-later`, 빌드 명령 비움) → 앱 주소를 Supabase Authentication → URL Configuration 에 등록
7. **7. 확인** — 로그인, 이 기기 알림 켜기, 테스트 알림, 영상 저장
8. **나중에** — 구글 OAuth 동의 화면 "앱 게시"(여러 사람이 쓰려면 필요)

## 정해 둔 것

- 무료로 시작 (수익화는 나중에, 하게 되면 겸직 허가 먼저)
- 화면 호스팅: Cloudflare Pages
- 새싹책방 등 기존 앱·파일은 절대 건드리지 않음 (`watch-later/` 폴더만 작업)
