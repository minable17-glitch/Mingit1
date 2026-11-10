# 3D 정원 시제품 (새싹책방 2.0)

ChatGPT 정원 콘셉트(`reference-concept.webp`)와 나무 6단계 그림(`reference-stages.webp`)을 보고 도형으로 조립한 정원입니다.
**앱 빌드에는 포함되지 않습니다.**

- `garden.js`
  - `buildGarden(scene, stageOf)` — 모래 오솔길 마당, 풀밭 화단 8곳 × 화분 4개 = 학생 나무 32그루, 가운데 돌 테두리 화단과 우리 반 나무(웃는 얼굴·꽃·열매), 우물과 수도꼭지, 벤치, 도서관 모퉁이(문), 둘레 숲, 나뭇잎 사이 햇살
  - 학생 나무 6단계(씨앗·새싹·줄기·잎·꽃봉오리·활짝 핀 꽃): 단계별 도형을 한 번만 만들어 32그루가 함께 씀
  - `planterLayout()` — 화분 32개 좌표(번호 1~32), `buildStageRow()` — 6단계 견본
- 아바타 물주기 자세(`water`)와 물조리개는 `../3d-avatar/avatar.js`에 추가
- `garden-demo.js` — `?view=garden`(폰 화면), `?view=gardenstages`(6단계 견본)
- 실행: `../3d-avatar`에서 `npm i three@0.170.0` 후 `prototype` 폴더에서 `python3 -m http.server` → `/3d-garden/`
