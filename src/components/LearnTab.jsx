import { useEffect, useState } from 'react';
import { listLearnContents } from '../lib/api';
import { splitUrls, toYoutubeEmbedUrl } from '../lib/media';
import BoxBreathing from './BoxBreathing';

export default function LearnTab({ classId }) {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showBreathing, setShowBreathing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listLearnContents(classId);
        if (!cancelled) setContents(rows);
      } catch (err) {
        if (!cancelled) setError(err.message || '목록을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  if (showBreathing) {
    return (
      <div>
        <button className="btn btn-outline" onClick={() => setShowBreathing(false)} type="button" style={{ marginBottom: 10 }}>
          ← 배워보기로
        </button>
        <BoxBreathing />
      </div>
    );
  }

  if (selected) {
    const images = splitUrls(selected.image_urls);
    const embedUrl = toYoutubeEmbedUrl(selected.video_url);
    return (
      <div className="card">
        <button className="btn btn-outline" onClick={() => setSelected(null)} type="button" style={{ marginBottom: 10 }}>
          ← 목록으로
        </button>
        <h2>{selected.title}</h2>
        {selected.category && <span className="tag" style={{ marginBottom: 10, display: 'inline-block' }}>{selected.category}</span>}
        {selected.video_url && (
          embedUrl ? (
            <div style={{ position: 'relative', paddingTop: '56.25%', marginBottom: 12 }}>
              <iframe
                src={embedUrl}
                title={selected.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, borderRadius: 10 }}
              />
            </div>
          ) : (
            <video src={selected.video_url} controls style={{ width: '100%', borderRadius: 10, marginBottom: 12 }} />
          )
        )}
        {selected.description && <p style={{ whiteSpace: 'pre-wrap' }}>{selected.description}</p>}
        {images.map((src, i) => (
          <img key={i} src={src} alt={`${selected.title} ${i + 1}`} className="content-image" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>배워보기</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>영상과 이미지를 보며 실제로 따라 해보세요.</p>
        <button className="btn btn-accent btn-block" type="button" onClick={() => setShowBreathing(true)}>
          🫁 박스 호흡 연습하기
        </button>
      </div>
      {loading && <div className="card center muted">불러오는 중...</div>}
      {error && <div className="card msg msg-error">{error}</div>}
      {!loading && !error && contents.length === 0 && <div className="card center muted">아직 등록된 자료가 없어요.</div>}
      {contents.map((c) => {
        const images = splitUrls(c.image_urls);
        return (
          <div key={c.id} className="content-card" onClick={() => setSelected(c)}>
            {images[0] ? <img src={images[0]} alt="" /> : <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--surface-alt)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.video_url ? '▶' : ''}</div>}
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
