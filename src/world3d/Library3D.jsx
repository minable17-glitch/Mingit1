// 도서관 3D 화면 — 읽기 탭 자리에 들어가는 화면(시험 기능, ?lab3d=1 로 켬)
// 3D 장면 위에 기존 읽기 버튼들을 그대로 올려 둠. 타이머·소감 등 실제 기능은 App.jsx의 것을 그대로 부름.
import React, { useEffect, useRef, useState } from "react";
import { LibraryWorld, webglAvailable } from "./LibraryWorld.js";
import { connectRoom } from "./realtime.js";

const C = { ink: "#35503F", inkSoft: "#6E8574", green: "#57A365", greenDk: "#3F7E4E", gold: "#EDA83A", paper: "#FBF7EE", leafL: "#9BD187" };
const seatKey = (classId, studentId) => `saesak_seat_${classId}_${studentId}`;

export default function Library3D({
  classInfo, studentInfo, role, reading, myBook, doneToday, dailyTargetMinutes,
  resumeMinutes, bonusResumeMinutes, onStartTarget, onStartFree, onStartBonus,
  onPickBook, onCompleteBook, onTapFriend, onUnsupported, showToast, timer,
}) {
  const canvasRef = useRef(null), worldRef = useRef(null), roomRef = useRef(null), metaRef = useRef(null);
  const [net, setNet] = useState("connecting");       // connecting | online | local | offline
  const [people, setPeople] = useState([]);
  const [mySeat, setMySeat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [near, setNear] = useState(true);            // 가까이 보기 / 전체 보기
  const isStudent = role === "student" && !!studentInfo?.id;
  const classId = classInfo?.id;

  // 최신 콜백을 장면 이벤트에서 쓰기 위한 참조
  const cb = useRef({}); cb.current = { onTapFriend, showToast };

  useEffect(() => {
    if (!classId || !canvasRef.current) return undefined;
    if (!webglAvailable()) { onUnsupported?.(); return undefined; }
    let world;
    const params = new URLSearchParams(window.location.search);
    const meId = isStudent ? studentInfo.id : null;
    let lastSeat = null;
    try { lastSeat = isStudent ? Number(localStorage.getItem(seatKey(classId, meId))) || null : null; } catch { /* 저장소를 못 써도 계속 */ }
    const baseMeta = isStudent ? { nick: studentInfo.nickname, seat: null, state: "stand", seatAt: 0 } : { observer: true };
    metaRef.current = baseMeta;
    try {
      world = new LibraryWorld(canvasRef.current, {
        me: isStudent ? { id: meId, nick: studentInfo.nickname } : null,
        lastSeat,
        onEvent: (type, payload) => {
          if (type === "me") {
            metaRef.current = { ...metaRef.current, ...payload };
            roomRef.current?.update(metaRef.current);
            setMySeat(payload.seat);
            try { if (payload.seat) localStorage.setItem(seatKey(classId, meId), String(payload.seat)); } catch { /* 무시 */ }
          } else if (type === "tapFriend") cb.current.onTapFriend?.(payload);
          else if (type === "bumped") cb.current.showToast?.("친구가 먼저 앉았어요. 다른 자리를 골라 주세요 🙂");
          else if (type === "hint") cb.current.showToast?.(payload);
        },
      });
    } catch (err) { console.error("3D 도서관을 열지 못했어요:", err); onUnsupported?.(); return undefined; }
    worldRef.current = world; setLoading(false);
    if (params.get("debug") === "1") window.__lib3d = world;   // 자동 점검용
    const room = connectRoom({
      classId, key: meId || `teacher-${Math.random().toString(36).slice(2, 8)}`, meta: baseMeta,
      forceLocal: params.get("rtlocal") === "1",
      onStatus: setNet,
      onSync: (list) => {
        const students = list.filter((o) => !o.observer);
        setPeople(students); world.setOthers(students);
      },
    });
    roomRef.current = room;
    // 실시간 연결이 끝내 안 되더라도 지난번 자리로는 앉을 수 있게 함
    const t = setTimeout(() => { if (!world._synced) world.setOthers(isStudent ? [{ id: meId, ...baseMeta }] : []); }, 3500);
    return () => { clearTimeout(t); room.close(); world.dispose(); worldRef.current = null; roomRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, isStudent, studentInfo?.id]);

  // 읽는 동안: 내 상태를 "읽는 중"으로 알리고, 도서관 전체가 보이도록 전체 보기로 바꿈(끝나면 원래 보기로)
  const nearBeforeRead = useRef(true);
  useEffect(() => {
    const w = worldRef.current; if (!w) return;
    w.setReading(!!reading);
    if (reading) { nearBeforeRead.current = near; setNear(false); w.setZoom(false); }
    else { setNear(nearBeforeRead.current); w.setZoom(nearBeforeRead.current); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, loading]);

  const readingCount = people.filter((p) => p.state === "read").length;
  const start = (fn) => { worldRef.current?.autoSeat(); fn?.(); };
  const pill = { background: "#ffffffd9", borderRadius: 20, padding: "5px 12px", fontSize: 12.5, color: C.greenDk, boxShadow: "0 2px 6px #0000000f" };
  const netLabel = { connecting: "연결 중…", online: "함께 읽는 중", local: "연습 모드", offline: "실시간 연결 안 됨" }[net];
  const netDot = { connecting: "#EDA83A", online: "#57A365", local: "#7CC4D6", offline: "#c9a0a0" }[net];

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100dvh - 68px)", minHeight: 420, overflow: "hidden", background: "#CFE9F5", touchAction: "none" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, fontSize: 14 }}>도서관 문을 여는 중…</div>
      )}

      {/* 위쪽: 반 이름과 접속 상태 */}
      <div style={{ position: "absolute", top: 10, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none" }}>
        <div style={{ ...pill, pointerEvents: "auto" }}>
          <span className="cs-jua" style={{ fontSize: 14 }}>📚 {classInfo?.name || "우리 반"} 도서관</span>
          <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 1 }}>
            <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, background: netDot, marginRight: 5 }} />
            {netLabel}{net === "online" || net === "local" ? ` · ${people.length}명 접속 · ${readingCount}명 읽는 중` : ""}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", pointerEvents: "auto" }}>
          <button onClick={() => { const n = !near; setNear(n); worldRef.current?.setZoom(n); }} style={{ ...pill, border: "none", cursor: "pointer" }}>{near ? "🔭 전체 보기" : "🔍 가까이 보기"}</button>
          {isStudent && near && <button onClick={() => worldRef.current?.focusMe()} style={{ ...pill, border: "none", cursor: "pointer" }}>📍 내 위치</button>}
        </div>
      </div>

      {/* 읽는 중: 도서관 위에 뜨는 타이머 카드. 탭바까지 덮어서 읽는 동안에는 다른 탭으로 나가지 않게 함 */}
      {timer && (() => {
        const ready = timer.readMode === "free" && timer.secs >= timer.minRequired;
        return (
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 150, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ width: "100%", maxWidth: 440, background: "#fffffff2", borderRadius: "22px 22px 0 0", padding: "14px 18px 18px",
              boxShadow: "0 -6px 20px #3f7e4e26", borderTop: `1px solid ${C.leafL}66`, pointerEvents: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: C.inkSoft }}>{timer.readMode === "free" ? (timer.isBonusRead ? "보너스로 자유롭게 읽는 중" : "자유롭게 읽는 중") : `목표 ${dailyTargetMinutes}분`} · 지금 읽는 책</div>
                  <div className="cs-jua" style={{ fontSize: 16, color: C.greenDk, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{myBook}</div>
                </div>
                <div className="cs-jua" style={{ fontSize: 40, color: C.ink, letterSpacing: 2, lineHeight: 1, flexShrink: 0 }}>{timer.mm}:{timer.ss}</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={timer.onPause} style={{ flex: 1, padding: "12px 8px", borderRadius: 14, border: `1.5px solid ${C.inkSoft}55`, background: "#fff", color: C.inkSoft, fontSize: 14, cursor: "pointer" }}>⏸ 잠깐 멈추기</button>
                {timer.readMode === "free" && (
                  <button onClick={timer.onFinish} disabled={!ready} className="cs-jua" style={{ flex: 1, padding: "12px 8px", borderRadius: 14, border: "none",
                    background: ready ? C.gold : "#c3ccbe", color: "#fff", fontSize: 14.5, cursor: ready ? "pointer" : "not-allowed" }}>다 읽었어요 ✓</button>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#93a08c", marginTop: 8, textAlign: "center" }}>
                {timer.readMode === "target"
                  ? "화면을 벗어나면 타이머가 멈춰요. 목표 시간을 채우면 자유롭게 이어서 읽을 수 있어요."
                  : timer.secs < timer.minRequired
                    ? (timer.isBonusRead ? `최소 10분은 읽어야 보너스를 받을 수 있어요. (지금 ${Math.floor(timer.secs / 60)}분)` : `최소 ${dailyTargetMinutes}분은 읽어야 오늘 물주기를 완료할 수 있어요. (지금 ${Math.floor(timer.secs / 60)}분)`)
                    : "이제 완료할 수 있어요! 더 읽을수록 우리 반 나무에 더 많이 기여해요 🌱"}
              </div>
            </div>
          </div>
        );
      })()}

      {/* 아래쪽: 읽기 버튼(기존 읽기 탭과 같은 동작). 읽는 중에는 위의 타이머 카드가 대신 보임 */}
      {!timer && <div style={{ position: "absolute", left: 12, right: 12, bottom: 12, background: "#ffffffee", borderRadius: 18, padding: "12px 14px",
        boxShadow: "0 6px 18px #3f7e4e22", border: `1px solid ${C.leafL}55` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: C.inkSoft }}>{mySeat ? `${mySeat}번 자리 · 오늘 읽을 책` : isStudent ? "빈자리를 눌러 앉아 보세요 · 오늘 읽을 책" : "오늘 읽을 책"}</div>
            <div className="cs-jua" style={{ fontSize: 17, color: C.greenDk, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{myBook || "아직 없어요"}</div>
          </div>
          {myBook && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
              <button onClick={onPickBook} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 11.5, textDecoration: "underline", textDecorationStyle: "dotted", cursor: "pointer", padding: 0 }}>📚 책 바꾸기</button>
              {isStudent && <button onClick={onCompleteBook} style={{ border: "none", background: "transparent", color: C.gold, fontSize: 11.5, textDecoration: "underline", cursor: "pointer", padding: 0 }}>🍎 완독하기</button>}
            </div>
          )}
        </div>
        <div style={{ marginTop: 10 }}>
          {doneToday ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="cs-jua" style={{ flex: 1, fontSize: 14, color: C.greenDk }}>오늘 물주기 완료 🌸</div>
              {isStudent && myBook && (
                <button onClick={() => start(onStartBonus)} className="cs-jua" style={{ padding: "11px 14px", borderRadius: 14, fontSize: 13.5, color: C.greenDk, cursor: "pointer", background: "#fff", border: `1.5px solid ${C.green}` }}>
                  {bonusResumeMinutes > 0 ? `▶ 보너스 이어 읽기 (${bonusResumeMinutes}분)` : "⏱ 더 읽기 (보너스)"}</button>
              )}
            </div>
          ) : !myBook ? (
            <button onClick={onPickBook} className="cs-jua" style={{ width: "100%", border: "none", padding: "13px", borderRadius: 16, fontSize: 15.5, color: "#fff", cursor: "pointer", background: `linear-gradient(${C.green}, ${C.greenDk})` }}>🔍 책 찾으러 가기</button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => start(onStartTarget)} className="cs-jua" style={{ flex: 1.5, border: "none", padding: "13px 8px", borderRadius: 16, fontSize: 15.5, color: "#fff", cursor: "pointer",
                background: `linear-gradient(${C.green}, ${C.greenDk})`, boxShadow: "0 5px 12px #3f7e4e44" }}>
                {resumeMinutes > 0 ? `▶ 이어서 읽기 (${resumeMinutes}분)` : `📖 ${dailyTargetMinutes}분 읽기 시작`}</button>
              <button onClick={() => start(onStartFree)} className="cs-jua" style={{ flex: 1, padding: "13px 8px", borderRadius: 16, fontSize: 14, color: C.greenDk, cursor: "pointer", background: "#fff", border: `1.5px solid ${C.green}` }}>⏱ 자유롭게</button>
            </div>
          )}
        </div>
      </div>}
    </div>
  );
}
