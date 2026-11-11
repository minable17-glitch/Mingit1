// 실제 Supabase 실시간 연결 코드 점검(가짜 실시간 서버 사용, ?rtlocal 없이):
// 두 학생이 서로 보임 → 10분 읽기 시작 → 앱을 뒤로 보내 연결이 끊김(그동안 재접속 거절) → 다시 화면을 열면 저절로 다시 연결 → 친구 화면에 다시 '읽는 중'
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-realtime.e2e.cjs
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const session = (id, nick) => JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id, nickname: nick } });

// ── 가짜 실시간 서버(Phoenix 방식): 채널 들어가기·presence 알리기·나가기만 흉내
const topics = new Map();           // topic → Map(key → { meta, conn })
const conns = new Set(); const blocked = new Set(); let refN = 0;
const stateOf = (topic) => { if (!topics.has(topic)) topics.set(topic, new Map()); return topics.get(topic); };
const metas = (e) => ({ metas: [{ phx_ref: e.ref, ...e.meta }] });   // 나갈 때도 들어올 때와 같은 표식(phx_ref)이어야 지워짐
function broadcast(topic, diff) { for (const c of conns) { const j = c.joins.get(topic); if (j) c.ws.send(JSON.stringify([j.joinRef, null, topic, 'presence_diff', diff])); } }
function leaveAll(c) { for (const [topic, j] of c.joins) { const st = stateOf(topic), e = st.get(j.key); if (e && e.conn === c) { st.delete(j.key); broadcast(topic, { joins: {}, leaves: { [j.key]: metas(e) } }); } } c.joins.clear(); }
async function fakeRealtime(page, name) {
  await page.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    const c = { ws, name, joins: new Map() }; conns.add(c);
    ws.onMessage((raw) => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw));
      const reply = (status, response = {}) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status, response }]));
      if (event === 'phx_join') {
        if (blocked.has(name)) return reply('error', { reason: 'unavailable' });
        const key = payload?.config?.presence?.key || 'anon'; c.joins.set(topic, { joinRef, key }); reply('ok');
        const st = stateOf(topic), snap = {}; for (const [k, e] of st) snap[k] = metas(e);
        ws.send(JSON.stringify([joinRef, null, topic, 'presence_state', snap])); return;
      }
      if (event === 'presence' && payload?.event === 'track') {
        const j = c.joins.get(topic); if (!j) return reply('error');
        const st = stateOf(topic), prev = st.get(j.key), e = { meta: payload.payload, conn: c, ref: 'r' + (++refN) }; st.set(j.key, e); reply('ok');
        broadcast(topic, { joins: { [j.key]: metas(e) }, leaves: prev ? { [j.key]: metas(prev) } : {} }); return;
      }
      if (event === 'phx_leave') { const j = c.joins.get(topic); if (j) { const st = stateOf(topic), e = st.get(j.key); if (e && e.conn === c) { st.delete(j.key); broadcast(topic, { joins: {}, leaves: { [j.key]: metas(e) } }); } c.joins.delete(topic); } return reply('ok'); }
      reply('ok');
    });
    ws.onClose(() => { leaveAll(c); conns.delete(c); });
  });
}
async function open(ctx, id, nick, log) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log.push(`[${nick}] pageerror: ${e.message}`));
  await fakeRealtime(p, nick);
  await p.route(/supabase\.co\/(rest|auth)/, (route) => {
    const req = route.request(), url = req.url(), obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (/\/rest\/v1\/books/.test(url) && req.method() === 'GET' && /is_completed=eq\.false/.test(url)) { const book = { id: 'b1', title: '어린 왕자', author: '생텍쥐페리', cover_url: null, is_completed: false }; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(obj ? book : [book]) }); }
    if (/rpc\/get_class_progress/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"joined_today":0,"total_students":2,"class_pct":0,"communal_minutes":0}]' });
    if (/\/rest\/v1\/rpc\//.test(url)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"mock"}' });
    if (/\/rest\/v1\//.test(url)) return route.fulfill({ status: obj ? 406 : 200, contentType: 'application/json', body: obj ? '{"message":"none"}' : '[]' });
    return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
  });
  await p.addInitScript(([s, sid]) => { localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_lib_tip', '1'); localStorage.setItem('saesak_dress_' + sid, JSON.stringify({ g: 'boy', hs: 'short', hc: 1, sc: 0, b: 'shorts', bc: 0 })); }, [session(id, nick), id]);
  await p.goto('http://localhost:4321/?debug=1');
  await p.waitForTimeout(600); await p.mouse.click(195, 400); await p.waitForTimeout(800);
  await p.getByText('읽기', { exact: true }).click();
  await p.waitForFunction('window.__lib3d && window.__lib3d._synced', null, { timeout: 20000, polling: 300 });
  return p;
}
const status = (p) => p.evaluate(() => (document.body.innerText.match(/함께 읽는 중|실시간 연결 안 됨|연결 중…|연습 모드/) || ['?'])[0]);
const friend = (p, nick) => p.evaluate((n) => { const q = [...window.__lib3d.people.values()].find((x) => x.nick === n); return q ? q.state : '없음'; }, nick);
(async () => {
  const log = [], ok = [];
  const check = (name, cond, extra = '') => ok.push(`${cond ? '✅' : '❌'} ${name} ${extra}`);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const A = await open(ctx, 'stu-minsu', '민수', log);
  const B = await open(ctx, 'stu-jiwoo', '지우', log);
  await B.waitForTimeout(2500);
  check('실제 연결 방식으로 접속됨', (await status(A)) === '함께 읽는 중' && (await status(B)) === '함께 읽는 중', `${await status(A)} / ${await status(B)}`);
  check('서로 보임', (await friend(B, '민수')) !== '없음' && (await friend(A, '지우')) !== '없음');
  await A.bringToFront(); await A.getByText(/10분 읽기 시작|이어서 읽기/).click(); await A.waitForTimeout(2500);
  check('읽기 시작 → 친구 화면에 읽는 중', (await friend(B, '민수')) === 'read', await friend(B, '민수'));
  // 앱을 뒤로 보냄: 연결이 끊기고, 그동안 다시 들어오는 것도 거절(토큰 만료 등 흉내)
  blocked.add('민수');
  await A.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  for (const c of [...conns]) if (c.name === '민수') { leaveAll(c); conns.delete(c); c.ws.close(); }
  await A.waitForTimeout(9000);
  check('뒤로 간 동안: 친구 화면에서 사라짐', (await friend(B, '민수')) === '없음', await friend(B, '민수'));
  // 다시 화면을 엶
  blocked.delete('민수');
  await A.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await A.waitForTimeout(5000);
  check('다시 열면 저절로 다시 연결', (await status(A)) === '함께 읽는 중', await status(A));
  check('읽기는 그대로 이어짐', (await A.getByText('잠깐 멈추기').count()) > 0);
  check('친구 화면에 다시 읽는 중으로 보임', (await friend(B, '민수')) === 'read', await friend(B, '민수'));
  // 두 번째: 뒤에 가 있는 동안 로그인 토큰이 만료되어 서버가 채널을 닫음(이때 라이브러리는 스스로 다시 들어가지 않음)
  await A.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  for (const c of [...conns]) if (c.name === '민수') for (const [topic, j] of [...c.joins]) {
    c.ws.send(JSON.stringify([j.joinRef, null, topic, 'system', { status: 'error', message: 'Token has expired 0 seconds ago', extension: 'system', channel: topic }]));
    c.ws.send(JSON.stringify([j.joinRef, null, topic, 'phx_close', {}]));
    const st = stateOf(topic), e = st.get(j.key); if (e && e.conn === c) { st.delete(j.key); broadcast(topic, { joins: {}, leaves: { [j.key]: metas(e) } }); } c.joins.delete(topic);
  }
  await A.waitForTimeout(3000);
  check('토큰 만료로 채널이 닫힘 → 친구 화면에서 사라짐', (await friend(B, '민수')) === '없음', await friend(B, '민수'));
  await A.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await A.waitForTimeout(6000);
  check('다시 열면 저절로 다시 연결(채널이 닫힌 경우)', (await status(A)) === '함께 읽는 중', await status(A));
  check('친구 화면에 다시 읽는 중(채널이 닫힌 경우)', (await friend(B, '민수')) === 'read', await friend(B, '민수'));
  await A.screenshot({ path: `${OUT}/rt-back.png` });
  console.log(ok.join('\n')); console.log('errors:', log.length ? log.slice(0, 6) : 'none');
  await b.close();
})().catch((e) => { console.error('TEST FAILED', e.message.slice(0, 400)); process.exit(1); });
