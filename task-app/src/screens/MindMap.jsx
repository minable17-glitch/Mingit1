// 마인드맵: 나의 업무 → 분류 → 업무 → 단계, 그리고 나의 원칙.
// 분류를 누르면 접기·펼치기, 업무를 누르면 단계 펼치기, ↗ 를 누르면 업무가 열려요.
// 먼저 끝내야 하는 업무 연결은 파란 점선 화살표.
import { useMemo, useState } from 'react';
import { assess } from '../lib/briefing.js';
import { taskState } from '../lib/balance.js';
import { todayKST } from '../lib/date.js';
import { buildTree, dependencyPath, edgePath, layoutTree } from '../lib/mindmap.js';
import LinkEditor from './LinkEditor.jsx';

const STATE_COLOR = { critical: '#d03b3b', warning: '#fab219', good: '#0ca30c' };

export default function MindMap({ tasks, categories, links = [], thoughts, settings, reload, onOpen }) {
  const [open, setOpen] = useState(() => new Set());
  const [closed, setClosed] = useState(() => new Set());
  const [zoom, setZoom] = useState(1);
  const today = todayKST();
  const tasksById = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);

  const tree = useMemo(() => buildTree(tasks, categories, thoughts ?? []), [tasks, categories, thoughts]);
  const { nodes, edges, width, height } = useMemo(() => layoutTree(tree, { open, closed }), [tree, open, closed]);
  const byTask = Object.fromEntries(nodes.filter((n) => n.taskId).map((n) => [n.taskId, n]));
  const states = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, taskState(t, assess(t, today, settings.neglect_days, settings.waiting_days), links, tasksById, today, settings)])), [tasks, links, tasksById, today, settings]);

  const flip = (set, setter, id) => setter(() => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  function onNode(n) {
    if (n.kind === 'category' || n.kind === 'group') flip(closed, setClosed, n.id);
    else if (n.kind === 'task') {
      if (n.hasKids) flip(open, setOpen, n.id);
      else onOpen(n.taskId);
    }
  }

  const deps = links.filter((l) => byTask[l.from_task_id] && byTask[l.to_task_id]);

  return (
    <div className="mindmap-wrap">
      <div className="row wrap mm-tools">
        <button onClick={() => { setClosed(new Set()); setOpen(new Set(tasks.filter((t) => t.steps?.length).map((t) => `t:${t.id}`))); }}>모두 펼치기</button>
        <button onClick={() => { setOpen(new Set()); setClosed(new Set()); }}>단계 접기</button>
        <span className="grow" />
        <button aria-label="작게" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}>－</button>
        <button aria-label="크게" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}>＋</button>
      </div>

      <div className="mm-scroll">
        <svg width={width * zoom} height={height * zoom} viewBox={`0 0 ${width} ${height}`} className="mm-svg" role="img" aria-label="업무 마인드맵">
          <defs>
            <marker id="mm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#4f7cff" />
            </marker>
          </defs>
          {edges.map((e) => (
            <path key={`${e.from.id}-${e.to.id}`} d={edgePath(e.from, e.to)} className="mm-edge"
              stroke={e.color ?? '#9aa5b8'} strokeWidth={e.to.kind === 'step' || e.to.kind === 'principle' ? 1.6 : e.to.depth === 1 ? 4 : 2.6} />
          ))}
          {deps.map((l) => (
            <path key={l.id} d={dependencyPath(byTask[l.from_task_id], byTask[l.to_task_id])} className="mm-dep" markerEnd="url(#mm-arrow)" />
          ))}
          {nodes.map((n) => <Node key={n.id} n={n} state={n.taskId ? states[n.taskId] : null} onClick={() => onNode(n)} onOpen={onOpen} />)}
        </svg>
      </div>
      <ul className="bal-legend small" aria-label="범례">
        <li><span style={{ color: STATE_COLOR.critical }}>●</span> 마감 지남·임박</li>
        <li><span style={{ color: STATE_COLOR.warning }}>●</span> 못 챙김·무응답</li>
        <li><span style={{ color: STATE_COLOR.good }}>●</span> 순조</li>
        <li><span style={{ color: '#4f7cff' }}>⇢</span> 먼저 끝낼 업무</li>
      </ul>
      <p className="small muted">분류를 누르면 접히고, 업무를 누르면 단계가 펼쳐져요. ↗ 를 누르면 업무가 열려요.</p>

      <LinkEditor tasks={tasks} links={links} tasksById={tasksById} reload={reload} />
    </div>
  );
}

function Node({ n, state, onClick, onOpen }) {
  const top = n.y - n.h / 2;
  const label = <title>{n.fullLabel}</title>;
  if (n.kind === 'root') {
    return (
      <g className="mm-node root">
        <rect x={n.x} y={top} width={n.w} height={n.h} rx={n.h / 2} />
        <text x={n.x + n.w / 2} y={n.y + 5} textAnchor="middle">{n.label}</text>
      </g>
    );
  }
  if (n.kind === 'category' || n.kind === 'group') {
    return (
      <g className="mm-node cat" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
        {label}
        <rect x={n.x} y={top} width={n.w} height={n.h} rx={n.h / 2} fill={n.color ?? '#9aa5b8'} />
        <text x={n.x + n.w / 2 - (n.expanded ? 0 : 6)} y={n.y + 5} textAnchor="middle">{n.label}</text>
        {!n.expanded && <text x={n.x + n.w - 14} y={n.y + 5} textAnchor="middle" className="mm-count">{n.childCount}</text>}
      </g>
    );
  }
  if (n.kind === 'task') {
    return (
      <g className="mm-node task">
        <g onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
          {label}
          <rect x={n.x} y={top} width={n.w} height={n.h} rx="12" stroke={n.color ?? '#9aa5b8'} />
          <circle cx={n.x + 13} cy={n.y} r="5" fill={STATE_COLOR[state] ?? '#9aa5b8'} />
          <text x={n.x + 24} y={n.y + 4.5}>{n.label}</text>
          {n.hasKids && !n.expanded && <text x={n.x + n.w + 6} y={n.y + 4} className="mm-more">+{n.childCount}</text>}
        </g>
        <g className="mm-open" onClick={() => onOpen(n.taskId)} role="button" aria-label="업무 열기">
          <circle cx={n.x + n.w - 13} cy={n.y} r="9" />
          <text x={n.x + n.w - 13} y={n.y + 4} textAnchor="middle">↗</text>
        </g>
      </g>
    );
  }
  return (
    <g className={`mm-node leaf ${n.done ? 'done' : ''} ${n.kind}`}>
      {label}
      <rect x={n.x} y={top} width={n.w} height={n.h} rx="8" />
      <text x={n.x + 10} y={n.y + 4}>{n.label}</text>
    </g>
  );
}
