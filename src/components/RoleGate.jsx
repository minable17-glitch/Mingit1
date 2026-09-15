export default function RoleGate({ onPickStudent, onPickAdmin }) {
  return (
    <div className="app-shell">
      <div className="app-header">
        <h1>🎯 LEVEL-UP ARCHERY</h1>
        <div className="sub">양궁 성장일지</div>
      </div>
      <div className="app-main">
        <div className="card center">
          <h2 style={{ marginBottom: 4 }}>역할을 선택하세요</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13, marginBottom: 20 }}>
            학생과 선생님의 화면이 달라요
          </p>
          <div className="stack">
            <button className="btn btn-accent btn-block" type="button" onClick={onPickStudent} style={{ padding: '14px 16px', fontSize: 16 }}>
              학생으로 로그인
            </button>
            <button className="btn btn-outline btn-block" type="button" onClick={onPickAdmin} style={{ padding: '14px 16px', fontSize: 16 }}>
              선생님으로 로그인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
