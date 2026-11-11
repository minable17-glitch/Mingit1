// 3D 정원 나무 누르기 점검: 뒤에서·내 눈으로·위에서 보기 모두에서 나무(또는 이름표)를 누르면 그 친구 정보 창이 열리는지
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-garden-tap.e2e.cjs
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const session = JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id: 'stu-03', nickname: '민수' } });
const NAMES = ['지우', '서연', '민수', '하준', '도윤', '수아', '예준', '지호', '시우', '유나'], DAYS = [0, 2, 3, 5, 11, 19, 27, 1, 8, 4];
const roster = NAMES.map((n, i) => ({ id: `stu-${String(i + 1).padStart(2, '0')}`, nickname: n, total_days: DAYS[i], communal_minutes: i * 3, total_pages: i * 10, equipped_accessories: i === 6 ? ['crown', 'butterfly', 'apple', 'star'] : i === 2 ? ['ribbon', 'heart'] : [], created_at: `2026-10-0${1 + (i % 9)}T00:00:0${i}Z` }));
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
    if (/rest\/v1\/students/.test(url)) return obj ? json({ accessory_counts: { ribbon: 1, heart: 1 }, equipped_accessories: ['ribbon', 'heart'] }) : json([]);
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
  const res = [];
  // 화면에 보이는 학생 나무를 실제로 누른 것처럼 하고, 정원이 어떤 나무를 골랐는지 기록(상세 창은 열자마자 닫음)
  await p.evaluate(() => { const w = window.__garden3d, o = w.emit; window.__taps = []; w.emit = (t, d) => { window.__taps.push(t + ':' + (d && d.id || '')); o(t, d); }; });
  const visibleTrees = (mode) => p.evaluate((md) => { const w = window.__garden3d, r = w.canvas.getBoundingClientRect(), out = [];
    w.slots.forEach((s, i) => { if (!s || !s.id) return; const t = w.garden.trees[i], y = md === 'tag' ? s.tag.position.y : md === 'mid' ? s.tag.position.y * 0.6 : md, v = new (w.camera.position.constructor)(t.x, y, t.z).project(w.camera);
      if (v.z < 1 && Math.abs(v.x) < 0.85 && v.y > -0.55 && v.y < 0.75) out.push({ id: s.id, me: s.me, nick: s.nick, stage: s.stage, x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }); });
    // 화면에서 다른 나무와 겹치는(멀리서 앞뒤로 포개진) 나무는 앞 나무가 눌리는 게 맞으므로 점검에서 뺌
    return out.filter((a) => !a.me && !out.some((b) => b !== a && Math.hypot(a.x - b.x, a.y - b.y) < 34)); }, mode);
  await p.locator('canvas').scrollIntoViewIfNeeded();
  for (const [view, px, pz, yaw] of [['third', 0, 2.0, 0], ['third', -1.2, -0.6, -0.9], ['first', 0, 2.0, 0], ['first', 1.4, 0.2, 0.7], ['top', 0, 2.0, 0]]) {
    await p.click(`[data-view="${view}"]`); await p.waitForTimeout(400);
    await p.evaluate(([x, z, a]) => { const w = window.__garden3d; w.me.walk = null; w.me.avatar.root.position.set(x, 0, z); w.rig.snapTo(a); w._dirty = true; }, [px, pz, yaw]);
    await p.waitForTimeout(1200);
    for (const mode of [0.12, 'mid', 'tag']) {
      for (const t of (await visibleTrees(mode)).slice(0, 5)) {
        await p.evaluate(() => { window.__taps = []; });
        await p.mouse.click(t.x, t.y); await p.waitForTimeout(400);
        const taps = await p.evaluate(() => window.__taps.join(','));
        const ok = taps === 'tapTree:' + t.id;
        res.push(`${ok ? '✅' : '❌'} [${view}] ${mode === 'tag' ? '이름표' : mode === 'mid' ? '잎(가운데)' : '밑동'} '${t.nick}'(${t.stage}단계) → ${taps || '반응 없음'}`);
        if (taps) { await p.mouse.click(195, 25); await p.waitForTimeout(350); }      // 열린 친구 정보 창 닫기(바깥 누르기)
      }
    }
  }
  await p.click('[data-view="third"]'); await p.evaluate(() => { const w = window.__garden3d; w.me.avatar.root.position.set(0, 0, 2.0); w.rig.snapTo(0); w._dirty = true; }); await p.waitForTimeout(1200);
  const marks = [...(await visibleTrees(0.12)), ...(await visibleTrees('mid')), ...(await visibleTrees('tag'))];
  await p.evaluate((ms) => { for (const m of ms) { const d = document.createElement('div'); d.textContent = m.nick; d.style.cssText = `position:fixed;left:${m.x - 4}px;top:${m.y - 4}px;width:8px;height:8px;border-radius:4px;background:red;z-index:999;font-size:9px;color:red;text-indent:10px;white-space:nowrap;pointer-events:none`; document.body.appendChild(d); } }, marks);
  await p.screenshot({ path: `${OUT}/gtap.png` });
  console.log(res.join('\n')); console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
  await b.close();
}
run(true).catch((e) => { console.error('TEST FAILED', e.message); process.exit(1); });
