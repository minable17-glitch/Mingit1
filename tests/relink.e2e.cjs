// 다른 기기 로그인 점검: 같은 닉네임으로 다른 기기에서 로그인하면 이 기기 연결이 풀림 →
// 영어 오류(row-level security) 대신 "다시 참여" 화면(학급 코드·닉네임 채워짐)으로 안내되는지
// 실행: VITE_SUPABASE_URL=https://x.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 4321  (다른 창에서) node tests/relink.e2e.cjs
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const session = JSON.stringify({ role: 'student', classInfo: { id: 'class-demo', name: '3학년 2반', code: '숲123456', start_date: '2026-11-01', goal_pct: 80, daily_target_minutes: 10, challenge_days: 30 }, studentInfo: { id: 'stu-minsu', nickname: '민수' } });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'uid-phone', role: 'authenticated', exp: 4102444800 })}.sig`;
const auth = JSON.stringify({ access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: { id: 'uid-phone', aud: 'authenticated', role: 'authenticated' } });
const ok = [], log = [];
const check = (name, cond, extra = '') => ok.push(`${cond ? '✅' : '❌'} ${name} ${extra}`);
async function open(ctx, state) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => log.push(`pageerror: ${e.message}`));
  await p.route(/supabase\.co/, (route) => {
    const req = route.request(), url = req.url(), obj = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (/\/rest\/v1\/students\?.*auth_user_id=eq\.uid-phone/.test(url)) {
      state.checks++;
      return state.linked ? route.fulfill({ status: 200, contentType: 'application/json', body: '[{"id":"stu-minsu"}]' })
        : route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (/rpc\/get_class_progress/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"joined_today":0,"total_students":2,"class_pct":0,"communal_minutes":0}]' });
    if (/\/rest\/v1\/rpc\//.test(url)) return route.fulfill({ status: 400, contentType: 'application/json', body: '{"message":"mock"}' });
    if (/\/rest\/v1\//.test(url)) return route.fulfill({ status: obj ? 406 : 200, contentType: 'application/json', body: obj ? '{"message":"none"}' : '[]' });
    return route.fulfill({ status: 400, contentType: 'application/json', body: '{}' });
  });
  await p.addInitScript(([s, a]) => { localStorage.setItem('saesak_session', s); localStorage.setItem('sb-x-auth-token', a); localStorage.setItem('saesak_lab3d', '0'); localStorage.setItem('saesak_lab3d_tip', '1'); }, [session, auth]);
  await p.goto('http://localhost:4321/');
  await p.waitForTimeout(600); await p.mouse.click(195, 400); await p.waitForTimeout(1500);
  return p;
}
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  // 1) 아직 이 기기에 연결된 학생: 그대로 앱 사용
  const s1 = { linked: true, checks: 0 };
  const A = await open(ctx, s1);
  check('연결 확인을 서버에 물어봄', s1.checks >= 1, `(${s1.checks}회)`);
  check('연결돼 있으면 그대로 메인 화면', (await A.getByText('학생으로 참여').count()) === 0);
  // 2) 다른 기기에서 로그인함 → 앱으로 돌아오면(visibilitychange) 다시 참여 화면
  s1.linked = false;
  await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await A.waitForTimeout(1200);
  check('앱으로 돌아오면 다시 참여 화면으로', (await A.getByText('🧒 학생으로 참여').count()) > 0);
  check('학급 코드가 채워져 있음', (await A.locator('input').nth(0).inputValue()) === '숲123456');
  check('닉네임이 채워져 있음', (await A.locator('input').nth(1).inputValue()) === '민수');
  check('이유를 한국어로 알려줌', (await A.getByText('다른 기기에서 같은 닉네임으로 로그인').count()) > 0);
  check('영어 오류 없음', (await A.getByText('row-level').count()) === 0);
  await A.screenshot({ path: `${OUT}/relink-01.png` });
  // 3) 처음 열 때부터 연결이 풀려 있으면 바로 안내
  const B = await open(ctx, { linked: false, checks: 0 });
  check('처음부터 풀려 있으면 바로 다시 참여 화면', (await B.getByText('🧒 학생으로 참여').count()) > 0);
  console.log(ok.join('\n')); console.log('errors:', log.length ? log.slice(0, 6) : 'none');
  await b.close();
  if (ok.some((l) => l.startsWith('❌'))) process.exit(1);
})().catch((e) => { console.error('TEST FAILED', e.message.slice(0, 300)); console.log(ok.join('\n')); process.exit(1); });
