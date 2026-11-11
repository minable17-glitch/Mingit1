// 캐릭터 꾸미기 점검: 처음 들어오면 꾸미기 창이 저절로 열림 → 성별·머리·옷 고르기 → 저장(서버 호출 확인) →
// 정원·도서관 내 캐릭터가 바뀜 → 친구 화면에도 바뀐 모습 → 다시 바꾸면 친구 화면도 바뀜
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-dress.e2e.cjs
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const session = (id, nick) => JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id, nickname: nick } });
const saved = [], log = [], ok = [];
async function open(ctx, id, nick, log, dress) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log.push(`[${nick}] pageerror: ${e.message}`));
  await p.route(/supabase\.co/, (route) => {
    const req = route.request(), url = req.url(), obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (/rpc\/student_set_avatar/.test(url)) { saved.push(JSON.parse(req.postData() || '{}').p_avatar); return route.fulfill({ status: 204, body: '' }); }
    if (/rpc\/get_class_progress/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"joined_today":0,"total_students":2,"class_pct":0,"communal_minutes":0}]' });
    if (/\/rest\/v1\/rpc\//.test(url)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"mock"}' });
    if (/\/rest\/v1\//.test(url)) return route.fulfill({ status: obj ? 406 : 200, contentType: 'application/json', body: obj ? '{"message":"none"}' : '[]' });
    return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
  });
  await p.addInitScript(([s, d, sid]) => { localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_lab3d_tip', '1'); if (d) localStorage.setItem('saesak_dress_' + sid, d); }, [session(id, nick), dress ? JSON.stringify(dress) : '', id]);
  await p.goto('http://localhost:4321/?rtlocal=1&debug=1');
  await p.waitForTimeout(600); await p.mouse.click(195, 400); await p.waitForTimeout(800);
  return p;
}
(async () => {
  log.length = 0;
  const check = (name, cond, extra = '') => ok.push(`${cond ? '✅' : '❌'} ${name} ${extra}`);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const A = await open(ctx, 'stu-minsu', '민수', log, null);
  await A.waitForFunction('window.__garden3d && window.__garden3d.me', null, { timeout: 20000 });
  await A.getByText('내 캐릭터 꾸미기').waitFor({ timeout: 10000 }).catch(() => {});
  check('처음 들어오면 꾸미기 창이 저절로 열림', (await A.getByText('내 캐릭터 꾸미기').count()) > 0 && (await A.getByLabel('닫기').count()) === 0);
  await A.getByRole('button', { name: '👧 여자' }).click(); await A.waitForTimeout(600);
  await A.getByRole('button', { name: '양갈래' }).click();
  await A.getByLabel('머리 색 3번').click(); await A.getByLabel('윗옷 색 5번').click();
  await A.getByRole('button', { name: '치마' }).click(); await A.getByLabel('아래옷 색 4번').click();
  await A.waitForTimeout(1200); await A.screenshot({ path: `${OUT}/dress-01-modal.png` });
  await A.getByRole('button', { name: '이 모습으로 할래요' }).click(); await A.waitForTimeout(1200);
  const want = 'girl.pigtails.2.4.skirt.3';
  check('저장하면 서버에 보냄', JSON.stringify(saved[0]) === JSON.stringify({ g: 'girl', hs: 'pigtails', hc: 2, sc: 4, b: 'skirt', bc: 3 }), JSON.stringify(saved[0]));
  check('정원 내 캐릭터가 바뀜', (await A.evaluate(() => window.__garden3d.me.lookKey)) === want);
  check('창이 닫힘', (await A.getByText('내 캐릭터 꾸미기').count()) === 0);
  await A.screenshot({ path: `${OUT}/dress-02-garden.png` });
  await A.getByText('읽기', { exact: true }).click(); await A.waitForFunction('window.__lib3d && window.__lib3d._synced', null, { timeout: 15000 }).catch(async (e) => { await A.screenshot({ path: OUT + '/dress-fail.png' }); throw e; }); await A.waitForTimeout(1200);
  check('도서관 내 캐릭터도 같은 모습', (await A.evaluate(() => window.__lib3d.me.lookKey)) === want);
  check('도서관에서는 꾸미기 창이 다시 안 열림', (await A.getByText('내 캐릭터 꾸미기').count()) === 0);
  await A.screenshot({ path: `${OUT}/dress-03-library.png` });
  // 친구 화면
  const B = await open(ctx, 'stu-jiwoo', '지우', log, { g: 'boy', hs: 'short', hc: 0, sc: 3, b: 'pants', bc: 2 });
  await B.bringToFront(); await B.getByText('읽기', { exact: true }).click(); await B.waitForFunction('window.__lib3d && window.__lib3d._synced', null, { timeout: 15000 }).catch(async (e) => { await B.screenshot({ path: OUT + '/dress-failB.png' }); console.log('B:', await B.evaluate(() => [!!window.__lib3d, window.__lib3d && window.__lib3d._synced, document.body.innerText.slice(0, 200)])); throw e; }); await B.waitForTimeout(3000);
  const seen = () => B.evaluate(() => { const p = [...window.__lib3d.people.values()].find((q) => q.nick === '민수'); return p && p.lookKey; });
  check('친구 화면에 내가 고른 모습', (await seen()) === want, await seen());
  check('꾸미기를 한 친구(지우)는 처음 창이 안 열림', (await B.getByText('내 캐릭터 꾸미기').count()) === 0);
  // 다시 바꾸기
  await A.bringToFront(); await A.click('[data-dress]'); await A.waitForTimeout(500);
  check('꾸미기 버튼으로 다시 열림(닫기 있음)', (await A.getByLabel('닫기').count()) > 0);
  await A.getByLabel('윗옷 색 1번').click(); await A.getByRole('button', { name: '긴 머리' }).click(); await A.getByRole('button', { name: '이 모습으로 할래요' }).click(); await A.waitForTimeout(800);
  await B.bringToFront(); await B.waitForTimeout(4000);
  check('다시 바꾸면 친구 화면도 바뀜', (await seen()) === 'girl.long.2.0.skirt.3', await seen());
  await B.evaluate(() => { const w = window.__lib3d, p = [...w.people.values()].find((q) => q.nick === '민수'), q = p.avatar.root.position; w.me.avatar.root.position.set(q.x + 0.4, 0, q.z + 1.6); w.rig.snapTo(0.25); w._dirty = true; });
  await B.waitForTimeout(1500); await B.screenshot({ path: `${OUT}/dress-04-friend.png` });
  console.log(ok.join('\n')); console.log('errors:', log.length ? log.slice(0, 6) : 'none');
  await b.close();
})().catch(async (e) => { console.error('TEST FAILED', e.message.slice(0, 300)); console.log(ok.join('\n')); process.exit(1); });
