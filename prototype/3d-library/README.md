# 3D 도서관 시제품 (새싹책방 2.0)

ChatGPT 평면도(`reference-floorplan.png`, 가로 40칸 × 세로 46칸)와 색상표를 그대로 옮긴 도서관 장면입니다.
콘셉트 그림은 `reference-concept.webp`. **앱 빌드에는 포함되지 않습니다.**

- `library.js` — 장면 조립. 평면도 1칸 = 0.3(캐릭터 키 = 1). 같은 색 도형을 묶어 그려서 그리기 횟수를 줄임
  - `seatLayout()` — 32석 좌표·방향 (모둠 6곳 × 4석 + 창가 8석, 번호는 평면도와 같음)
  - `buildLibrary(scene)` — 바닥, 벽, 창문, 통유리, 문 2개, 곡선 책장, 책상·의자, 카펫, 화분, 바깥 정원
- `lib-demo.js` — 확인용. `?view=lib`(전체 조망), `?view=libplay`(폰 따라가기 카메라), `?view=libwide`(폰에 방 폭 전체)
- 실행: `../3d-avatar` 폴더에서 `npm i three@0.170.0` 후, `prototype` 폴더에서 `python3 -m http.server` → `/3d-library/`
