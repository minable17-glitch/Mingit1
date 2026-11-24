// 자리 뺏김 점검: 이미 앉아 있는 친구 자리를, 나중에 들어온 학생이 뺏지 않는지
// - 나중에 온 학생(지우)의 실시간 연결이 늦음(3.5초 넘게) → 친구 목록을 모른 채 지난번 자리(민수 자리)에 먼저 앉음
// - 게다가 지우 기기 시계가 10분 늦음(예전엔 "먼저 앉은 사람" 비교에서 지우가 이겨서 민수가 쫓겨났음)
// 기대: 민수는 그대로 앉아 있고, 지우가 "친구가 먼저 앉았어요"로 양보함
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-seat.e2e.cjs
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const session = (id, nick) => JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id, nickname: nick } });
// ── 가짜 실시간 서버(Phoenix 방식): 채널 들어가기·presence 알리기·나가기만 흉내
const topics = new Map();           // topic → Map(key → { meta, conn })
const conns = new Set(); const blocked = new Set(); const slow = new Map(); let refN = 0;
const stateOf = (topic) => { if (!topics.has(topic)) topics.set(topic, new Map()); return topics.get(topic); };
const metas = (e) => ({ metas: [{ phx_ref: e.ref, ...e.meta }] });   // 나갈 때도 들어올 때와 같은 표식(phx_ref)이어야 지워짐
function broadcast(topic, diff) { for (const c of conns) { const j = c.joins.get(topic); if (j) c.ws.send(JSON.stringify([j.joinRef, null, topic, 'presence_diff', diff])); } }
function leaveAll(c) { for (const [topic, j] of c.joins) { const st = stateOf(topic), e = st.get(j.key); if (e && e.conn === c) { st.delete(j.key); broadcast(topic, { joins: {}, leaves: { [j.key]: metas(e) } }); } } c.joins.clear(); }
async function fakeRealtime(page, name) {
  await page.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
    const c = { ws, name, joins: new Map() }; conns.add(c);
    const handle = (raw) => {
      const [joinRef, ref, topic, event, payload] = JSON.parse(String(raw));
      const reply = (status, response = {}) => ws.send(JSON.stringify([joinRef, ref, topic, 'phx_reply', { status, response }]));
      if (event === 'phx_join') {
        if (blocked.has(name)) return reply('error', { reason: 'unavailable' });
        const until = slow.get(name) || 0; if (Date.now() < until) { setTimeout(() => handle(raw), until - Date.now() + 50); return; }
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
    };
    ws.onMessage(handle);
    ws.onClose(() => { leaveAll(c); conns.delete(c); });
  });
}
async function open(ctx, id, nick, log, { seat, clockOffset = 0, waitSync = true, slowMs = 0 } = {}) {
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
  await p.addInitScript(([s, sid, st, off]) => {
    if (off) { const n = Date.now.bind(Date); Date.now = () => n() + off; }
    localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_lib_tip', '1'); localStorage.setItem('saesak_lab3d_tip', '1');
    localStorage.setItem('saesak_dress_' + sid, JSON.stringify({ g: 'boy', hs: 'short', hc: 1, sc: 0, b: 'shorts', bc: 0 }));
    if (st) localStorage.setItem('saesak_seat_class-demo_' + sid, String(st));
  }, [session(id, nick), id, seat || 0, clockOffset]);
  await p.goto('http://localhost:4321/?debug=1');
  await p.waitForTimeout(600); await p.mouse.click(195, 400); await p.waitForTimeout(800);
  if (slowMs) { blocked.add(nick); setTimeout(() => blocked.delete(nick), slowMs); }   // 도서관에 들어갈 때 실시간 연결이 한동안 안 됨(느린 와이파이 흉내)
  await p.getByText('읽기', { exact: true }).click();
  if (waitSync) await p.waitForFunction('window.__lib3d && window.__lib3d._synced', null, { timeout: 20000, polling: 300 });
  return p;
}
const mySeat = (p) => p.evaluate(() => window.__lib3d.me.seat);
const seatOf = (p, nick) => p.evaluate((n) => { const q = [...window.__lib3d.people.values()].find((x) => x.nick === n); return q ? q.seat : '없음'; }, nick);
(async () => {
  const log = [], ok = [];
  const check = (name, cond, extra = '') => ok.push(`${cond ? '✅' : '❌'} ${name} ${extra}`);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const A = await open(ctx, 'stu-minsu', '민수', log, { seat: 3 });
  await A.waitForTimeout(3000);
  const seatA = await mySeat(A);
  check('민수가 자기 자리(3번)에 앉음', seatA === 3, String(seatA));
  await A.getByText(/10분 읽기 시작|이어서 읽기/).click(); await A.waitForTimeout(1500);
  // 지우: 실시간 연결이 6초 늦고, 기기 시계가 10분 늦음, 지난번 자리도 3번
  // 지우: 기기 시계가 10분 늦음. 도서관에 들어온 직후 친구 목록이 늦게 와서(느린 와이파이) 민수가 안 보이는 순간에 3번을 고름
  const B = await open(ctx, 'stu-jiwoo', '지우', log, { clockOffset: -10 * 60 * 1000 });
  await B.waitForTimeout(2000);
  const picked = await B.evaluate(() => {
    const w = window.__lib3d, a = [...w.people.values()].find((q) => q.nick === '민수');
    if (a) a.seat = null;            // 아직 민수를 모르는 상태 흉내
    w._live = false; w.sitAt(3);     // 친구 목록 받기 전에 지난번 자리(3번)에 앉음
    return w.me.seat;
  });
  check('(재현) 지우가 민수 자리 3번을 모르고 고름', picked === 3, String(picked));
  await B.evaluate(() => { window.__lib3d._live = true; });
  await B.waitForTimeout(6000);
  await A.bringToFront(); await A.waitForTimeout(2500);
  check('민수는 그대로 3번 자리', (await mySeat(A)) === 3, String(await mySeat(A)));
  check('민수 화면: 민수는 계속 읽는 중', (await A.evaluate(() => window.__lib3d.me.state)) === 'read');
  const seatB = await mySeat(B);
  check('지우는 3번에서 비켜남', seatB !== 3, String(seatB));
  check('민수 화면에서 지우가 3번에 안 앉아 있음', (await seatOf(A, '지우')) !== 3, String(await seatOf(A, '지우')));
  check('지우 화면에서 민수가 3번', (await seatOf(B, '민수')) === 3, String(await seatOf(B, '민수')));
  check('민수에게 "친구가 먼저 앉았어요" 안내가 안 뜸', (await A.getByText('친구가 먼저 앉았어요').count()) === 0);
  await B.bringToFront(); await B.screenshot({ path: `${OUT}/seat-B.png` });
  // 지우가 다른 빈자리를 누르면 앉을 수 있음 + 그때는 정상 비교(친구 목록을 알고 고름)
  const free = await B.evaluate(() => { const w = window.__lib3d; for (const s of w.seats.values()) if (!w.occupantOf(s.id)) return s.id; return null; });
  await B.evaluate((s) => window.__lib3d.sitAt(s), free); await B.waitForTimeout(2500);
  check('지우는 빈자리에 앉을 수 있음', (await mySeat(B)) === free, `${await mySeat(B)} / ${free}`);
  check('민수 화면에도 지우가 그 자리', (await seatOf(A, '지우')) === free, String(await seatOf(A, '지우')));
  console.log(ok.join('\n')); console.log('errors:', log.length ? log.slice(0, 6) : 'none');
  await b.close();
  if (ok.some((l) => l.startsWith('❌'))) process.exit(1);
})().catch((e) => { console.error('TEST FAILED', e.message.slice(0, 300)); process.exit(1); });
