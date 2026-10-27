// 📎 첨부: 캡처 사진·파일을 업무(또는 던져 둔 것)에 붙이기.
// 📎 버튼으로 고르기 · 캡처를 Ctrl+V(폰은 길게 눌러 붙여넣기) · 끌어다 놓기. 사진은 작은 그림으로, 파일은 이름으로.
// 파일은 비공개 저장소의 내 폴더에만 저장되고, 볼 때마다 1시간짜리 임시 주소로 열려요.
import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { filesFrom, isImage, nameCapture, sizeLabel } from '../lib/files.js';

export default function Attachments({ taskId, throwId, editable = true, title = '📎 첨부', pasteAnywhere = false }) {
  const [list, setList] = useState(null);
  const [urls, setUrls] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [over, setOver] = useState(false);
  const [tick, setTick] = useState(0);
  const pick = useRef(null);

  useEffect(() => {
    let alive = true;
    api.loadAttachments({ taskId, throwId }).then(async (l) => {
      const u = await api.attachmentUrls(l);
      if (alive) { setList(l); setUrls(u); }
    });
    return () => { alive = false; };
  }, [taskId, throwId, tick]);

  async function add(files) {
    if (!files.length || !editable) return;
    setBusy(true);
    setMsg(`올리는 중… (${files.length}개)`);
    const failed = [];
    for (const f of files) {
      try { await api.uploadAttachment(nameCapture(f), { taskId, throwId }); } catch (e) { failed.push(e.message); }
    }
    setBusy(false);
    setMsg(failed.length ? `못 올린 파일: ${failed.join(' / ')}` : '');
    setTick((t) => t + 1);
  }

  // 업무 화면 어디서든 Ctrl+V 로 캡처 붙여넣기 (글자 입력칸에 글자를 붙일 때는 건드리지 않음)
  useEffect(() => {
    if (!pasteAnywhere || !editable) return undefined;
    const onPaste = (e) => {
      const files = filesFrom(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      add(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  async function remove(a) {
    if (!confirm(`“${a.name}”을(를) 지울까요?`)) return;
    try { await api.deleteAttachment(a); setTick((t) => t + 1); } catch (e) { alert(`지우지 못했어요: ${e.message}`); }
  }

  if (list === null) return null;
  if (!editable && !list.length) return null;
  const images = list.filter(isImage);
  const others = list.filter((a) => !isImage(a));

  return (
    <div
      className={`block att${over ? ' over' : ''}`}
      onDragOver={editable ? (e) => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={() => setOver(false)}
      onDrop={editable ? (e) => { e.preventDefault(); setOver(false); add(filesFrom(e.dataTransfer)); } : undefined}
    >
      <div className="block-head">
        <h2>{title} {list.length > 0 && <span className="muted small">{list.length}</span>}</h2>
        {editable && (
          <>
            <button disabled={busy} onClick={() => pick.current?.click()}>사진·파일 넣기</button>
            <input ref={pick} type="file" multiple hidden onChange={(e) => { add([...e.target.files]); e.target.value = ''; }} />
          </>
        )}
      </div>
      {images.length > 0 && (
        <div className="att-grid">
          {images.map((a) => (
            <figure key={a.id} className="att-img">
              <a href={urls[a.path]} target="_blank" rel="noreferrer" title={a.name}>
                {urls[a.path] ? <img src={urls[a.path]} alt={a.name} loading="lazy" /> : <span className="muted small">불러오는 중</span>}
              </a>
              {editable && <button className="att-x" onClick={() => remove(a)} aria-label={`${a.name} 지우기`}>×</button>}
            </figure>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="att-files">
          {others.map((a) => (
            <li key={a.id}>
              <span aria-hidden="true">📄</span>
              <a className="grow" href={urls[a.path]} target="_blank" rel="noreferrer" download={a.name}>{a.name}</a>
              <span className="muted small">{sizeLabel(a.size)}</span>
              {editable && <button className="icon" onClick={() => remove(a)} aria-label={`${a.name} 지우기`}>×</button>}
            </li>
          ))}
        </ul>
      )}
      {editable && !list.length && (
        <p className="small muted att-hint">캡처한 화면을 <b>Ctrl+V</b>로 붙여넣거나, 파일을 여기로 끌어다 놓으세요. 폰에서는 <b>사진·파일 넣기</b>를 누르세요. (한 파일 {api.MAX_FILE_MB}MB까지, 나만 볼 수 있어요)</p>
      )}
      {msg && <p className="small muted">{msg}</p>}
    </div>
  );
}
