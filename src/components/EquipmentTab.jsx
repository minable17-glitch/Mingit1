import { useEffect, useState } from 'react';
import { getMyEquipment, saveEquipment } from '../lib/api';

export default function EquipmentTab({ onSaved }) {
  const [loading, setLoading] = useState(true);
  const [bowNumber, setBowNumber] = useState('');
  const [laneInfo, setLaneInfo] = useState('');
  const [sightVertical, setSightVertical] = useState('');
  const [sightHorizontal, setSightHorizontal] = useState('');
  const [sightNote, setSightNote] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const eq = await getMyEquipment();
        if (cancelled || !eq) return;
        setBowNumber(eq.bow_number || '');
        setLaneInfo(eq.lane_info || '');
        setSightVertical(eq.sight_vertical || '');
        setSightHorizontal(eq.sight_horizontal || '');
        setSightNote(eq.sight_note || '');
      } catch {
        /* 장비를 아직 등록하지 않았으면 빈 값으로 시작 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!bowNumber.trim()) {
      setResult({ ok: false, error: '내 활 번호를 입력해주세요.' });
      return;
    }
    setPending(true);
    setResult(null);
    try {
      await saveEquipment({ bowNumber: bowNumber.trim(), laneInfo, sightVertical, sightHorizontal, sightNote });
      setResult({ ok: true });
      onSaved?.({ bowNumber: bowNumber.trim(), laneInfo, sightVertical, sightHorizontal, sightNote });
    } catch (err) {
      setResult({ ok: false, error: err.message || '저장에 실패했어요.' });
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="card center muted">불러오는 중...</div>;

  return (
    <div className="card">
      <h2>내 장비</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        활마다 특성이 달라 조준 데이터가 활에 종속돼요. 오조준(조준 보정)을 하려면
        같은 활을 매번 사용하는 게 중요해요.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>내 활 번호 *</label>
          <input type="text" value={bowNumber} onChange={(e) => setBowNumber(e.target.value)} placeholder="예: 7번" />
        </div>
        <div className="field">
          <label>조 / 사대 위치</label>
          <input type="text" value={laneInfo} onChange={(e) => setLaneInfo(e.target.value)} placeholder="예: 2조, 3번 사대" />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label>사이트 상하(높이)</label>
            <input type="text" value={sightVertical} onChange={(e) => setSightVertical(e.target.value)} placeholder="예: 12" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>사이트 좌우(수평)</label>
            <input type="text" value={sightHorizontal} onChange={(e) => setSightHorizontal(e.target.value)} placeholder="예: 3" />
          </div>
        </div>
        <div className="field">
          <label>사이트 세팅 메모</label>
          <textarea value={sightNote} onChange={(e) => setSightNote(e.target.value)} placeholder="자유롭게 메모해도 돼요" />
        </div>
        {result && !result.ok && <div className="msg msg-error">{result.error}</div>}
        {result && result.ok && <div className="msg msg-ok">저장했어요. 이 활 번호로 기록을 시작할 수 있어요.</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={pending} style={{ marginTop: 4 }}>
          {pending ? '저장 중...' : '이 활로 기록 시작'}
        </button>
      </form>
    </div>
  );
}
