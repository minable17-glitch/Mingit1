# 3D 아바타 시제품 (새싹책방 2.0)

ChatGPT가 그린 삼면도(`reference-turnaround.webp`)를 보고 Three.js 도형으로 조립한 캐릭터 시제품입니다.
**앱 빌드에는 포함되지 않습니다.** (Vite는 루트 `index.html`만 묶습니다.)

- `avatar.js` — 아바타 클래스. 외형 4종(`LOOKS`), 상태 `idle / walk / sit / read / wave`, 표정 교체
- `demo.js`, `index.html` — 확인용 화면. `?view=turn`(삼면도 구도), `?view=scene`(폰 화면 구도), `&anim=1`(움직임)
- `compare.png` — 원본 그림과 3D 비교, `scene-phone.png` — 390×844 폰 화면

실행: 이 폴더에서 `npm i three@0.170.0` 후 `python3 -m http.server` 로 열기.

모델 파일(.glb)·이미지 없이 코드만으로 그립니다. 아바타 1명당 도형 약 45개.
