// 정원 3D 화면 — 숲 탭의 숲 그림 자리에 들어가는 화면(시험 기능, ?lab3d=1 로 켬)
// 나무 단계·이름은 App.jsx가 주는 값을 그대로 그리고, 물주기는 App.jsx의 onWater 를 부름.
import React, { useEffect, useRef, useState } from "react";
import { GardenWorld } from "./GardenWorld.js";
import { webglAvailable } from "./LibraryWorld.js";
import { connectRoom } from "./realtime.js";
import { Joystick, ViewPicker, loadView, saveView } from "./controls.jsx";
import DressUp from "./DressUp.jsx";
import { cleanDress, dressKey } from "./avatar.js";

const C = { ink: "#35503F", inkSoft: "#6E8574", green: "#57A365", greenDk: "#3F7E4E", gold: "#EDA83A", leafL: "#9BD187", water: "#4FA9C4" };

export default function Garden3D({ classInfo, studentInfo, role, myDress = null, dressReady = false, onSaveDress, trees, classStage, waterReady, waterLeft, onWater, onTapTree, onTapClassTree, onUnsupported, showToast, onGoLibrary }) {
  const canvasRef = useRef(null), worldRef = useRef(null), roomRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [near, setNear] = useState(true);            // 가까이 보기(내 나무 둘레) / 전체 보기
  const isStudent = role === "student" && !!studentInfo?.id;
  const canWalk = isStudent || role === "teacher";     // 선생님도 걸어 다니며 둘러봄(학생 화면에는 안 보임)
  const classId = classInfo?.id;
  const [view, setViewState] = useState(() => (canWalk ? loadView() : "top"));
  const chooseView = (v) => { setViewState(v); worldRef.current?.setView(v); saveView(v); };
  const metaRef = useRef(null), leavingRef = useRef(false), boxRef = useRef(null);
  // 정원 화면이 화면 아래(탭바 위)까지 꽉 차도록 높이를 맞춤(위쪽 반 목표 카드 높이에 따라 달라짐)
  const [boxH, setBoxH] = useState(null);
  const [tip, setTip] = useState(true);
  useEffect(() => {
    const fit = () => { const el = boxRef.current; if (!el) return; const top = el.getBoundingClientRect().top + window.scrollY; setBoxH(Math.max(420, Math.round(window.innerHeight - top - 68))); };
    fit(); const t = setTimeout(fit, 400); window.addEventListener("resize", fit);
    return () => { clearTimeout(t); window.removeEventListener("resize", fit); };
  }, []);
  useEffect(() => { const t = setTimeout(() => setTip(false), 5000); return () => clearTimeout(t); }, []);
  useEffect(() => { worldRef.current?.resize(); }, [boxH]);
  const cb = useRef({}); cb.current = { onTapTree, onTapClassTree, onGoLibrary };
  // 캐릭터 꾸미기: 버튼으로 열고, 아직 한 번도 안 고른 학생은 처음 들어올 때 한 번 자동으로 열림
  const [dressOpen, setDressOpen] = useState(false);
  const myDressKey = dressKey(cleanDress(myDress));
  useEffect(() => { if (isStudent && dressReady && !cleanDress(myDress)) setDressOpen(true); }, [isStudent, dressReady]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isStudent) return;
    worldRef.current?.setMyDress(cleanDress(myDress));
    if (metaRef.current && !metaRef.current.observer) { metaRef.current = { ...metaRef.current, dress: cleanDress(myDress) }; roomRef.current?.update(metaRef.current); }
  }, [myDressKey, isStudent]);   // eslint-disable-line react-hooks/exhaustive-deps
  const saveDress = async (d) => {
    const ok = await onSaveDress?.(d); setDressOpen(false);
    showToast?.(ok === false ? "이 기기에 저장했어요 👕" : "새 모습으로 바꿨어요 👕");
  };
  // 화분 개수가 달라질 때만 장면을 다시 지음(학생이 32명을 넘으면 화단이 늘어남)
  const islands = Math.max(8, Math.ceil((trees?.length || 0) / 4));

  useEffect(() => {
    if (!classId || !canvasRef.current) return undefined;
    if (!webglAvailable()) { onUnsupported?.(); return undefined; }
    let world;
    try {
      world = new GardenWorld(canvasRef.current, {
        students: islands * 4, me: isStudent ? { id: studentInfo.id, nick: studentInfo.nickname, dress: myDress } : canWalk ? { id: "teacher-me", nick: "선생님" } : null, view,
        onEvent: (type, payload) => {
          if (type === "tapTree") cb.current.onTapTree?.(payload.id);
          else if (type === "tapClassTree") cb.current.onTapClassTree?.();
          else if (type === "me" && isStudent) { metaRef.current = { ...metaRef.current, ...payload }; roomRef.current?.update(metaRef.current); }
          else if (type === "door" && cb.current.onGoLibrary && !leavingRef.current) { leavingRef.current = true; cb.current.onGoLibrary(); }
        },
      });
    } catch (err) { console.error("3D 정원을 열지 못했어요:", err); onUnsupported?.(); return undefined; }
    worldRef.current = world; setReady(true);
    if (new URLSearchParams(window.location.search).get("debug") === "1") window.__garden3d = world;   // 자동 점검용
    const meId = isStudent ? studentInfo.id : null;
    const startPos = world.me ? { x: Math.round(world.me.avatar.root.position.x * 100) / 100, z: Math.round(world.me.avatar.root.position.z * 100) / 100 } : {};
    metaRef.current = isStudent ? { nick: studentInfo.nickname, place: "garden", state: "stand", dress: cleanDress(myDress), ...startPos } : { observer: true };
    const room = connectRoom({
      classId, key: meId || `teacher-${Math.random().toString(36).slice(2, 8)}`,
      meta: metaRef.current,
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
    setBusy(true); if (view === "top") setNear(true);     // 위에서 볼 때는 내 나무를 가까이서 봄(캐릭터 시점에서는 나무까지 걸어감)
    const upd = (state) => { metaRef.current = { ...metaRef.current, state }; roomRef.current?.update(metaRef.current); };
    try {
      upd("water");
      // 연출과 저장을 함께 진행하고, 둘 다 끝난 뒤에 결과를 알림(저장에 실패하면 나무는 자라지 않음)
      const [n] = await Promise.all([onWater(all), worldRef.current?.water()]);
      if (!n) showToast?.("줄 수 있는 물이 없어요.");
    } catch (e) { showToast?.(e?.message || "물주기에 실패했어요. 다시 시도해 주세요."); }
    finally { upd("stand"); setBusy(false); }
  };

  return (
    <div ref={boxRef} style={{ position: "relative", width: "100%", ...(boxH ? { height: boxH } : { aspectRatio: "10 / 13" }), marginTop: 6, overflow: "hidden", background: "#CFE9F5" }}>
      {/* 캐릭터 시점에서는 화면을 끌어 둘러보므로 페이지 스크롤을 막음(위에서 보기는 예전처럼 스크롤 가능) */}
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: view === "top" ? "pan-y" : "none" }} />
      {!ready && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, fontSize: 14 }}>정원 문을 여는 중…</div>}
      {onGoLibrary && ready && (
        <button onClick={() => { leavingRef.current = true; onGoLibrary(); }} style={{ position: "absolute", top: 10, left: 12, border: "none", cursor: "pointer", background: `linear-gradient(${C.green}, ${C.greenDk})`, borderRadius: 20,
          padding: "5px 12px", fontSize: 12.5, color: "#fff", boxShadow: "0 2px 6px #0000001a" }}>📚 도서관 가기</button>
      )}
      {canWalk && ready && (
        <div style={{ position: "absolute", top: 10, right: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <ViewPicker view={view} onChange={chooseView} />
          {isStudent && <button onClick={() => setDressOpen(true)} data-dress style={{ border: "none", cursor: "pointer", background: "#ffffffd9", borderRadius: 20,
            padding: "5px 12px", fontSize: 12.5, color: C.greenDk, boxShadow: "0 2px 6px #0000000f" }}>👕 꾸미기</button>}
          {view === "top" && isStudent && (
            <button onClick={() => setNear((n) => !n)} style={{ border: "none", cursor: "pointer", background: "#ffffffd9", borderRadius: 20,
              padding: "5px 12px", fontSize: 12.5, color: C.greenDk, boxShadow: "0 2px 6px #0000000f" }}>{near ? "🔭 전체 보기" : "🔍 내 나무 보기"}</button>
          )}
        </div>
      )}
      {tip && ready && (
        <div style={{ position: "absolute", left: "50%", top: 54, transform: "translateX(-50%)", background: "#35503Fcc", color: "#fff", borderRadius: 14,
          padding: "6px 12px", fontSize: 12, whiteSpace: "nowrap", pointerEvents: "none" }}>🌳 나무를 누르면 그 친구가 읽는 책이 보여요</div>
      )}
      {canWalk && ready && !busy && <Joystick bottom={waterReady ? 76 : 16} onMove={(x, y) => worldRef.current?.setMove(x, y)} />}
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
      {dressOpen && <DressUp initial={myDress} firstTime={!cleanDress(myDress)} onSave={saveDress} onClose={() => setDressOpen(false)} />}
    </div>
  );
}
