# 인수인계: 바이브 코딩 연수(체육) 사이트

## 목표
민동수 선생님(성남 낙원중, 체육)이 구글 사이트(https://sites.google.com/view/pevibecode)에 만들어 둔 "바이브 코딩 연수" 자료를
**Vercel에 올리는 정적 사이트**로 옮긴다. 원본과 같은 27페이지 구조·글·체험(HTML 실습)을 유지하고, 선생님 본인의 구글 사이트(비어 있음)는 쓰지 않는다.

## 현재 상태
- 27페이지 복제 완료, 체험 상자 7개 이식 완료.
- 아티팩트 버전(비공개): https://claude.ai/artifact/LQc1G76Pgb64hyqnHZv78J  (site.html, 편집 모드 포함, 임베드 불가)
- Vercel 버전: `vercel-site/public/index.html` 생성됨(아직 배포 안 함). 외부 앱 4개는 iframe으로 삽입.
- 소스 위치: 저장소 `minable17-glitch/Mingit1`의 `vibe-site/` 폴더 (같은 저장소의 새싹책방 앱과는 별개, 서로 영향 없음).
- 실제 브라우저(Chromium) 확인 완료(2026-10-25): 27페이지 모두 열림, 체험 상자 7개 모두 실행됨.
  - 고친 것: 디버깅 실습(CSS/JS)의 칭찬 스티커판이 `localStorage`를 쓰는데 sandbox에 막혀 학생 버튼이 안 나오던 문제.
    html 블록에 `storage: true`를 주면 그 상자만 `allow-same-origin`으로 실행(`build2.py`의 `html(..., storage=True)`).
  - 확인 못 한 것: 외부 앱 4곳 iframe, Tailwind·FontAwesome·confetti CDN — 작업 환경의 네트워크 정책으로 막혀 있었음. 배포 후 확인 필요.

## 파일 구조
- `template.html` : 단일 파일 SPA 틀(아티팩트 조각 형식: `<title>`, `<style>`, `<script>`). 데이터 자리는 `__DATA__`.
  - 블록 종류: h, p, note, steps, prompt(복사 상자), html(체험 상자: sandbox iframe + 코드 보기/실행), quiz, links. (Vercel 빌드에서 `embed` 추가)
  - 메뉴는 3단계까지 지원, 해시 라우팅(`#페이지id`), 편집 모드는 `window.claude`(아티팩트 전용)가 있을 때만 뜸.
- `build2.py` : 27페이지 데이터 정의 → `site.html`(아티팩트용) 생성. 글/프롬프트 원문이 모두 여기 있음.
- `build_vercel.py` : build2.py의 페이지를 불러와 외부 앱 4곳을 `embed` 블록으로 바꾸고 `template.html`에 `embed` 블록·`allow-modals` 패치 후 완전한 HTML로 감싸 `vercel-site/`(public/index.html, vercel.json, README.md) 생성.
- `embeds/*.html|txt` : 원본 구글 사이트의 "HTML 삽입" 코드를 옮겨 적은 것 (structure, frontend, debug, debug_css, debug_js, appscript, prompt) + dddd 페이지 코드(code_gs.txt, index_html.txt).
- `build.py` : 첫 초안(내가 임의로 쓴 17페이지). **폐기**, 참고 불필요.
- `t/` : jsdom 스모크 테스트(node_modules 제외 가능).

빌드: `python3 build_vercel.py` → `vercel-site/` 갱신.

## 원본 페이지 트리 (id)
홈(home) / 바이브 코딩의 기초개념(basics) ▸ 프로그램 기본구조(structure), 프론트엔드의 구조(frontend), 코딩 용어(terms)
/ 웹앱 기초(webapp) ▸ 사례(cases) ▸ 달리기 수업 웹앱(run), 새싹책방(book); 퀴즈형 웹앱 만들기(quiz), 웹앱 만들기(실습)(make), 자리배치표(seat)
/ 디버깅(debug) ▸ 디버깅 실습 (CSS)(debug-css), 디버깅 실습(Java script)(debug-js)
/ 앱스크립트(appscript) ▸ AI 와 함께 프롬포트 다듬기(refine), 앱스크립트 실습(기존코드)(ex-old), 실습(새로, 기본)(ex-new), 실습(새로, 심화)(ex-adv), 게임형과제(예시)(ex-game), 연수신청(예시)(ex-apply), dddd
/ API(api) ▸ API 실습, API 개념, API활용 예시 (제목만 있는 빈 페이지)

## 외부 임베드 4곳 (Vercel 버전에서 iframe)
- 코딩 용어 카드: https://coding-term-cards.minable17.chatgpt.site/
- 달리기 수업 웹앱: https://running-journal-wine.vercel.app/  (테스트 로그인: 학번 9801, 이름 코드테스트 1, 비번 123456 — 원본 페이지에 공개돼 있던 값)
- 게임형과제·연수신청: Apps Script exec URL (build_vercel.py 안에 있음)

## 해야 할 일 (우선순위)
1. Vercel에서 이 저장소를 Import → Root Directory `vibe-site/vercel-site`, Framework Other, Output `public`으로 배포하고 확인:
   - debug_css/debug_js의 Tailwind·FontAwesome·confetti가 적용되는지(이 코드는 `allow-modals`로 alert/confirm 허용).
   - 앱스크립트 2곳은 Apps Script 코드에 `.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)`이 없으면 iframe에서 빈 화면이 됨.
   - 외부 앱 iframe이 빈 화면이면 상대 사이트의 `X-Frame-Options`/CSP 때문 → 해당 앱 쪽 설정 변경 또는 "새 창에서 열기"만 유지.
2. 원본 이미지 이식: 원본은 `sites.google.com/sitesv-images-rt/...`(로그인 없이 못 받음). 선생님에게 이미지 파일을 받아 `public/images/`에 넣고 `image` 블록(src, alt) 추가 필요. 이미지가 있던 페이지: 홈, 기초개념(3장), 프로그램 기본구조, 달리기 수업 웹앱, 자리배치표, 실습(새로, 기본/심화).
3. dddd 페이지 코드(code_gs.txt, index_html.txt)는 원본에서 읽을 때 **들여쓰기가 사라졌음**. 가능하면 코드 포맷터로 복원.
4. ~~페이지 편집 방법 결정~~ → 관리자 화면 완료(아래 "관리자 화면" 참고). 남은 일: 선생님이 Vercel 환경 변수 넣기.
5. API 3페이지, 새싹책방, 퀴즈형 등 원본이 빈/짧은 페이지는 선생님이 내용을 채울 예정.
6. 디자인: 원본(어두운 배너+점 패턴+빨간 밑줄)을 흉내 낸 상태. 로고·색 확정 필요.

## 알아둘 점
- 선생님은 교사(비개발자). 설명은 쉬운 한국어로, 결과 중심으로. 원본과 "똑같이"를 중시함.
- 학생 개인정보는 이 사이트에 넣지 않는다(실습용 가짜 데이터만).
- 아티팩트 버전과 Vercel 버전은 같은 `template.html`을 쓰므로, 틀을 고치면 두 빌드를 모두 다시 돌릴 것.

## 관리자 화면 (2026-10-25 추가)
- 주소 `/admin` (또는 사이트 맨 아래 "관리자" 링크) → **구글 계정 로그인**(Google Identity Services). `ADMIN_EMAILS`에 있는 계정만 통과.
- 편집 기능(구글 사이트 참고): 페이지 추가·삭제·이름 바꾸기·순서 이동·위치(3단계까지) 바꾸기·메뉴에서 숨기기, 사이트 이름,
  블록 = 제목/문단/사진(내 컴퓨터에서 올리기)/링크 버튼/웹사이트 삽입(주소)/HTML 체험/복사 상자/안내 상자/단계별/퀴즈/구분선, 블록 사이 끼워 넣기,
  "저장하고 게시", 버전 기록·되돌리기, 저장 안 하고 나가면 경고.
- 저장 방식: `vercel-site/api/admin.js`가 `public/site-data.json`(사진은 `public/images/`)을 GitHub 브랜치 `claude/new-session-f7zx6a`에 **커밋** → Vercel 자동 재배포(1~2분). 커밋 기록 = 버전 기록.
  동시 편집은 `rev` 숫자로 막음(먼저 저장된 게 있으면 409).
- **이제 페이지 내용의 원본은 `vercel-site/public/site-data.json`**. `build2.py`는 처음 데이터용이라 다시 돌려도 이 파일을 덮어쓰지 않음(`--reset`을 줄 때만 덮어씀).
  관리자 화면에서 저장하면 브랜치에 새 커밋이 생기니, Claude Code로 작업하기 전에 항상 `git pull`.
- Vercel 환경 변수: `GITHUB_TOKEN`(fine-grained, Mingit1 저장소 Contents 읽기/쓰기), `GOOGLE_CLIENT_ID`(Google Cloud OAuth 웹 클라이언트, 승인된 JavaScript 원본 = 사이트 주소),
  `ADMIN_EMAILS`(쉼표로 여러 개), 선택: `ADMIN_PASSWORD`(예비 비밀번호 로그인).
- `vercel-site/package.json`의 `"type":"commonjs"`는 지우지 말 것(저장소 맨 위 package.json이 ESM이라 api/admin.js가 깨짐).

## 여러 사이트 (2026-10-25 추가)
- 한 Vercel 프로젝트에 사이트 여러 개. `public/sites.json` = 목록 `[{slug,title}]`.
  - 첫 사이트(slug `""`) = `public/site-data.json`, 주소 `/`
  - 나머지 = `public/sites/<slug>.json`, 주소 `/<slug>` (같은 화면 파일의 사본 `public/<slug>.html`을 cleanUrls가 연결)
- 관리자 화면 위 **사이트 관리**: 목록·다른 사이트 고치기(`/admin?site=<slug>`)·새 사이트(빈 사이트 / 지금 사이트 복사)·지우기.
  만들기·지우기는 Git Data API로 파일 3개를 **커밋 하나**로 올린다(api `createSite`/`deleteSite`). 사이트마다 버전 기록이 따로다.
- 화면 틀(template.html)을 고친 뒤 `python3 build_vercel.py` 를 돌리면 `sites.json` 에 있는 모든 `<slug>.html` 사본도 새로 만든다.
- 주소 이름 금지어: admin, api, images, sites, index, favicon, site-data.

## 구글 사이트 기능 (2026-10-25 추가)
- 글 서식(`fmt`): **굵게** *기울임* ==형광펜== `코드` [글자](https://… 또는 #페이지), 줄 앞 "- / · / •" 글머리표, "1." 번호 목록. 문단(p)은 이제 div.para.
- 제목 크기(큰/작은 = h2/h3)·가운데 정렬(h, p). 새 블록: 여러 단(cols, 최대 3칸·사진), 사진 슬라이드(carousel, 자동 넘기기), 지도(map — maps.google.com ?output=embed, 키 없음), 목차(toc — 그 페이지 제목 블록), 빈 공간(space).
- 삽입(embed)은 `toEmbed`로 유튜브·구글 문서/시트/슬라이드(/preview)·설문(embedded=true)·드라이브 파일 주소를 바꿔 보여 줌. 사진 블록에 누르면 갈 링크.
- 편집: 블록 ⧉ 복제, 페이지 복제, ↶ 되돌리기/↷ 다시 하기(`S.hist`/`S.fut`, touch 때마다 저장), 👀 미리보기(PC·휴대폰 틀).
- ⚙ 사이트 설정(`data.site`): 이름·로고·강조색(`ACCENTS`, `applyTheme`)·머리 배경(dots/plain/accent)·📢 공지 배너(notice {on,text,link}, 닫으면 그 탭에서 숨김)·꼬리말(footer). 페이지마다 머리 배경 사진(`page.cover`).
- 방문자: 왼쪽 메뉴 위 사이트 검색(`pageText`), 맨 위로 버튼.

## 앱 설치(PWA)·위 줄 정리 (2026-10-25 추가)
- 위 줄: 넓은 화면은 단추 그대로(`.top-wide`), 휴대폰은 **편집 + ⋯ 메뉴**(사이트 관리·버전 기록·앱으로 설치·로그아웃). 편집 줄은 아이콘 단추로 한 줄(`.ebtns`, 글자 `.lbl` 은 휴대폰에서 숨김).
- 사이트마다 manifest: `manifest.webmanifest`(첫 사이트), `manifest-<slug>.webmanifest`(나머지) — `build_vercel.py manifest_for` 와 `api/admin.js manifestFor` 가 같은 규칙. 화면이 `/<slug>` 이면 manifest 링크를 바꿔 끼운다.
- `sw.js`: 페이지·.json 은 네트워크 먼저(늘 최신 편집), 끊기면 저장해 둔 것. 사진은 한 번 보면 저장. `/api` 는 안 건드림. 캐시 이름 `vc-v1` 을 바꾸면 옛 캐시가 지워진다.
- 아이콘 `icon-192.png`·`icon-512.png`·`apple-touch-icon.png` 는 `make_icons.py` 로 만듦. 크롬·삼성 인터넷은 위 줄 "📲 앱 설치" 단추(beforeinstallprompt), 아이폰은 사파리 공유 → 홈 화면에 추가.
- 홈(첫 페이지): 머리에 페이지 제목 "홈" 대신 사이트 이름(태그가 있으면 위 작은 글씨, 없으면 WELCOME). 본문 아래 **둘러보기**(`explore()`) — 최상위 단원마다 카드(번호·설명·하위 페이지 4개·"페이지 N개 보기"). 홈에는 이전/다음 대신 이것. 편집 중엔 안 보임.
- 왼쪽 메뉴 검색칸 둥근 모양, 메뉴 스크롤 막대는 얇게·마우스 올릴 때만.
- 끌어서 옮기기(편집 중): 블록은 위 줄의 종류 이름표(점 여섯 개 손잡이)를, 페이지는 왼쪽 메뉴 줄 앞 손잡이를 잡고 끈다. Pointer Events 라 마우스·손가락 둘 다(`startDrag`, `dragBlock`, `dragPage`).
  페이지는 줄의 위 30% = 앞에, 아래 30% = 뒤에, 가운데 = 그 페이지 아래로(빨간 상자 + "“…” 아래로"). 4단계 넘기·자기 아래로·홈 앞/아래는 막음. 화면 끝으로 끌면 저절로 스크롤, Esc 로 취소. ↑↓ 단추는 그대로.
- 글자 꾸미기(2026-10-25): 편집 칸(문단·상자·안내·숨김 상자·카드·단계·여러 단·퀴즈 해설·꼬리말) 위에 도구 줄(`fmtBar`) — 굵게·기울임·형광·링크·글자색 6가지·작게/크게/아주 크게·글머리표·번호·꾸밈 지우기, 아래 실시간 미리보기(`fmtPreview`).
  글로는 `{빨강:글자}` `{파랑 18pt:글자}`(낱말: 빨강 파랑 초록 주황 보라 회색 노랑배경 작게 크게 아주크게 굵게 = `FMT_WORDS`, 크기는 숫자+pt 6~72)로 저장된다.
  크기는 도구 줄의 숫자 칸(pt) + 바꾸기(비우고 누르면 크기만 뺌). 여러 줄을 한 번에 꾸미면 줄마다 따로 감싼다(`splitSpans` — 예전에 여러 줄로 감싼 글도 화면에선 줄마다 나눠 읽음). 같은 종류 단추를 다시 누르면 바꾸거나 끔. 문단은 "문단 전체 글자 크기"(b.pt 숫자, 예전 b.fs sm/lg/xl 도 읽음)도 있음. 색은 어두운 화면용 값이 따로 있음.
- API활용 예시(2026-10-25): 파라런 AI 코치 체험. 화면(실습 블록)은 1km 구간 시간(초)·지난 최고 페이스만 `POST /api/feedback`(새 함수 `api/feedback.js`)로 보내고,
  함수가 파라런 `src/lib/feedback.ts` 와 같은 프롬프트로 Groq(`GROQ_API_KEY`, 모델 `GROQ_MODEL` 기본 openai/gpt-oss-20b)를 부른다. 키가 없거나 실패하면 같은 규칙 피드백.
  숫자만 받음(구간 1~10개, 2~30분), IP당 한 시간 30번(서버 인스턴스 안에서만 셈). **AI 로 나오게 하려면 Vercel pevibecode 에 GROQ_API_KEY 를 넣고 다시 배포.**
- API 실습(2026-10-25 최종): **PAPS 맞춤 운동 처방** — Code.gs + index.html 두 파일을 그대로 붙여 넣는 실습(sheets.new → Apps Script → 스크립트 속성 GEMINI_API_KEY → 웹앱 배포). 처방은 시트 'PAPS처방' 탭에 쌓임.
  페이지의 미리보기는 index.html 에 가짜 google.script.run(예시 처방)을 붙인 것. 코드 블록 두 개가 원본. `api/_groq.js` 는 API활용 예시(feedback.js)가 씀.
- 왼쪽 메뉴 접기(2026-10-25): 하위 페이지는 접혀 있고 지금 페이지까지의 길만 저절로 펼침(`navOpen`). 위 페이지를 누르면 펼치며 이동, 지금 페이지를 한 번 더 누르면 접힘, 오른쪽 화살표(`.nav-caret`)는 이동 없이 펴고 접기. 편집 중엔 끌어 옮기기를 위해 전부 펼침. 상태는 `S.open`(새로고침하면 처음으로).
- 숨김 상자(fold)에 사진도 넣을 수 있음(`b.imgs` [{src,caption}], 편집기에서 올리기·목록). 퀴즈형 웹앱 페이지에 "💡 힌트 — Gemini Canvas로 만드는 과정"(images/canvas-1~3.jpg, 왼쪽 대화 목록·계정은 잘라 냄).
- 새 블록 **퀴즈 묶음**(`quizset` {title, items[{q,opts,a,why}]}): 한 문제씩 풀고 다음/이전·좌우 밀기로 넘김, 위 번호 동그라미에 맞음/틀림, 마지막 "N문제 중 M개 정답". 편집은 글 한 칸(첫 줄 질문, "- " 보기, 정답 앞 *, "해설: ", 문제 사이 ---).
- HTML 체험에 **"높이를 내용에 맞추기"**(`b.fit`): 안쪽 페이지가 높이를 postMessage(`vcH`)로 알려 주면 틀 높이를 맞춤. 화면 높이(vh)로 커지는 코드(디버깅 실습 등)에 켜면 계속 커지니 끄기. 높이 입력 상한 900 → 3000.

## 사진 슬라이드(carousel) 세로 사진 (2026-10-25)
- 세로로 긴 사진이 틀을 넘어 설명 글을 덮던 것을 고침(.frame overflow:hidden, flex 가운데).
- 블록에 `tall: true`(편집 화면 체크 "세로로 긴 사진…")면 틀 높이 min(120vw,680px). 수업 사례의 활동지·폰 화면 슬라이드가 씀.
- 수업 사례 ①~④ 단계 사진(images/class-*.jpg)은 캔바 포스터 '삶과연계 2 민동수' 1쪽을 12000px로 내보내 잘라 낸 것.

## 삽입·HTML 체험 배율 (2026-10-26)
- embed·html 블록에 `zoom`(0.5~0.9, 없으면 100%). 편집 화면 "배율" 고르기. 보이는 높이는 그대로, 안의 iframe 을 1/z 크기로 그려 scale(z) — `zoomBox()`.
- html `fit` 과 함께 쓰면 높이 맞춤 메시지(vcH) 때 바깥 칸 높이도 z 를 곱해 맞춘다.
- 코딩 용어 페이지(terms) 플래시카드 삽입은 75%.

## 블록 묶기·배경색 (2026-10-26)
- `join: true` = 바로 위 블록과 한 상자(.bgroup). 묶음의 첫 블록은 join 없이 시작.
- `bg`: yellow·blue·green·pink·purple·gray (BGC). 단독 블록은 .blk 에, 묶음은 첫 블록의 bg 를 상자에. 색은 rgba 연한 색이라 어두운 화면에서도 그대로.
- 편집 화면 맨 아래 "배경색"·"바로 위 블록과 한 상자로 묶어 보이기".

## 종합 실습 + 채점 봇 (2026-10-26, page id `final`, API 아래)
- 수업 성찰 AI 코치: 이름·한 줄 성찰 → '성찰' 탭 저장 + Gemini 피드백. 조건 4개(저장·AI 피드백·키는 스크립트 속성·이름은 AI에 안 보냄).
- 채점 봇은 배드민턴 채점기를 바꾼 것: 가짜 SpreadsheetApp + 가짜 UrlFetchApp(Gemini 흉내, 스크립트 속성 GEMINI_API_KEY='TEST-KEY-1234'
  가 요청에 들어가야 200). AI에게 보낸 글에 이름이 있으면 ❌, 코드에 AIza… 키가 있으면 ❌. 오류·프롬프트에 키는 '(키 가림)'.
