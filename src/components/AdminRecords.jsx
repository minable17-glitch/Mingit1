import { useEffect, useState } from 'react';
import { adminListStudents, adminListShootingLogs, adminListReflections } from '../lib/api';

export default function AdminRecords({ classId, adminPin }) {
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [s, l, r] = await Promise.all([
          adminListStudents(classId, adminPin),
          adminListShootingLogs(classId, adminPin),
          adminListReflections(classId, adminPin),
        ]);
        if (cancelled) return;
        setStudents(s);
        setLogs(l);
        setReflections(r);
      } catch (err) {
        if (!cancelled) setError(err.message || '기록을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId, adminPin]);

  if (loading) return <div className="card center muted">불러오는 중...</div>;
  if (error) return <div className="card msg msg-error">{error}</div>;

  return (
    <div>
      <div className="card">
        <h2>학생 명단 ({students.length}명)</h2>
        <div className="scroll-x">
          <table className="admin-table">
            <thead>
              <tr>
                <th>학번</th><th>이름</th><th>장비등록</th><th>기록횟수</th><th>성찰횟수</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.student_id}>
                  <td>{s.student_number}</td>
                  <td>{s.name}</td>
                  <td>{s.has_equipment ? '✓' : '-'}</td>
                  <td>{s.shooting_log_count}</td>
                  <td>{s.reflection_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>슈팅 기록 ({logs.length})</h2>
        <div className="scroll-x">
          <table className="admin-table">
            <thead>
              <tr>
                <th>날짜</th><th>학번</th><th>이름</th><th>차시</th><th>활</th><th>명중</th><th>보정 안내</th><th>세팅(전→후)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{l.log_date}</td>
                  <td>{l.student_number}</td>
                  <td>{l.student_name}</td>
                  <td>{l.session_label}</td>
                  <td>{l.bow_number}</td>
                  <td>{l.hit_count}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 220 }}>{l.aim_advice}</td>
                  <td>{l.sight_before} → {l.sight_after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>성찰 기록 ({reflections.length})</h2>
        {reflections.length === 0 && <p className="muted">아직 제출된 성찰 기록이 없어요.</p>}
        {reflections.map((r) => (
          <div key={r.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <b>{r.student_number} {r.student_name}</b>
              <span className="muted">{r.log_date}</span>
            </div>
            {r.used_skills?.length > 0 && (
              <div className="pill-row" style={{ marginBottom: 0 }}>
                {r.used_skills.map((s) => <span key={s} className="tag">{s}</span>)}
              </div>
            )}
            {r.short_note && <div className="muted">메모: {r.short_note}</div>}
            {r.endure && <div>① 인내·도전: {r.endure}</div>}
            {r.regulate && <div>② 자기조절: {r.regulate}</div>}
            {r.life_link && <div>③ 삶 연계: {r.life_link}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
