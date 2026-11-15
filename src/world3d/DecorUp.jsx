// 내 화단 꾸미기 창: 화분 둘레 3자리에 가진 소품을 놓음. 모든 소품 14종을 보여 주고, 없는 것은 "아직 없어요"
import React, { useMemo, useState } from "react";
import { DECOR, TIER_NAMES, decorThumb, cleanPlaced } from "./decor.js";

const C = { ink: "#35503F", inkSoft: "#6E8574", green: "#57A365", greenDk: "#3F7E4E", gold: "#EDA83A", paper: "#FBF7EE" };
const TIER_STYLE = [{ bg: "#EAF4DF", fg: "#4E8A45" }, { bg: "#FFF1CF", fg: "#B7801F" }, { bg: "#FFE1E6", fg: "#C24E67" }];
const SLOT_NAMES = ["왼쪽", "가운데", "오른쪽"];

export default function DecorUp({ counts = {}, placed = [null, null, null], teacher = false, onSave, onClose }) {
  const [slots, setSlots] = useState(() => cleanPlaced(placed));
  const [sel, setSel] = useState(() => { const i = cleanPlaced(placed).findIndex((x) => !x); return i < 0 ? 0 : i; });
  const [saving, setSaving] = useState(false);
  const thumbs = useMemo(() => Object.fromEntries(DECOR.map((d) => [d.id, decorThumb(d.id)])), []);
  const used = (id) => slots.filter((x) => x === id).length;
  const left = (id) => (counts[id] || 0) - used(id);
  const owned = DECOR.filter((d) => (counts[d.id] || 0) > 0).length;
  const pick = (id) => {
    if (left(id) <= 0 && slots[sel] !== id) return;
    setSlots((s) => { const n = [...s]; n[sel] = id; return n; });
    const next = slots.findIndex((x, i) => !x && i !== sel); if (next >= 0) setSel(next);
  };
  const clear = (i) => setSlots((s) => { const n = [...s]; n[i] = null; return n; });
  const save = async () => { if (saving) return; setSaving(true); try { await onSave(slots); } finally { setSaving(false); } };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#00000055", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{ width: "100%", maxWidth: 440, maxHeight: "90dvh", overflowY: "auto", background: C.paper, borderRadius: "22px 22px 0 0", padding: "16px 16px 20px", boxShadow: "0 -6px 20px #0003" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="cs-jua" style={{ fontSize: 19, color: C.greenDk }}>🪴 내 화단 꾸미기</div>
          <button onClick={onClose} aria-label="닫기" style={{ border: "none", background: "transparent", fontSize: 20, color: C.inkSoft, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3, lineHeight: 1.6 }}>
          {teacher ? "선생님은 모든 소품을 놓아 볼 수 있어요(종류마다 3개까지)." : "내 나무 화분 둘레에 소품 3개를 놓을 수 있어요. 자유롭게 읽기로 목표보다 20분 더 읽거나, 책을 완독하면 소품을 하나씩 받아요."}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {slots.map((id, i) => (
            <button key={i} onClick={() => setSel(i)} data-slot={i} aria-pressed={sel === i}
              style={{ flex: 1, minWidth: 0, position: "relative", height: 96, borderRadius: 16, cursor: "pointer", padding: 4,
                border: sel === i ? `2.5px solid ${C.green}` : "1.5px dashed #d6ccb6", background: id ? "#fff" : "#fffaf0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {id ? <img src={thumbs[id]} alt="" style={{ width: 60, height: 60, objectFit: "contain" }} /> : <span style={{ fontSize: 22, opacity: 0.4 }}>＋</span>}
              <span style={{ fontSize: 10.5, color: C.inkSoft }}>{SLOT_NAMES[i]} {id ? "" : "빈자리"}</span>
              {id && <span onClick={(e) => { e.stopPropagation(); clear(i); }} role="button" aria-label={`${SLOT_NAMES[i]} 비우기`}
                style={{ position: "absolute", top: 3, right: 6, fontSize: 13, color: C.inkSoft }}>✕</span>}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft, margin: "14px 0 6px" }}>내 소품 ({owned}/{DECOR.length}종) · <b style={{ color: C.greenDk }}>{SLOT_NAMES[sel]}</b> 자리에 놓을 소품을 골라요</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}>
          {DECOR.map((d) => {
            const have = counts[d.id] || 0, can = left(d.id) > 0, t = TIER_STYLE[d.tier];
            return (
              <button key={d.id} onClick={() => pick(d.id)} disabled={!have} data-item={d.id}
                style={{ position: "relative", border: "1.5px solid #ece2cf", background: have ? "#fff" : "#f3efe6", borderRadius: 14, padding: "6px 4px 7px",
                  cursor: have && can ? "pointer" : "default", opacity: have ? (can ? 1 : 0.55) : 0.55, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <img src={thumbs[d.id]} alt="" style={{ width: 56, height: 56, objectFit: "contain", filter: have ? "none" : "grayscale(1) brightness(1.15)" }} />
                <span style={{ fontSize: 11.5, color: C.ink, lineHeight: 1.2, textAlign: "center" }}>{have ? d.name : "아직 없어요"}</span>
                <span style={{ fontSize: 9.5, background: t.bg, color: t.fg, borderRadius: 8, padding: "1px 6px" }}>{TIER_NAMES[d.tier]}</span>
                {have > 0 && <span style={{ position: "absolute", top: 4, right: 6, fontSize: 10.5, color: C.inkSoft }}>×{have}</span>}
              </button>
            );
          })}
        </div>
        <button onClick={save} disabled={saving} className="cs-jua"
          style={{ width: "100%", marginTop: 14, border: "none", padding: 13, borderRadius: 16, fontSize: 16, color: "#fff", cursor: saving ? "default" : "pointer",
            background: saving ? "#a8c49a" : "linear-gradient(#57A365, #3F7E4E)", boxShadow: "0 5px 12px #3f7e4e44" }}>{saving ? "놓는 중…" : "이렇게 꾸밀래요"}</button>
      </div>
    </div>
  );
}
