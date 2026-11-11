// 3D 도서관 자동 점검: 입장 → 자리 앉기 → 친구 접속·표시 → 같은 자리 막기 → 읽는 중 동기화 → 멈추기 → 나가기
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-library.e2e.cjs
// Supabase 요청은 가짜 응답으로 막고, 실시간은 같은 브라우저 탭끼리 연결되는 연습 방식(?rtlocal=1)으로 확인함
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const session = (id, nick) => JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id, nickname: nick } });
async function open(ctx, id, nick, log) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log.push(`[${nick}] pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/supabase\.co|WebSocket|Failed to load resource|net::/.test(m.text())) log.push(`[${nick}] console: ${m.text()}`); });
  await p.route(/supabase\.co/, (route) => {
    const req = route.request(), url = req.url(), obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (/\/rest\/v1\/books/.test(url) && req.method() === 'GET' && /is_completed=eq\.false/.test(url)) {
      const book = { id: 'b1', title: '어린 왕자', author: '생텍쥐페리', cover_url: null, is_completed: false };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj ? book : [book]) });
    }
    if (/rpc\/get_class_progress/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ joined_today: 0, total_students: 2, class_pct: 0, communal_minutes: 0 }]) });
    if (/\/rest\/v1\/rpc\//.test(url)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"mock"}' });
    if (/\/rest\/v1\//.test(url)) return route.fulfill({ status: obj ? 406 : 200, contentType: 'application/json', body: obj ? '{"message":"none"}' : '[]' });
    return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
  });
  await p.addInitScript(([s]) => { localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_lab3d', '1'); const sid = JSON.parse(s).studentInfo?.id; if (sid && !localStorage.getItem('saesak_dress_' + sid)) localStorage.setItem('saesak_dress_' + sid, JSON.stringify({ g: 'boy', hs: 'short', hc: 1, sc: 0, b: 'shorts', bc: 0 })); }, [session(id, nick)]);
  await p.goto('http://localhost:4321/?lab3d=1&rtlocal=1&debug=1');
  await p.waitForTimeout(600); await p.mouse.click(195, 400);           // 스플래시 넘기기
  await p.waitForTimeout(800);
  await p.getByText('읽기', { exact: true }).click();
  try { await p.waitForFunction('window.__lib3d && window.__lib3d._synced', null, { timeout: 15000 }); }
  catch (e) { await p.screenshot({ path: `${OUT}/fail-open.png` }); console.log('open failed; lib3d:', await p.evaluate(() => ({ has: !!window.__lib3d, synced: window.__lib3d && window.__lib3d._synced, body: document.body.innerText.slice(0, 200) })), log); throw e; }
  await p.click('[data-view="top"]'); await p.waitForTimeout(300);   // 이 점검은 위에서 보기 기준(걷기 점검은 lab3d-roam)
  return p;
}
const seatXY = async (p, id) => { await p.evaluate(() => window.__lib3d.setZoom(false)); await p.waitForTimeout(2500); return seatXY0(p, id); };
const nearAgain = (p) => p.evaluate(() => window.__lib3d.setZoom(true));
const seatXY0 = (p, id) => p.evaluate((sid) => { const w = window.__lib3d, s = w.seats.get(sid), v = new (w.camera.position.constructor)(s.x, 0.25, s.z).project(w.camera), r = w.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, id);
const info = (p) => p.evaluate(() => { const w = window.__lib3d; return { mySeat: w.me.seat, walking: !!w.me.walk, state: w.me.avatar.state, people: [...w.people.values()].map((q) => ({ nick: q.nick, seat: q.seat, state: q.state, pose: q.avatar.state })) }; });
(async () => {
  const log = [];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const A = await open(ctx, 'stu-minsu', '민수', log);
  await A.screenshot({ path: `${OUT}/01-enter.png` });
  // 1) 빈자리(9번)를 눌러 앉기
  await A.waitForTimeout(1500); await A.screenshot({ path: `${OUT}/01-enter.png` });
  let [x, y] = await seatXY(A, 9); await A.mouse.click(x, y); await nearAgain(A);
  await A.waitForTimeout(600); const mid = await info(A);
  try { await A.waitForFunction('window.__lib3d.me.seat === 9 && !window.__lib3d.me.walk', null, { timeout: 120000 }); } catch (e) { await A.screenshot({ path: `${OUT}/fail-seat.png` }); console.log('seat wait failed', x, y, JSON.stringify(mid), JSON.stringify(await info(A)), log); throw e; }
  await A.waitForTimeout(400); await A.screenshot({ path: `${OUT}/02-seated.png` });
  console.log('A walking right after tap:', mid.walking, '→ seated:', JSON.stringify(await info(A)));
  // 2) 두 번째 학생 접속 → 서로 보이는지
  const B = await open(ctx, 'stu-jiwoo', '지우', log);
  await B.waitForTimeout(1500);
  console.log('B sees:', JSON.stringify((await info(B)).people));
  [x, y] = await seatXY(B, 10); await B.mouse.click(x, y); await nearAgain(B);
  await B.waitForFunction('window.__lib3d.me.seat === 10 && !window.__lib3d.me.walk', null, { timeout: 120000 });
  await A.bringToFront(); await A.waitForTimeout(8000);
  console.log('A sees:', JSON.stringify((await info(A)).people));
  await A.screenshot({ path: `${OUT}/03-two-students.png` });
  // 3) 이미 앉은 자리를 누르면 앉지 못함
  await B.bringToFront(); [x, y] = await seatXY(B, 9); await B.mouse.click(x, y); await B.waitForTimeout(500);
  console.log('B after tapping occupied seat 9 → still seat', (await info(B)).mySeat);
  // 4) 읽기 시작 → 타이머가 뜨고 상태가 읽는 중으로
  await A.bringToFront(); await A.getByText(/10분 읽기 시작|이어서 읽기/).click(); await A.waitForTimeout(1200);
  await A.screenshot({ path: `${OUT}/04-timer.png` });
  const timerShown = await A.getByText('잠깐 멈추기').count();
  await B.bringToFront(); await B.waitForTimeout(4500);
  console.log('timer overlay shown:', timerShown > 0, '| B sees A as:', JSON.stringify((await info(B)).people.find((q) => q.nick === '민수')));
  await B.screenshot({ path: `${OUT}/05-friend-reading.png` });
  // 5) 멈추면 다시 앉은 상태
  await A.bringToFront(); await A.getByRole('button', { name: '⏸ 잠깐 멈추기' }).click(); await A.waitForTimeout(800);
  console.log('A after pause:', JSON.stringify(await info(A)).slice(0, 80));
  // 6) 탭을 떠나면 친구 화면에서 사라짐
  await A.getByText('내 기록', { exact: true }).click(); await B.bringToFront(); await B.waitForTimeout(4500);
  console.log('after A leaves, B sees:', JSON.stringify((await info(B)).people.map((q) => q.nick)));
  console.log('errors:', log.length ? log.slice(0, 8) : 'none');
  await b.close();
})().catch((e) => { console.error('TEST FAILED', e.message); process.exit(1); });
