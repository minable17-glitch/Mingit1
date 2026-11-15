// 🖼 학급 그림: 조회·종례 전달사항, 일지, 학생 특이사항에 캡처·사진을 붙이기.
// 화면 아무 데서나 Ctrl+V(폰은 길게 눌러 붙여넣기) · 끌어다 놓기 · '그림 넣기' 버튼.
// 비공개 저장소의 내 폴더에만 저장되고(본인만), 볼 때마다 1시간짜리 임시 주소로 열려요.
import { useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';
import { filesFrom, isImage, nameCapture } from '../lib/files.js';
import { removeImage, uploadAll, usePasteImages, withUrls } from '../lib/classImages.js';

// 작은 그림들 (누르면 크게)
export function Thumbs({ items, onRemove }) {
  if (!items.length) return null;
  return (
    <div className="att-grid cls-thumbs">
      {items.map((it) => (
        <figure key={it.key} className="att-img">
          <a href={it.url} target="_blank" rel="noreferrer" title={it.name}>
            {it.url ? <img src={it.url} alt={it.name} loading="lazy" /> : <span className="muted small">불러오는 중</span>}
          </a>
          {onRemove && <button className="att-x" onClick={() => onRemove(it)} aria-label={`${it.name} 지우기`}>×</button>}
        </figure>
      ))}
    </div>
  );
}

// '그림 넣기' 버튼 (파일 고르기 · 폰 사진첩)
export function PickImages({ onImages, disabled, label = '🖼 그림 넣기' }) {
  const pick = useRef(null);
  return (
    <>
      <button type="button" className="small" disabled={disabled} onClick={() => pick.current?.click()}>{label}</button>
      <input ref={pick} type="file" accept="image/*" multiple hidden onChange={(e) => { onImages([...e.target.files]); e.target.value = ''; }} />
    </>
  );
}

// 그날 그림 모음 (조회·종례·일지)
export default function ClassImages({ kind, day, title = '그림' }) {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    api.loadClassImages({ kind, day }).then(withUrls).then((l) => { if (alive) setList(l); });
    return () => { alive = false; };
  }, [kind, day, tick]);

  async function add(files) {
    const imgs = files.filter(isImage);
    if (!imgs.length || busy) return;
    setBusy(true);
    await uploadAll(imgs.map((f) => nameCapture(f)), { kind, day });
    setBusy(false);
    setTick((t) => t + 1);
  }
  usePasteImages(add);

  return (
    <div
      className={`cls-images${over ? ' over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); add(filesFrom(e.dataTransfer)); }}
    >
      <div className="row">
        <span className="grow small"><b>{title}</b> {list.length > 0 && <span className="muted">{list.length}</span>}{busy && <span className="muted"> · 올리는 중…</span>}</span>
        <PickImages onImages={add} disabled={busy} />
      </div>
      <Thumbs items={list} onRemove={(it) => removeImage(it, () => setTick((t) => t + 1))} />
      {!list.length && <p className="small muted">캡처한 그림을 <b>Ctrl+V</b>로 붙여넣거나 여기로 끌어다 놓으세요. (나만 볼 수 있어요)</p>}
    </div>
  );
}
