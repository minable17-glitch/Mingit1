// 도서관 ↔ 정원 오가기 점검: 정원 가기(문으로 걸어감) → 정원 도착 → 도서관 가기 → 도서관 도착
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-door.e2e.cjs
const { chromium } = require('playwright');
const session = JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: 'x', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id: 'stu-00', nickname: '민수' } });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/supabase\.co/, (route) => { const u = route.request().url(), obj = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object'); if (/get_class_progress/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"joined_today":0,"total_students":1,"class_pct":0,"communal_minutes":0}]' }); if (/students/.test(u) && /total_days/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"id":"stu-00","nickname":"민수","total_days":4,"communal_minutes":0,"total_pages":0,"equipped_accessories":[],"created_at":"2026-10-01"}]' }); return route.fulfill({ status: obj ? 406 : 200, contentType: 'application/json', body: obj ? '{}' : '[]' }); });
  await p.addInitScript(([s]) => { localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_lab3d', '1'); const sid = JSON.parse(s).studentInfo?.id; if (sid && !localStorage.getItem('saesak_dress_' + sid)) localStorage.setItem('saesak_dress_' + sid, JSON.stringify({ g: 'boy', hs: 'short', hc: 1, sc: 0, b: 'shorts', bc: 0 })); }, [session]);
  await p.goto('http://localhost:4321/?lab3d=1&rtlocal=1&debug=1'); await p.waitForTimeout(600); await p.mouse.click(195, 400); await p.waitForTimeout(800);
  await p.getByText('읽기', { exact: true }).click();
  await p.waitForFunction('window.__lib3d && window.__lib3d._synced', null, { timeout: 30000 });
  await p.getByText(/🌳 정원 가기/).click(); await p.waitForTimeout(600);
  const walking = await p.evaluate(() => !!(window.__lib3d && window.__lib3d.me.walk));
  await p.waitForFunction('!!window.__garden3d && window.__garden3d.slots.length > 0', null, { timeout: 30000 });
  console.log('정원 가기 → 문으로 걸어감:', walking, '| 정원 화면 도착: true');
  await p.getByText('📚 도서관 가기').click();
  await p.waitForFunction('window.__lib3d && !window.__lib3d.disposed && window.__lib3d._synced', null, { timeout: 30000 });
  console.log('도서관 가기 → 도서관 화면 도착: true | errors:', errs.length ? errs : 'none');
  await b.close();
})().catch((e) => { console.error('TEST FAILED', e.message); process.exit(1); });
