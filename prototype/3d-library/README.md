# 3D 도서관 시제품 (새싹책방 2.0)

ChatGPT 세로형 평면도(`reference-floorplan-tall.png`, 가로 24칸 × 세로 72칸)와 색상표를 그대로 옮긴 도서관 장면입니다.
이전 정사각형 평면도는 `reference-floorplan.png`(폰 세로 화면에서 좌우가 잘려 교체).
콘셉트 그림은 `reference-concept.webp`. **앱 빌드에는 포함되지 않습니다.**

- `library.js` — 장면 조립. 평면도 1칸 = 0.3(캐릭터 키 = 1). 같은 색 도형을 묶어 그려서 그리기 횟수를 줄임
  - `seatLayout()` — 32석 좌표·방향 (4인 모둠 6곳 + 창가 8석, 번호는 평면도와 같음)
  - `buildLibrary(scene)` — 바닥, 3면 통창(나무 틀), 문 2개, 낮은 책장, 책상·의자, 카펫, 화분, 도서관을 둘러싼 숲(문 앞 길은 비움)
  - 따뜻한 오후 햇살: 왼쪽·뒤쪽 통창으로 들어와 바닥에 생기는 빛 자국과 은은한 빛줄기(실제 그림자 계산 없이 가볍게)
  - 창밖 숲 풍경판: 가까운 큰 나무, 겹겹의 숲, 나무 사이 햇살, 숲 위로 보이는 먼 산을 그린 큰 판을 카메라를 향해 기울여 세움. `faceBackdrop(pitch)`로 카메라 각도에 맞춤
- `lib-demo.js` — 확인용. `?view=lib`(전체 조망), `?view=libplay`(폰 화면: 방 폭이 꼭 맞고 위아래로만 따라감)
- 실행: `../3d-avatar` 폴더에서 `npm i three@0.170.0` 후, `prototype` 폴더에서 `python3 -m http.server` → `/3d-library/`
