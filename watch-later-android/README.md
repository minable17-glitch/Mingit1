# 나중에 볼 영상 — 안드로이드 앱(APK)

웹앱 https://watch-later.pages.dev 를 안드로이드 앱으로 감싼 TWA(Trusted Web Activity) 프로젝트예요.
화면과 기능은 웹앱 그대로라서, **웹앱을 고치면 앱도 자동으로 바뀌어요** (APK 를 다시 만들 필요 없음).

- 패키지 이름: `kr.watchlater.app`
- 유튜브 앱 "공유" → 이 앱으로 링크 보내기 지원
- 알림은 웹 푸시 그대로 (앱 이름·아이콘으로 표시)
- 주소창 없이 전체 화면으로 뜨려면 `watch-later/.well-known/assetlinks.json` 의 지문이 서명 키와 같아야 해요

## 다시 빌드할 때 (아이콘·이름·버전을 바꿀 때만)

1. 서명 키(`.jks`)와 비밀번호를 준비하고 `keystore.properties` 를 만들어요 (커밋 금지):
   ```
   storeFile=서명키.jks 경로
   storePassword=비밀번호
   keyAlias=watchlater
   keyPassword=비밀번호
   ```
2. `app/build.gradle` 의 `versionCode` 를 1 올리고
3. `gradle assembleRelease` → `app/build/outputs/apk/release/app-release.apk`

⚠️ 서명 키를 잃어버리면 같은 앱으로 업데이트할 수 없어요. 안전한 곳에 꼭 보관하세요.
