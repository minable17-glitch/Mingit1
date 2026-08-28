import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  createClass, teacherLogin, studentLogin, logout as apiLogout,
  getClassById, updateClassSettings, getClassProgress,
  getMyLogs, getTodayLog, getCurrentBook, startBook as apiStartBook, submitLog,
  getClassLogsForTeacher, getClassRoster, searchBooks,
  getClassCurrentBooks, getClassReadingSessions, setReadingSession, sendCheer,
} from "./lib/api";
import { getSession, setSession, clearSession } from "./lib/session";

function stageFromDays(days) {
  if (days <= 0) return 0;
  if (days < 4) return 1;
  if (days < 10) return 2;
  if (days < 18) return 3;
  if (days < 26) return 4;
  return 5;
}

function formatLogDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T00:00:00");
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ─────────────────────────────────────────────────────────────
// 새싹책방 — 30일 독서 챌린지 프로토타입 (탭 구조)
// 탭: 숲 · 책 찾기 · 읽기 · 내 기록 · 랭킹
// ※ 책 검색은 목업, OCR·엑셀·백엔드는 다음 단계에서 연결
// ─────────────────────────────────────────────────────────────

const C = {
  skyTop: "#FCEFCF", skyBot: "#E7F1DC", grassA: "#CFE7A6", grassB: "#A9CE78",
  trunk: "#AE7749", trunkDark: "#855834", leafL: "#9BD187", leafM: "#6FB86C", leafD: "#4E9459",
  bloom: "#F79FB5", bloomC: "#FBD968", sun: "#FBD24E", water: "#7CC4D6",
  ink: "#35503F", inkSoft: "#6E8574", gold: "#EDA83A", green: "#57A365", greenDk: "#3F7E4E",
  paper: "#FBF7EE", face: "#3C4E3D",
};
const STAGE_NAME = ["씨앗", "새싹", "줄기", "잎", "꽃봉오리", "활짝 핀 꽃"];
const COVERS = ["#F6C6C6", "#F7DEA6", "#BFE3C0", "#C6D8F6", "#E3C6F6", "#F6D9BF"];

function Tree({ stage = 3, size = 120, communal = false, reading = false }) {
  const w = size, h = size * 1.25;
  const face = (cx, cy, k) => (
    <g>
      <circle cx={cx - 10 * k} cy={cy + 4 * k} r={2.4 * k} fill={C.bloom} opacity="0.5" />
      <circle cx={cx + 10 * k} cy={cy + 4 * k} r={2.4 * k} fill={C.bloom} opacity="0.5" />
      <ellipse cx={cx - 6 * k} cy={cy - 1 * k} rx={1.5 * k} ry={2.1 * k} fill={C.face} />
      <ellipse cx={cx + 6 * k} cy={cy - 1 * k} rx={1.5 * k} ry={2.1 * k} fill={C.face} />
      <path d={`M ${cx - 3.4 * k} ${cy + 3.2 * k} Q ${cx} ${cy + 6 * k} ${cx + 3.4 * k} ${cy + 3.2 * k}`}
        stroke={C.face} strokeWidth={1.2 * k} fill="none" strokeLinecap="round" />
    </g>
  );
  const fluffy = (cy, R) => {
    const bumps = [[50, cy - R * 0.62, R * 0.52], [50 - R * 0.6, cy - R * 0.18, R * 0.5],
      [50 + R * 0.6, cy - R * 0.18, R * 0.5], [50 - R * 0.34, cy - R * 0.55, R * 0.42], [50 + R * 0.34, cy - R * 0.55, R * 0.42]];
    return (
      <g>
        {bumps.map((b, i) => <circle key={"b" + i} cx={b[0]} cy={b[1]} r={b[2]} fill={C.leafD} />)}
        <ellipse cx="50" cy={cy} rx={R} ry={R * 0.94} fill={C.leafD} />
        <ellipse cx={50 - R * 0.28} cy={cy + R * 0.12} rx={R * 0.66} ry={R * 0.62} fill={C.leafM} />
        <ellipse cx={50 + R * 0.3} cy={cy + R * 0.08} rx={R * 0.58} ry={R * 0.55} fill={C.leafM} />
        <ellipse cx="50" cy={cy - R * 0.28} rx={R * 0.6} ry={R * 0.5} fill={C.leafL} />
      </g>
    );
  };
  const flowers = (cy, R, open) => {
    const spots = [[50, cy - R * 0.72], [50 - R * 0.72, cy - R * 0.1], [50 + R * 0.72, cy - R * 0.1],
      [50 - R * 0.42, cy + R * 0.5], [50 + R * 0.42, cy + R * 0.5], [50, cy + R * 0.66]];
    const n = open ? (communal ? 6 : 5) : 3;
    return spots.slice(0, n).map((s, i) => open ? (
      <g key={"f" + i}>
        {[0, 72, 144, 216, 288].map((a) => { const rad = (a * Math.PI) / 180;
          return <circle key={a} cx={s[0] + Math.cos(rad) * 2.6} cy={s[1] + Math.sin(rad) * 2.6} r={1.9} fill={C.bloom} />; })}
        <circle cx={s[0]} cy={s[1]} r={1.7} fill={C.bloomC} />
      </g>
    ) : <circle key={"f" + i} cx={s[0]} cy={s[1]} r={2.3} fill={C.bloom} opacity="0.9" />);
  };
  const canopyMap = { 2: [72, 16], 3: [60, 23], 4: [54, 28], 5: [50, 30] };
  const [cy, R] = canopyMap[stage] || canopyMap[3];
  const k = R / 23;
  const trunkTop = stage <= 1 ? 96 : stage === 2 ? 82 : cy + R * 0.7;
  return (
    <svg viewBox="0 0 100 122" width={w} height={h} style={{ overflow: "visible", display: "block" }}>
      {communal && stage >= 4 && <circle cx="50" cy={cy} r={R + 18} fill={C.sun} opacity="0.13" />}
      {stage <= 0 && (<g>
        <ellipse cx="50" cy="108" rx="10" ry="6" fill={C.trunkDark} />
        <path d="M50 102 q4 -6 1 -11" stroke={C.leafD} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <circle cx="50" cy="90" r="3.2" fill={C.leafM} /></g>)}
      {stage === 1 && (<g>
        <rect x="48.3" y="90" width="3.4" height="22" rx="1.7" fill={C.leafD} />
        <ellipse cx="42" cy="88" rx="8" ry="5.5" fill={C.leafM} transform="rotate(-28 42 88)" />
        <ellipse cx="58" cy="88" rx="8" ry="5.5" fill={C.leafL} transform="rotate(28 58 88)" />
        {face(50, 96, 0.8)}</g>)}
      {stage >= 2 && (<>
        <rect x={50 - 4} y={trunkTop} width="8" height={112 - trunkTop} rx="4" fill={communal ? C.trunkDark : C.trunk} />
        {fluffy(cy, R)}{stage >= 4 && flowers(cy, R, stage === 5)}{face(50, cy + 1, k)}</>)}
      {reading && <g className="cs-drip"><path d="M50 20 q3.2 5 0 8.4 q-3.2 -3.4 0 -8.4 z" fill={C.water} /></g>}
    </svg>
  );
}

// 정원 배경 꾸미기 — 언덕·구름·잔디 빈터·들꽃·버섯·풀숲·조약돌
function Scenery() {
  const flowers = [
    { x: 55, y: 352, c: "#F79FB5", s: 1.1 }, { x: 112, y: 388, c: "#FBD968", s: 1.2 },
    { x: 384, y: 360, c: "#F79FB5", s: 1.1 }, { x: 412, y: 390, c: "#C6A8F0", s: 1.1 },
    { x: 28, y: 392, c: "#FBD968", s: 1 }, { x: 225, y: 406, c: "#F79FB5", s: 1.1 },
    { x: 305, y: 398, c: "#C6A8F0", s: 1 }, { x: 158, y: 406, c: "#FBD968", s: 0.95 },
    { x: 350, y: 392, c: "#9BD187", s: 0.9 },
  ];
  const tufts = [{ x: 88, y: 372 }, { x: 150, y: 398 }, { x: 262, y: 392 }, { x: 332, y: 382 },
    { x: 402, y: 402 }, { x: 44, y: 372 }, { x: 200, y: 400 }, { x: 365, y: 372 }];
  const mush = [{ x: 72, y: 402, s: 1 }, { x: 352, y: 406, s: 1.1 }];
  const peb = [{ x: 132, y: 410 }, { x: 292, y: 406 }, { x: 245, y: 412 }];
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
      viewBox="0 0 440 412" preserveAspectRatio="none">
      <defs>
        <radialGradient id="grass" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor="#D9EDAF" /><stop offset="100%" stopColor="#A6CD77" />
        </radialGradient>
      </defs>
      {[[78, 58, 1], [352, 92, 0.85]].map((c, i) => (
        <g key={"cl" + i} opacity="0.9">
          <ellipse cx={c[0]} cy={c[1]} rx={26 * c[2]} ry={15 * c[2]} fill="#fff" />
          <ellipse cx={c[0] + 22 * c[2]} cy={c[1] + 3 * c[2]} rx={20 * c[2]} ry={13 * c[2]} fill="#fff" />
          <ellipse cx={c[0] - 20 * c[2]} cy={c[1] + 4 * c[2]} rx={17 * c[2]} ry={11 * c[2]} fill="#fff" />
        </g>
      ))}
      <ellipse cx="120" cy="360" rx="210" ry="95" fill="#BCDD8F" />
      <ellipse cx="360" cy="372" rx="200" ry="90" fill="#B0D682" />
      <ellipse cx="220" cy="398" rx="248" ry="120" fill="url(#grass)" />
      <ellipse cx="205" cy="330" rx="150" ry="40" fill="#DDF0B4" opacity="0.5" />
      <ellipse cx="220" cy="250" rx="66" ry="13" fill="#3f7e4e" opacity="0.12" />
      {[[24, 336, 1], [420, 346, 1.1]].map((b, i) => (
        <g key={"bs" + i}>
          <circle cx={b[0]} cy={b[1]} r={20 * b[2]} fill={C.leafD} />
          <circle cx={b[0] - 16 * b[2]} cy={b[1] + 6 * b[2]} r={15 * b[2]} fill={C.leafM} />
          <circle cx={b[0] + 16 * b[2]} cy={b[1] + 6 * b[2]} r={15 * b[2]} fill={C.leafM} />
          <circle cx={b[0]} cy={b[1] + 8 * b[2]} r={15 * b[2]} fill={C.leafL} />
        </g>
      ))}
      {tufts.map((t, i) => (
        <g key={"tf" + i} stroke={C.leafD} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.8">
          <path d={`M${t.x} ${t.y} q-3 -8 -4 -12`} /><path d={`M${t.x} ${t.y} q0 -9 0 -14`} /><path d={`M${t.x} ${t.y} q3 -8 4 -12`} />
        </g>
      ))}
      {peb.map((p, i) => <ellipse key={"pb" + i} cx={p.x} cy={p.y} rx="6" ry="3.4" fill="#C9C3B2" />)}
      {mush.map((m, i) => (
        <g key={"ms" + i}>
          <rect x={m.x - 2.4 * m.s} y={m.y - 2} width={4.8 * m.s} height={9 * m.s} rx={2 * m.s} fill="#FBF3E2" />
          <ellipse cx={m.x} cy={m.y - 2} rx={7 * m.s} ry={5 * m.s} fill="#E8776E" />
          <circle cx={m.x - 2.5 * m.s} cy={m.y - 3 * m.s} r={1.2 * m.s} fill="#fff" />
          <circle cx={m.x + 2 * m.s} cy={m.y - 2 * m.s} r={1 * m.s} fill="#fff" />
        </g>
      ))}
      {flowers.map((f, i) => (
        <g key={"fw" + i}>
          <rect x={f.x - 0.6} y={f.y} width="1.2" height={9 * f.s} fill={C.leafD} opacity="0.6" />
          {[0, 60, 120, 180, 240, 300].map((a) => { const r = (a * Math.PI) / 180;
            return <circle key={a} cx={f.x + Math.cos(r) * 3.2 * f.s} cy={f.y + Math.sin(r) * 3.2 * f.s} r={2.3 * f.s} fill={f.c} />; })}
          <circle cx={f.x} cy={f.y} r={1.9 * f.s} fill="#FBD968" />
        </g>
      ))}
    </svg>
  );
}

// 공용 나무 — 학생 나무와 다른, 크고 웅장한 3단 나무 (기여도 열매 + 표정)
function CommunalTree({ size = 182, pct = 60 }) {
  const w = size, h = size * 1.35;
  const nFruit = Math.min(7, Math.floor(pct / 13));
  const bloom = pct >= 55, bigBloom = pct >= 90;
  const fruitSpots = [[26, 86], [40, 92], [60, 92], [74, 86], [33, 79], [67, 79], [50, 96]];
  const fCol = ["#F2857E", "#F7B750", "#F79FB5"];
  const flowerSpots = [[30, 44], [50, 30], [70, 44], [38, 58], [62, 58], [50, 50], [22, 56], [78, 56]];
  return (
    <svg viewBox="0 0 100 132" width={w} height={h} style={{ overflow: "visible", display: "block" }}>
      <circle cx="50" cy="56" r="52" fill={C.sun} opacity="0.15" />
      <circle cx="50" cy="56" r="38" fill={C.sun} opacity="0.11" />
      <path d="M41 121 Q39 96 44 76 L56 76 Q61 96 59 121 Z" fill={C.trunkDark} />
      <path d="M47 121 Q46 100 48 80 L51 80 L51 121 Z" fill="#6e4526" opacity="0.45" />
      <ellipse cx="41" cy="121" rx="9" ry="4" fill={C.trunkDark} />
      <ellipse cx="59" cy="121" rx="9" ry="4" fill={C.trunkDark} />
      {/* 3단 캐노피 (뒤 어두운 층) */}
      <ellipse cx="50" cy="72" rx="41" ry="27" fill={C.leafD} />
      <ellipse cx="50" cy="50" rx="33" ry="25" fill={C.leafD} />
      <ellipse cx="50" cy="31" rx="23" ry="19" fill={C.leafD} />
      {/* 앞 밝은 층 */}
      <ellipse cx="43" cy="75" rx="30" ry="20" fill={C.leafM} />
      <ellipse cx="59" cy="73" rx="27" ry="18" fill={C.leafM} />
      <ellipse cx="50" cy="52" rx="25" ry="19" fill={C.leafM} />
      <ellipse cx="42" cy="61" rx="16" ry="13" fill={C.leafL} opacity="0.9" />
      <ellipse cx="50" cy="33" rx="16" ry="13" fill={C.leafL} />
      <circle cx="33" cy="25" r="8" fill={C.leafM} />
      <circle cx="67" cy="27" r="9" fill={C.leafM} />
      {bloom && flowerSpots.slice(0, bigBloom ? 8 : 5).map((s, i) => (
        <g key={"fl" + i}>
          {[0, 72, 144, 216, 288].map((a) => { const r = (a * Math.PI) / 180;
            return <circle key={a} cx={s[0] + Math.cos(r) * 2.8} cy={s[1] + Math.sin(r) * 2.8} r={2} fill={C.bloom} />; })}
          <circle cx={s[0]} cy={s[1]} r="1.8" fill={C.bloomC} />
        </g>
      ))}
      {Array.from({ length: nFruit }).map((_, i) => { const s = fruitSpots[i]; return (
        <g key={"fr" + i}>
          <line x1={s[0]} y1={s[1] - 4} x2={s[0]} y2={s[1] - 1} stroke={C.leafD} strokeWidth="0.8" />
          <circle cx={s[0]} cy={s[1]} r="3" fill={fCol[i % 3]} />
          <circle cx={s[0] - 0.9} cy={s[1] - 0.9} r="0.9" fill="#fff" opacity="0.6" />
        </g>
      ); })}
      <g>
        <circle cx="37" cy="60" r="4.2" fill={C.bloom} opacity="0.45" />
        <circle cx="63" cy="60" r="4.2" fill={C.bloom} opacity="0.45" />
        <ellipse cx="44" cy="55" rx="2.3" ry="3.3" fill={C.face} />
        <ellipse cx="56" cy="55" rx="2.3" ry="3.3" fill={C.face} />
        <path d="M43.5 61 Q50 67.5 56.5 61" stroke={C.face} strokeWidth="1.9" fill="none" strokeLinecap="round" />
      </g>
      {bigBloom && [[16, 40], [84, 44], [50, 14]].map((s, i) => (
        <text key={"sp" + i} x={s[0]} y={s[1]} fontSize="7" textAnchor="middle">✨</text>
      ))}
    </svg>
  );
}

const BADGES = [
  { icon: "🐿️", title: "개근 다람쥐", who: "별이", detail: "연속 14일 물주기" },
  { icon: "☀️", title: "햇살 요정", who: "토리", detail: "응원 32번 보냄" },
  { icon: "💧", title: "물조리개 대장", who: "초코", detail: "우리 반 나무 +48" },
  { icon: "🍎", title: "열매 부자", who: "뭉치", detail: "이번 주 3권 완독" },
];
const CHEERS = ["❤️", "🔥", "👏", "🌟"];
function Cover({ title, cover, size = 46 }) {
  if (cover) {
    return (
      <img src={cover} alt="" width={size} height={size * 1.3} style={{ width: size, height: size * 1.3, borderRadius: 8,
        objectFit: "cover", flexShrink: 0, boxShadow: "0 2px 5px #0002" }} />
    );
  }
  const c = COVERS[(title?.length || 0) % COVERS.length];
  return (
    <div style={{ width: size, height: size * 1.3, borderRadius: 8, background: c, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 5px #0002" }}>
      <span className="cs-jua" style={{ fontSize: size * 0.5, color: "#fff" }}>{title?.[0] || "?"}</span>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("splash");
  const [enter, setEnter] = useState(false);
  const [tab, setTab] = useState("forest");

  // ── 역할·학급·학생 세션 ──
  const [role, setRole] = useState(null); // 'teacher' | 'student'
  const [classInfo, setClassInfo] = useState(null); // { id, name, code, start_date, goal_pct }
  const [studentInfo, setStudentInfo] = useState(null); // { id, nickname }
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [teacherForm, setTeacherForm] = useState({ name: "", password: "", goalPct: 80 });
  const [teacherLoginForm, setTeacherLoginForm] = useState({ code: "", password: "" });
  const [studentJoinForm, setStudentJoinForm] = useState({ code: "", nickname: "", pin: "" });
  const [createdClass, setCreatedClass] = useState(null);
  const [currentBook, setCurrentBook] = useState(null); // { id, title, author } | null
  const [myBook, setMyBook] = useState(null);
  const [doneToday, setDoneToday] = useState(false);
  const [reading, setReading] = useState(false);
  const [readMode, setReadMode] = useState("target"); // 'target' | 'free'
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [reflecting, setReflecting] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const ocrInputRef = useRef(null);
  const [secs, setSecs] = useState(600);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [classProgress, setClassProgress] = useState({ joined_today: 0, total_students: 1, class_pct: 0 });
  const [bloomPulse, setBloomPulse] = useState(false);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [showTeacher, setShowTeacher] = useState(false);
  const [pin, setPin] = useState("");
  const [myLog, setMyLog] = useState([]);
  const [teacherLogs, setTeacherLogs] = useState([]);
  const [teacherRoster, setTeacherRoster] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const goalPct = classInfo?.goal_pct ?? 80;
  const dailyTargetMinutes = classInfo?.daily_target_minutes ?? 10;
  const myStage = stageFromDays(myLog.length);
  const timerRef = useRef(null);
  const classmatesErrorShownRef = useRef(false);

  const refreshClassProgress = async (classId) => {
    try {
      const p = await getClassProgress(classId);
      setClassProgress(p);
    } catch { /* 참여율은 실패해도 화면은 계속 사용 가능 */ }
  };

  useEffect(() => {
    if (screen !== "main" || !classInfo?.id) return;
    refreshClassProgress(classInfo.id);
    if (role === "student" && studentInfo?.id) {
      getTodayLog(studentInfo.id).then((l) => setDoneToday(!!l)).catch(() => {});
      getMyLogs(studentInfo.id).then((logs) => {
        setMyLog(logs.map((l) => ({ date: formatLogDate(l.log_date), book: l.books?.title || "", note: l.note, minutes: l.minutes })));
      }).catch(() => {});
      getCurrentBook(studentInfo.id).then((b) => { setCurrentBook(b); setMyBook(b?.title ?? null); }).catch(() => {});
    } else if (role === "teacher" && classInfo?.id) {
      getClassLogsForTeacher(classInfo.id).then(setTeacherLogs).catch(() => {});
      getClassRoster(classInfo.id).then(setTeacherRoster).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, role, classInfo?.id, studentInfo?.id]);

  const refreshClassmates = async (classId, myStudentId) => {
    try {
      const roster = await getClassRoster(classId);
      const others = roster.filter((s) => s.id !== myStudentId);
      const ids = others.map((s) => s.id);
      const [books, sessions] = await Promise.all([
        getClassCurrentBooks(ids),
        getClassReadingSessions(ids),
      ]);
      setClassmates(
        others.map((s) => ({
          id: s.id,
          nick: s.nickname,
          book: books[s.id] || "아직 책을 안 골랐어요",
          stage: stageFromDays(s.total_days),
          totalDays: s.total_days,
          reading: !!sessions[s.id],
        }))
      );
    } catch (e) {
      if (!classmatesErrorShownRef.current) {
        classmatesErrorShownRef.current = true;
        showToast(`학급원 정보를 못 불러왔어요: ${e.message || e}`);
      }
    }
  };

  useEffect(() => {
    if (screen !== "main" || tab !== "forest" || !classInfo?.id) return;
    refreshClassmates(classInfo.id, studentInfo?.id);
    const t = setInterval(() => refreshClassmates(classInfo.id, studentInfo?.id), 12000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, tab, role, classInfo?.id, studentInfo?.id]);

  useEffect(() => {
    if (tab !== "search") return;
    if (!query.trim()) { setResults([]); setSearchError(""); return; }
    setSearching(true);
    setSearchError("");
    const t = setTimeout(() => {
      searchBooks(query.trim())
        .then((books) => setResults(books))
        .catch(() => setSearchError("검색에 실패했어요. 잠시 후 다시 시도해주세요."))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [query, tab]);

  useEffect(() => {
    if (screen !== "splash") return;
    const t1 = setTimeout(() => setEnter(true), 2600);
    return () => clearTimeout(t1);
  }, [screen]);

  const proceedFromSplash = async () => {
    const saved = getSession();
    if (saved && saved.role === "teacher" && saved.classInfo) {
      setRole("teacher");
      setClassInfo(saved.classInfo);
      setScreen("main");
      getClassById(saved.classInfo.id).then(setClassInfo).catch(() => {});
    } else if (saved && saved.role === "student" && saved.classInfo && saved.studentInfo) {
      setRole("student");
      setClassInfo(saved.classInfo);
      setStudentInfo(saved.studentInfo);
      setScreen("main");
      getClassById(saved.classInfo.id).then(setClassInfo).catch(() => {});
    } else {
      setScreen("role");
    }
  };

  const handleCreateClass = async () => {
    setAuthError("");
    if (!teacherForm.name.trim() || teacherForm.password.length < 4) {
      setAuthError("학급 이름과 4자리 이상 비밀번호를 입력해주세요.");
      return;
    }
    setAuthBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const created = await createClass({
        name: teacherForm.name.trim(),
        adminPassword: teacherForm.password,
        startDate: today,
        goalPct: teacherForm.goalPct,
      });
      const cls = await getClassById(created.id);
      setCreatedClass(cls);
      setRole("teacher");
      setClassInfo(cls);
      setSession({ role: "teacher", classInfo: cls });
      setScreen("teacher-code");
    } catch (e) {
      setAuthError(e.message || "학급을 만들지 못했어요. 다시 시도해주세요.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleTeacherLogin = async () => {
    setAuthError("");
    if (!teacherLoginForm.code.trim() || !teacherLoginForm.password) {
      setAuthError("학급 코드와 비밀번호를 입력해주세요.");
      return;
    }
    setAuthBusy(true);
    try {
      const loggedIn = await teacherLogin({
        classCode: teacherLoginForm.code.trim(),
        adminPassword: teacherLoginForm.password,
      });
      const cls = await getClassById(loggedIn.id);
      setRole("teacher");
      setClassInfo(cls);
      setSession({ role: "teacher", classInfo: cls });
      setScreen("main");
    } catch (e) {
      setAuthError(e.message || "로그인에 실패했어요.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleStudentJoin = async () => {
    setAuthError("");
    if (!studentJoinForm.code.trim() || !studentJoinForm.nickname.trim() || studentJoinForm.pin.length !== 4) {
      setAuthError("학급 코드, 닉네임, PIN 4자리를 모두 입력해주세요.");
      return;
    }
    setAuthBusy(true);
    try {
      const student = await studentLogin({
        classCode: studentJoinForm.code.trim(),
        nickname: studentJoinForm.nickname.trim(),
        pin: studentJoinForm.pin,
      });
      const cls = await getClassById(student.class_id);
      setRole("student");
      setClassInfo(cls);
      setStudentInfo({ id: student.id, nickname: student.nickname });
      setSession({ role: "student", classInfo: cls, studentInfo: { id: student.id, nickname: student.nickname } });
      setScreen("main");
    } catch (e) {
      setAuthError(e.message || "참여에 실패했어요. 코드와 PIN을 확인해주세요.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    await apiLogout();
    clearSession();
    setRole(null);
    setClassInfo(null);
    setStudentInfo(null);
    setShowTeacher(false);
    setScreen("role");
  };

  const syncReadingSession = (isReading) => {
    if (role === "student" && studentInfo?.id) {
      setReadingSession(studentInfo.id, isReading).catch(() => {});
    }
  };

  const finishAuto = () => {
    clearInterval(timerRef.current);
    setReading(false);
    syncReadingSession(false);
    setSessionMinutes(dailyTargetMinutes);
    setReflecting(true);
  };

  useEffect(() => {
    if (!reading) return;
    timerRef.current = setInterval(() => {
      setSecs((s) => {
        if (readMode === "target" && s <= 1) {
          clearInterval(timerRef.current);
          finishAuto();
          return 0;
        }
        return readMode === "free" ? s + 1 : s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, readMode]);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const startReading = (mode) => {
    setReadMode(mode);
    setSecs(mode === "free" ? 0 : dailyTargetMinutes * 60);
    setReading(true);
    syncReadingSession(true);
  };

  const finishManual = () => {
    clearInterval(timerRef.current);
    setReading(false);
    syncReadingSession(false);
    const minutesRead = readMode === "free"
      ? Math.max(1, Math.round(secs / 60))
      : Math.max(1, Math.round((dailyTargetMinutes * 60 - secs) / 60));
    setSessionMinutes(minutesRead);
    setReflecting(true);
  };

  const handleOcrFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrBusy(true);
    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "kor+eng");
      const text = (data?.text || "").trim();
      if (text) {
        setNote((n) => (n.trim() ? `${n.trim()}\n${text}` : text));
        showToast("구절을 인식했어요. 필요하면 다듬어주세요 ✏️");
      } else {
        showToast("글자를 잘 못 읽었어요. 더 밝은 곳에서 다시 찍어볼까요?");
      }
    } catch {
      showToast("구절 스캔에 실패했어요.");
    } finally {
      setOcrBusy(false);
    }
  };

  const submit = async () => {
    if (!note.trim()) return;
    const savedNote = note.trim();
    if (role !== "student" || !studentInfo?.id) {
      // 선생님 계정은 체험용으로만 동작 (실제 저장 없음)
      setReflecting(false); setNote(""); setDoneToday(true); setBloomPulse(true);
      setTab("forest");
      showToast("선생님 계정에서는 기록이 저장되지 않아요 (체험용)");
      setTimeout(() => setBloomPulse(false), 1400);
      return;
    }
    setSubmitBusy(true);
    try {
      await submitLog({
        studentId: studentInfo.id,
        bookId: currentBook?.id ?? null,
        minutes: sessionMinutes,
        note: savedNote,
      });
      setReflecting(false); setNote("");
      setDoneToday(true); setBloomPulse(true);
      setMyLog((l) => [{ date: "오늘", book: currentBook?.title || "", note: savedNote, minutes: sessionMinutes }, ...l]);
      setTab("forest");
      showToast(`물을 줬어요! 오늘 ${sessionMinutes}분 읽었어요 🌱`);
      setTimeout(() => setBloomPulse(false), 1400);
      if (classInfo?.id) refreshClassProgress(classInfo.id);
    } catch (e) {
      showToast(e.message?.includes("duplicate") ? "오늘은 이미 기록했어요." : (e.message || "저장에 실패했어요. 다시 시도해주세요."));
    } finally {
      setSubmitBusy(false);
    }
  };

  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  const TOTAL = classProgress.total_students || 1;
  const joinedToday = classProgress.joined_today || 0;
  const classPct = classProgress.class_pct || 0;
  const todayRate = Math.round((joinedToday / TOTAL) * 100);
  const goalCount = Math.ceil((TOTAL * goalPct) / 100);
  const remain = Math.max(0, goalCount - joinedToday);
  const goalMet = todayRate >= goalPct;

  const teacherStats = teacherRoster.map((s) => {
    const rows = teacherLogs.filter((l) => l.student_id === s.id);
    return {
      nick: s.nickname,
      days: rows.length,
      min: rows.reduce((sum, r) => sum + (r.minutes || 0), 0),
      done: 0,
    };
  });

  const handleUpdateGoal = async (g) => {
    if (!classInfo?.id) return;
    try {
      const updated = await updateClassSettings(classInfo.id, { goalPct: g });
      setClassInfo(updated);
      setSession({ role: "teacher", classInfo: updated });
    } catch (e) { showToast(e.message || "설정 저장에 실패했어요."); }
  };

  const handleUpdateTarget = async (m) => {
    if (!classInfo?.id) return;
    try {
      const updated = await updateClassSettings(classInfo.id, { dailyTargetMinutes: m });
      setClassInfo(updated);
      setSession({ role: "teacher", classInfo: updated });
    } catch (e) { showToast(e.message || "설정 저장에 실패했어요."); }
  };

  const exportExcel = () => {
    try {
      const daily = teacherLogs.map((l) => ({
        닉네임: l.students?.nickname || "", 날짜: formatLogDate(l.log_date), 책제목: l.books?.title || "",
        "읽은시간(분)": l.minutes, 느낀점: l.note, 완료: "O",
      }));
      const summary = teacherStats.map((s) => ({ 닉네임: s.nick, 완료일수: s.days, "총 독서시간(분)": s.min, 완독권수: s.done }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(daily), "일별기록");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "학생요약");
      XLSX.writeFile(wb, "새싹책방_독서기록.xlsx");
      showToast("엑셀 파일을 내려받았어요 📄");
    } catch (e) {
      showToast("미리보기에선 다운로드가 막힐 수 있어요. 실제 앱에선 저장돼요.");
    }
  };

  const myNick = role === "student" && studentInfo ? studentInfo.nickname : "나";
  const allTrees = role === "student"
    ? [{ me: true, nick: myNick, book: myBook || "아직 책을 안 골랐어요", stage: myStage }, ...classmates]
    : classmates;
  const topDays = [
    ...(role === "student" ? [{ nick: myNick, days: myLog.length }] : []),
    ...classmates.map((c) => ({ nick: c.nick, days: c.totalDays || 0 })),
  ].sort((a, b) => b.days - a.days).slice(0, 3);
  const daysSinceStart = classInfo?.start_date
    ? Math.min(30, Math.max(1, Math.floor((Date.now() - new Date(classInfo.start_date + "T00:00:00").getTime()) / 86400000) + 1))
    : 1;
  const n = allTrees.length;
  const positioned = allTrees.map((t, i) => {
    const deg = 90 + i * (360 / n); const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    // 공동 나무(가운데 아래쪽, top 60%대)와 겹치지 않도록 세로 범위를 위쪽으로 제한
    return { ...t, left: 50 + 38 * cos, top: 34 + 18 * sin, scale: 0.68 + 0.28 * ((sin + 1) / 2), z: Math.min(14, Math.round(2 + (sin + 1) * 10)) };
  });
  const Z = { communal: 15, tabbar: 100, timer: 200, reflect: 210, card: 250, toast: 400 };

  const TABS = [
    { id: "forest", icon: "🌳", label: "숲" },
    { id: "search", icon: "🔍", label: "책 찾기" },
    { id: "read", icon: "📖", label: "읽기", center: true },
    { id: "log", icon: "📔", label: "내 기록" },
    { id: "rank", icon: "🏆", label: "랭킹" },
  ];

  return (
    <div style={{ fontFamily: "'Gowun Dodum', sans-serif", color: C.ink, width: "100%", minHeight: "100%",
      display: "flex", justifyContent: "center", background: "#DDE9D3" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jua&family=Gaegu:wght@700&family=Gowun+Dodum&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .cs-jua { font-family: 'Jua', sans-serif; } .cs-hand { font-family: 'Gaegu', cursive; }
        @keyframes cs-sprout { 0%{transform:scale(0) translateY(20px);opacity:0} 60%{transform:scale(1.1);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes cs-rise { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes cs-fade { from{opacity:0} to{opacity:1} }
        @keyframes cs-drip { 0%{transform:translateY(-4px);opacity:0} 30%{opacity:1} 100%{transform:translateY(26px);opacity:0} }
        @keyframes cs-sway { 0%,100%{transform:rotate(-1.5deg)} 50%{transform:rotate(1.5deg)} }
        @keyframes cs-pulse { 0%,100%{transform:translateX(-50%) scale(1)} 50%{transform:translateX(-50%) scale(1.05)} }
        @keyframes cs-shimmer { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes cs-sun { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes cs-up { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes cs-float { 0%,100%{transform:translate(0,0) rotate(-6deg)} 50%{transform:translate(12px,-16px) rotate(8deg)} }
        .cs-drip { animation: cs-drip 1.3s ease-in infinite; }
        @media (prefers-reduced-motion: reduce){ *{animation:none!important} }
      `}</style>

      <div style={{ width: "100%", maxWidth: 440, minHeight: "100vh", position: "relative", overflow: "hidden",
        background: `linear-gradient(${C.skyTop}, ${C.skyBot} 66%)` }}>

        {/* 스플래시 */}
        {screen === "splash" && (
          <div onClick={proceedFromSplash} style={{ position: "absolute", inset: 0, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer",
            background: `linear-gradient(${C.skyTop}, ${C.skyBot})` }}>
            <div style={{ animation: "cs-sprout 1s ease both" }}><Tree stage={2} size={140} /></div>
            <div className="cs-jua" style={{ fontSize: 44, color: C.greenDk, marginTop: 10, animation: "cs-rise .7s ease .9s both" }}>새싹책방</div>
            <div style={{ fontSize: 15, color: C.inkSoft, marginTop: 3, animation: "cs-fade .8s ease 1.5s both" }}>하루 10분, 우리 반이 함께 키우는 숲</div>
            {enter && <div style={{ marginTop: 32, fontSize: 13, color: C.inkSoft, animation: "cs-fade .5s ease both" }}>화면을 눌러 시작하기</div>}
          </div>
        )}

        {/* 역할 선택 */}
        {screen === "role" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
            <Tree stage={2} size={100} />
            <div className="cs-jua" style={{ fontSize: 26, color: C.greenDk, marginBottom: 6 }}>새싹책방</div>
            <button onClick={() => { setAuthError(""); setScreen("teacher-entry"); }} className="cs-jua" style={{ width: "100%", maxWidth: 300,
              padding: "18px 20px", borderRadius: 18, border: "none", fontSize: 17, color: "#fff", cursor: "pointer",
              background: `linear-gradient(${C.green}, ${C.greenDk})`, boxShadow: "0 6px 16px #3f7e4e44" }}>👩‍🏫 선생님으로 시작</button>
            <button onClick={() => { setAuthError(""); setScreen("student-join"); }} className="cs-jua" style={{ width: "100%", maxWidth: 300,
              padding: "18px 20px", borderRadius: 18, border: `1.5px solid ${C.green}`, fontSize: 17, color: C.greenDk, cursor: "pointer",
              background: "#fff" }}>🧒 학생으로 참여</button>
          </div>
        )}

        {/* 선생님: 새 학급 만들기 / 기존 학급 로그인 선택 */}
        {screen === "teacher-entry" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
            <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk, marginBottom: 6 }}>👩‍🏫 선생님</div>
            <button onClick={() => { setAuthError(""); setScreen("teacher-create"); }} className="cs-jua" style={{ width: "100%", maxWidth: 300,
              padding: "16px 20px", borderRadius: 16, border: "none", fontSize: 16, color: "#fff", cursor: "pointer",
              background: `linear-gradient(${C.green}, ${C.greenDk})` }}>새 학급 만들기</button>
            <button onClick={() => { setAuthError(""); setScreen("teacher-login"); }} className="cs-jua" style={{ width: "100%", maxWidth: 300,
              padding: "16px 20px", borderRadius: 16, border: `1.5px solid ${C.green}`, fontSize: 16, color: C.greenDk, cursor: "pointer",
              background: "#fff" }}>이미 만든 학급 관리하기</button>
            <button onClick={() => setScreen("role")} style={{ marginTop: 6, border: "none", background: "transparent",
              color: C.inkSoft, fontSize: 13, cursor: "pointer" }}>← 뒤로</button>
          </div>
        )}

        {/* 선생님: 새 학급 만들기 폼 */}
        {screen === "teacher-create" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            padding: "40px 24px", gap: 12, overflowY: "auto" }}>
            <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk, marginBottom: 4 }}>새 학급 만들기</div>
            <label style={{ fontSize: 13, color: C.inkSoft }}>학급 이름</label>
            <input value={teacherForm.name} onChange={(e) => setTeacherForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="예: 3학년 2반" style={{ padding: "13px 15px", borderRadius: 14, border: "1.5px solid #d9d2c2",
                fontSize: 15, fontFamily: "inherit", outline: "none", background: "#fff", color: C.ink }} />
            <label style={{ fontSize: 13, color: C.inkSoft }}>관리자 비밀번호 (4자리 이상)</label>
            <input type="password" value={teacherForm.password} onChange={(e) => setTeacherForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="비밀번호" style={{ padding: "13px 15px", borderRadius: 14, border: "1.5px solid #d9d2c2",
                fontSize: 15, fontFamily: "inherit", outline: "none", background: "#fff", color: C.ink }} />
            <label style={{ fontSize: 13, color: C.inkSoft }}>오늘의 반 목표 참여율</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[70, 80, 90, 100].map((g) => (
                <button key={g} onClick={() => setTeacherForm((f) => ({ ...f, goalPct: g }))} className="cs-jua"
                  style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: teacherForm.goalPct === g ? "none" : "1px solid #e2dac9",
                    background: teacherForm.goalPct === g ? C.green : "#fff", color: teacherForm.goalPct === g ? "#fff" : C.ink,
                    fontSize: 14, cursor: "pointer" }}>{g}%</button>
              ))}
            </div>
            {authError && <div style={{ color: "#d15b5b", fontSize: 13 }}>{authError}</div>}
            <button onClick={handleCreateClass} disabled={authBusy} className="cs-jua" style={{ marginTop: 10, padding: 15, borderRadius: 16,
              border: "none", fontSize: 17, color: "#fff", cursor: authBusy ? "default" : "pointer",
              background: authBusy ? "#c3ccbe" : `linear-gradient(${C.green}, ${C.greenDk})` }}>
              {authBusy ? "만드는 중..." : "학급 만들기"}</button>
            <button onClick={() => setScreen("teacher-entry")} style={{ border: "none", background: "transparent",
              color: C.inkSoft, fontSize: 13, cursor: "pointer" }}>← 뒤로</button>
          </div>
        )}

        {/* 선생님: 학급 코드 발급 완료 */}
        {screen === "teacher-code" && createdClass && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", padding: 28, gap: 14 }}>
            <div style={{ fontSize: 40 }}>🎉</div>
            <div className="cs-jua" style={{ fontSize: 20, color: C.greenDk }}>학급이 만들어졌어요!</div>
            <div style={{ fontSize: 13, color: C.inkSoft, textAlign: "center" }}>학생들에게 이 코드를 알려주세요.</div>
            <div className="cs-jua" style={{ fontSize: 34, color: C.gold, background: "#fff", padding: "16px 32px",
              borderRadius: 18, border: `2px dashed ${C.gold}`, letterSpacing: 2 }}>{createdClass.code}</div>
            <button onClick={() => setScreen("main")} className="cs-jua" style={{ marginTop: 10, padding: "14px 36px", borderRadius: 16,
              border: "none", fontSize: 16, color: "#fff", cursor: "pointer", background: `linear-gradient(${C.green}, ${C.greenDk})` }}>
              시작하기</button>
          </div>
        )}

        {/* 선생님: 기존 학급 로그인 */}
        {screen === "teacher-login" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            padding: "40px 24px", gap: 12, justifyContent: "center" }}>
            <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk, marginBottom: 4 }}>학급 관리자 로그인</div>
            <label style={{ fontSize: 13, color: C.inkSoft }}>학급 코드</label>
            <input value={teacherLoginForm.code} onChange={(e) => setTeacherLoginForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="예: 숲7423" style={{ padding: "13px 15px", borderRadius: 14, border: "1.5px solid #d9d2c2",
                fontSize: 15, fontFamily: "inherit", outline: "none", background: "#fff", color: C.ink }} />
            <label style={{ fontSize: 13, color: C.inkSoft }}>관리자 비밀번호</label>
            <input type="password" value={teacherLoginForm.password} onChange={(e) => setTeacherLoginForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="비밀번호" style={{ padding: "13px 15px", borderRadius: 14, border: "1.5px solid #d9d2c2",
                fontSize: 15, fontFamily: "inherit", outline: "none", background: "#fff", color: C.ink }} />
            {authError && <div style={{ color: "#d15b5b", fontSize: 13 }}>{authError}</div>}
            <button onClick={handleTeacherLogin} disabled={authBusy} className="cs-jua" style={{ marginTop: 10, padding: 15, borderRadius: 16,
              border: "none", fontSize: 17, color: "#fff", cursor: authBusy ? "default" : "pointer",
              background: authBusy ? "#c3ccbe" : `linear-gradient(${C.green}, ${C.greenDk})` }}>
              {authBusy ? "확인 중..." : "로그인"}</button>
            <button onClick={() => setScreen("teacher-entry")} style={{ border: "none", background: "transparent",
              color: C.inkSoft, fontSize: 13, cursor: "pointer" }}>← 뒤로</button>
          </div>
        )}

        {/* 학생: 학급 코드 + 닉네임 + PIN */}
        {screen === "student-join" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            padding: "40px 24px", gap: 12, justifyContent: "center" }}>
            <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk, marginBottom: 4 }}>🧒 학생으로 참여</div>
            <label style={{ fontSize: 13, color: C.inkSoft }}>학급 코드</label>
            <input value={studentJoinForm.code} onChange={(e) => setStudentJoinForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="선생님이 알려준 코드" style={{ padding: "13px 15px", borderRadius: 14, border: "1.5px solid #d9d2c2",
                fontSize: 15, fontFamily: "inherit", outline: "none", background: "#fff", color: C.ink }} />
            <label style={{ fontSize: 13, color: C.inkSoft }}>닉네임</label>
            <input value={studentJoinForm.nickname} onChange={(e) => setStudentJoinForm((f) => ({ ...f, nickname: e.target.value }))}
              placeholder="이름 대신 쓸 닉네임" style={{ padding: "13px 15px", borderRadius: 14, border: "1.5px solid #d9d2c2",
                fontSize: 15, fontFamily: "inherit", outline: "none", background: "#fff", color: C.ink }} />
            <label style={{ fontSize: 13, color: C.inkSoft }}>PIN 4자리 (처음이면 새로 정하기, 두 번째면 이전과 동일하게)</label>
            <input value={studentJoinForm.pin} onChange={(e) => setStudentJoinForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
              placeholder="숫자 4자리" inputMode="numeric" style={{ padding: "13px 15px", borderRadius: 14, border: "1.5px solid #d9d2c2",
                fontSize: 15, fontFamily: "inherit", outline: "none", background: "#fff", color: C.ink, letterSpacing: 4 }} />
            {authError && <div style={{ color: "#d15b5b", fontSize: 13 }}>{authError}</div>}
            <button onClick={handleStudentJoin} disabled={authBusy} className="cs-jua" style={{ marginTop: 10, padding: 15, borderRadius: 16,
              border: "none", fontSize: 17, color: "#fff", cursor: authBusy ? "default" : "pointer",
              background: authBusy ? "#c3ccbe" : `linear-gradient(${C.green}, ${C.greenDk})` }}>
              {authBusy ? "확인 중..." : "참여하기"}</button>
            <button onClick={() => setScreen("role")} style={{ border: "none", background: "transparent",
              color: C.inkSoft, fontSize: 13, cursor: "pointer" }}>← 뒤로</button>
          </div>
        )}

        {screen === "main" && (
          <>
            <div style={{ minHeight: "100vh", paddingBottom: 78 }}>

              {/* ── 숲 탭 ── */}
              {tab === "forest" && (
                <>
                  <div style={{ padding: "16px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div className="cs-jua" style={{ fontSize: 23, color: C.greenDk }}>🌱 새싹책방</div>
                      {classInfo && (
                        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 1 }}>
                          {classInfo.name ? `${classInfo.name} · ` : ""}코드 {classInfo.code}
                          {role === "student" && studentInfo ? ` · ${studentInfo.nickname}` : ""}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {role === "teacher" && (
                        <button onClick={() => setShowTeacher(true)} style={{ border: "none", background: "#ffffffcc",
                          borderRadius: 20, padding: "5px 12px", fontSize: 12, color: C.greenDk, cursor: "pointer" }}>👩‍🏫 반 관리</button>
                      )}
                      <div style={{ background: "#ffffffcc", borderRadius: 20, padding: "5px 13px", fontSize: 13 }}>🗓️ {daysSinceStart} / 30</div>
                    </div>
                  </div>
                  <div style={{ padding: "0 18px 4px" }}>
                    <div style={{ background: "#fff", borderRadius: 16, padding: "12px 14px", border: `1px solid ${goalMet ? C.leafL : "#eee5d3"}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                        <span className="cs-jua" style={{ fontSize: 14.5, color: C.greenDk }}>🎯 오늘의 반 목표</span>
                        <span style={{ fontSize: 12, color: C.inkSoft }}>목표 참여율 {goalPct}%</span>
                      </div>
                      <div style={{ position: "relative", height: 12, background: "#eef2e8", borderRadius: 7, overflow: "visible" }}>
                        <div style={{ width: `${todayRate}%`, height: "100%", borderRadius: 7,
                          background: goalMet ? `linear-gradient(90deg, ${C.gold}, #f0b73f)` : `linear-gradient(90deg, ${C.leafL}, ${C.green})`, transition: "width .5s ease" }} />
                        <div style={{ position: "absolute", left: `${goalPct}%`, top: -3, bottom: -3, width: 2, background: C.greenDk, borderRadius: 2 }} />
                        <div style={{ position: "absolute", left: `${goalPct}%`, top: -16, transform: "translateX(-50%)", fontSize: 11 }}>🚩</div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 7 }}>
                        <span style={{ fontSize: 12.5, color: C.ink }}>오늘 {joinedToday}/{TOTAL}명 참여 ({todayRate}%)</span>
                        <span className="cs-hand" style={{ fontSize: 14, color: goalMet ? C.gold : C.green }}>
                          {goalMet ? "오늘 목표 달성! 다 함께 해냈어요 🎉" : `${remain}명만 더 하면 달성! 🌟`}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: "0 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>
                      <span>우리 반 숲 (30일 누적)</span><span>{classPct}%</span></div>
                    <div style={{ height: 9, background: "#ffffff88", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${classPct}%`, height: "100%", borderRadius: 6, background: `linear-gradient(90deg, ${C.leafL}, ${C.green})`, transition: "width .6s ease" }} /></div>
                  </div>
                  <div style={{ position: "relative", height: 412, marginTop: 4 }}>
                    <div style={{ position: "absolute", top: 6, right: 22, animation: "cs-sun 6s ease-in-out infinite" }}>
                      <svg width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="27" fill={C.sun} opacity="0.24" /><circle cx="30" cy="30" r="17" fill={C.sun} /></svg></div>
                    <Scenery />
                    <div style={{ position: "absolute", left: "14%", top: "18%", fontSize: 20, zIndex: 40, animation: "cs-float 6s ease-in-out infinite" }}>🦋</div>
                    <div style={{ position: "absolute", right: "12%", top: "44%", fontSize: 15, zIndex: 40, animation: "cs-float 7s ease-in-out infinite .8s" }}>🦋</div>
                    <div style={{ position: "absolute", left: "50%", top: "60%", transform: "translateX(-50%)", zIndex: Z.communal,
                      animation: bloomPulse ? "cs-pulse 1.2s ease" : "none" }}>
                      <div style={{ transform: "translateY(-100%)", transformOrigin: "bottom center", animation: bloomPulse ? "none" : "cs-sway 8s ease-in-out infinite" }}>
                        <CommunalTree size={188} pct={classPct} /></div></div>
                    <div style={{ position: "absolute", left: "50%", top: "60.5%", transform: "translateX(-50%)", zIndex: Z.communal + 1,
                      background: "#fff", padding: "3px 13px", borderRadius: 16, fontSize: 12, color: C.greenDk,
                      boxShadow: "0 2px 6px #0002", border: `1px solid ${C.leafL}` }} className="cs-jua">🌳 우리 반 나무</div>
                    {positioned.map((t, i) => (
                      <div key={i} onClick={() => setSelected(t)} style={{ position: "absolute", left: `${t.left}%`, top: `${t.top}%`,
                        transform: "translate(-50%,-100%)", zIndex: t.z, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ animation: t.reading ? "cs-sway 2.6s ease-in-out infinite" : "none", transformOrigin: "bottom center" }}>
                          <Tree stage={t.stage} size={72 * t.scale} reading={t.reading} /></div>
                        <div style={{ marginTop: 1, background: t.me ? "#fff" : "#ffffffcc", border: t.me ? `2px solid ${C.gold}` : "1px solid #fff",
                          borderRadius: 10, padding: "1px 7px", textAlign: "center", boxShadow: "0 2px 4px #0000000f" }}>
                          <div className="cs-hand" style={{ fontSize: 13.5, lineHeight: 1.15, color: C.greenDk }}>{t.nick}</div>
                          <div style={{ fontSize: 8.5, color: C.inkSoft, lineHeight: 1.1, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.book}</div>
                          {t.reading && <div style={{ fontSize: 8, color: C.green, animation: "cs-shimmer 1.4s infinite" }}>독서중…</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", fontSize: 12, color: "#4b6b3f", padding: "2px 0 10px" }}>나무를 누르면 그 친구가 읽는 책이 보여요 🌿</div>
                </>
              )}

              {/* ── 책 찾기 탭 ── */}
              {tab === "search" && (
                <div style={{ padding: "18px 18px 0" }}>
                  <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk }}>🔍 책 찾기</div>
                  <div style={{ fontSize: 12.5, color: C.inkSoft, margin: "3px 0 12px" }}>읽을 책을 골라 내 나무에 걸어두세요.</div>
                  <div style={{ background: "#fff", borderRadius: 14, padding: "10px 14px", marginBottom: 8, display: "flex",
                    alignItems: "center", gap: 8, border: "1px solid #eadfce" }}>
                    <span style={{ fontSize: 14, color: C.greenDk }}>지금 읽는 책</span>
                    <span className="cs-jua" style={{ fontSize: 15, color: C.ink }}>{myBook || "아직 없어요"}</span>
                  </div>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목이나 작가를 검색해보세요"
                    style={{ width: "100%", padding: "13px 15px", borderRadius: 14, border: "1.5px solid #d9d2c2", fontSize: 15,
                      fontFamily: "inherit", outline: "none", background: "#fff", color: C.ink, marginBottom: 12 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {!query.trim() && (
                      <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: 24 }}>책 제목이나 작가 이름을 검색해보세요 🔎</div>
                    )}
                    {searching && (
                      <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: 20 }}>검색 중...</div>
                    )}
                    {searchError && (
                      <div style={{ textAlign: "center", color: "#d15b5b", fontSize: 13, padding: 20 }}>{searchError}</div>
                    )}
                    {!searching && !searchError && results.map((b, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 14,
                        padding: 10, border: "1px solid #eee5d3" }}>
                        <Cover title={b.title} cover={b.cover} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cs-jua" style={{ fontSize: 15.5, color: C.ink, lineHeight: 1.2 }}>{b.title}</div>
                          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{b.author}</div>
                        </div>
                        <button onClick={async () => {
                          if (role === "student" && studentInfo?.id) {
                            try {
                              const book = await apiStartBook(studentInfo.id, { title: b.title, author: b.author });
                              setCurrentBook(book);
                            } catch (e) { showToast(e.message || "책 등록에 실패했어요."); return; }
                          }
                          setMyBook(b.title);
                          showToast(`'${b.title}'을(를) 내 책으로 골랐어요 📖`);
                          setTab("read");
                        }}
                          className="cs-jua" style={{ border: "none", background: myBook === b.title ? "#cbd8c3" : C.green, color: "#fff",
                            borderRadius: 12, padding: "9px 13px", fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
                          {myBook === b.title ? "선택됨" : "이 책 읽기"}</button>
                      </div>
                    ))}
                    {!searching && !searchError && query.trim() && results.length === 0 && (
                      <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: 20 }}>검색 결과가 없어요. 다른 낱말로 찾아볼까요?</div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 읽기 탭 ── */}
              {tab === "read" && (
                <div style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "70vh", justifyContent: "center" }}>
                  <Tree stage={myStage} size={150} />
                  <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 10 }}>오늘 읽을 책</div>
                  <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk, marginBottom: 4 }}>{myBook || "아직 없어요"}</div>
                  {doneToday ? (
                    <div className="cs-jua" style={{ background: "#fff", color: C.greenDk, textAlign: "center", padding: "16px 24px",
                      borderRadius: 18, fontSize: 16, border: `1px solid ${C.leafL}`, marginTop: 10 }}>오늘 물주기 완료 🌸<br />내일 또 만나요!</div>
                  ) : !myBook ? (
                    <>
                      <div style={{ fontSize: 13, color: C.inkSoft, textAlign: "center", marginBottom: 20, maxWidth: 260 }}>
                        먼저 읽을 책을 골라주세요.</div>
                      <button onClick={() => setTab("search")} className="cs-jua" style={{ border: "none", padding: "15px 34px", borderRadius: 18,
                        fontSize: 16, color: "#fff", cursor: "pointer", background: `linear-gradient(${C.green}, ${C.greenDk})` }}>
                        🔍 책 찾으러 가기</button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: C.inkSoft, textAlign: "center", marginBottom: 22, maxWidth: 260 }}>
                        읽고 느낀 점 한 줄을 남기면 나무에 물을 줄 수 있어요.</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 280 }}>
                        <button onClick={() => startReading("target")} className="cs-jua" style={{ border: "none", padding: "16px 20px", borderRadius: 20,
                          fontSize: 18, color: "#fff", cursor: "pointer", background: `linear-gradient(${C.green}, ${C.greenDk})`, boxShadow: "0 6px 16px #3f7e4e55" }}>
                          📖 {dailyTargetMinutes}분 읽기 시작</button>
                        <button onClick={() => startReading("free")} className="cs-jua" style={{ padding: "14px 20px", borderRadius: 20,
                          fontSize: 15, color: C.greenDk, cursor: "pointer", background: "#fff", border: `1.5px solid ${C.green}` }}>
                          ⏱ 자유롭게 읽기</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── 내 기록 탭 ── */}
              {tab === "log" && (
                <div style={{ padding: "18px 18px 0" }}>
                  <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk }}>📔 내 기록</div>
                  {!unlocked ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 0" }}>
                      <div style={{ fontSize: 40 }}>🔒</div>
                      <div style={{ fontSize: 14, color: C.ink, margin: "10px 0 4px" }}>내 느낀점은 나만 볼 수 있어요</div>
                      <div style={{ fontSize: 12, color: C.inkSoft, marginBottom: 18 }}>비밀번호 4자리를 입력하세요</div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: pin.length > i ? C.green : "#d7ddd2" }} />
                        ))}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 64px)", gap: 10 }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "←", 0, "✓"].map((k, i) => (
                          <button key={i} onClick={() => {
                            if (k === "←") setPin((p) => p.slice(0, -1));
                            else if (k === "✓") { if (pin.length === 4) { setUnlocked(true); setPin(""); } }
                            else setPin((p) => (p.length < 4 ? p + k : p));
                          }} className="cs-jua" style={{ height: 56, borderRadius: 14, border: "none", fontSize: 20,
                            background: k === "✓" ? C.green : "#fff", color: k === "✓" ? "#fff" : C.ink, cursor: "pointer", boxShadow: "0 2px 5px #0000000d" }}>{k}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "#a7b3a0", marginTop: 14 }}>※ 체험용: 아무 숫자 4자리나 넣고 ✓</div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 12.5, color: C.inkSoft }}>지금까지 {myLog.length}일 기록했어요 🌱</div>
                      {myLog.length === 0 && (
                        <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 13, padding: 24 }}>
                          아직 기록이 없어요. 오늘 첫 기록을 남겨볼까요? 📖</div>
                      )}
                      {myLog.map((e, i) => (
                        <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 14, border: "1px solid #eee5d3" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span className="cs-jua" style={{ fontSize: 14, color: C.greenDk }}>{e.date}</span>
                            <span style={{ fontSize: 11.5, color: C.inkSoft }}>📖 {e.book}{e.minutes ? ` · ${e.minutes}분` : ""}</span>
                          </div>
                          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.5 }}>“{e.note}”</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 랭킹 탭 ── */}
              {tab === "rank" && (
                <div style={{ padding: "18px 18px 0" }}>
                  <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk }}>🏆 이주의 주인공</div>
                  <div style={{ fontSize: 12.5, color: C.inkSoft, margin: "2px 0 16px" }}>매주 월요일 새로 시작해요. 누구나 주인공이 될 수 있어요!</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {BADGES.map((b, i) => (
                      <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "16px 12px", textAlign: "center", border: "1px solid #eee5d3" }}>
                        <div style={{ fontSize: 32 }}>{b.icon}</div>
                        <div className="cs-jua" style={{ fontSize: 14, color: C.gold, marginTop: 4 }}>이주의 {b.title}</div>
                        <div className="cs-hand" style={{ fontSize: 20, color: C.greenDk, lineHeight: 1.1 }}>{b.who}</div>
                        <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 2 }}>{b.detail}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#a7b3a0", textAlign: "center", padding: "6px 0 0" }}>※ 배지 4종은 아직 예시예요. 다음 업데이트에서 실제 집계로 연결돼요.</div>
                  <div style={{ marginTop: 16, background: "#fff", borderRadius: 16, padding: "14px 16px", border: "1px solid #eee5d3" }}>
                    <div className="cs-jua" style={{ fontSize: 15, color: C.greenDk, marginBottom: 8 }}>🐿️ 참여왕 TOP 3</div>
                    {topDays.length === 0 && <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "6px 0" }}>아직 기록이 없어요.</div>}
                    {topDays.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: i < topDays.length - 1 ? "1px dashed #eee5d3" : "none" }}>
                        <span style={{ fontSize: 14 }}>{["🥇", "🥈", "🥉"][i]} <span className="cs-hand" style={{ fontSize: 17, color: C.ink }}>{s.nick}</span></span>
                        <span style={{ fontSize: 12.5, color: C.inkSoft }}>누적 {s.days}일</span>
                      </div>
                    ))}
                  </div>
                  {role === "teacher" && (
                    <button onClick={() => setShowTeacher(true)} style={{ width: "100%", marginTop: 16, padding: 12,
                      borderRadius: 14, border: "1px dashed #cbb98a", background: "#fff", color: C.gold, fontSize: 13.5,
                      cursor: "pointer" }}>👩‍🏫 선생님용 · 반 관리 열기</button>
                  )}
                  <button onClick={handleLogout} style={{ width: "100%", marginTop: 10, padding: 10,
                    borderRadius: 14, border: "none", background: "transparent", color: C.inkSoft, fontSize: 12.5,
                    cursor: "pointer" }}>로그아웃</button>
                </div>
              )}
            </div>

            {/* 하단 탭바 */}
            <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: Z.tabbar, display: "flex", justifyContent: "center" }}>
              <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderTop: "1px solid #ececdf",
                display: "flex", justifyContent: "space-around", alignItems: "flex-end", padding: "8px 6px 12px", boxShadow: "0 -2px 12px #0000000a" }}>
                {TABS.map((t) => {
                  const active = tab === t.id;
                  if (t.center) return (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ border: "none", background: "transparent", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", transform: "translateY(-10px)" }}>
                      <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(${C.green}, ${C.greenDk})`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: "0 5px 12px #3f7e4e55",
                        border: "3px solid #fff" }}>{t.icon}</div>
                      <span className="cs-jua" style={{ fontSize: 11, color: C.greenDk, marginTop: 2 }}>{t.label}</span>
                    </button>
                  );
                  return (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{ border: "none", background: "transparent", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1, opacity: active ? 1 : 0.5 }}>
                      <span style={{ fontSize: 21 }}>{t.icon}</span>
                      <span style={{ fontSize: 11, color: active ? C.greenDk : C.inkSoft, fontWeight: active ? 700 : 400 }}>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 나무 상세 + 응원 */}
        {selected && (
          <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "#2e3d2f99", zIndex: Z.card,
            display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: C.paper, borderRadius: "24px 24px 0 0",
              padding: "20px 22px 30px", animation: "cs-up .28s ease" }}>
              <div style={{ width: 44, height: 5, background: "#00000018", borderRadius: 3, margin: "0 auto 14px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Tree stage={selected.stage} size={64} />
                <div>
                  <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk }}>{selected.nick}</div>
                  <div style={{ fontSize: 13.5, color: C.ink }}>📖 {selected.book}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>지금 {STAGE_NAME[selected.stage]} 단계</div>
                </div>
              </div>
              {selected.me ? (
                <button onClick={() => { setSelected(null); setTab("log"); }} className="cs-jua" style={{ width: "100%", marginTop: 16,
                  padding: 14, borderRadius: 14, border: "none", fontSize: 16, color: "#fff", cursor: "pointer", background: `linear-gradient(${C.green}, ${C.greenDk})` }}>
                  🔒 내 독서기록 보기</button>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12.5, color: C.inkSoft, textAlign: "center", marginBottom: 8 }}>응원을 보내볼까요? 💬</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    {CHEERS.map((c) => (
                      <button key={c} onClick={async () => {
                        const nk = selected.nick; const toId = selected.id; setSelected(null);
                        if (role === "student" && studentInfo?.id && toId) {
                          try { await sendCheer({ fromStudentId: studentInfo.id, toStudentId: toId, emoji: c }); }
                          catch { showToast("응원 전송에 실패했어요."); return; }
                        }
                        showToast(`${nk}에게 응원을 보냈어요! ${c}`);
                      }}
                        style={{ fontSize: 26, width: 56, height: 56, borderRadius: 16, border: "1px solid #eee5d3", background: "#fff", cursor: "pointer" }}>{c}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 선생님용 · 반 관리 */}
        {showTeacher && (
          <div onClick={() => setShowTeacher(false)} style={{ position: "fixed", inset: 0, background: "#2e3d2f99", zIndex: 260,
            display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: C.paper, borderRadius: "24px 24px 0 0",
              padding: "20px 20px 30px", animation: "cs-up .28s ease", maxHeight: "88vh", overflowY: "auto" }}>
              <div style={{ width: 44, height: 5, background: "#00000018", borderRadius: 3, margin: "0 auto 14px" }} />
              <div className="cs-jua" style={{ fontSize: 22, color: C.greenDk }}>👩‍🏫 선생님용 · 반 관리</div>
              <div style={{ fontSize: 12.5, color: C.inkSoft, margin: "2px 0 14px" }}>총 {TOTAL}명 · 오늘 {joinedToday}명 참여 ({todayRate}%)</div>

              {/* 목표 설정 */}
              <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #eee5d3", marginBottom: 12 }}>
                <div className="cs-jua" style={{ fontSize: 14.5, color: C.greenDk, marginBottom: 8 }}>🎯 오늘의 반 참여율 목표</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[70, 80, 90, 100].map((g) => (
                    <button key={g} onClick={() => handleUpdateGoal(g)} style={{ flex: 1, padding: "10px 0", borderRadius: 12,
                      border: goalPct === g ? "none" : "1px solid #e2dac9", background: goalPct === g ? C.green : "#fff",
                      color: goalPct === g ? "#fff" : C.ink, fontSize: 14, cursor: "pointer" }} className="cs-jua">{g}%</button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 8 }}>목표를 정하면 학생들 숲 화면에 "몇 명 더 하면 달성"으로 함께 보여요.</div>
              </div>

              {/* 하루 읽기 목표 시간 */}
              <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #eee5d3", marginBottom: 12 }}>
                <div className="cs-jua" style={{ fontSize: 14.5, color: C.greenDk, marginBottom: 8 }}>⏱ 하루 읽기 챌린지 시간</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {[10, 15, 20, 30].map((m) => (
                    <button key={m} onClick={() => handleUpdateTarget(m)} style={{ flex: 1, padding: "10px 0", borderRadius: 12,
                      border: dailyTargetMinutes === m ? "none" : "1px solid #e2dac9", background: dailyTargetMinutes === m ? C.green : "#fff",
                      color: dailyTargetMinutes === m ? "#fff" : C.ink, fontSize: 14, cursor: "pointer" }} className="cs-jua">{m}분</button>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 8 }}>학생 읽기 화면의 기본 타이머 시간이 바뀌어요. "자유롭게 읽기"는 계속 선택할 수 있어요.</div>
              </div>

              {/* 학생 요약 미리보기 */}
              <div style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #eee5d3", marginBottom: 12 }}>
                <div className="cs-jua" style={{ fontSize: 14.5, color: C.greenDk, marginBottom: 8 }}>📊 학생 요약</div>
                <div style={{ display: "flex", fontSize: 11.5, color: C.inkSoft, padding: "0 0 6px", borderBottom: "1px solid #eee5d3" }}>
                  <span style={{ flex: 1 }}>닉네임</span><span style={{ width: 60, textAlign: "right" }}>완료일</span>
                  <span style={{ width: 66, textAlign: "right" }}>총 분</span><span style={{ width: 54, textAlign: "right" }}>완독</span>
                </div>
                {teacherStats.length === 0 && (
                  <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 12.5, padding: 14 }}>아직 참여한 학생이 없어요.</div>
                )}
                {teacherStats.map((s, i) => (
                  <div key={i} style={{ display: "flex", fontSize: 13, color: C.ink, padding: "6px 0", borderBottom: i < teacherStats.length - 1 ? "1px dashed #f0ead9" : "none" }}>
                    <span style={{ flex: 1 }} className="cs-hand">{s.nick}</span>
                    <span style={{ width: 60, textAlign: "right" }}>{s.days}일</span>
                    <span style={{ width: 66, textAlign: "right" }}>{s.min}분</span>
                    <span style={{ width: 54, textAlign: "right" }}>{s.done}권</span>
                  </div>
                ))}
              </div>

              <button onClick={exportExcel} className="cs-jua" style={{ width: "100%", padding: 15, borderRadius: 16, border: "none",
                fontSize: 17, color: "#fff", cursor: "pointer", background: `linear-gradient(${C.green}, ${C.greenDk})`, boxShadow: "0 5px 14px #3f7e4e44" }}>
                📄 엑셀로 내보내기 (.xlsx)</button>
              <div style={{ fontSize: 11, color: "#a7b3a0", textAlign: "center", marginTop: 10 }}>
                일별 기록(날짜·책·시간·느낀점)과 학생 요약이 시트 2장으로 저장돼요. 느낀점은 학생끼리는 비공개, 선생님만 볼 수 있어요.</div>
            </div>
          </div>
        )}

        {/* 타이머 */}
        {reading && (
          <div style={{ position: "fixed", inset: 0, background: `linear-gradient(${C.skyTop}, ${C.skyBot})`, display: "flex",
            flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: Z.timer, padding: 24 }}>
            <div style={{ fontSize: 14, color: C.inkSoft }}>지금 읽는 책</div>
            <div className="cs-jua" style={{ fontSize: 20, color: C.greenDk, marginBottom: 4 }}>{myBook}</div>
            <Tree stage={myStage} size={140} reading />
            <div className="cs-jua" style={{ fontSize: 58, color: C.ink, letterSpacing: 3, marginTop: 4 }}>{mm}:{ss}</div>
            <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{readMode === "free" ? "자유롭게 읽는 중" : `목표 ${dailyTargetMinutes}분`}</div>
            <div style={{ fontSize: 13.5, color: C.inkSoft, marginTop: 6, textAlign: "center" }}>읽는 동안 나무에 물이 차올라요.<br />화면을 벗어나면 물주기가 멈춰요.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button onClick={() => { clearInterval(timerRef.current); setReading(false); syncReadingSession(false); }} style={{ padding: "11px 20px", borderRadius: 14,
                border: `1.5px solid ${C.inkSoft}55`, background: "transparent", color: C.inkSoft, fontSize: 14, cursor: "pointer" }}>그만두기</button>
              <button onClick={finishManual} className="cs-jua" style={{ padding: "11px 22px", borderRadius: 14, border: "none",
                background: C.gold, color: "#fff", fontSize: 14, cursor: "pointer" }}>{readMode === "free" ? "다 읽었어요 ✓" : "지금 마치기 ✓"}</button>
            </div>
          </div>
        )}

        {/* 느낀점 */}
        {reflecting && (
          <div style={{ position: "fixed", inset: 0, background: "#2e3d2faa", zIndex: Z.reflect, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: 440, background: C.paper, borderRadius: "24px 24px 0 0", padding: "22px 20px 30px", animation: "cs-up .28s ease" }}>
              <div style={{ width: 44, height: 5, background: "#00000018", borderRadius: 3, margin: "0 auto 16px" }} />
              <div className="cs-jua" style={{ fontSize: 20, color: C.greenDk }}>오늘의 한 줄 🌱</div>
              <div style={{ fontSize: 13, color: C.inkSoft, margin: "3px 0 14px" }}>느낀점을 남겨야 나무에 물이 가요. (필수)</div>
              <input ref={ocrInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleOcrFile} />
              <button onClick={() => ocrInputRef.current?.click()} disabled={ocrBusy} style={{ width: "100%", padding: 12, borderRadius: 14,
                marginBottom: 12, border: `1.5px dashed ${C.green}`, background: "#fff", color: C.greenDk, fontSize: 14, cursor: ocrBusy ? "default" : "pointer" }}>
                {ocrBusy ? "📷 구절을 읽는 중..." : "📷 마음에 드는 구절 스캔하기 (선택)"}</button>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="오늘 읽은 부분에서 느낀 점을 적어보세요"
                style={{ width: "100%", minHeight: 96, resize: "none", borderRadius: 14, border: "1.5px solid #d9d2c2", padding: 13, fontSize: 15,
                  fontFamily: "inherit", color: C.ink, outline: "none", background: "#fff" }} />
              <button onClick={submit} disabled={!note.trim() || submitBusy} className="cs-jua" style={{ width: "100%", marginTop: 14, padding: 15, borderRadius: 16,
                border: "none", fontSize: 17, color: "#fff", cursor: note.trim() && !submitBusy ? "pointer" : "not-allowed",
                background: note.trim() && !submitBusy ? `linear-gradient(${C.green}, ${C.greenDk})` : "#c3ccbe", boxShadow: note.trim() ? "0 5px 14px #3f7e4e44" : "none" }}>
                {submitBusy ? "저장 중..." : "💧 물 주기"}</button>
            </div>
          </div>
        )}

        {toast && (
          <div style={{ position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", background: "#2e3d2fee", color: "#fff",
            padding: "11px 18px", borderRadius: 30, fontSize: 13.5, zIndex: Z.toast, maxWidth: "88%", textAlign: "center" }}>{toast}</div>
        )}
      </div>
    </div>
  );
}
