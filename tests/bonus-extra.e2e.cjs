// 더 읽은 시간 누적 표시 + 보너스 악세서리 안내 점검
// - 도서관(3D): "더 읽은 시간 오늘 n분 · 누적 m분"
// - 내 기록: "더 읽은 시간 누적 m분"
// - 보너스 저장 후 안내: 서버가 알려 준 실제 악세서리 개수로 표시
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/bonus-extra.e2e.cjs
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const kst = (d = 0) => new Date(Date.now() + 9 * 3600e3 + d * 86400e3).toISOString().slice(0, 10);
const session = JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id: 'stu-minsu', nickname: '민수' } });
const logs = [
  { id: 'l1', log_date: kst(0), minutes: 40, overflow_minutes: 30, pages: null, note: '재미있었다', ocr_excerpt: null, book_id: 'b1', books: { title: '어린 왕자' }, watered_at: new Date().toISOString() },
  { id: 'l2', log_date: kst(-1), minutes: 25, overflow_minutes: 15, pages: null, note: '좋았다', ocr_excerpt: null, book_id: 'b1', books: { title: '어린 왕자' }, watered_at: new Date().toISOString() },
];
const ok = [], log = []; const check = (n, c, e = '') => ok.push(`${c ? '✅' : '❌'} ${n} ${e}`);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); p.on('pageerror', (e) => log.push(e.message));
  let bonusCalls = 0;
  await p.route(/supabase\.co/, (route) => {
    const req = route.request(), url = req.url(), obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (/rpc\/add_bonus_reading/.test(url)) { bonusCalls++; return json(3); }
    if (/rpc\/student_verify_pin/.test(url)) return json(true);
    if (/rpc\/get_class_progress/.test(url)) return json([{ joined_today: 1, total_students: 2, class_pct: 50, communal_minutes: 45 }]);
    if (/\/rest\/v1\/logs/.test(url) && /log_date=eq/.test(url)) return obj ? json(logs[0]) : json([logs[0]]);
    if (/\/rest\/v1\/logs/.test(url)) return json(logs);
    if (/\/rest\/v1\/books/.test(url) && /is_completed=eq\.false/.test(url)) { const bk = { id: 'b1', title: '어린 왕자', author: '생텍쥐페리', cover_url: null, is_completed: false }; return obj ? json(bk) : json([bk]); }
    if (/\/rest\/v1\/rpc\//.test(url)) return json({ message: 'mock' }, 400);
    if (/\/rest\/v1\//.test(url)) return obj ? json({ message: 'none' }, 406) : json([]);
    return json({}, 400);
  });
  await p.addInitScript((s) => { localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_lib_tip', '1'); localStorage.setItem('saesak_lab3d_tip', '1'); localStorage.setItem('saesak_dress_stu-minsu', JSON.stringify({ g: 'boy', hs: 'short', hc: 1, sc: 0, b: 'shorts', bc: 0 })); }, session);
  await p.goto('http://localhost:4321/?debug=1&rtlocal=1');
  await p.waitForTimeout(600); await p.mouse.click(195, 400); await p.waitForTimeout(1500);
  await p.getByText('읽기', { exact: true }).click(); await p.waitForTimeout(2500);
  const t = (await p.locator('[data-extra]').textContent().catch(() => '')) || '';
  check('도서관: 오늘 30분 · 누적 45분', t.includes('오늘 30분') && t.includes('누적 45분'), t);
  await p.screenshot({ path: `${OUT}/extra-01-library.png` });
  await p.getByText('내 기록', { exact: true }).click(); await p.waitForTimeout(500);
  for (const k of ['1', '2', '3', '4', '✓']) await p.getByRole('button', { name: k, exact: true }).click();
  await p.waitForTimeout(800);
  const r = (await p.locator('[data-extra-total]').textContent().catch(() => '')) || '';
  check('내 기록: 누적 45분 · 오늘 30분', r.includes('누적 45분') && r.includes('오늘 30분'), r);
  await p.screenshot({ path: `${OUT}/extra-02-record.png` });
  console.log(ok.join('\n')); console.log('errors:', log.length ? log.slice(0, 5) : 'none');
  await b.close(); if (ok.some((l) => l.startsWith('❌'))) process.exit(1);
})().catch((e) => { console.error('TEST FAILED', e.message.slice(0, 300)); console.log(ok.join('\n')); process.exit(1); });
