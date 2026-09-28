// 업무 연결도 (3D): 분류 → 업무 → 단계를 입체 그물로, 업무끼리의 선후 관계는 화살표로.
// 노드 색은 상태 하나만 뜻함(위험·주의·순조). 분류는 큰 회색 구, 단계는 작은 점.
// 손가락/마우스로 돌리고 확대, 업무를 누르면 그 업무 화면으로.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { assess } from '../lib/briefing.js';
import { dueLabel, todayKST } from '../lib/date.js';
import { wouldCycle } from '../lib/links.js';

// 상태 색 (dataviz 기본 status 팔레트, 어두운 배경에서 모두 3:1 이상)
const STATUS = {
  critical: { color: '#d03b3b', icon: '●', label: '위험 (마감 지남·임박)' },
  warning: { color: '#fab219', icon: '▲', label: '주의 (방치·무응답·앞 업무 지연)' },
  good: { color: '#0ca30c', icon: '■', label: '순조' },
};
const CATEGORY_NODE = '#cbd5e1';
const STEP_NODE = '#64748b';
const LINK_DEP = '#93c5fd';
const BG = '#14161c';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (s, n = 14) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default function Graph3D({ tasks, categories, links, settings, reload, onOpen }) {
  const box = useRef(null);
  const graphRef = useRef(null);
  const [showSteps, setShowSteps] = useState(true);
  const [error, setError] = useState('');
  const today = todayKST();

  const tasksById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  const data = useMemo(() => {
    const nodes = [];
    const edges = [];
    const delayedBlocker = new Set(
      links.filter((l) => tasksById[l.from_task_id] && assess(tasksById[l.from_task_id], today, settings.neglect_days, settings.waiting_days).overdue)
        .map((l) => l.to_task_id),
    );
    for (const c of categories) {
      if (!tasks.some((t) => t.category_id === c.id)) continue;
      nodes.push({ id: `c:${c.id}`, kind: 'category', name: c.name, color: CATEGORY_NODE, val: 14 });
    }
    for (const t of tasks) {
      const i = assess(t, today, settings.neglect_days, settings.waiting_days);
      const state = i.overdue || i.dueSoon ? 'critical' : (i.neglected || i.noReply || delayedBlocker.has(t.id)) ? 'warning' : 'good';
      const done = t.steps?.filter((s) => s.done).length ?? 0;
      nodes.push({
        id: `t:${t.id}`, kind: 'task', taskId: t.id, name: t.title, color: STATUS[state].color, val: state === 'critical' ? 7 : 5,
        tip: `<b>${esc(t.title)}</b><br>${STATUS[state].icon} ${STATUS[state].label.split(' (')[0]}${i.due ? ` · ${dueLabel(i.due, today)}` : ''}<br>→ ${esc(t.waiting_on ? `${t.waiting_on} 대기` : t.next_action)}<br>단계 ${done}/${t.steps?.length ?? 0}`,
      });
      if (nodes.some((n) => n.id === `c:${t.category_id}`)) edges.push({ source: `c:${t.category_id}`, target: `t:${t.id}`, kind: 'belongs' });
      if (showSteps) {
        for (const s of t.steps ?? []) {
          nodes.push({ id: `s:${s.id}`, kind: 'step', name: s.title, color: STEP_NODE, val: s.done ? 0.6 : 1.2, tip: `${s.done ? '✓ ' : ''}${esc(s.title)}` });
          edges.push({ source: `t:${t.id}`, target: `s:${s.id}`, kind: 'step' });
        }
      }
    }
    for (const l of links) {
      if (tasksById[l.from_task_id] && tasksById[l.to_task_id]) {
        edges.push({ source: `t:${l.from_task_id}`, target: `t:${l.to_task_id}`, kind: 'dep' });
      }
    }
    return { nodes, links: edges };
  }, [tasks, categories, links, settings, showSteps, today, tasksById]);

  // 그래프 만들기 (한 번) + 크기 맞추기
  useEffect(() => {
    let disposed = false;
    let observer;
    (async () => {
      try {
        const [{ default: ForceGraph3D }, { default: SpriteText }] = await Promise.all([
          import('3d-force-graph'),
          import('three-spritetext'),
        ]);
        if (disposed || !box.current) return;
        const g = new ForceGraph3D(box.current, { controlType: 'orbit' })
          .backgroundColor(BG)
          .showNavInfo(false)
          .nodeLabel((n) => n.tip ?? esc(n.name))
          .nodeColor((n) => n.color)
          .nodeVal((n) => n.val)
          .nodeOpacity(0.95)
          .nodeThreeObjectExtend(true)
          .nodeThreeObject((n) => {
            if (n.kind === 'step') return null;
            const label = new SpriteText(short(n.name, n.kind === 'category' ? 10 : 14));
            label.color = n.kind === 'category' ? '#ffffff' : '#e8eaf0';
            label.textHeight = n.kind === 'category' ? 9 : 6;
            label.fontWeight = n.kind === 'category' ? 'bold' : 'normal';
            label.position.y = n.kind === 'category' ? 16 : 10;
            return label;
          })
          .linkColor((l) => (l.kind === 'dep' ? LINK_DEP : l.kind === 'belongs' ? '#475569' : '#334155'))
          .linkWidth((l) => (l.kind === 'dep' ? 2 : 0))
          .linkOpacity(0.6)
          .linkDirectionalArrowLength((l) => (l.kind === 'dep' ? 6 : 0))
          .linkDirectionalArrowRelPos(1)
          .linkDirectionalParticles((l) => (l.kind === 'dep' ? 3 : 0))
          .linkDirectionalParticleWidth(2)
          .linkDirectionalParticleColor(() => LINK_DEP)
          .onNodeClick((n) => {
            if (n.kind === 'task') onOpen(n.taskId);
            else {
              const d = 80 / Math.hypot(n.x || 1, n.y || 1, n.z || 1);
              g.cameraPosition({ x: n.x * (1 + d), y: n.y * (1 + d), z: n.z * (1 + d) }, n, 800);
            }
          });
        g.d3Force('charge').strength(-60);
        graphRef.current = g;
        const fit = () => {
          if (!box.current) return;
          g.width(box.current.clientWidth).height(box.current.clientHeight);
        };
        fit();
        observer = new ResizeObserver(fit);
        observer.observe(box.current);
        // 배치가 멈추면 전체가 화면에 꽉 차게 (처음 한 번)
        let fitted = false;
        g.cooldownTicks(120).onEngineStop(() => {
          if (!fitted && !disposed) {
            fitted = true;
            g.zoomToFit(500, 20);
          }
        });
        g.graphData(data);
        // 느린 기기에서 배치가 오래 걸리면 2초 뒤에도 한 번 맞춤
        setTimeout(() => !disposed && g.zoomToFit(500, 20), 2000);
      } catch (e) {
        setError(`이 기기에서는 3D 화면을 열 수 없어요 (${e.message}). 아래 연결 목록은 그대로 쓸 수 있어요.`);
      }
    })();
    return () => {
      disposed = true;
      observer?.disconnect();
      graphRef.current?._destructor?.();
      graphRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 데이터가 바뀌면 그래프만 갱신
  useEffect(() => {
    graphRef.current?.graphData(data);
  }, [data]);

  return (
    <section>
      <header className="page-head">
        <h1>업무 연결도</h1>
        <label className="toggle">
          <input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} />
          단계 보이기
        </label>
      </header>

      <div className="graph-wrap">
        {error ? <div className="graph-error">{error}</div> : <div ref={box} className="graph-box" aria-label="업무 연결 3D 그래프" />}
      </div>
      <ul className="graph-legend" aria-label="범례">
          {Object.values(STATUS).map((s) => (
            <li key={s.label}><span className="swatch" style={{ color: s.color }}>{s.icon}</span>{s.label}</li>
          ))}
          <li><span className="swatch" style={{ color: CATEGORY_NODE }}>⬤</span>분류</li>
          <li><span className="swatch" style={{ color: LINK_DEP }}>→</span>먼저 끝내야 할 업무</li>
      </ul>
      <p className="muted small">한 손가락(마우스)으로 돌리고, 두 손가락(휠)으로 확대해요. 업무 구를 누르면 그 업무가 열려요.</p>

      <LinkEditor tasks={tasks} links={links} tasksById={tasksById} reload={reload} />
    </section>
  );
}

// 연결 만들기·지우기 + 표로 보기 (3D를 못 보는 경우에도 전부 할 수 있게)
function LinkEditor({ tasks, links, tasksById, reload }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [msg, setMsg] = useState('');

  async function add() {
    setMsg('');
    if (!from || !to || from === to) return setMsg('서로 다른 두 업무를 골라 주세요.');
    if (links.some((l) => l.from_task_id === from && l.to_task_id === to)) return setMsg('이미 연결되어 있어요.');
    if (wouldCycle(from, to, links)) return setMsg('서로가 서로를 기다리는 고리가 생겨서 연결할 수 없어요.');
    try {
      await api.addLink(tasksById[from], tasksById[to]);
      setFrom('');
      setTo('');
      await reload();
    } catch (e) {
      setMsg(e.message.includes('task_links') ? '연결 기능을 쓰려면 schema_links.sql 을 한 번 실행해야 해요.' : `연결하지 못했어요: ${e.message}`);
    }
  }

  const visible = links.filter((l) => tasksById[l.from_task_id] && tasksById[l.to_task_id]);

  return (
    <div className="block stack">
      <h2>업무 연결하기</h2>
      <p className="muted small">“앞 업무”를 끝내야 “뒤 업무”를 할 수 있을 때 연결하세요. 앞 업무가 마감을 넘기면 뒤 업무에 주의 표시가 떠요.</p>
      <div className="row wrap">
        <select className="grow" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="앞 업무">
          <option value="">앞 업무 (먼저)</option>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <span aria-hidden="true">→</span>
        <select className="grow" value={to} onChange={(e) => setTo(e.target.value)} aria-label="뒤 업무">
          <option value="">뒤 업무 (나중)</option>
          {tasks.filter((t) => t.id !== from).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <button className="primary" disabled={!from || !to} onClick={add}>연결</button>
      </div>
      {msg && <p className="small">{msg}</p>}
      {visible.length > 0 && (
        <ul className="link-list">
          {visible.map((l) => (
            <li key={l.id}>
              <span className="grow">{tasksById[l.from_task_id].title} <b>→</b> {tasksById[l.to_task_id].title}</span>
              <button className="link" onClick={async () => { await api.removeLink(l.id); await reload(); }}>끊기</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
