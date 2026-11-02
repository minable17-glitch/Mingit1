// 친구들과 실시간으로 함께 있기 (Supabase Realtime 사용)
// DB 테이블을 쓰지 않고, 같은 방(room)에 들어온 사람끼리 위치·동작 메시지만 주고받습니다.
// 그래서 schema.sql 을 고치거나 SQL 을 실행할 필요가 없습니다.
import { createClient } from '@supabase/supabase-js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function connectRoom({ room, me, onState, onAction, onBall, onLeave, onCount, onStatus }) {
  if (!URL || !KEY) return connectLocal({ room, me, onState, onAction, onBall, onLeave, onCount, onStatus });

  const supabase = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const channel = supabase.channel(`school-${room}`, {
    config: { presence: { key: me.id }, broadcast: { self: false } },
  });

  let ready = false;
  const queue = [];

  const send = (event, payload) => {
    if (!ready) {
      if (queue.length < 20) queue.push([event, payload]);
      return;
    }
    channel.send({ type: 'broadcast', event, payload: { ...payload, id: me.id } });
  };

  channel
    .on('broadcast', { event: 'state' }, ({ payload }) => onState(payload))
    .on('broadcast', { event: 'act' }, ({ payload }) => onAction(payload))
    .on('broadcast', { event: 'ball' }, ({ payload }) => onBall(payload))
    .on('presence', { event: 'sync' }, () => {
      onCount(Object.keys(channel.presenceState()).length);
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      // 새 친구가 들어오면 내 현재 상태를 한 번 알려줌
      if (key !== me.id) me.announce?.();
    })
    .on('presence', { event: 'leave' }, ({ key }) => onLeave(key))
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        ready = true;
        onStatus?.('online');
        await channel.track({ name: me.name, teacher: !!me.teacher });
        while (queue.length) {
          const [e, p] = queue.shift();
          send(e, p);
        }
        me.announce?.();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        ready = false;
        onStatus?.('offline');
      }
    });

  return {
    send,
    updateMe() {
      if (ready) channel.track({ name: me.name, teacher: !!me.teacher });
    },
    close() {
      supabase.removeChannel(channel);
    },
  };
}

// Supabase 설정이 없을 때(개발용): 같은 브라우저의 다른 탭끼리만 연결
function connectLocal({ room, me, onState, onAction, onBall, onLeave, onCount, onStatus }) {
  if (typeof BroadcastChannel === 'undefined') {
    onStatus?.('solo');
    return { send() {}, updateMe() {}, close() {} };
  }
  const bc = new BroadcastChannel(`school-${room}`);
  const seen = new Map();
  const send = (event, payload) => bc.postMessage({ event, payload: { ...payload, id: me.id } });
  bc.onmessage = ({ data }) => {
    const { event, payload } = data || {};
    if (!payload?.id) return;
    if (event === 'bye') {
      seen.delete(payload.id);
      onLeave(payload.id);
    } else {
      if (!seen.has(payload.id)) me.announce?.();
      seen.set(payload.id, Date.now());
      if (event === 'state') onState(payload);
      else if (event === 'act') onAction(payload);
      else if (event === 'ball') onBall(payload);
    }
    onCount(seen.size + 1);
  };
  onStatus?.('solo');
  setTimeout(() => me.announce?.(), 100);
  return {
    send,
    updateMe() {},
    close() {
      send('bye', {});
      bc.close();
    },
  };
}
