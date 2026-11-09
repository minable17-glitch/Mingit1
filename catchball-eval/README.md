# 캐치볼 영상 평가 (catchball-eval)

체육 수행평가용 도구. 두 학생이 캐치볼하는 영상을 올리면 **노란 공**과 아이들의 **손목·발목**을 브라우저 안에서 인식해
성공(잡음)/실패(떨어뜨림) 횟수를 자동으로 세고, 선생님이 확인·수정해서 기록합니다. 영상 인식은 전부 브라우저에서 돌아가고,
영상과 기록은 수파베이스(Supabase)에 저장됩니다.

- `index.html` (대문) — **학생 제출 페이지**. 반·이름 입력 → 📹 앱 안에서 촬영(실시간 카운트, 끝나면 자동 업로드) 또는 📁 찍어 둔 영상 압축 업로드.
- `admin.html` — **선생님(관리자) 채점 페이지**. 로그인 → 학생이 제출한 영상 목록 → 채점 → 저장. 로그인 없이도 이 기기에서 영상을 올려 채점·기록 가능. 학생 페이지 맨 아래 작은 링크로도 들어감.

## 처음 설정 (한 번만)

1. **수파베이스 SQL 실행**: 수파베이스 대시보드 → SQL Editor → `supabase/catchball.sql` 내용을 붙여 넣고 Run.
   (버킷 `catchball-videos`, `catchball_` 로 시작하는 표·함수만 만들어지며 다른 앱의 표는 건드리지 않습니다.)
   선생님 계정은 새싹책방 선생님 계정(`teachers` 표)을 그대로 씁니다.
2. **GitHub Pages 켜기**: 저장소 Settings → Pages → Source 를 **GitHub Actions** 로. 이후 `main` 에 push 하면 자동 배포.
   - 학생: `https://<아이디>.github.io/<저장소이름>/`
   - 선생님(관리자): `https://<아이디>.github.io/<저장소이름>/admin.html`
3. 다른 수파베이스 프로젝트를 쓰려면 `.github/workflows/deploy.yml` 의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 를 바꾸세요.

## 로컬 개발

```
npm install
cp .env.example .env
npm run dev          # http://localhost:5173/ 학생 페이지, /admin.html 선생님 페이지
npm run build && npm run preview
```

## 실제 영상으로 기준 맞추기

ffmpeg 가 있으면 브라우저 없이 영상을 검사할 수 있습니다 (손 인식은 제외, 공 궤적만).

```
node scripts/catchball-offline.mjs 영상.mp4            # 성공/실패 판정 결과
DUMP=8-12 node scripts/catchball-offline.mjs 영상.mp4  # 8~12초 구간 프레임별 공 위치
```

브라우저에서는 채점이 끝난 뒤 콘솔의 `window.__catchballDebug` (track, events, groundY)로 같은 데이터를 볼 수 있습니다.
공 색 기준값은 `src/analysis.js` 의 `DEFAULT_BALL_PARAMS`, 판정 기준은 `DEFAULT_EVENT_PARAMS` 입니다.

## 잘 찍는 요령

- 두 아이가 **옆모습**으로 한 화면에 들어오고, 공이 화면에서 **좌우로** 오가도록. (카메라 쪽으로 던지는 영상은 판정 불가)
- 휴대폰 **고정**(삼각대·책상). 한 영상에 **한 팀(2명)** 만.
- 노란 공이 잘 보이게 노란 옷·노란 배경·역광은 피하기.
- 자동 판정은 참고용. 결과 목록에서 성공/실패를 눌러 바꾸거나 지우고, 빠진 건 추가.

## 구조 (자세한 내용은 HANDOFF.md)

```
src/
  analysis.js   공 검출(HSV 색)·추적·캐치 판정 (순수 함수, node 에서도 실행 가능)
  analyzer.js   영상을 프레임 단위로 읽어 분석
  pose.js       MediaPipe 포즈(손목·발목) 래퍼
  live.js       촬영하면서 실시간 분석
  compress.js   브라우저에서 640px 로 압축
  api.js        수파베이스 저장소·RPC 통신
  supabase.js   수파베이스 클라이언트
  records.js    기기 저장(localStorage) + 엑셀 내려받기
  App.jsx       선생님 채점 페이지
  upload/       학생 제출 페이지 (Upload.jsx, LiveCapture.jsx)
supabase/catchball.sql   DB·스토리지 설정 (SQL Editor 에서 실행)
scripts/catchball-offline.mjs   ffmpeg 기반 오프라인 검사 도구
```
