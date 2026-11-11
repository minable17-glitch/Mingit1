// 캐릭터 꾸미기 창: 성별 → 머리 모양·머리 색 → 윗옷 색 → 아래옷·색. 위에 빙글 도는 미리보기
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Avatar, DRESS, defaultDress, cleanDress, lookFromDress, dressKey } from "./avatar.js";

const C = { ink: "#35503F", inkSoft: "#6E8574", green: "#57A365", greenDk: "#3F7E4E", gold: "#EDA83A", paper: "#FBF7EE" };

// 미리보기: 작은 3D 화면에 내 캐릭터 하나. 끌면 돌려 볼 수 있고, 가만두면 천천히 돎
function Preview({ dress }) {
  const ref = useRef(null), st = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return undefined;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight("#FFEBD6", 0.62)); scene.add(new THREE.HemisphereLight("#FFF3E2", "#F7CFA6", 1.3));
    const sun = new THREE.DirectionalLight("#FFD8A0", 1.35); sun.position.set(-3, 5, 6); scene.add(sun);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20); cam.position.set(0, 0.72, 2.75); cam.lookAt(0, 0.5, 0);
    const s = { r, scene, cam, avatar: null, yaw: 0.35, drag: null, raf: 0, last: performance.now() };
    st.current = s;
    const loop = (now) => {
      s.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - s.last) / 1000); s.last = now;
      if (!s.drag) s.yaw += dt * 0.5;
      if (s.avatar) { s.avatar.root.rotation.y = s.yaw; s.avatar.update(dt); }
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * r.getPixelRatio()) || canvas.height !== Math.round(h * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      r.render(scene, cam);
    };
    s.raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(s.raf); if (s.avatar) s.avatar.root.traverse((o) => o.geometry?.dispose?.()); r.dispose(); st.current = null; };
  }, []);
  useEffect(() => {
    const s = st.current; if (!s) return;
    if (s.avatar) { s.scene.remove(s.avatar.root); s.avatar.root.traverse((o) => o.geometry?.dispose?.()); }
    const a = new Avatar(lookFromDress(dress)); a.setState("idle"); a.update(0); s.scene.add(a.root); s.avatar = a;
  }, [dressKey(dress)]);   // eslint-disable-line react-hooks/exhaustive-deps
  const down = (e) => { const s = st.current; if (s) s.drag = { x: e.clientX, yaw: s.yaw }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => { const s = st.current; if (s && s.drag) s.yaw = s.drag.yaw + (e.clientX - s.drag.x) * 0.012; };
  const up = () => { const s = st.current; if (s) s.drag = null; };
  return <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
    style={{ width: "100%", height: 210, display: "block", touchAction: "none", cursor: "grab" }} />;
}

const Swatches = ({ colors, value, onPick, label }) => (
  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {colors.map((c, i) => (
      <button key={c} onClick={() => onPick(i)} aria-label={`${label} ${i + 1}번`} aria-pressed={value === i}
        style={{ width: 34, height: 34, borderRadius: 17, background: c, cursor: "pointer", padding: 0,
          border: value === i ? `3px solid ${C.greenDk}` : "2px solid #ffffff", boxShadow: value === i ? "0 0 0 2px #fff inset" : "0 1px 4px #0000001f" }} />
    ))}
  </div>
);
const Chips = ({ items, value, onPick }) => (
  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
    {items.map(([k, label]) => (
      <button key={k} onClick={() => onPick(k)} aria-pressed={value === k} className="cs-jua"
        style={{ border: value === k ? "none" : "1.5px solid #dfe8d6", background: value === k ? C.green : "#fff", color: value === k ? "#fff" : C.greenDk,
          borderRadius: 16, padding: "7px 12px", fontSize: 13.5, cursor: "pointer" }}>{label}</button>
    ))}
  </div>
);
const Row = ({ title, children }) => (
  <div style={{ marginTop: 12 }}>
    <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>{title}</div>
    {children}
  </div>
);

export default function DressUp({ initial, firstTime = false, onSave, onClose }) {
  const [d, setD] = useState(() => cleanDress(initial) || null);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const pickGender = (g) => setD((x) => (x && x.g === g ? x : { ...defaultDress(g), hc: x ? x.hc : defaultDress(g).hc }));
  const save = async () => { if (!d || saving) return; setSaving(true); try { await onSave(d); } finally { setSaving(false); } };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#00000055", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget && !firstTime) onClose?.(); }}>
      <div style={{ width: "100%", maxWidth: 440, maxHeight: "92dvh", overflowY: "auto", background: C.paper, borderRadius: "22px 22px 0 0", padding: "16px 18px 20px", boxShadow: "0 -6px 20px #0003" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="cs-jua" style={{ fontSize: 19, color: C.greenDk }}>👕 내 캐릭터 꾸미기</div>
          {!firstTime && <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 20, color: C.inkSoft, cursor: "pointer" }} aria-label="닫기">✕</button>}
        </div>
        {firstTime && <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 4 }}>도서관에서 친구들이 보게 될 내 모습이에요. 나중에 언제든 바꿀 수 있어요.</div>}
        <Row title="성별">
          <div style={{ display: "flex", gap: 8 }}>
            {[["boy", "👦 남자"], ["girl", "👧 여자"]].map(([g, label]) => (
              <button key={g} onClick={() => pickGender(g)} aria-pressed={d?.g === g} className="cs-jua"
                style={{ flex: 1, padding: "11px 8px", borderRadius: 14, fontSize: 15.5, cursor: "pointer",
                  border: d?.g === g ? "none" : "1.5px solid #dfe8d6", background: d?.g === g ? C.green : "#fff", color: d?.g === g ? "#fff" : C.greenDk }}>{label}</button>
            ))}
          </div>
        </Row>
        {d ? (
          <>
            <div style={{ marginTop: 10, background: "linear-gradient(#FFF6E6, #F7E6CC)", borderRadius: 18 }}><Preview dress={d} /></div>
            <Row title="머리 모양"><Chips items={DRESS.hairStyles} value={d.hs} onPick={(v) => set("hs", v)} /></Row>
            <Row title="머리 색"><Swatches colors={DRESS.hairColors} value={d.hc} onPick={(v) => set("hc", v)} label="머리 색" /></Row>
            <Row title="윗옷 색"><Swatches colors={DRESS.shirtColors} value={d.sc} onPick={(v) => set("sc", v)} label="윗옷 색" /></Row>
            <Row title="아래옷"><Chips items={DRESS.bottoms} value={d.b} onPick={(v) => set("b", v)} /></Row>
            <Row title="아래옷 색"><Swatches colors={DRESS.bottomColors} value={d.bc} onPick={(v) => set("bc", v)} label="아래옷 색" /></Row>
            <button onClick={save} disabled={saving} className="cs-jua"
              style={{ width: "100%", marginTop: 16, border: "none", padding: 13, borderRadius: 16, fontSize: 16, color: "#fff", cursor: saving ? "default" : "pointer",
                background: saving ? "#a8c49a" : `linear-gradient(${C.green}, ${C.greenDk})`, boxShadow: "0 5px 12px #3f7e4e44" }}>{saving ? "저장하는 중…" : "이 모습으로 할래요"}</button>
          </>
        ) : (
          <div style={{ fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "24px 0 8px" }}>먼저 성별을 골라 주세요 🙂</div>
        )}
      </div>
    </div>
  );
}
