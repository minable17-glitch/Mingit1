// 도서관 실시간 접속 정보 — 누가 들어와 있고, 어느 자리에서 무엇을 하는지
// Supabase Realtime의 presence만 사용(테이블·SQL 변경 없음). 좌표가 아니라 "자리 번호와 상태"만 주고받고,
// 걷는 모습은 각자 화면에서 그려서 메시지 수를 아낌.
// 연결할 수 없을 때(또는 ?rtlocal=1)는 같은 브라우저의 다른 탭끼리만 연결되는 연습용 방식으로 대신함.
import { supabase } from '../lib/supabaseClient';

export function connectRoom({ classId, key, meta, onSync, onStatus, forceLocal = false }) {
  if (forceLocal || !import.meta.env.VITE_SUPABASE_URL) return connectLocal({ classId, key, meta, onSync, onStatus });
  let current = meta, ready = false, closed = false, channel = null, usePrivate = true, retryT = null, opening = false;
  const emit = () => {
    if (!channel) return;
    const st = channel.presenceState();
    onSync(Object.entries(st).map(([id, arr]) => ({ id, ...(arr[arr.length - 1] || {}) })));
  };
  // 끊겼을 때 몇 초 뒤 다시 연결(화면이 보일 때만)
  const scheduleRetry = (ms = 4000) => {
    clearTimeout(retryT);
    retryT = setTimeout(() => { if (!closed && !ready && document.visibilityState === 'visible') reopen(); else if (!closed && !ready) scheduleRetry(ms); }, ms);
  };
  // 비공개 채널(반 학생·선생님만, supabase/realtime_library.sql 적용 시)을 먼저 시도하고,
  // 한 번도 연결되지 못하고 실패하면 공개 채널로 대신 연결함(SQL 적용 전에도 동작하도록)
  const open = (isPrivate) => {
    let joined = false;
    const ch = supabase.channel(`saesak-library-${classId}`, { config: { private: isPrivate, presence: { key } } });
    channel = ch;
    ch.on('presence', { event: 'sync' }, () => { if (ch === channel) emit(); })
      .subscribe(async (status) => {
        if (closed || ch !== channel) return;       // 이미 버린 옛 채널의 소식은 무시
        if (status === 'SUBSCRIBED') {
          joined = true; ready = true; usePrivate = isPrivate; clearTimeout(retryT); onStatus?.('online');
          try { await ch.track(current); } catch { /* 다음 갱신 때 다시 시도 */ }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          ready = false;
          if (isPrivate && !joined && status !== 'CLOSED' && usePrivate) { usePrivate = false; channel = null; supabase.removeChannel(ch); open(false); return; }
          onStatus?.('offline'); scheduleRetry();
        }
      });
  };
  // 처음부터 다시 연결: 옛 채널을 버리고, 로그인 토큰을 새로 받은 뒤 새 채널로 들어감
  // (폰이 앱을 뒤로 보내면 연결이 끊기고, 그동안 토큰이 만료되어 자동 재접속이 계속 실패하는 경우가 있음)
  async function reopen() {
    if (closed || opening) return;
    opening = true; ready = false; onStatus?.('connecting');
    const old = channel; channel = null;
    try { if (old) await supabase.removeChannel(old); } catch { /* 무시 */ }
    try { const { data } = await supabase.auth.getSession(); if (data?.session?.access_token) supabase.realtime.setAuth(data.session.access_token); } catch { /* 무시 */ }
    opening = false;
    if (!closed) { open(usePrivate); scheduleRetry(8000); }
  }
  open(true);
  // 화면이 다시 보이면: 연결이 살아 있으면 내 상태를 다시 알리고, 끊겼으면 처음부터 다시 연결
  const onVisible = () => {
    if (document.visibilityState !== 'visible' || closed) return;
    if (ready && channel && channel.state === 'joined') channel.track(current).catch(() => reopen());
    else reopen();
  };
  const onOnline = () => { if (!ready) reopen(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  return {
    update(next) { current = next; if (ready && channel) channel.track(current).catch(() => {}); },
    close() { closed = true; clearTimeout(retryT); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); if (channel) supabase.removeChannel(channel); },
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
