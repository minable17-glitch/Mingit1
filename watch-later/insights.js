// 내 관심사 분석: 저장한 영상(카테고리·채널·제목·저장 시각·시청 여부)만으로 앱 안에서 계산
// 서버나 외부 AI 를 쓰지 않으므로 무료이고, 데이터가 밖으로 나가지 않음.

const MIN_ITEMS = 3;
const RECENT_DAYS = 14;

// 제목 키워드에서 뺄 흔한 말
const STOPWORDS = new Set(
  `영상 하는 하기 하고 해서 했다 하면 방법 진짜 정말 완전 그냥 이렇게 이거 그거 이것 저것 우리 나의 내가
   오늘 지금 모든 최고 가장 무조건 절대 처음 다시 같이 너무 많이 이번 함께 대한 위한 통해 있는 없는 되는
   쇼츠 shorts short ep 편 화 vlog official mv video the a an of and to in for on with is my your how what why`
    .split(/\s+/)
    .filter(Boolean),
);
const JOSA = /(에서|으로|에게|까지|부터|처럼|보다|이랑|하고|은|는|이|가|을|를|의|에|로|와|과|도|만)$/;

function keywordsOf(title) {
  const words = new Set();
  for (let w of String(title || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (w.length > 2 && /[가-힣]$/.test(w)) w = w.replace(JOSA, '');
    if (w.length < 2 || /^\d+$/.test(w) || STOPWORDS.has(w)) continue;
    words.add(w);
  }
  return words;
}

function countBy(list, keyFn) {
  const map = new Map();
  for (const x of list) {
    const k = keyFn(x);
    if (k == null) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

const TIME_SLOTS = [
  { name: '새벽', range: '0~6시', from: 0 },
  { name: '아침', range: '6~12시', from: 6 },
  { name: '오후', range: '12~18시', from: 12 },
  { name: '저녁·밤', range: '18~24시', from: 18 },
];

export function analyze(items, categoryName) {
  const total = items.length;
  const watched = items.filter((i) => i.watched_at).length;

  // 카테고리별: 저장 수, 본 수
  const byCategory = countBy(items, (i) => i.category_id ?? '').map(([id, count]) => {
    const seen = items.filter((i) => (i.category_id ?? '') === id && i.watched_at).length;
    return { id, name: categoryName(id || null), count, seen, rate: pct(seen, count) };
  });

  // 요즘 늘어난 관심사: 최근 2주 비중 - 그 전 비중
  const since = Date.now() - RECENT_DAYS * 86400000;
  const recent = items.filter((i) => new Date(i.created_at).getTime() >= since);
  const older = items.filter((i) => new Date(i.created_at).getTime() < since);
  let rising = null;
  if (recent.length >= 3 && older.length >= 3) {
    for (const c of byCategory) {
      if (!c.id) continue;
      const r = recent.filter((i) => i.category_id === c.id).length / recent.length;
      const o = older.filter((i) => i.category_id === c.id).length / older.length;
      if (r - o >= 0.15 && (!rising || r - o > rising.diff)) rising = { ...c, diff: r - o };
    }
  }

  // 저장만 하고 잘 안 보는 분야
  const neglected = byCategory
    .filter((c) => c.count >= 3 && c.rate < 30)
    .sort((a, b) => a.rate - b.rate || b.count - a.count)[0] ?? null;

  const channels = countBy(items, (i) => i.channel_title || null).slice(0, 5);

  const keywordCounts = new Map();
  for (const i of items) for (const w of keywordsOf(i.title)) keywordCounts.set(w, (keywordCounts.get(w) || 0) + 1);
  const keywords = [...keywordCounts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const slots = TIME_SLOTS.map((s) => ({ ...s, count: 0 }));
  for (const i of items) {
    const h = new Date(i.created_at).getHours();
    slots[Math.floor(h / 6)].count++;
  }
  const topSlot = [...slots].sort((a, b) => b.count - a.count)[0];

  return { total, watched, byCategory, rising, neglected, channels, keywords, slots, topSlot };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// 가로 막대 한 줄 (값은 항상 글자로도 보여 줌)
function bar(label, value, max, detail) {
  const w = max ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return `
    <div class="bar-row" title="${esc(label)}: ${esc(detail)}">
      <span class="bar-label">${esc(label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${w}%"></span></span>
      <span class="bar-value">${esc(detail)}</span>
    </div>`;
}

export function renderInsights(items, categoryName) {
  if (items.length < MIN_ITEMS) {
    return `
      <div class="empty">
        영상을 ${MIN_ITEMS}개 이상 저장하면 관심사를 분석해 드려요.<br />
        지금 ${items.length}개 저장했어요. <a href="#/">영상 추가하러 가기 →</a>
      </div>`;
  }

  const a = analyze(items, categoryName);
  const top = a.byCategory.find((c) => c.id) ?? a.byCategory[0];

  const sentences = [
    top && `가장 관심이 많은 분야는 <b>'${esc(top.name)}'</b>예요. 저장한 영상의 ${pct(top.count, a.total)}%를 차지해요.`,
    a.rising && `최근 2주 동안 <b>'${esc(a.rising.name)}'</b> 영상이 눈에 띄게 늘었어요.`,
    a.keywords.length && `제목에 <b>${a.keywords.slice(0, 3).map(([w]) => `'${esc(w)}'`).join(', ')}</b> 같은 말이 자주 나와요.`,
    a.neglected && `<b>'${esc(a.neglected.name)}'</b> 영상은 저장만 하고 잘 안 보는 편이에요 (본 비율 ${a.neglected.rate}%). 알림을 걸어 보는 건 어때요?`,
    a.topSlot.count && `주로 <b>${a.topSlot.name}</b>(${a.topSlot.range})에 영상을 저장해요.`,
  ].filter(Boolean);

  const maxCat = Math.max(...a.byCategory.map((c) => c.count));
  const maxCh = Math.max(0, ...a.channels.map(([, n]) => n));
  const maxSlot = Math.max(...a.slots.map((s) => s.count));

  return `
    <div class="stats">
      <div class="stat"><span class="stat-num">${a.total}</span><span class="stat-label">저장한 영상</span></div>
      <div class="stat"><span class="stat-num">${a.watched}</span><span class="stat-label">다 본 영상</span></div>
      <div class="stat"><span class="stat-num">${pct(a.watched, a.total)}%</span><span class="stat-label">본 비율</span></div>
    </div>

    <section class="card insight-summary">
      <h2>한눈에 보는 내 관심사</h2>
      <ul>${sentences.map((s) => `<li>${s}</li>`).join('')}</ul>
    </section>

    <section class="card">
      <h2>카테고리별 저장한 영상</h2>
      <div class="bars">
        ${a.byCategory.map((c) => bar(c.name, c.count, maxCat, `${c.count}개 · ${c.rate}% 봄`)).join('')}
      </div>
    </section>

    ${
      a.keywords.length
        ? `<section class="card">
             <h2>자주 나오는 키워드</h2>
             <div class="keywords">
               ${a.keywords.map(([w, n]) => `<span class="kw">${esc(w)} <span class="muted">${n}</span></span>`).join('')}
             </div>
           </section>`
        : ''
    }

    ${
      a.channels.length
        ? `<section class="card">
             <h2>자주 저장한 채널</h2>
             <div class="bars">${a.channels.map(([name, n]) => bar(name, n, maxCh, `${n}개`)).join('')}</div>
           </section>`
        : ''
    }

    <section class="card">
      <h2>영상을 저장하는 시간대</h2>
      <div class="bars">${a.slots.map((s) => bar(`${s.name}`, s.count, maxSlot, `${s.count}개`)).join('')}</div>
    </section>

    <p class="small muted center">분석은 이 기기 안에서만 계산돼요. 영상 정보가 외부로 나가지 않아요.</p>`;
}
