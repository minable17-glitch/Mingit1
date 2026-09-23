// 시간표: 종 시간과 수업 있는 교시를 표시하면, 공강 시간에 브리핑에 "짜투리 모드"가 뜹니다.
import { useState } from 'react';
import * as api from '../lib/api.js';

const DAYS = ['월', '화', '수', '목', '금'];

export default function Timetable({ settings, userId, onSaved, onClose }) {
  const [bell, setBell] = useState(settings.bell_schedule ?? []);
  const [busy, setBusy] = useState(() => settings.timetable ?? {});
  const [saving, setSaving] = useState(false);

  const isBusy = (d, p) => (busy[String(d)] ?? []).includes(p);
  const toggle = (d, p) => {
    const key = String(d);
    const cur = busy[key] ?? [];
    setBusy({ ...busy, [key]: isBusy(d, p) ? cur.filter((x) => x !== p) : [...cur, p].sort((a, b) => a - b) });
  };
  const setTime = (i, patch) => setBell(bell.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  async function save() {
    setSaving(true);
    try {
      const patch = { bell_schedule: bell, timetable: busy };
      await api.updateSettings(userId, patch);
      onSaved({ ...settings, ...patch });
      onClose();
    } catch (e) {
      alert(`저장하지 못했어요: ${e.message}`);
      setSaving(false);
    }
  }

  return (
    <section>
      <header className="page-head">
        <button className="link" onClick={onClose}>← 설정</button>
        <button className="primary" disabled={saving} onClick={save}>저장</button>
      </header>
      <h1>시간표</h1>
      <p className="muted small">수업이 있는 칸을 눌러 표시하세요. 표시하지 않은 교시에 앱을 열면 “지금 공강” 안내와 함께 짧게 할 일을 추천해요.</p>

      <div className="block timetable">
        <table>
          <thead>
            <tr><th>교시</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr>
          </thead>
          <tbody>
            {bell.map((b) => (
              <tr key={b.period}>
                <th>{b.period}</th>
                {DAYS.map((_, i) => (
                  <td key={i}>
                    <button className={isBusy(i + 1, b.period) ? 'cell on' : 'cell'} onClick={() => toggle(i + 1, b.period)}>
                      {isBusy(i + 1, b.period) ? '수업' : ''}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="block stack">
        <h2>종 시간</h2>
        {bell.map((b, i) => (
          <div key={b.period} className="row">
            <span style={{ width: 44 }}>{b.period}교시</span>
            <input type="time" value={b.start} onChange={(e) => setTime(i, { start: e.target.value })} />
            ~
            <input type="time" value={b.end} onChange={(e) => setTime(i, { end: e.target.value })} />
          </div>
        ))}
        <div className="row">
          <button
            className="link"
            onClick={() => {
              const last = bell.at(-1);
              setBell([...bell, { period: (last?.period ?? 0) + 1, start: last?.end ?? '09:00', end: last?.end ?? '09:45' }]);
            }}
          >+ 교시 추가</button>
          {bell.length > 1 && <button className="link" onClick={() => setBell(bell.slice(0, -1))}>마지막 교시 빼기</button>}
        </div>
      </div>
    </section>
  );
}
