// 도서관 실시간 접속 정보 — 누가 들어와 있고, 어느 자리에서 무엇을 하는지
// Supabase Realtime의 presence만 사용(테이블·SQL 변경 없음). 좌표가 아니라 "자리 번호와 상태"만 주고받고,
// 걷는 모습은 각자 화면에서 그려서 메시지 수를 아낌.
// 연결할 수 없을 때(또는 ?rtlocal=1)는 같은 브라우저의 다른 탭끼리만 연결되는 연습용 방식으로 대신함.
import { supabase } from '../lib/supabaseClient';

export function connectRoom({ classId, key, meta, onSync, onStatus, forceLocal = false }) {
  if (forceLocal || !import.meta.env.VITE_SUPABASE_URL) return connectLocal({ classId, key, meta, onSync, onStatus });
  let current = meta, ready = false, closed = false;
  const channel = supabase.channel(`saesak-library-${classId}`, { config: { presence: { key } } });
  const emit = () => {
    const st = channel.presenceState();
    onSync(Object.entries(st).map(([id, arr]) => ({ id, ...(arr[arr.length - 1] || {}) })));
  };
  channel
    .on('presence', { event: 'sync' }, emit)
    .subscribe(async (status) => {
      if (closed) return;
      if (status === 'SUBSCRIBED') { ready = true; onStatus?.('online'); try { await channel.track(current); } catch { /* 다음 갱신 때 다시 시도 */ } }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { ready = false; onStatus?.('offline'); }
    });
  // 화면이 다시 보이면 내 상태를 한 번 더 알림(백그라운드에서 연결이 끊겼다 돌아온 경우)
  const onVisible = () => { if (document.visibilityState === 'visible' && ready) channel.track(current).catch(() => {}); };
  document.addEventListener('visibilitychange', onVisible);
  return {
    update(next) { current = next; if (ready) channel.track(current).catch(() => {}); },
    close() { closed = true; document.removeEventListener('visibilitychange', onVisible); supabase.removeChannel(channel); },
  };
}

function connectLocal({ classId, key, meta, onSync, onStatus }) {
  if (typeof BroadcastChannel === 'undefined') { onStatus?.('offline'); onSync([{ id: key, ...meta }]); return { update() {}, close() {} }; }
  const bc = new BroadcastChannel(`saesak-library-${classId}`);
  const seen = new Map();
  let current = meta;
  const emit = () => onSync([{ id: key, ...current }, ...[...seen.entries()].map(([id, v]) => ({ id, ...v.meta }))]);
  const say = (type) => bc.postMessage({ type, id: key, meta: current });
  bc.onmessage = ({ data }) => {
    if (!data || data.id === key) return;
    if (data.type === 'bye') seen.delete(data.id);
    else { seen.set(data.id, { meta: data.meta, t: Date.now() }); if (data.type === 'hello') say('state'); }
    emit();
  };
  const beat = setInterval(() => { say('state'); const now = Date.now(); let changed = false; for (const [id, v] of seen) if (now - v.t > 9000) { seen.delete(id); changed = true; } if (changed) emit(); }, 3000);
  const bye = () => say('bye');
  window.addEventListener('pagehide', bye);
  onStatus?.('local'); say('hello'); emit();
  return {
    update(next) { current = next; say('state'); emit(); },
    close() { bye(); clearInterval(beat); window.removeEventListener('pagehide', bye); bc.close(); },
  };
}
