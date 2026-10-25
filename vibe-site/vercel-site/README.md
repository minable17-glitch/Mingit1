# 바이브 코딩 연수(체육) 사이트

정적 사이트 한 장(`public/index.html`)입니다. 빌드 과정이 없어요.

## 배포 (Vercel)
1. 이 폴더를 GitHub 저장소로 올리거나, 터미널에서 이 폴더로 이동해 `npx vercel` 실행
2. Framework Preset: **Other**, Output Directory: **public**
3. 배포 후 나오는 `*.vercel.app` 주소를 공유

## 수정하기
- 모든 페이지 내용은 `public/index.html` 안의 `<script type="application/json" id="site-data">` 블록에 들어 있어요.
- 페이지 추가·수정은 Claude Code에게 "○○ 페이지 추가해 줘"라고 요청하세요.
