// 정원 3D 화면 — 숲 탭의 숲 그림 자리에 들어가는 화면(시험 기능, ?lab3d=1 로 켬)
// 나무 단계·이름은 App.jsx가 주는 값을 그대로 그리고, 물주기는 App.jsx의 onWater 를 부름.
import React, { useEffect, useRef, useState } from "react";
import { GardenWorld } from "./GardenWorld.js";
import { webglAvailable } from "./LibraryWorld.js";
import { connectRoom } from "./realtime.js";

const C = { ink: "#35503F", inkSoft: "#6E8574", green: "#57A365", greenDk: "#3F7E4E", gold: "#EDA83A", leafL: "#9BD187", water: "#4FA9C4" };

export default function Garden3D({ classInfo, studentInfo, role, trees, classStage, waterReady, waterLeft, onWater, onTapTree, onTapClassTree, onUnsupported, showToast }) {
  const canvasRef = useRef(null), worldRef = useRef(null), roomRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState(true);            // 가까이 보기(내 나무 둘레) / 전체 보기
  const isStudent = role === "student" && !!studentInfo?.id;
  const classId = classInfo?.id;
  const cb = useRef({}); cb.current = { onTapTree, onTapClassTree };
  // 화분 개수가 달라질 때만 장면을 다시 지음(학생이 32명을 넘으면 화단이 늘어남)
  const islands = Math.max(8, Math.ceil((trees?.length || 0) / 4));

  useEffect(() => {
    if (!classId || !canvasRef.current) return undefined;
    if (!webglAvailable()) { onUnsupported?.(); return undefined; }
    let world;
    try {
      world = new GardenWorld(canvasRef.current, {
        students: islands * 4, me: isStudent ? { id: studentInfo.id, nick: studentInfo.nickname } : null,
        onEvent: (type, payload) => { if (type === "tapTree") cb.current.onTapTree?.(payload.id); else if (type === "tapClassTree") cb.current.onTapClassTree?.(); },
      });
    } catch (err) { console.error("3D 정원을 열지 못했어요:", err); onUnsupported?.(); return undefined; }
    worldRef.current = world; setReady(true);
    if (new URLSearchParams(window.location.search).get("debug") === "1") window.__garden3d = world;   // 자동 점검용
    const meId = isStudent ? studentInfo.id : null;
    const room = connectRoom({
      classId, key: meId || `teacher-${Math.random().toString(36).slice(2, 8)}`,
      meta: isStudent ? { nick: studentInfo.nickname, place: "garden", state: "stand" } : { observer: true },
      forceLocal: new URLSearchParams(window.location.search).get("rtlocal") === "1",
      onSync: (list) => world.setOthers(list.filter((o) => !o.observer && o.place === "garden")),
    });
    roomRef.current = room;
    return () => { room.close(); world.dispose(); worldRef.current = null; roomRef.current = null; setReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, isStudent, studentInfo?.id, islands]);

  useEffect(() => { if (ready) worldRef.current?.setTrees(trees || []); }, [trees, ready]);
  useEffect(() => { if (ready) worldRef.current?.setClassStage(classStage ?? 0); }, [classStage, ready]);
  useEffect(() => { if (ready) worldRef.current?.setZoom(near); }, [near, ready]);

  const water = async (all) => {
    if (busy || !onWater) return;
    setBusy(true); setNear(true);     // 물 줄 때는 내 나무를 가까이서 봄
    const meta = { nick: studentInfo?.nickname, place: "garden" };
    try {
      roomRef.current?.update({ ...meta, state: "water" });
      // 연출과 저장을 함께 진행하고, 둘 다 끝난 뒤에 결과를 알림(저장에 실패하면 나무는 자라지 않음)
      const [n] = await Promise.all([onWater(all), worldRef.current?.water()]);
      if (!n) showToast?.("줄 수 있는 물이 없어요.");
    } catch (e) { showToast?.(e?.message || "물주기에 실패했어요. 다시 시도해 주세요."); }
    finally { roomRef.current?.update({ ...meta, state: "stand" }); setBusy(false); }
  };

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "10 / 13", marginTop: 4, overflow: "hidden", background: "#CFE9F5" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "pan-y" }} />
      {!ready && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, fontSize: 14 }}>정원 문을 여는 중…</div>}
      {isStudent && ready && (
        <button onClick={() => setNear((n) => !n)} style={{ position: "absolute", top: 10, right: 12, border: "none", cursor: "pointer", background: "#ffffffd9", borderRadius: 20,
          padding: "5px 12px", fontSize: 12.5, color: C.greenDk, boxShadow: "0 2px 6px #0000000f" }}>{near ? "🔭 전체 보기" : "🔍 내 나무 보기"}</button>
      )}
      {isStudent && waterReady && (
        <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, display: "flex", gap: 8, justifyContent: "center", pointerEvents: "none" }}>
          {waterLeft > 0 ? (
            <>
              <button onClick={() => water(false)} disabled={busy} className="cs-jua" style={{ pointerEvents: "auto", border: "none", borderRadius: 18, padding: "13px 20px", fontSize: 16, color: "#fff",
                cursor: busy ? "default" : "pointer", background: busy ? "#a9c9d4" : `linear-gradient(#6CC3DA, ${C.water})`, boxShadow: "0 6px 14px #4fa9c455" }}>
                {busy ? "물 주는 중…" : `💧 물 주기 · ${waterLeft}번 남음`}</button>
              {waterLeft > 1 && !busy && (
                <button onClick={() => water(true)} className="cs-jua" style={{ pointerEvents: "auto", borderRadius: 18, padding: "13px 14px", fontSize: 14, color: C.water, cursor: "pointer",
                  background: "#fff", border: `1.5px solid ${C.water}` }}>모두 주기</button>
              )}
            </>
          ) : (
            <div style={{ pointerEvents: "auto", background: "#ffffffd9", borderRadius: 16, padding: "8px 14px", fontSize: 12.5, color: C.greenDk }}>지금은 줄 물이 없어요. 책을 읽고 기록을 남기면 물이 생겨요 🌱</div>
          )}
        </div>
      )}
    </div>
  );
}
