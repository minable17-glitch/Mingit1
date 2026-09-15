import { useRef } from 'react';

const RINGS = [
  { pct: 100, color: '#ffffff', border: '#c9c2ab' },
  { pct: 80, color: '#1c1c1c', border: '#1c1c1c' },
  { pct: 60, color: '#2563eb', border: '#2563eb' },
  { pct: 40, color: '#dc2626', border: '#dc2626' },
  { pct: 20, color: '#f4c430', border: '#f4c430' },
];

const MAX_MARKERS = 10;
const OUT_OF_FACE_DISTANCE = 1.15;

export default function TargetFace({ markers, onAddMarker, onRemoveMarker }) {
  const ref = useRef(null);

  function handleClick(e) {
    if (markers.length >= MAX_MARKERS) return;
    const rect = ref.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const radius = rect.width / 2;
    const nx = (clickX - cx) / radius;
    const ny = -(clickY - cy) / radius;
    const dist = Math.sqrt(nx * nx + ny * ny);
    if (dist > OUT_OF_FACE_DISTANCE) return;
    onAddMarker({ x: nx, y: ny });
  }

  return (
    <div className="target-wrap">
      <div className="target-face" ref={ref} onClick={handleClick}>
        {RINGS.map((r) => (
          <div
            key={r.pct}
            style={{
              position: 'absolute',
              left: `${(100 - r.pct) / 2}%`,
              top: `${(100 - r.pct) / 2}%`,
              width: `${r.pct}%`,
              height: `${r.pct}%`,
              borderRadius: '50%',
              background: r.color,
              border: `1px solid ${r.border}`,
            }}
          />
        ))}
        {markers.map((m, i) => (
          <div
            key={i}
            className="target-marker"
            style={{ left: `${(m.x + 1) / 2 * 100}%`, top: `${(1 - m.y) / 2 * 100}%` }}
            onClick={(e) => {
              e.stopPropagation();
              onRemoveMarker(i);
            }}
          >
            ✕
          </div>
        ))}
      </div>
    </div>
  );
}

export { MAX_MARKERS };
