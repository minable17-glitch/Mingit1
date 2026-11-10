// 3D 도서관 부담 측정: 빈 도서관과 32명이 모두 앉았을 때의 그리기 횟수·삼각형 수 (저가 폰 기준 목표: 삼각형 30만 개, 그리기 250번 이하)
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-perf.cjs
const { chromium } = require('playwright');
const session = JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: 'x', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id: 'stu-00', nickname: '민수' } });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await p.route(/supabase\.co/, (route) => { const u = route.request().url(); if (/get_class_progress/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"joined_today":0,"total_students":32,"class_pct":0,"communal_minutes":0}]' }); const obj = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object'); return route.fulfill({ status: obj ? 406 : 200, contentType: 'application/json', body: obj ? '{}' : '[]' }); });
  await p.addInitScript(([s]) => { localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_lab3d', '1'); }, [session]);
  await p.goto('http://localhost:4321/?lab3d=1&rtlocal=1&debug=1'); await p.waitForTimeout(600); await p.mouse.click(195, 400); await p.waitForTimeout(800);
  await p.getByText('읽기', { exact: true }).click();
  await p.waitForFunction('window.__lib3d && window.__lib3d._synced', null, { timeout: 30000 });
  const measure = (label) => p.evaluate((lbl) => new Promise((res) => { const w = window.__lib3d; w._dirty = true; requestAnimationFrame(() => requestAnimationFrame(() => { const i = w.renderer.info.render; res(`${lbl}: 그리기 ${i.calls}번, 삼각형 ${(i.triangles / 1000).toFixed(0)}천 개, 도형 ${w.renderer.info.memory.geometries}, 그림 ${w.renderer.info.memory.textures}`); })); }), label);
  await p.evaluate(() => window.__lib3d.setZoom(false)); await p.waitForTimeout(2500);
  console.log(await measure('빈 도서관(나 혼자, 전체 보기)'));
  // 친구 31명이 모두 자리에 앉음(절반은 읽는 중)
  await p.evaluate(() => { const list = []; for (let i = 1; i <= 31; i++) list.push({ id: 'stu-' + String(i).padStart(2, '0'), nick: '친구' + i, seat: i, state: i % 2 ? 'read' : 'sit', seatAt: i }); window.__lib3d.setOthers(list); });
  await p.waitForTimeout(1500);
  console.log(await measure('32명 모두 앉음(전체 보기)'));
  await p.evaluate(() => window.__lib3d.setZoom(true)); await p.waitForTimeout(2500);
  console.log(await measure('32명 모두 앉음(가까이 보기)'));
  await p.screenshot({ path: require('path').join(__dirname, 'out', 'perf32.png') });
  await b.close();
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
