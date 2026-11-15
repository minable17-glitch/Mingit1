// 선생님 함께 읽기 점검: 반 관리 스위치 → 선생님 계정 그대로 읽기 버튼·내 캐릭터 → 정원 가운데 '선생님 나무' →
// 학생 화면에도 선생님 나무(누르면 창) → 랭킹에는 선생님이 없음 → 스위치 끄면 선생님 나무 사라짐
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/lab3d-teacher.e2e.cjs
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const CLASS = { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 };
const roster = [
  ...['지우', '서연', '민수', '하준'].map((n, i) => ({ id: `stu-0${i + 1}`, nickname: n, total_days: [2, 5, 9, 14][i], communal_minutes: 0, total_pages: 0, equipped_accessories: [], created_at: `2026-10-0${i + 1}T00:00:00Z`, is_teacher: false })),
  { id: 'tch-reader', nickname: '선생님', total_days: 20, communal_minutes: 0, total_pages: 0, equipped_accessories: ['crown'], created_at: '2026-11-02T00:00:00Z', is_teacher: true },
];
const state = { reads: true, calls: [] };
async function open(ctx, sess, log) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log.push('pageerror: ' + e.message));
  await p.route(/supabase\.co/, (route) => {
    const req = route.request(), url = decodeURIComponent(req.url()), obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (/rpc\/set_teacher_reads/.test(url)) { const b = JSON.parse(req.postData() || '{}'); state.reads = b.p_on; state.calls.push('set:' + b.p_on); return route.fulfill({ status: 204, body: '' }); }
    if (/rpc\/teacher_reader_enter/.test(url)) { state.calls.push('enter'); return state.reads ? json([{ id: 'tch-reader', nickname: '선생님' }]) : json({ message: '선생님 함께 읽기가 꺼져 있어요' }, 400); }
    if (/rpc\/get_class_progress/.test(url)) return json([{ joined_today: 1, total_students: 4, class_pct: 20, communal_minutes: 0 }]);
    if (/rest\/v1\/classes/.test(url) && /select=teacher_reads/.test(url)) return json(obj ? { teacher_reads: state.reads } : [{ teacher_reads: state.reads }]);
    if (/rest\/v1\/classes/.test(url)) return json(obj ? CLASS : [CLASS]);
    if (/rest\/v1\/students/.test(url) && /total_days/.test(url)) return json(roster);
    if (/rest\/v1\/books/.test(url) && /is_completed=eq\.false/.test(url)) { const bk = { id: 'b1', title: '어린 왕자', author: '생텍쥐페리', is_completed: false }; return json(obj ? bk : [bk]); }
    if (/\/rest\/v1\/rpc\//.test(url)) return json({ message: 'mock' }, 400);
    if (/\/rest\/v1\//.test(url)) return obj ? json({ message: 'none' }, 406) : json([]);
    return json({}, 400);
  });
  await p.addInitScript(([s]) => { localStorage.setItem('saesak_session', s); localStorage.setItem('saesak_lib_tip', '1');
    for (const id of ['tch-reader', 'stu-03']) localStorage.setItem('saesak_dress_' + id, JSON.stringify({ g: 'girl', hs: 'long', hc: 0, sc: 3, b: 'pants', bc: 2 })); }, [sess]);
  await p.goto('http://localhost:4321/?rtlocal=1&debug=1');
  await p.waitForTimeout(600); await p.mouse.click(195, 400); await p.waitForTimeout(800);
  return p;
}
(async () => {
  const log = [], ok = [];
  const check = (name, cond, extra = '') => { ok.push(`${cond ? '✅' : '❌'} ${name} ${extra}`); console.log(ok[ok.length - 1]); };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const T = await open(ctx, JSON.stringify({ role: 'teacher', classInfo: CLASS }), log);
  await T.waitForFunction('window.__garden3d && window.__garden3d.me', null, { timeout: 30000, polling: 300 }).catch(async (e) => { await T.screenshot({ path: OUT + '/teacher-fail.png' }); console.log('dbg', state.calls, await T.evaluate(() => [!!window.__garden3d, window.__garden3d && !!window.__garden3d.me, document.body.innerText.slice(0, 160)]), log); throw e; });
  await T.waitForFunction('window.__garden3d.garden.trees.find((t) => t.teacher).bed.visible', null, { timeout: 15000, polling: 300 }).catch(() => {});
  const tinfo = () => T.evaluate(() => { const w = window.__garden3d, i = w.garden.trees.findIndex((t) => t.teacher), s = w.slots[i]; return { bed: w.garden.trees[i].bed.visible, nick: s && s.nick, me: s && s.me, stage: s && s.stage }; });
  const t1 = await tinfo();
  check('선생님 계정: 정원 가운데 선생님 나무(내 나무로)', t1.bed && t1.nick === '선생님' && t1.me, JSON.stringify(t1));
  check('선생님 나무는 학생 화분에 안 섞임', await T.evaluate(() => !window.__garden3d.slots.slice(0, window.__garden3d.studentSlots).some((s) => s && s.id === 'tch-reader')));
  await T.evaluate(() => document.querySelector('[data-view="top"]').click()); await T.waitForTimeout(2500);
  await T.screenshot({ path: `${OUT}/teacher-01-garden.png` });
  // 도서관: 선생님도 읽기 버튼
  await T.getByText('읽기', { exact: true }).click(); await T.waitForFunction('window.__lib3d && window.__lib3d._synced', null, { timeout: 20000, polling: 300 }); await T.waitForTimeout(1200);
  check('선생님도 10분 읽기 버튼', (await T.getByText(/10분 읽기 시작|이어서 읽기/).count()) > 0);
  check('도서관에 선생님 캐릭터(조이스틱·꾸미기)', (await T.locator('[data-joystick]').count()) > 0 && (await T.locator('[data-dress]').count()) > 0);
  await T.screenshot({ path: `${OUT}/teacher-02-library.png` });
  // 랭킹: 선생님은 없음
  await T.getByText('랭킹', { exact: true }).click(); await T.waitForTimeout(1500);
  check('랭킹에 선생님 없음', !(await T.evaluate(() => /선생님/.test([...document.querySelectorAll('div')].map((d) => d.childElementCount === 0 ? d.textContent : '').join('|')))));
  // 반 관리 스위치 끄기
  await T.getByText('반 관리').first().click(); await T.waitForTimeout(600);
  check('반 관리에 선생님도 함께 읽기 스위치(켜짐)', (await T.locator('[data-teacher-reads]').getAttribute('aria-checked')) === 'true');
  await T.screenshot({ path: `${OUT}/teacher-03-switch.png` });
  await T.click('[data-teacher-reads]'); await T.waitForTimeout(1200);
  check('끄면 서버에 꺼짐 저장', state.calls.includes('set:false'), state.calls.join(','));
  await T.mouse.click(206, 40); await T.waitForTimeout(500);
  await T.getByText('숲', { exact: true }).first().click(); await T.waitForFunction('window.__garden3d', null, { timeout: 20000, polling: 300 }); await T.waitForTimeout(2500);
  check('끄면 선생님 나무 사라짐', !(await T.evaluate(() => window.__garden3d.garden.trees.find((t) => t.teacher).bed.visible)));
  check('끄면 선생님 캐릭터 없음(조이스틱은 둘러보기용으로 남음)', !(await T.evaluate(() => window.__garden3d.slots.some((s) => s && s.me))));
  // 학생 화면: 선생님 나무가 보이고 누르면 창
  state.reads = true;
  const S = await open(ctx, JSON.stringify({ role: 'student', classInfo: CLASS, studentInfo: { id: 'stu-03', nickname: '민수' } }), log);
  await S.waitForFunction('window.__garden3d && window.__garden3d.slots.filter((s) => s && s.id).length >= 5', null, { timeout: 30000, polling: 300 }).catch(async (e) => { await S.screenshot({ path: OUT + '/teacher-failS.png' }); console.log('dbgS', JSON.stringify(await S.evaluate(() => [!!window.__garden3d, window.__garden3d && window.__garden3d.slots.filter((s) => s && s.id).map((s) => s.nick), document.body.innerText.slice(0, 150)]))); throw e; });
  const sv = await S.evaluate(() => { const w = window.__garden3d, i = w.garden.trees.findIndex((t) => t.teacher), s = w.slots[i]; return { bed: w.garden.trees[i].bed.visible, nick: s && s.nick, me: s && s.me }; });
  check('학생 화면에도 선생님 나무', sv.bed && sv.nick === '선생님' && !sv.me, JSON.stringify(sv));
  await S.evaluate(() => document.querySelector('[data-view="top"]').click()); await S.waitForTimeout(2500);
  const [x, y] = await S.evaluate(() => { const w = window.__garden3d, t = w.garden.trees.find((q) => q.teacher), v = new (w.camera.position.constructor)(t.x, 0.3, t.z).project(w.camera), r = w.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; });
  await S.mouse.click(x, y); await S.waitForTimeout(800);
  check('학생이 선생님 나무를 누르면 창', /선생님/.test(await S.evaluate(() => document.body.innerText)) && /누적 \d+일/.test(await S.evaluate(() => document.body.innerText)));
  await S.screenshot({ path: `${OUT}/teacher-04-student.png` });
  console.log(ok.join('\n')); console.log('errors:', log.length ? log.slice(0, 6) : 'none');
  await b.close();
})().catch((e) => { console.error('TEST FAILED', e.message.slice(0, 300), e.stack.split('\n').find((l) => l.includes('teacher.e2e')) ); process.exit(1); });
