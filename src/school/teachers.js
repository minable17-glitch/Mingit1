// NPC 선생님들
// - 수업 시간에만 교실에 계심. 어느 교실에 어느 선생님이 계실지는 '교실 이름 + 몇 교시'로 정해서
//   모든 친구 화면에서 똑같음 (서버 필요 없음)
// - 일반 교실: 수학 / 국어 / 선생님 없음(자습) 중 하나
// - 음악실: 음악 선생님 (피아노), 미술실: 미술 선생님 (돌아다니며 봐 주심)
// - 쉬는 시간·점심시간엔 선생님이 안 계심
// - 휴대폰이 버벅이지 않도록, 내 근처(같은 층) 교실의 선생님만 화면에 만듦
import { Avatar } from './avatar.js';
import { CLASSROOMS, levelY, levelOfY } from './world.js';
import { schoolNow } from './schedule.js';

export const SUBJECTS = {
  수학: {
    name: '수학 선생님',
    look: { outfit: 'suit', hair: 'short', hairColor: 'black', acc: 'glasses' },
    boards: [
      '수학 · 일차방정식\n2x + 3 = 11\nx = ?',
      '수학 · 피타고라스 정리\na² + b² = c²\n3, 4 이면 c = ?',
      '수학 · 연립방정식\nx + y = 10\nx − y = 2',
      '수학 · 원의 넓이\nS = πr²\nr = 3 일 때?',
    ],
    lines: ['자, 이 문제 풀어볼 사람?', '공식 외웠지? 시험에 나온다~', '칠판 잘 봐라~ 여기 중요해!', '계산 실수 조심하고!', '익힘책 다음 시간까지 풀어 와요~', '졸지 말고! 거기 뒤에!'],
    greet: '어서 와, 빈자리에 앉아라~',
  },
  국어: {
    name: '국어 선생님',
    look: { outfit: 'beige', hair: 'long', hairColor: 'dark', acc: 'none' },
    boards: [
      '국어 · 소나기 (황순원)\n"이 바보"\n소녀의 마음은?',
      '국어 · 진달래꽃 (김소월)\n시의 화자는\n어떤 마음일까?',
      '국어 · 문법\n품사의 종류\n명사 · 동사 · 형용사',
      '국어 · 속담\n가는 말이 고와야\n오는 말이 곱다',
    ],
    lines: ['밑줄 쫙~ 별표 세 개!', '이 부분 시험에 꼭 나온다~', '자, 다 같이 읽어볼까?', '작가가 하고 싶은 말이 뭘까?', '교과서 펴라~', '글씨 또박또박 써야지~'],
    greet: '어서 와, 교과서 펴고 앉자~',
  },
  음악: {
    name: '음악 선생님',
    look: { outfit: 'wine', hair: 'bob', hairColor: 'brown', acc: 'ribbon' },
    boards: ['♪ 음악 · 함께 불러요\n학교 종이 땡땡땡\n솔솔라라 솔솔미'],
    lines: ['자, 다 같이 따라 불러보자~', '리코더 챙겨 왔지?', '박자 맞춰서~ 하나 둘 셋 넷!', '목소리 더 크게~!'],
    greet: '어서 와~ 같이 노래하자!',
  },
  미술: {
    name: '미술 선생님',
    look: { outfit: 'green', hair: 'bun', hairColor: 'dark', acc: 'none' },
    boards: ['미술 · 수채화\n물 조절이 핵심!\n밝은 색부터 칠해요'],
    lines: ['물통 엎지르지 않게 조심~', '색깔 참 예쁘게 칠했네!', '스케치는 연하게 해보자', '다 그리면 뒤에 붙여 놓자~'],
    greet: '앞치마 입고 앉으렴~',
  },
};

function hash(str) {
  let h = 7;
  for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) | 0;
  return Math.abs(h);
}

// 이 교실, 이 시간의 과목 (없으면 null)
export function subjectOf(room, period = schoolNow()) {
  if (!room || period.kind !== 'class') return null;
  if (room.type === 'music') return '음악';
  if (room.type === 'art') return '미술';
  return ['수학', '국어', null][hash(`${room.id}|${period.key}`) % 3];
}

const R = (a, b) => a + Math.random() * (b - a);

export function createTeachers({ scene, world }) {
  const active = new Map(); // 교실 id → 선생님 NPC
  let periodKey = null;
  let period = schoolNow();

  function refreshBoards() {
    for (const room of CLASSROOMS) {
      const sub = subjectOf(room, period);
      let text = null; // null = 기본 글
      if (sub) {
        const list = SUBJECTS[sub].boards;
        text = list[hash(`${room.id}|${period.key}|b`) % list.length];
      } else if (period.kind === 'class') {
        text = `${room.name}\n자습 시간\n조용히 공부해요`;
      }
      world.writeBoard(room.id, text);
    }
  }

  function spawn(room, sub) {
    const info = SUBJECTS[sub];
    const a = new Avatar({ id: `teacher-${room.id}`, name: info.name, look: info.look, occlude: true });
    const L = levelY(room.level);
    const t = { avatar: a, room, sub, L, nextMove: R(1, 4), nextTalk: R(1, 4), writing: 0, greeted: false };
    if (sub === '음악') {
      // 피아노 의자에 앉아 계심
      a.pos.set(room.xs + 1.5, L, -1.5);
      a.sitChair = { seatY: L + 0.5, ry: -Math.PI / 2 };
      a.root.rotation.y = -Math.PI / 2;
    } else if (sub === '미술') {
      a.pos.set(room.xs + 4.85, L, -4.6);
    } else {
      a.pos.set(room.xs + 0.85, L, -4.5);
      a.root.rotation.y = Math.PI / 2;
    }
    scene.add(a.root);
    active.set(room.id, t);
  }

  function despawn(id) {
    const t = active.get(id);
    if (!t) return;
    t.avatar.dispose();
    active.delete(id);
  }

  // 0.3초마다: 시간표 바뀌었는지, 내 근처에 어떤 선생님을 보여줄지
  function sync(me) {
    period = schoolNow();
    if (period.key !== periodKey) {
      periodKey = period.key;
      refreshBoards();
      for (const id of [...active.keys()]) despawn(id);
    }
    const k = levelOfY(me.pos.y);
    const inBuilding = me.pos.z < 1 && me.pos.z > -13;
    for (const room of CLASSROOMS) {
      const sub = subjectOf(room, period);
      const near = inBuilding && room.level === k && Math.abs((room.xs + room.xe) / 2 - me.pos.x) < 26;
      if (sub && near && !active.has(room.id)) spawn(room, sub);
      else if ((!sub || !near) && active.has(room.id)) despawn(room.id);
    }
  }

  // 매 프레임: 걷기·말하기
  function update(dt, me, myRoomId, camPos) {
    for (const t of active.values()) {
      const a = t.avatar;
      const xs = t.room.xs;
      const here = myRoomId === t.room.id;
      t.nextMove -= dt;
      t.nextTalk -= dt;
      if (t.writing > 0) t.writing -= dt;

      if (t.sub === '미술') {
        // 모둠 책상 사이를 돌아다니며 봐 주심 (가운데 통로를 거쳐서)
        if (!a.target && t.nextMove <= 0) {
          const hub = { x: xs + 4.85, z: -4.6 };
          const spots = [{ x: xs + 1.7, z: -4.6 }, { x: xs + 7.9, z: -4.6 }, { x: xs + 4.85, z: -1.8 }, { x: xs + 4.85, z: -7.6 }];
          const atHub = Math.hypot(a.pos.x - hub.x, a.pos.z - hub.z) < 0.3;
          a.target = atHub ? spots[Math.floor(Math.random() * spots.length)] : hub;
          a.path = [];
          t.nextMove = R(3, 7);
        }
      } else if (t.sub !== '음악') {
        // 교탁 앞을 왔다 갔다, 가끔 칠판에 판서
        if (!a.target && t.nextMove <= 0) {
          if (Math.random() < 0.35) {
            t.writing = 3;
            a.play('hand');
          } else {
            a.target = { x: xs + 0.85, z: R(-6.6, -2.4) };
            a.path = [];
          }
          t.nextMove = R(3, 8);
        }
      }

      a.update(dt, world.heightAt);
      // 카메라 바로 앞이면 이름표·말풍선이 화면을 가리지 않게 숨김
      if (camPos) {
        const dx = camPos.x - a.pos.x;
        const dy = camPos.y - (a.pos.y + 2.1);
        const dz = camPos.z - a.pos.z;
        a.tagHolder.visible = Math.hypot(dx, dy, dz) > 3.6;
      }
      if (!a.target) {
        // 서 있을 땐 학생 쪽을 보고, 판서할 땐 칠판 쪽을 봄
        if (t.sub === '음악') a.faceAngle(-Math.PI / 2, dt);
        else if (t.sub === '미술') a.faceAngle(Math.atan2(me.pos.x - a.pos.x, me.pos.z - a.pos.z), dt * 0.5);
        else a.faceAngle(t.writing > 0 ? -Math.PI / 2 : Math.PI / 2, dt);
      }

      // 내가 같은 교실에 있을 때만 말풍선
      if (here) {
        const info = SUBJECTS[t.sub];
        if (!t.greeted) {
          t.greeted = true;
          a.say(info.greet);
          t.nextTalk = R(6, 9);
        } else if (t.nextTalk <= 0) {
          a.say(info.lines[Math.floor(Math.random() * info.lines.length)]);
          t.nextTalk = R(8, 14);
        }
      } else t.greeted = false;
    }
  }

  return { sync, update, subjectOf: (room) => subjectOf(room, period) };
}
