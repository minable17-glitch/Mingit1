// 3D 도서관·정원이 함께 쓰는 조작 부품: 걷기 조이스틱, 보는 방법 고르기
import React, { useRef, useState } from "react";

const C = { green: "#57A365", greenDk: "#3F7E4E" };
const VIEW_KEY = "saesak_view3d";
export const VIEWS = [["third", "🚶", "뒤에서"], ["first", "👀", "내 눈으로"], ["top", "🔭", "전체"]];
export const loadView = () => { try { const v = localStorage.getItem(VIEW_KEY); return VIEWS.some(([k]) => k === v) ? v : "third"; } catch { return "third"; } };
export const saveView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch { /* 저장소를 못 써도 계속 */ } };

export function ViewPicker({ view, onChange }) {
  return (
    <div style={{ background: "#ffffffd9", borderRadius: 20, padding: 3, display: "flex", gap: 2, boxShadow: "0 2px 6px #0000000f" }}>
      {VIEWS.map(([v, icon, label]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={view === v} data-view={v}
          style={{ border: "none", borderRadius: 16, padding: "5px 8px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
            background: view === v ? C.green : "transparent", color: view === v ? "#fff" : C.greenDk }}>{icon} {label}</button>
      ))}
    </div>
  );
}

// 왼쪽 아래 동그라미 조이스틱: 밀면 그쪽으로 걷기(손을 떼면 멈춤)
export function Joystick({ onMove, bottom }) {
  const base = useRef(null), id = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const R = 34, active = id.current != null || knob.x !== 0 || knob.y !== 0;
  const upd = (e) => {
    const r = base.current.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy); if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    setKnob({ x: dx, y: dy }); onMove(dx / R, dy / R);
  };
  const end = (e) => { if (e.pointerId !== id.current) return; id.current = null; setKnob({ x: 0, y: 0 }); onMove(0, 0); };
  return (
    <div ref={base} data-joystick
      onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); id.current = e.pointerId; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 무시 */ } upd(e); }}
      onPointerMove={(e) => { if (e.pointerId === id.current) upd(e); }}
      onPointerUp={end} onPointerCancel={end}
      style={{ position: "absolute", left: 14, bottom, width: 2 * R + 28, height: 2 * R + 28, borderRadius: "50%", background: active ? "#ffffff70" : "#ffffff40",
        border: "1.5px solid #ffffffb0", boxShadow: "0 3px 10px #3f7e4e22", opacity: active ? 1 : 0.85, transition: "opacity .2s, background .2s", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", zIndex: 5 }}
      onContextMenu={(e) => e.preventDefault()}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: "50%",
        background: "radial-gradient(circle at 35% 30%, #ffffff, #dff0d6)", border: `2px solid ${C.green}`, boxShadow: "0 2px 6px #3f7e4e44",
        transform: `translate(${knob.x}px, ${knob.y}px)`, pointerEvents: "none" }} />
    </div>
  );
}

