import { useEffect, useState } from 'react';
import { getMyReflection, saveReflection } from '../lib/api';
import { todayKST } from '../lib/date';

const SKILL_OPTIONS = ['호흡법', '슈팅 루틴', '심상', '기타'];

export default function ReflectTab() {
  const today = todayKST();
  const [loading, setLoading] = useState(true);
  const [usedSkills, setUsedSkills] = useState([]);
  const [shortNote, setShortNote] = useState('');
  const [endure, setEndure] = useState('');
  const [regulate, setRegulate] = useState('');
  const [lifeLink, setLifeLink] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getMyReflection(today);
        if (cancelled || !r) return;
        setUsedSkills(r.used_skills || []);
        setShortNote(r.short_note || '');
        setEndure(r.endure || '');
        setRegulate(r.regulate || '');
        setLifeLink(r.life_link || '');
      } catch {
        /* 오늘 성찰이 없으면 빈 화면으로 시작 */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [today]);

  function toggleSkill(skill) {
    setUsedSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    try {
      await saveReflection({ logDate: today, usedSkills, shortNote, endure, regulate, lifeLink });
      setResult({ ok: true });
    } catch (err) {
      setResult({ ok: false, error: err.message || '저장에 실패했어요.' });
    } finally {
      setPending(false);
    }
  }

  if (loading) return <div className="card center muted">불러오는 중...</div>;

  return (
    <div className="card">
      <h2>성찰하기</h2>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        오늘 사용한 심리기법과 어려움을 견디고 도전한 경험을 기록해보세요.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>오늘 사용한 심리기법</label>
          <div className="pill-row">
            {SKILL_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`pill ${usedSkills.includes(s) ? 'active' : ''}`}
                onClick={() => toggleSkill(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>집중이 흐트러진 순간과 그때 사용한 방법</label>
          <textarea value={shortNote} onChange={(e) => setShortNote(e.target.value)} placeholder="한두 줄로 짧게 적어보세요" />
        </div>
        <div className="field">
          <label>① 인내·도전: 어려웠지만 견디고 도전한 점</label>
          <textarea value={endure} onChange={(e) => setEndure(e.target.value)} />
        </div>
        <div className="field">
          <label>② 자기조절: 어려움을 극복하려 사용한 방법</label>
          <textarea value={regulate} onChange={(e) => setRegulate(e.target.value)} />
        </div>
        <div className="field">
          <label>③ 삶과 연계: 이 방법을 내 삶 어디에 써볼까</label>
          <textarea value={lifeLink} onChange={(e) => setLifeLink(e.target.value)} placeholder="시험, 발표 등" />
        </div>
        {result && !result.ok && <div className="msg msg-error">{result.error}</div>}
        {result && result.ok && <div className="msg msg-ok">오늘의 성찰을 저장했어요.</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={pending} style={{ marginTop: 4 }}>
          {pending ? '저장 중...' : '오늘 성찰 저장'}
        </button>
      </form>
    </div>
  );
}
