import { useEffect, useState } from 'react';
import StudentLoginGate from './components/StudentLoginGate';
import EquipmentTab from './components/EquipmentTab';
import ReadTab from './components/ReadTab';
import LearnTab from './components/LearnTab';
import RecordTab from './components/RecordTab';
import ReflectTab from './components/ReflectTab';
import AdminTab from './components/AdminTab';
import { getSession, clearSession } from './lib/session';
import { getMyEquipment, logout as apiLogout } from './lib/api';

const TABS = [
  { key: 'equipment', label: '내 장비', icon: '🏹' },
  { key: 'read', label: '읽어보기', icon: '📖' },
  { key: 'learn', label: '배워보기', icon: '🎬' },
  { key: 'record', label: '기록하기', icon: '🎯' },
  { key: 'reflect', label: '성찰하기', icon: '📝' },
];

export default function App() {
  const [mode, setMode] = useState('student'); // 'student' | 'admin'
  const [student, setStudent] = useState(() => getSession());
  const [equipment, setEquipment] = useState(null);
  const [equipmentLoaded, setEquipmentLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('equipment');

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    (async () => {
      try {
        const eq = await getMyEquipment();
        if (cancelled) return;
        if (eq) {
          setEquipment({
            bowNumber: eq.bow_number,
            laneInfo: eq.lane_info,
            sightVertical: eq.sight_vertical,
            sightHorizontal: eq.sight_horizontal,
            sightNote: eq.sight_note,
          });
        }
      } catch {
        /* 아직 장비 등록 전이거나 세션이 만료됨 — 등록 화면에서 다시 시도 */
      } finally {
        if (!cancelled) setEquipmentLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [student]);

  async function handleLogout() {
    await apiLogout();
    clearSession();
    setStudent(null);
    setEquipment(null);
    setEquipmentLoaded(false);
    setActiveTab('equipment');
  }

  if (mode === 'admin') {
    return <AdminTab onExit={() => setMode('student')} />;
  }

  if (!student) {
    return <StudentLoginGate onLoggedIn={setStudent} onWantAdmin={() => setMode('admin')} />;
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>🎯 LEVEL-UP ARCHERY</h1>
            <div className="sub">{student.name} ({student.studentNumber})</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button
              type="button"
              onClick={() => setMode('admin')}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 8, padding: '5px 9px', fontSize: 11, cursor: 'pointer' }}
            >
              관리자
            </button>
            <button
              type="button"
              onClick={handleLogout}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', borderRadius: 8, padding: '5px 9px', fontSize: 12, cursor: 'pointer' }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
      <div className="app-main">
        {activeTab === 'equipment' && (
          <EquipmentTab onSaved={(eq) => setEquipment(eq)} />
        )}
        {activeTab === 'read' && <ReadTab classId={student.classId} />}
        {activeTab === 'learn' && <LearnTab classId={student.classId} />}
        {activeTab === 'record' && equipmentLoaded && (
          <RecordTab equipment={equipment} onGoToEquipment={() => setActiveTab('equipment')} />
        )}
        {activeTab === 'record' && !equipmentLoaded && <div className="card center muted">불러오는 중...</div>}
        {activeTab === 'reflect' && <ReflectTab />}
      </div>
      <div className="bottom-nav">
        {TABS.map((t) => (
          <button key={t.key} className={activeTab === t.key ? 'active' : ''} onClick={() => setActiveTab(t.key)} type="button">
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
