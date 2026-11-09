import { useRef, useState } from 'react';
import { getApiConfig, setApiConfig, submitVideo } from '../api.js';
import { canCompress, compressVideo, extForMime } from '../compress.js';
import { todayKST } from '../records.js';
import LiveCapture from './LiveCapture.jsx';
import { canRecord } from '../live.js';

const MB = 1024 * 1024;

export default function Upload() {
  const [cfg] = useState(() => getApiConfig());
  const [info, setInfo] = useState(() => {
    let className = '';
    try { className = JSON.parse(localStorage.getItem('catchball_upload_last') || '{}').className || ''; } catch { /* 무시 */ }
    return { date: todayKST(), className, student1: '', student2: '', submitCode: cfg.submitCode || '' };
  });
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | compressing | uploading | done | error
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [compress, setCompress] = useState(canCompress());
  const [mode, setMode] = useState(() => (canRecord() ? 'live' : 'file')); // live: 앱 안에서 촬영 / file: 찍어 둔 영상
  const abortRef = useRef(null);

  const validateInfo = () => {
    if (!cfg.scriptUrl) return '제출 주소가 없습니다. 선생님이 보내 준 링크로 다시 열어 주세요.';
    if (!info.className.trim() || !info.student1.trim() || !info.student2.trim()) return '반과 두 사람 이름을 모두 적어 주세요.';
    try {
      localStorage.setItem('catchball_upload_last', JSON.stringify({ className: info.className.trim() }));
      setApiConfig({ ...cfg, submitCode: info.submitCode });
    } catch { /* 무시 */ }
    return null;
  };

  const busy = status === 'compressing' || status === 'uploading';

  const start = async () => {
    if (!cfg.scriptUrl) { setStatus('error'); setMessage('제출 주소가 없습니다. 선생님이 보내 준 링크로 다시 열어 주세요.'); return; }
    if (!info.className.trim() || !info.student1.trim() || !info.student2.trim()) { setMessage('반과 두 사람 이름을 모두 적어 주세요.'); return; }
    if (!file) { setMessage('영상을 먼저 골라 주세요.'); return; }
    setMessage('');
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      localStorage.setItem('catchball_upload_last', JSON.stringify({ className: info.className.trim() }));
      setApiConfig({ ...cfg, submitCode: info.submitCode });
    } catch { /* 무시 */ }

    let blob = file, fileName = file.name;
    try {
      if (compress) {
        setStatus('compressing'); setProgress(0);
        try {
          const out = await compressVideo(file, { onProgress: setProgress, signal: controller.signal });
          blob = out.blob;
          fileName = file.name.replace(/\.[^.]+$/, '') + '.' + extForMime(out.mimeType);
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
          console.warn('압축 실패, 원본을 그대로 올립니다', e);
          setMessage('압축이 안 되어 원본을 그대로 올립니다.');
        }
      }
      setStatus('uploading'); setProgress(0);
      const r = await submitVideo({
        scriptUrl: cfg.scriptUrl,
        submitCode: info.submitCode.trim(),
        info: { className: info.className.trim(), student1: info.student1.trim(), student2: info.student2.trim(), date: info.date },
        blob, fileName,
        onStatus: setMessage, onProgress: setProgress,
      });
      setResult({ ...r, sizeMb: Math.round(blob.size / MB * 10) / 10, originalMb: Math.round(file.size / MB) });
      setStatus('done');
      setMessage('');
    } catch (e) {
      if (e?.name === 'AbortError') { setStatus('idle'); setMessage('취소했습니다.'); return; }
      console.error(e);
      setStatus('error');
      setMessage(e?.message || '올리는 중 문제가 생겼습니다.');
    }
  };

  const reset = () => { setFile(null); setStatus('idle'); setMessage(''); setResult(null); setInfo((v) => ({ ...v, student1: '', student2: '' })); };

  return (
    <div className="cb-app">
      <header className="cb-header">
        <h1>⚾ 캐치볼 영상 제출</h1>
        <p>반과 이름을 적고, 앱에서 바로 촬영하거나 찍어 둔 영상을 올려 주세요. 영상은 선생님 구글 드라이브에만 저장됩니다.</p>
      </header>

      {!cfg.scriptUrl && (
        <section className="cb-card"><p className="cb-error">⚠️ 제출 주소가 없는 링크입니다. 선생님이 보내 준 링크로 다시 열어 주세요.</p></section>
      )}

      {status === 'done' && result ? (
        <section className="cb-card cb-done">
          <h2>✅ 제출 완료!</h2>
          <p className="cb-big">{info.className} · {info.student1} · {info.student2}</p>
          <p className="cb-note">파일: {result.fileName} ({result.sizeMb}MB{result.originalMb ? `, 원본 ${result.originalMb}MB` : ''})</p>
          <button type="button" className="cb-btn big" onClick={reset}>다른 팀 영상 올리기</button>
        </section>
      ) : (
        <section className="cb-card">
          <div className="cb-grid">
            <label>평가일<input type="date" value={info.date} onChange={(e) => setInfo({ ...info, date: e.target.value })} disabled={busy} /></label>
            <label>반<input placeholder="예: 1학년 3반" value={info.className} onChange={(e) => setInfo({ ...info, className: e.target.value })} disabled={busy} /></label>
            <label>학생 1<input placeholder="이름" value={info.student1} onChange={(e) => setInfo({ ...info, student1: e.target.value })} disabled={busy} /></label>
            <label>학생 2<input placeholder="이름" value={info.student2} onChange={(e) => setInfo({ ...info, student2: e.target.value })} disabled={busy} /></label>
            <label>제출 코드 <span className="cb-sub">(선생님이 알려 준 경우만)</span><input placeholder="없으면 비워 두세요" value={info.submitCode} onChange={(e) => setInfo({ ...info, submitCode: e.target.value })} disabled={busy} /></label>
          </div>

          {canRecord() && (
            <div className="cb-mode" style={{ marginTop: 12 }}>
              <button type="button" className={mode === 'live' ? 'on' : ''} onClick={() => setMode('live')} disabled={busy}>📹 바로 촬영해서 제출</button>
              <button type="button" className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')} disabled={busy}>📁 찍어 둔 영상 올리기</button>
            </div>
          )}

          {mode === 'live' && (
            <LiveCapture key={`${info.student1}|${info.student2}`} cfg={cfg} info={info} validate={validateInfo} onDone={() => {}} />
          )}

          {mode === 'file' && (<>
          <label className={`cb-drop ${busy ? 'is-busy' : ''}`} style={{ marginTop: 12 }}>
            <input type="file" accept="video/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={busy} />
            <span>{file ? `📼 ${file.name} (${Math.round(file.size / MB)}MB)` : '여기를 눌러 영상 고르기 (또는 바로 촬영)'}</span>
            <small>캐치볼하는 두 사람이 옆모습으로 한 화면에 나오게 찍어 주세요.</small>
          </label>

          {canCompress() && (
            <label className="cb-check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} disabled={busy} />
              올리기 전에 영상 줄이기 (권장. 데이터와 시간을 아낍니다. 영상 길이만큼 걸립니다)
            </label>
          )}

          {busy && (
            <div className="cb-upload-progress">
              <div className="cb-progress-bar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
              <div className="cb-progress-text dark">
                {status === 'compressing' ? `영상 줄이는 중 ${Math.round(progress * 100)}%` : `${message || '올리는 중'} ${Math.round(progress * 100)}%`}
              </div>
              <button type="button" className="cb-btn ghost" onClick={() => abortRef.current?.abort()}>취소</button>
            </div>
          )}
          {!busy && message && <p className={status === 'error' ? 'cb-error' : 'cb-note'}>{message}</p>}

          <button type="button" className="cb-btn big" onClick={start} disabled={busy || !cfg.scriptUrl}>영상 올리기</button>
          </>)}
        </section>
      )}
    </div>
  );
}
