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
4. 페이지 편집 방법 결정: (a) Claude Code에게 요청해 재빌드 (b) 사이트에 JSON 편집 화면 추가 (c) Firebase 연동. 현재 Vercel 버전엔 편집 UI 없음.
5. API 3페이지, 새싹책방, 퀴즈형 등 원본이 빈/짧은 페이지는 선생님이 내용을 채울 예정.
6. 디자인: 원본(어두운 배너+점 패턴+빨간 밑줄)을 흉내 낸 상태. 로고·색 확정 필요.

## 알아둘 점
- 선생님은 교사(비개발자). 설명은 쉬운 한국어로, 결과 중심으로. 원본과 "똑같이"를 중시함.
- 학생 개인정보는 이 사이트에 넣지 않는다(실습용 가짜 데이터만).
- 아티팩트 버전과 Vercel 버전은 같은 `template.html`을 쓰므로, 틀을 고치면 두 빌드를 모두 다시 돌릴 것.
