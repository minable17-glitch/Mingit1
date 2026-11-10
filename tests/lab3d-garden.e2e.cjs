// 3D 정원 자동 점검: 나무 단계 표시 → 물 주기(오래된 물부터) → 나무 성장 → 전체 보기 → 나무 눌러 상세 열기 → SQL 적용 전 기기에서는 예전 방식 유지
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-garden.e2e.cjs
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const session = JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id: 'stu-03', nickname: '민수' } });
const NAMES = ['지우', '서연', '민수', '하준', '도윤', '수아', '예준', '지호', '시우', '유나'], DAYS = [0, 2, 3, 5, 11, 19, 27, 1, 8, 4];
const roster = NAMES.map((n, i) => ({ id: `stu-${String(i + 1).padStart(2, '0')}`, nickname: n, total_days: DAYS[i], communal_minutes: i * 3, total_pages: i * 10, equipped_accessories: [], created_at: `2026-10-0${1 + (i % 9)}T00:00:0${i}Z` }));
const logs = [3, 4, 5, 6, 7].map((d, i) => ({ id: `log-${d}`, log_date: `2026-11-0${d}`, minutes: 10, pages: 5, note: '재미있게 읽었어요 열 글자', ocr_excerpt: null, book_id: 'b1', books: { title: '어린 왕자' }, watered_at: i < 3 ? `2026-11-0${d}T08:00:00Z` : null })).reverse();
async function run(supportsWater) {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/supabase\.co|WebSocket|Failed to load resource|net::/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  const calls = [];
  await p.route(/supabase\.co/, (route) => {
    const req = route.request(), url = decodeURIComponent(req.url()), obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (/rest\/v1\/logs/.test(url) && req.method() === 'GET') {
      if (/select=watered_at/.test(url)) return supportsWater ? json([]) : json({ message: 'column logs.watered_at does not exist' }, 400);
      if (/log_date=eq/.test(url)) return obj ? json({ message: 'none' }, 406) : json([]);
      const wet = /watered_at/.test(url);
      return json(logs.map((l) => { const c = { ...l }; if (!wet) delete c.watered_at; else if (calls.includes('water:' + l.id) || calls.includes('water:all')) c.watered_at = 'x'; return c; }));
    }
    if (/rest\/v1\/students/.test(url) && /total_days/.test(url)) return json(roster.map((r) => (r.id === 'stu-03' ? { ...r, total_days: 3 + calls.filter((c) => c.startsWith('water:')).length } : r)));
    if (/rest\/v1\/students/.test(url)) return obj ? json({ accessory_counts: {}, equipped_accessories: [] }) : json([]);
    if (/rest\/v1\/books/.test(url) && /is_completed=eq\.false/.test(url)) { const book = { id: 'b1', student_id: 'stu-03', title: '어린 왕자', author: '생텍쥐페리', cover_url: null, is_completed: false, started_at: 'x' }; return json(obj ? book : [book]); }
    if (/rpc\/get_class_progress/.test(url)) return json([{ joined_today: 3, total_students: 10, class_pct: 27, communal_minutes: 40 }]);
    if (/rpc\/water_tree/.test(url)) { const body = JSON.parse(req.postData() || '{}'); calls.push('water:' + (body.p_log_id || 'all')); return json(body.p_log_id ? 1 : 2); }
    if (/rpc\/get_class_read_days/.test(url)) return json(roster.map((r) => ({ student_id: r.id, days: r.total_days + 1 })));
    if (/rest\/v1\/rpc\//.test(url)) return json({ message: 'mock' }, 400);
    if (/rest\/v1\//.test(url)) return obj ? json({ message: 'none' }, 406) : json([]);
    return json({}, 400);
  });
  await p.addInitScript(([s]) => { localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_lab3d', '1'); }, [session]);
  await p.goto('http://localhost:4321/?lab3d=1&rtlocal=1&debug=1');
  await p.waitForTimeout(600); await p.mouse.click(195, 400);
  await p.waitForFunction('window.__garden3d && window.__garden3d.slots.filter((s) => s && s.id).length === 10', null, { timeout: 40000 });
  await p.waitForTimeout(1500);
  const state = () => p.evaluate(() => { const w = window.__garden3d; const m = w.slots.find((s) => s && s.me); return { mine: m ? `${m.nick} ${m.stage}단계` : null, trees: w.slots.filter((s) => s && s.id).map((s) => `${s.nick}:${s.stage}`).join(' '), people: w.people.size, button: (document.body.innerText.match(/💧 물 주기[^\n]*|지금은 줄 물이 없어요[^\n]*/) || ['(물주기 버튼 없음)'])[0], hasAll: /모두 주기/.test(document.body.innerText) }; });
  const tag = supportsWater ? '[물주기 SQL 적용됨]' : '[SQL 적용 전]';
  console.log(tag, '처음:', JSON.stringify(await state()));
  if (!supportsWater) { await p.screenshot({ path: `${OUT}/g0-legacy.png` }); console.log(tag, 'errors:', errs.length ? errs.slice(0, 5) : 'none'); await b.close(); return; }
  await p.locator('canvas').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/g1-before.png` });
  await p.getByText(/💧 물 주기/).click();
  const during = await p.evaluate(() => [...window.__garden3d.people.values()][0].avatar.state + ', 버튼: ' + (document.body.innerText.match(/물 주는 중…/) || ['?'])[0]);
  await p.screenshot({ path: `${OUT}/g2-watering.png` });
  await p.waitForTimeout(2600);
  console.log(tag, '물 1번 준 뒤(주는 동안 자세:', during + '):', JSON.stringify(await state()), '| 안내:', await p.evaluate(() => (document.body.innerText.match(/물을 [^\n]*/) || ['없음'])[0]));
  await p.screenshot({ path: `${OUT}/g3-after.png` });
  await p.waitForTimeout(2800);
  await p.getByText(/💧 물 주기/).click(); await p.waitForTimeout(3200);
  console.log(tag, '한 번 더 준 뒤:', JSON.stringify(await state()));
  // 전체 보기로 바꾼 뒤 나무를 눌러 친구 정보 열기
  await p.getByText('🔭 전체 보기').click(); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/g4-overview.png` });
  const [tx, ty] = await p.evaluate(() => { const w = window.__garden3d, i = w.slots.findIndex((s) => s && s.nick === '수아'), t = w.garden.trees[i], v = new (w.camera.position.constructor)(t.x, 0.1, t.z).project(w.camera), r = w.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; });
  await p.mouse.click(tx, ty); await p.waitForTimeout(500);
  console.log(tag, "'수아' 나무를 누름 → 상세 창:", await p.evaluate(() => (document.body.innerText.match(/지금 [^\n]* 단계 · 누적 \d+일/) || ['안 열림'])[0]));
  console.log(tag, '서버 호출:', calls.join(', '), '| errors:', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
}
(async () => { await run(true); await run(false); })().catch((e) => { console.error('TEST FAILED', e.message); process.exit(1); });
