// 화단 꾸미기 점검: 친구 화단 소품이 정원에 보임 → '🪴 화단' 버튼(새 소품 빨간 점) → 14종 목록(없는 것 '아직 없어요') →
// 3자리에 놓기(가진 개수까지만) → 서버 저장 → 내 화단에 바로 보임
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-decor.e2e.cjs
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const CLASS = { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 };
const NAMES = ['지우', '서연', '민수', '하준', '도윤', '수아', '예준', '지호'];
const roster = NAMES.map((n, i) => ({ id: `stu-0${i + 1}`, nickname: n, total_days: [3, 6, 9, 12, 15, 20, 25, 28][i], communal_minutes: 0, total_pages: 0, equipped_accessories: [], created_at: `2026-10-0${i + 1}T00:00:00Z`, is_teacher: false,
  decor_placed: i === 0 ? ['prop_lantern', null, 'prop_mushroom_stool'] : i === 1 ? ['prop_low_fence', 'prop_flower_pot', null] : i === 3 ? [null, 'prop_firefly_jar', 'prop_rainbow_pinwheel'] : [null, null, null] }));
const saved = [];
(async () => {
  const log = [], ok = [];
  const check = (name, cond, extra = '') => { ok.push(`${cond ? '✅' : '❌'} ${name} ${extra}`); console.log(ok[ok.length - 1]); };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => log.push('pageerror: ' + e.message));
  await p.route(/supabase\.co/, (route) => {
    const req = route.request(), url = decodeURIComponent(req.url()), obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (/rpc\/student_set_decor/.test(url)) { saved.push(JSON.parse(req.postData() || '{}').p_items); return route.fulfill({ status: 204, body: '' }); }
    if (/rpc\/get_class_progress/.test(url)) return json([{ joined_today: 1, total_students: 8, class_pct: 20, communal_minutes: 0 }]);
    if (/rest\/v1\/students/.test(url) && /decor_counts/.test(url)) return json({ decor_counts: { prop_name_sign: 1, prop_lantern: 2, prop_bunny_doll: 1, prop_mushroom_stool: 1 }, decor_placed: [null, null, null] });
    if (/rest\/v1\/students/.test(url) && /total_days/.test(url)) return json(roster);
    if (/rest\/v1\/classes/.test(url)) return obj ? json({ message: 'none' }, 406) : json([CLASS]);
    if (/\/rest\/v1\/rpc\//.test(url)) return json({ message: 'mock' }, 400);
    if (/\/rest\/v1\//.test(url)) return obj ? json({ message: 'none' }, 406) : json([]);
    return json({}, 400);
  });
  await p.addInitScript(([s]) => { localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_dress_stu-03', JSON.stringify({ g: 'boy', hs: 'short', hc: 1, sc: 0, b: 'shorts', bc: 0 })); },
    [JSON.stringify({ role: 'student', classInfo: CLASS, studentInfo: { id: 'stu-03', nickname: '민수' } })]);
  await p.goto('http://localhost:4321/?rtlocal=1&debug=1'); await p.waitForTimeout(600); await p.mouse.click(206, 400);
  await p.waitForFunction('window.__garden3d && window.__garden3d.slots.filter((s) => s && s.id).length === 8', null, { timeout: 30000, polling: 300 });
  await p.waitForTimeout(1500);
  check('친구 화단 소품이 정원에 보임', await p.evaluate(() => !!window.__garden3d.decor && (window.__garden3d._decorKey || '').split('|').length === 6), await p.evaluate(() => (window.__garden3d._decorKey || '').split('|').length + '개'));
  check("'🪴 화단' 버튼 + 새 소품 빨간 점", (await p.locator('[data-decor]').count()) === 1 && (await p.locator('[data-decor] span').count()) === 1);
  await p.evaluate(() => document.querySelector('[data-view="top"]').click()); await p.waitForTimeout(400);
  await p.getByText('🔍 내 나무 보기').click(); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/decor-01-friends.png` });
  await p.click('[data-decor]'); await p.waitForTimeout(1500);
  check('14종 목록, 없는 소품 10종은 아직 없어요', (await p.locator('[data-item]').count()) === 14 && (await p.getByText('아직 없어요').count()) === 10);
  await p.screenshot({ path: `${OUT}/decor-02-modal.png` });
  await p.click('[data-slot="0"]'); await p.click('[data-item="prop_lantern"]');
  await p.click('[data-slot="1"]'); await p.click('[data-item="prop_lantern"]');
  await p.click('[data-slot="2"]'); await p.click('[data-item="prop_lantern"]');      // 2개뿐이라 세 번째는 안 들어가야 함
  await p.click('[data-item="prop_bunny_doll"]');
  await p.screenshot({ path: `${OUT}/decor-03-picked.png` });
  await p.getByText('이렇게 꾸밀래요').click(); await p.waitForTimeout(1500);
  check('가진 개수까지만 놓고 서버에 저장', JSON.stringify(saved[0]) === JSON.stringify(['prop_lantern', 'prop_lantern', 'prop_bunny_doll']), JSON.stringify(saved[0]));
  check('내 화단에 바로 보임', await p.evaluate(() => (window.__garden3d._decorKey || '').split('|').length === 9));
  await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/decor-04-mine.png` });
  await p.evaluate(() => document.querySelector('[data-view="third"]').click());
  await p.evaluate(() => { const w = window.__garden3d, i = w.slots.findIndex((s) => s && s.me), t = w.garden.trees[i]; w.me.walk = null; w.me.avatar.root.position.set(t.x + t.ux * 1.6, 0, t.z + t.uz * 1.6); w.rig.snapTo(Math.atan2(t.ux, t.uz)); w._dirty = true; });
  await p.waitForTimeout(1800); await p.screenshot({ path: `${OUT}/decor-05-third.png` });
  console.log('errors:', log.length ? log.slice(0, 5) : 'none');
  await b.close();
})().catch((e) => { console.error('TEST FAILED', e.message.slice(0, 300)); process.exit(1); });
