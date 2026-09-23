// 아이폰 홈 화면 위젯 (Scriptable 앱용)
// 1. App Store에서 Scriptable 설치 → 새 스크립트에 이 파일 내용을 붙여넣기
// 2. 아래 URL에 앱 설정 화면의 "JSON 주소 복사" 값을 붙여넣기
// 3. 홈 화면 길게 누르기 → 위젯 추가 → Scriptable(중간 크기) → 이 스크립트 선택
const URL = '여기에_JSON_주소_붙여넣기';

const data = await new Request(URL).loadJSON();
const w = new ListWidget();
w.backgroundColor = new Color('#1e2129');
w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

const head = w.addText(`업무 ${data.active} · 경고 ${data.alerts}`);
head.font = Font.boldSystemFont(13);
head.textColor = new Color('#9aa1ae');
w.addSpacer(6);

for (const item of data.items.slice(0, config.widgetFamily === 'large' ? 8 : 3)) {
  const t = w.addText(`${item.alert ? `[${item.alert}] ` : ''}${item.title}`);
  t.font = Font.semiboldSystemFont(13);
  t.textColor = item.alert ? new Color('#ff8a8a') : Color.white();
  t.lineLimit = 1;
  const n = w.addText(`→ ${item.next_action}`);
  n.font = Font.systemFont(12);
  n.textColor = new Color('#c7cbd4');
  n.lineLimit = 1;
  w.addSpacer(4);
}

Script.setWidget(w);
if (config.runsInApp) w.presentMedium();
Script.complete();
