// 3D 도서관 자유 이동 점검: 3인칭 시작 → 조이스틱으로 걷기 → 화면 끌어 둘러보기 → 의자 앉기 → 1인칭
// → 조이스틱 밀면 일어남 → 친구 화면에 내 위치가 따라옴 → 읽기 중 위에서 보기 → 정원 문으로 걸어 나가기
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-roam.e2e.cjs
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
  await p.waitForTimeout(600); await p.mouse.click(195, 400);
  await p.waitForTimeout(800);
  await p.getByText('읽기', { exact: true }).click();
  await p.waitForFunction('window.__lib3d && window.__lib3d._synced', null, { timeout: 15000 });
  return p;
}
const me = (p) => p.evaluate(() => { const w = window.__lib3d, q = w.me.avatar.root.position; return { x: +q.x.toFixed(2), z: +q.z.toFixed(2), seat: w.me.seat, walk: !!w.me.walk, view: w.view, yaw: +w.rig.yaw.toFixed(2), vis: w.me.avatar.root.visible, pose: w.me.avatar.state }; });
async function stick(p, dx, dy, ms) {   // 조이스틱을 (dx, dy)로 밀고 ms 동안 유지
  const box = await p.locator('[data-joystick]').boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx + dx, cy + dy, { steps: 4 }); await p.waitForTimeout(ms); await p.mouse.up();
}
(async () => {
  const log = [], ok = [];
  const check = (name, cond, extra = '') => { ok.push(`${cond ? '✅' : '❌'} ${name} ${extra}`); };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const A = await open(ctx, 'stu-minsu', '민수', log);
  await A.waitForTimeout(1500);
  const reach = await A.evaluate(() => { const w = window.__lib3d, e = w.nav.nearest(w.me.avatar.root.position.x, w.me.avatar.root.position.z); return [...w.seats.values()].filter((s) => !w.nav.path(e, s.stand)).map((s) => s.id); });
  check('모든 자리(32곳)에 걸어갈 수 있음', reach.length === 0, reach.length ? `못 가는 자리: ${reach}` : '');
  let s0 = await me(A); check('처음엔 뒤에서 보기(3인칭)', s0.view === 'third');
  await A.locator('[data-view]').first().waitFor(); await A.mouse.click(195, 300); await A.waitForTimeout(300);   // 안내 닫기
  await A.screenshot({ path: `${OUT}/roam-01-third.png` });
  // 조이스틱 위로 → 앞으로 걸어감
  await stick(A, 0, -40, 1500); let s1 = await me(A);
  check('조이스틱으로 걷기', Math.hypot(s1.x - s0.x, s1.z - s0.z) > 1.2, `${JSON.stringify([s0.x, s0.z])} → ${JSON.stringify([s1.x, s1.z])}`);
  await A.screenshot({ path: `${OUT}/roam-02-walked.png` });
  // 화면 끌기 → 카메라가 돌아감
  await A.mouse.move(250, 300); await A.mouse.down(); await A.mouse.move(150, 300, { steps: 6 }); await A.mouse.up(); await A.waitForTimeout(300);
  let s2 = await me(A); check('화면을 끌면 둘러보기', Math.abs(s2.yaw - s1.yaw) > 0.3, `yaw ${s1.yaw} → ${s2.yaw}`);
  await A.screenshot({ path: `${OUT}/roam-03-turned.png` });
  // 책장·책상을 뚫고 지나가지 않음: 한쪽으로 오래 밀어도 막히는 곳 안에 들어가지 않음
  await stick(A, 40, 0, 2500); const inWall = await A.evaluate(() => { const w = window.__lib3d, q = w.me.avatar.root.position; return !w.nav.walkable(q.x, q.z); });
  check('가구·벽을 통과하지 않음', !inWall);
  // 자리 9번 눌러 앉기(화면 위 자리 위치를 계산해서 누름 — 위에서 보기로 잠깐 바꿔 찾음)
  await A.click('[data-view="top"]'); await A.waitForTimeout(2500);
  const [x, y] = await A.evaluate(() => { const w = window.__lib3d, s = w.seats.get(9), v = new (w.camera.position.constructor)(s.x, 0.25, s.z).project(w.camera), r = w.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; });
  await A.mouse.click(x, y); await A.click('[data-view="third"]');
  await A.waitForFunction('window.__lib3d.me.seat === 9 && !window.__lib3d.me.walk', null, { timeout: 60000 }); await A.waitForTimeout(1500);
  check('걸어가서 의자에 앉기', (await me(A)).pose === 'sit');
  await A.screenshot({ path: `${OUT}/roam-04-seated-third.png` });
  await A.click('[data-view="first"]'); await A.waitForTimeout(1200);
  let s3 = await me(A); check('1인칭: 내 캐릭터는 숨김', s3.view === 'first' && !s3.vis);
  await A.screenshot({ path: `${OUT}/roam-05-seated-first.png` });
  await stick(A, 0, 40, 900); let s4 = await me(A);
  check('조이스틱 밀면 일어나서 걸음', s4.seat === null && Math.hypot(s4.x - s3.x, s4.z - s3.z) > 0.3);
  await A.screenshot({ path: `${OUT}/roam-06-first-walk.png` });
  await A.click('[data-view="third"]');
  // 친구 화면에서 내 위치가 따라오는지
  const B = await open(ctx, 'stu-jiwoo', '지우', log); await B.waitForTimeout(2000);
  await A.bringToFront(); await stick(A, 40, -20, 1800); await A.waitForTimeout(500); const aNow = await me(A);
  await B.bringToFront(); await B.waitForTimeout(4000);
  const seen = await B.evaluate(() => { const p = [...window.__lib3d.people.values()].find((q) => q.nick === '민수'); const q = p.avatar.root.position; return { x: +q.x.toFixed(2), z: +q.z.toFixed(2), seat: p.seat }; });
  check('친구 화면에 내 위치가 보임', Math.hypot(seen.x - aNow.x, seen.z - aNow.z) < 0.4, `A ${aNow.x},${aNow.z} / B가 본 A ${seen.x},${seen.z}`);
  await B.screenshot({ path: `${OUT}/roam-07-friend-view.png` });
  // 읽기 시작 → 자동으로 앉고 위에서 보기, 멈추면 원래 보기
  await A.bringToFront(); await A.getByText(/10분 읽기 시작|이어서 읽기/).click(); await A.waitForTimeout(1500);
  const r1 = await me(A); check('읽는 동안 위에서 전체 보기 + 조이스틱 숨김', r1.view === 'top' && (await A.locator('[data-joystick]').count()) === 0);
  await A.waitForFunction('!window.__lib3d.me.walk', null, { timeout: 60000 });
  await A.screenshot({ path: `${OUT}/roam-08-reading.png` });
  await A.getByRole('button', { name: '⏸ 잠깐 멈추기' }).click(); await A.waitForTimeout(800);
  check('멈추면 원래 보기(3인칭)', (await me(A)).view === 'third');
  // 정원 문으로 걸어가면 정원으로
  await A.evaluate(() => { const w = window.__lib3d; w._standUp(w.me); w.me.avatar.root.position.set(-3.2, 0, -9.15); w.rig.snapTo(Math.PI / 2); });
  await stick(A, 0, -40, 1500); await A.waitForTimeout(2500);
  const garden = await A.evaluate(() => !window.__lib3d && !!document.querySelector('canvas'));
  check('정원 문으로 걸어 나가면 정원 화면', garden || (await A.getByText('도서관 가기').count()) > 0);
  await A.screenshot({ path: `${OUT}/roam-09-garden.png` });
  // 정원: 뒤에서 보기로 시작, 조이스틱으로 걷기, 1인칭, 문으로 걸어 도서관으로
  await A.waitForFunction('window.__garden3d && window.__garden3d.me', null, { timeout: 15000 });
  await A.locator('canvas').scrollIntoViewIfNeeded(); await A.waitForFunction('!window.__garden3d.me.walk', null, { timeout: 15000 }); await A.waitForTimeout(500);
  const gme = () => A.evaluate(() => { const w = window.__garden3d, q = w.me.avatar.root.position; return { x: +q.x.toFixed(2), z: +q.z.toFixed(2), view: w.view, ok: w.nav.walkable(q.x, q.z) }; });
  const g0 = await gme(); check('정원도 뒤에서 보기로 시작', g0.view === 'third');
  await A.screenshot({ path: `${OUT}/roam-10-garden-third.png` });
  await stick(A, 0, -40, 1600); const g1 = await gme();
  check('정원에서 조이스틱으로 걷기', Math.hypot(g1.x - g0.x, g1.z - g0.z) > 1.2 && g1.ok, `${g0.x},${g0.z} → ${g1.x},${g1.z}`);
  await A.screenshot({ path: `${OUT}/roam-11-garden-walk.png` });
  await stick(A, 0, -40, 4000); check('화분·가운데 화단을 통과하지 않음', (await gme()).ok);
  await A.click('[data-view="first"]'); await A.waitForTimeout(900); await A.screenshot({ path: `${OUT}/roam-12-garden-first.png` });
  await A.click('[data-view="third"]');
  await A.evaluate(() => { const w = window.__garden3d, s = w.garden.doorSpot, d = s.door; w.me.avatar.root.position.set(s.x, 0, s.z); w.rig.snapTo(Math.atan2(-(d.x - s.x), -(d.z - s.z))); });
  await A.waitForTimeout(300); await stick(A, 0, -40, 1500); await A.waitForTimeout(2500);
  check('정원 문으로 걸어가면 도서관', (await A.getByText('정원 가기').count()) > 0 || (await A.evaluate(() => !!document.querySelector('[data-joystick]') && /도서관/.test(document.body.innerText))));
  // 선생님으로 들어와도 보는 방법 버튼과 조이스틱이 있고 걸을 수 있음(학생 화면에는 안 보임)
  const T = await ctx.newPage();
  await T.route(/supabase\.co/, (route) => { const obj = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object'); if (/get_class_progress/.test(route.request().url())) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"joined_today":0,"total_students":2,"class_pct":0,"communal_minutes":0}]' }); return route.fulfill({ status: obj ? 406 : 200, contentType: 'application/json', body: obj ? '{}' : '[]' }); });
  await T.addInitScript(() => { localStorage.setItem('saesak_session', JSON.stringify({ role: 'teacher', classInfo: { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 } })); localStorage.setItem('saesak_lab3d', '1'); });
  await T.goto('http://localhost:4321/?lab3d=1&rtlocal=1&debug=1'); await T.waitForTimeout(600); await T.mouse.click(195, 400); await T.waitForTimeout(800);
  await T.getByText('읽기', { exact: true }).click(); await T.waitForFunction('window.__lib3d && window.__lib3d.me', null, { timeout: 15000 }); await T.waitForTimeout(1200);
  await T.mouse.click(195, 300); const t0 = await me(T); await stick(T, 0, -40, 1200); const t1 = await me(T);
  check('선생님도 보는 방법 버튼·조이스틱으로 걷기', (await T.locator('[data-view]').count()) === 3 && Math.hypot(t1.x - t0.x, t1.z - t0.z) > 0.8);
  await T.screenshot({ path: `${OUT}/roam-13-teacher.png` });
  await B.bringToFront(); await B.waitForTimeout(3500);
  check('학생 화면에는 선생님 캐릭터가 안 보임', !(await B.evaluate(() => [...window.__lib3d.people.values()].some((q) => q.nick === '선생님'))));
  console.log(ok.join('\n'));
  console.log('errors:', log.length ? log.slice(0, 8) : 'none');
  await b.close();
})().catch((e) => { console.error('TEST FAILED', e.message); process.exit(1); });
