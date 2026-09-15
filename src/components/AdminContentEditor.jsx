import { useEffect, useState } from 'react';
import {
  adminListReadContents, adminUpsertReadContent, adminDeleteReadContent,
  adminListLearnContents, adminUpsertLearnContent, adminDeleteLearnContent,
} from '../lib/api';

const EMPTY = { id: null, title: '', category: '', imageUrls: '', videoUrl: '', description: '', orderIndex: 0, visible: true };

export default function AdminContentEditor({ kind, classId }) {
  const isLearn = kind === 'learn';
  const listFn = isLearn ? adminListLearnContents : adminListReadContents;
  const upsertFn = isLearn ? adminUpsertLearnContent : adminUpsertReadContent;
  const deleteFn = isLearn ? adminDeleteLearnContent : adminDeleteReadContent;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const rows = await listFn(classId);
      setItems(rows);
    } catch (err) {
      setError(err.message || '목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, kind]);

  function edit(item) {
    setForm({
      id: item.id,
      title: item.title || '',
      category: item.category || '',
      imageUrls: item.image_urls || '',
      videoUrl: item.video_url || '',
      description: item.description || '',
      orderIndex: item.order_index ?? 0,
      visible: item.visible,
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await upsertFn(classId, form);
      setForm(EMPTY);
      await refresh();
    } catch (err) {
      setError(err.message || '저장에 실패했어요.');
    } finally {
      setPending(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('이 콘텐츠를 삭제할까요?')) return;
    try {
      await deleteFn(classId, id);
      await refresh();
    } catch (err) {
      setError(err.message || '삭제에 실패했어요.');
    }
  }

  return (
    <div>
      <div className="card">
        <h2>{form.id ? '콘텐츠 수정' : '콘텐츠 추가'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>제목 *</label>
            <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="field">
            <label>카테고리</label>
            <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="예: 심리기술, 자세, 안전" />
          </div>
          {isLearn && (
            <div className="field">
              <label>영상 URL (유튜브 또는 드라이브)</label>
              <input type="text" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} placeholder="https://youtube.com/..." />
            </div>
          )}
          <div className="field">
            <label>이미지 URL ({isLearn ? '보조' : '본문'}, 여러 장이면 쉼표로 구분)</label>
            <textarea value={form.imageUrls} onChange={(e) => setForm({ ...form, imageUrls: e.target.value })} placeholder="https://.../1.jpg, https://.../2.jpg" />
          </div>
          {isLearn && (
            <div className="field">
              <label>설명</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          )}
          <div className="row">
            <div className="field" style={{ flex: 1 }}>
              <label>정렬 순서</label>
              <input type="number" value={form.orderIndex} onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>노출 여부</label>
              <label className="checkbox-row" style={{ border: 'none' }}>
                <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} />
                학생에게 보이기
              </label>
            </div>
          </div>
          {error && <div className="msg msg-error">{error}</div>}
          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? '저장 중...' : form.id ? '수정 저장' : '추가하기'}
            </button>
            {form.id && (
              <button className="btn btn-outline" type="button" onClick={() => setForm(EMPTY)}>
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>등록된 콘텐츠 ({items.length})</h2>
        {loading && <p className="muted">불러오는 중...</p>}
        {!loading && items.length === 0 && <p className="muted">아직 등록된 콘텐츠가 없어요.</p>}
        {items.map((item) => (
          <div className="list-row" key={item.id}>
            <span>
              {item.title}
              {!item.visible && <span className="tag" style={{ marginLeft: 6 }}>숨김</span>}
            </span>
            <span className="row">
              <button className="btn btn-outline" type="button" onClick={() => edit(item)}>수정</button>
              <button className="btn btn-danger" type="button" onClick={() => handleDelete(item.id)}>삭제</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
