import { useEffect, useRef, useState } from 'react';

const PHASES = [
  { key: 'in', label: '들이쉬기', seconds: 4 },
  { key: 'hold1', label: '멈추기', seconds: 4 },
  { key: 'out', label: '내쉬기', seconds: 4 },
  { key: 'hold2', label: '멈추기', seconds: 4 },
];

// 4초 들숨 - 4초 멈춤 - 4초 날숨 - 4초 멈춤 박스 호흡 타이머
export default function BoxBreathing() {
  const [running, setRunning] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secsLeft, setSecsLeft] = useState(PHASES[0].seconds);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecsLeft((s) => {
        if (s > 1) return s - 1;
        setPhaseIndex((p) => (p + 1) % PHASES.length);
        return PHASES[(phaseIndex + 1) % PHASES.length].seconds;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phaseIndex]);

  function toggle() {
    if (!running) {
      setPhaseIndex(0);
      setSecsLeft(PHASES[0].seconds);
    }
    setRunning((r) => !r);
  }

  const phase = PHASES[phaseIndex];
  const scale = phase.key === 'in' ? 1 : phase.key === 'out' ? 0.55 : phase.key === 'hold1' ? 1 : 0.55;

  return (
    <div className="card center">
      <h2>박스 호흡 연습</h2>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>4초 들이쉬고 - 4초 멈추고 - 4초 내쉬고 - 4초 멈춰요.</p>
      <div
        style={{
          width: 140,
          height: 140,
          margin: '18px auto',
          borderRadius: '50%',
          background: 'var(--primary)',
          opacity: 0.85,
          transform: `scale(${scale})`,
          transition: 'transform 4s linear',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
        }}
      >
        {running ? `${phase.label} ${secsLeft}` : '준비'}
      </div>
      <button className="btn btn-primary" type="button" onClick={toggle}>
        {running ? '멈추기' : '시작하기'}
      </button>
    </div>
  );
}
