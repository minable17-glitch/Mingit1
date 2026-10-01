// 업무 밸런스: 업무마다 캐릭터(업무 친구) — 챙길수록 크고, 오래 안 챙기면 작아지고 졸고, 급하면 땀을 흘림.
// 아래 '숫자로 자세히'에는 균형 점수·저울, 업무 지도(급함 × 남은 단계), 분류별·날짜별 부담.
// 색은 상태만 뜻함(위험·주의·순조) + 모양(●▲■)과 글자로 함께 표시.
import { useMemo, useState } from 'react';
import * as api from '../lib/api.js';
import { analyzeBalance, HEAVY_LOAD, quadrantOf, QUADRANTS } from '../lib/balance.js';
import { buddyOf, moodCounts, MOODS } from '../lib/buddies.js';
import Buddy from './Buddy.jsx';
import { dueLabel, todayKST } from '../lib/date.js';

const STATE = {
  critical: { icon: '●', label: '위험', hint: '마감 지남·임박' },
  warning: { icon: '▲', label: '주의', hint: '못 챙김·무응답·앞 업무 지연' },
  good: { icon: '■', label: '순조', hint: '' },
};
const ORDER = ['critical', 'warning', 'good'];

export default function Balance({ tasks, categories, settings, links = [], onOpen, onOpenScreen, reload }) {
  const today = todayKST();
  const b = useMemo(() => analyzeBalance(tasks, categories, settings, links, today), [tasks, categories, settings, links, today]);

  if (!tasks.length) {
    return (
      <section>
        <header className="page-head"><h1>업무 친구들</h1></header>
        <p className="muted">진행 중인 업무가 없어요. 업무를 등록하면 업무마다 친구가 한 명씩 생겨요.</p>
      </section>
    );
  }

  return (
    <section className="viz-root">
      <header className="page-head"><h1>업무 친구들</h1></header>
      <Garden b={b} categories={categories} settings={settings} onOpen={onOpen} reload={reload} />

      <details className="more-stats">
        <summary>📊 숫자로 자세히 보기 (균형 점수·업무 지도·2주 마감)</summary>
        <ScaleHero b={b} neglectDays={settings.neglect_days} />
        <Meters b={b} />
        <TaskMap points={b.points} today={today} onOpen={onOpen} />
        <CategoryBalance rows={b.byCategory} onOpen={onOpen} />
        <TwoWeeks days={b.days} overdue={b.overdueItems} />
      </details>

      <button className="link" onClick={() => onOpenScreen({ type: 'graph' })}>🔗 업무 연결(먼저 끝낼 업무) 관리 · 3D로 보기 →</button>
    </section>
  );
}

// 업무 친구 정원: 분류마다 한 줄, 챙길수록 크고 오래 안 챙기면 작아지고 졸아요
const MOOD_ORDER = ['panic', 'worried', 'sleepy', 'waiting', 'calm', 'happy'];

function Garden({ b, categories, settings, onOpen, reload }) {
  const [sel, setSel] = useState(null);
  const [justDone, setJustDone] = useState(null);
  const buddies = useMemo(
    () => b.points.map((p) => ({ ...p, ...buddyOf(p, settings.neglect_days) })),
    [b.points, settings.neglect_days],
  );
  const counts = moodCounts(buddies);
  const rows = categories
    .map((c) => ({ c, items: buddies.filter((x) => x.task.category_id === c.id).sort((x, y) => MOOD_ORDER.indexOf(x.mood) - MOOD_ORDER.indexOf(y.mood)) }))
    .filter((r) => r.items.length);
  const picked = buddies.find((x) => x.task.id === sel);
  const needCare = counts.sleepy + counts.waiting;
  const headline = counts.panic + counts.worried > 0
    ? `땀 흘리는 친구 ${counts.panic + counts.worried}명이 급해요.${needCare ? ` 시든 친구도 ${needCare}명 있어요.` : ''}`
    : needCare > 0 ? `시든 친구 ${needCare}명이 챙겨 주길 기다려요.` : '모두 잘 지내고 있어요!';

  async function complete(task) {
    try {
      await api.completeTask(task);
      setSel(null);
      setJustDone(task);
      await reload();
    } catch (e) {
      alert(`완료하지 못했어요: ${e.message}`);
    }
  }
  async function undo() {
    const task = justDone;
    setJustDone(null);
    await api.reopenTask(task);
    await reload();
  }

  return (
    <>
      <div className="garden-head block">
        <p className="garden-headline">{headline}</p>
        <ul className="mood-chips">
          {MOOD_ORDER.slice().reverse().filter((m) => counts[m] > 0).map((m) => (
            <li key={m}>{MOODS[m].emoji} {MOODS[m].label} <b>{counts[m]}</b></li>
          ))}
        </ul>
        <p className="small muted">
          크게 = 최근에 챙김 · 작게·졸림 = {settings.neglect_days}일 넘게 못 챙김 · 땀 = 마감 임박 · 왼쪽 위 숫자 = 남은 단계.
          단계를 체크하거나 메모를 남기면 다시 커져요.
        </p>
      </div>

      {justDone && (
        <div className="undo-bar" role="status">
          <span className="grow">🎉 “{justDone.title}” 완료! 보관함으로 보냈어요.</span>
          <button className="link" onClick={undo}>되돌리기</button>
        </div>
      )}

      {rows.map(({ c, items }) => (
        <div key={c.id} className="garden block" style={{ '--c': c.color }}>
          <div className="garden-title"><span className="dot" style={{ background: c.color }} aria-hidden="true" />{c.name} <span className="muted small">{items.length}</span></div>
          <ul className="garden-row">
            {items.map((x, i) => (
              <li key={x.task.id}>
                <button
                  type="button"
                  className={`buddy${sel === x.task.id ? ' on' : ''}`}
                  onClick={() => setSel(sel === x.task.id ? null : x.task.id)}
                  aria-label={`${x.task.title}: ${MOODS[x.mood].label}`}
                >
                  <Buddy color={c.color} mood={x.mood} boxes={x.boxes} size={x.size} delay={(i * 0.37) % 2} />
                  <span className="buddy-name">{x.task.title}</span>
                  {(x.info.due || x.info.neglected || x.info.noReply) && (
                    <span className={`buddy-tag ${x.info.overdue || x.info.dueSoon ? 'hot' : ''}`}>
                      {x.info.due ? dueLabel(x.info.due, todayKST()) : x.info.noReply ? `${x.info.waitDays}일 무응답` : `${x.info.idle}일 방치`}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {picked && picked.task.category_id === c.id && (
            <div className="map-card buddy-card">
              <div className="row">
                <span className="buddy-emoji" aria-hidden="true">{MOODS[picked.mood].emoji}</span>
                <b className="grow">{picked.task.title}</b>
              </div>
              <p className="small">{picked.message}</p>
              <p className="small muted">→ 다음 행동: {picked.task.waiting_on ? `${picked.task.waiting_on} 기다리기` : picked.task.next_action}</p>
              <div className="row wrap">
                <button className="primary" onClick={() => onOpen(picked.task.id)}>업무 열기 →</button>
                <button className="done-btn" onClick={() => complete(picked.task)}>✓ 완료</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// 저울: 못 챙긴·밀린 업무가 많을수록 오른쪽으로 기움
function ScaleHero({ b, neglectDays }) {
  const W = 300;
  const cx = W / 2;
  const top = 58;
  const arm = 110;
  const rad = (b.scale.tilt * Math.PI) / 180;
  const left = { x: cx - arm * Math.cos(rad), y: top - arm * Math.sin(rad) };
  const right = { x: cx + arm * Math.cos(rad), y: top + arm * Math.sin(rad) };
  const pan = (p, text, n, cls) => (
    <g className={cls}>
      <line x1={p.x} y1={p.y} x2={p.x - 22} y2={p.y + 26} />
      <line x1={p.x} y1={p.y} x2={p.x + 22} y2={p.y + 26} />
      <path d={`M${p.x - 30},${p.y + 26} h60 a30,10 0 0 1 -60,0 z`} />
      <text x={p.x} y={p.y + 54} textAnchor="middle" className="scale-num">{n}</text>
      <text x={p.x} y={p.y + 70} textAnchor="middle" className="scale-cap">{text}</text>
    </g>
  );
  return (
    <div className="block balance-hero">
      <div className="hero-score">
        <span className="hero-num">{b.score}</span>
        <span className="hero-unit">/ 100</span>
        <span className={`hero-level ${b.score >= 80 ? 'ok' : b.score >= 60 ? 'mid' : 'low'}`}>{b.level}</span>
      </div>
      <svg viewBox={`0 0 ${W} 150`} className="scale-svg" role="img"
        aria-label={`균형 저울: 챙기는 업무 ${b.scale.cared}개, 밀린 업무 ${b.scale.behind}개, ${b.scale.tilt}도 기울어짐`}>
        <path className="scale-post" d={`M${cx},${top} L${cx - 16},${top + 76} h32 z`} />
        <line className="scale-beam" x1={left.x} y1={left.y} x2={right.x} y2={right.y} />
        <circle className="scale-pivot" cx={cx} cy={top} r="5" />
        {pan(left, '챙기는 중', b.scale.cared, 'pan pan-cared')}
        {pan(right, '밀림', b.scale.behind, 'pan pan-behind')}
      </svg>
      {b.notes.length ? (
        <ul className="hero-notes">
          {b.notes.map((n) => <li key={n.kind}>{n.kind === 'forgotten' ? '▲' : '●'} {n.text}</li>)}
        </ul>
      ) : (
        <p className="small muted">못 챙긴 업무도, 몰린 마감도 없어요. 지금처럼만 하면 돼요.</p>
      )}
      <p className="small muted">
        {neglectDays}일 넘게 손대지 않은 업무·회신이 없는 업무·마감 지난 업무가 많을수록 점수가 내려가고 저울이 기울어요.
      </p>
    </div>
  );
}

function Meters({ b }) {
  const pct = (r) => `${Math.round(r * 100)}%`;
  const items = [
    { key: 'forgotten', title: '소홀', value: b.counts.forgotten, sub: `업무량의 ${pct(b.ratios.forgotten)}를 못 챙김`, bad: b.counts.forgotten > 0 },
    { key: 'urgent', title: '급함', value: b.counts.urgent, sub: '마감 지남·3일 안', bad: b.counts.urgent > 0 },
    { key: 'heavy', title: '과중', value: b.counts.heavy, sub: `남은 단계 ${HEAVY_LOAD}개 이상`, bad: b.counts.heavy > 0 },
  ];
  return (
    <div className="meters">
      {items.map((m) => (
        <div key={m.key} className={`meter ${m.bad ? 'bad' : ''}`}>
          <span className="meter-title">{m.title}</span>
          <span className="meter-value">{m.value}<small>개</small></span>
          <span className="meter-sub">{m.sub}</span>
        </div>
      ))}
    </div>
  );
}

// 업무 지도: 가로 = 급한 정도, 세로 = 남은 단계 수
const MAP = { w: 340, h: 250, l: 40, r: 10, t: 12, b: 38 };
const LOAD_MAX = 10;
const xOf = (u) => MAP.l + u * (MAP.w - MAP.l - MAP.r);
const yOf = (load) => {
  const v = Math.min(load, LOAD_MAX);
  return MAP.h - MAP.b - ((Math.sqrt(v) - 1) / (Math.sqrt(LOAD_MAX) - 1)) * (MAP.h - MAP.t - MAP.b);
};

// 같은 자리에 겹치는 점은 조금씩 비켜 놓기
function place(points) {
  const placed = [];
  for (const p of points) {
    let x = xOf(p.urgency);
    let y = yOf(p.load);
    for (let k = 1; placed.some((q) => Math.hypot(q.x - x, q.y - y) < 13) && k < 40; k++) {
      const a = k * 2.4;
      const r = 6 + k * 1.6;
      x = Math.min(MAP.w - MAP.r - 6, Math.max(MAP.l + 6, xOf(p.urgency) + r * Math.cos(a)));
      y = Math.min(MAP.h - MAP.b - 6, Math.max(MAP.t + 6, yOf(p.load) + r * Math.sin(a)));
    }
    placed.push({ ...p, x, y });
  }
  return placed;
}

function Mark({ p }) {
  const cls = `mark st-${p.state}${p.unknownSize ? ' hollow' : ''}`;
  if (p.state === 'critical') return <circle className={cls} cx={p.x} cy={p.y} r="6.5" />;
  if (p.state === 'warning') return <path className={cls} d={`M${p.x},${p.y - 7.5} L${p.x + 7.5},${p.y + 5.5} L${p.x - 7.5},${p.y + 5.5} Z`} />;
  return <rect className={cls} x={p.x - 5.5} y={p.y - 5.5} width="11" height="11" rx="1.5" />;
}

function TaskMap({ points, today, onOpen }) {
  const [sel, setSel] = useState(null);
  const placed = useMemo(() => place([...points].sort((a, b) => b.load - a.load)), [points]);
  const picked = placed.find((p) => p.task.id === sel);
  const splitX = xOf(0.78);
  const splitY = yOf(HEAVY_LOAD - 0.5);
  const xTicks = [
    { u: 0.04, t: '마감 없음' }, { u: 0.36, t: '2주' }, { u: 0.64, t: '1주' }, { u: 0.8, t: '3일' }, { u: 1, t: '지남' },
  ];
  const yTicks = [1, 2, 4, 7, 10];
  const groups = Object.keys(QUADRANTS).map((q) => ({ q, items: points.filter((p) => quadrantOf(p) === q) }));

  return (
    <div className="block stack">
      <h2>업무 지도 <span className="muted small">급한가 × 일이 많은가</span></h2>
      <ul className="bal-legend" aria-label="범례">
        {ORDER.map((k) => <li key={k}><span className={`sw st-${k}`} aria-hidden="true">{STATE[k].icon}</span> {STATE[k].label}{STATE[k].hint && <span className="muted"> ({STATE[k].hint})</span>}</li>)}
        <li><span className="sw hollow-sw" aria-hidden="true">○</span> 단계 미정</li>
      </ul>
      <svg viewBox={`0 0 ${MAP.w} ${MAP.h}`} className="map-svg" role="img" aria-label="업무 지도: 오른쪽일수록 급하고 위쪽일수록 남은 단계가 많아요">
        <rect className="quad-hot" x={splitX} y={MAP.t} width={MAP.w - MAP.r - splitX} height={splitY - MAP.t} />
        <line className="grid" x1={splitX} y1={MAP.t} x2={splitX} y2={MAP.h - MAP.b} />
        <line className="grid" x1={MAP.l} y1={splitY} x2={MAP.w - MAP.r} y2={splitY} />
        <line className="axis" x1={MAP.l} y1={MAP.h - MAP.b} x2={MAP.w - MAP.r} y2={MAP.h - MAP.b} />
        <text className="quad-label" x={MAP.w - MAP.r - 4} y={MAP.t + 12} textAnchor="end">{QUADRANTS.focus.label}</text>
        <text className="quad-label" x={MAP.w - MAP.r - 4} y={splitY + 13} textAnchor="end">{QUADRANTS.quick.label}</text>
        <text className="quad-label" x={MAP.l + 4} y={MAP.t + 12}>{QUADRANTS.split.label}</text>
        <text className="quad-label" x={MAP.l + 4} y={splitY + 13}>{QUADRANTS.later.label}</text>
        {xTicks.map((t) => <text key={t.t} className="tick" x={xOf(t.u)} y={MAP.h - MAP.b + 14} textAnchor={t.u > 0.95 ? 'end' : t.u < 0.1 ? 'start' : 'middle'}>{t.t}</text>)}
        <text className="axis-title" x={(MAP.l + MAP.w) / 2} y={MAP.h - 4} textAnchor="middle">여유 ← 마감까지 → 급함</text>
        {yTicks.map((v) => <text key={v} className="tick" x={MAP.l - 6} y={yOf(v) + 4} textAnchor="end">{v === LOAD_MAX ? `${v}+` : v}</text>)}
        <text className="axis-title" transform={`translate(11 ${(MAP.t + MAP.h - MAP.b) / 2}) rotate(-90)`} textAnchor="middle">남은 단계</text>
        {placed.map((p) => (
          <g key={p.task.id} className={sel === p.task.id ? 'pt on' : 'pt'}>
            <Mark p={p} />
            <circle className="hit" cx={p.x} cy={p.y} r="13" onClick={() => setSel(sel === p.task.id ? null : p.task.id)}>
              <title>{p.task.title}</title>
            </circle>
          </g>
        ))}
      </svg>
      {picked ? (
        <div className="map-card">
          <b>{picked.task.title}</b>
          <p className="small">
            {STATE[picked.state].icon} {STATE[picked.state].label}
            {picked.info.due && ` · ${dueLabel(picked.info.due, today)}`}
            {' · '}{picked.unknownSize ? '단계 미정 (단계를 정하면 크기가 보여요)' : `남은 단계 ${picked.load}개`}
            {picked.info.neglected && ` · ${picked.info.idle}일째 손 안 댐`}
            {picked.info.noReply && ` · ${picked.info.waitDays}일째 무응답`}
          </p>
          <p className="small muted">{QUADRANTS[quadrantOf(picked)].label}: {QUADRANTS[quadrantOf(picked)].hint}</p>
          <button className="primary" onClick={() => onOpen(picked.task.id)}>업무 열기 →</button>
        </div>
      ) : (
        <p className="small muted">점을 누르면 어떤 업무인지 보여요. 오른쪽 위(지금 집중)에 점이 몰리면 과부하예요.</p>
      )}
      <details>
        <summary className="small">칸별 목록으로 보기</summary>
        {groups.map(({ q, items }) => (
          <div key={q} className="small quad-list">
            <b>{QUADRANTS[q].label}</b> <span className="muted">({items.length})</span>
            {items.length > 0 && (
              <ul>
                {items.map((p) => (
                  <li key={p.task.id}>
                    <button className="link" onClick={() => onOpen(p.task.id)}>{STATE[p.state].icon} {p.task.title}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </details>
    </div>
  );
}

// 분류별: 막대 길이 = 남은 업무량(단계 수), 색 = 상태
function CategoryBalance({ rows, onOpen }) {
  const [open, setOpen] = useState(null);
  const max = Math.max(...rows.map((r) => r.total), 1);
  const avg = rows.reduce((s, r) => s + r.total, 0) / (rows.length || 1);
  return (
    <div className="block stack">
      <h2>분류별 균형 <span className="muted small">막대 길이 = 남은 업무량</span></h2>
      <ul className="bal-rows">
        {rows.map((r) => (
          <li key={r.category.id}>
            <button type="button" className="bal-row" aria-expanded={open === r.category.id} onClick={() => setOpen(open === r.category.id ? null : r.category.id)}>
              <span className="bal-name"><span className="dot" style={{ background: r.category.color }} aria-hidden="true" />{r.category.name}</span>
              <span className="bal-track">
                <span className="bal-bar" style={{ width: `${(r.total / max) * 100}%` }}>
                  {ORDER.filter((k) => r.load[k] > 0).map((k) => (
                    <span key={k} className={`bal-seg st-bg-${k}`} style={{ flexGrow: r.load[k] }} title={`${STATE[k].label} ${r.load[k]}`} />
                  ))}
                </span>
                <span className="bal-value">
                  {r.total}
                  {r.forgotten.length > 0 && <span className="bal-flag"> ▲{r.forgotten.length}</span>}
                </span>
              </span>
            </button>
            {open === r.category.id && (
              <div className="bal-detail small">
                <p>
                  업무 {r.tasks}개 · 남은 단계 {r.total}
                  {rows.length > 1 && r.total >= avg * 1.5 && ' · 다른 분류보다 많이 몰려 있어요'}
                  {' · '}{ORDER.map((k) => `${STATE[k].icon} ${STATE[k].label} ${r.load[k]}`).join(' · ')}
                </p>
                {r.forgotten.length > 0 && (
                  <p>
                    못 챙긴 업무:{' '}
                    {r.forgotten.map((p, i) => (
                      <span key={p.task.id}>{i > 0 && ', '}<button className="link" onClick={() => onOpen(p.task.id)}>{p.task.title}</button></span>
                    ))}
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="small muted">▲숫자 = 오래 손대지 않은 업무 수. 누르면 자세히 보여요.</p>
    </div>
  );
}

// 앞으로 2주: 날짜별 마감 수 (3개 이상이면 몰림 표시)
function TwoWeeks({ days, overdue }) {
  const max = Math.max(3, ...days.map((d) => d.count));
  return (
    <div className="block stack">
      <h2>앞으로 2주 마감 <span className="muted small">업무·단계 마감 수</span></h2>
      {overdue > 0 && <p className="small">● 이미 지난 마감 {overdue}개</p>}
      <div className="days" role="list">
        {days.map((d) => (
          <div key={d.date} role="listitem" className={`day${d.weekend ? ' weekend' : ''}${d.count >= 3 ? ' peak' : ''}`}
            aria-label={`${d.label} 마감 ${d.count}개${d.count >= 3 ? ', 몰림' : ''}`}>
            <span className="day-count">{d.count > 0 ? (d.count >= 3 ? `▲${d.count}` : d.count) : ''}</span>
            <span className="day-bar-wrap"><span className="day-bar" style={{ height: `${(d.count / max) * 100}%` }} /></span>
            <span className="day-label">{d.label.split('/')[1].replace(/\(.\)/, '')}<br />{d.weekday}</span>
          </div>
        ))}
      </div>
      <p className="small muted">▲ = 하루에 마감이 3개 이상 몰린 날. 그 전에 미리 몇 개를 끝내 두면 좋아요.</p>
    </div>
  );
}
