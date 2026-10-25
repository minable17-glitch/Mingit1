# 바이브 코딩 연수(체육) 사이트

- `public/index.html` : 화면 틀 (template.html에서 만들어짐)
- `public/site-data.json` : 모든 페이지 내용. **관리자 화면에서 저장하면 이 파일이 GitHub에 커밋**되고 Vercel이 다시 배포해요.
- `public/images/` : 관리자 화면에서 올린 사진
- `api/admin.js` : 관리자 로그인·저장·버전 기록·사진 올리기

## 배포 (Vercel)
Root Directory `vibe-site/vercel-site`, Framework Other. 출력 폴더는 vercel.json에 들어 있어요.

## 관리자 화면 켜기
Vercel 프로젝트 Settings → Environment Variables 에 두 개를 넣고 다시 배포:
- `ADMIN_PASSWORD` : 관리자 비밀번호
- `GITHUB_TOKEN` : GitHub fine-grained token (저장소 Mingit1, Contents: Read and write)

관리자 화면 주소: `https://<사이트 주소>/admin`
