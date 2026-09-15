import { useEffect, useState } from 'react';
import { listReadContents } from '../lib/api';
import { splitUrls } from '../lib/media';

export default function ReadTab({ classId }) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listReadContents(classId);
        if (!cancelled) setContents(rows);
      } catch (err) {
        if (!cancelled) setError(err.message || '목록을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  if (selected) {
    const images = splitUrls(selected.image_urls);
    return (
      <div className="card">
        <button className="btn btn-outline" onClick={() => setSelected(null)} type="button" style={{ marginBottom: 10 }}>
          ← 목록으로
        </button>
        <h2>{selected.title}</h2>
        {selected.category && <span className="tag" style={{ marginBottom: 10, display: 'inline-block' }}>{selected.category}</span>}
        {images.length === 0 && <p className="muted">등록된 이미지가 없어요.</p>}
        {images.map((src, i) => (
          <img key={i} src={src} alt={`${selected.title} ${i + 1}`} className="content-image" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>읽어보기</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>선생님이 올려주신 자료를 읽어보세요.</p>
      </div>
      {loading && <div className="card center muted">불러오는 중...</div>}
      {error && <div className="card msg msg-error">{error}</div>}
      {!loading && !error && contents.length === 0 && <div className="card center muted">아직 등록된 자료가 없어요.</div>}
      {contents.map((c) => {
        const images = splitUrls(c.image_urls);
        return (
          <div key={c.id} className="content-card" onClick={() => setSelected(c)}>
            {images[0] ? <img src={images[0]} alt="" /> : <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--surface-alt)', flexShrink: 0 }} />}
            <div className="meta">
              <div className="title">{c.title}</div>
              {c.category && <span className="tag">{c.category}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
