// 장소마다 들리는 주변 소리 (운동장 / 교실 / 복도 / 교무실 / 도서실 / 바깥 새소리)
// 음원 파일 없이 브라우저에서 직접 합성합니다.
// main.js 가 내 위치에 따라 setMix() 로 각 장소 소리의 크기와 '벽 너머로 먹먹하게' 정도를 정해줍니다.
import { ac } from './audio.js';

export function createAmbience() {
  const c = ac();
  if (!c) return { setMix() {}, setMuted() {}, start() {} };

  const master = c.createGain();
  master.gain.value = 0.9;
  master.connect(c.destination);

  // 실내 울림 (간단한 잔향)
  const reverb = c.createConvolver();
  {
    const len = Math.floor(c.sampleRate * 1.4);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    reverb.buffer = buf;
  }
  const revGain = c.createGain();
  revGain.gain.value = 0.35;
  reverb.connect(revGain).connect(master);

  // 하얀 잡음 (여러 소리의 재료)
  const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  {
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // 장소별 소리 통로: 소리 → 크기 → 먹먹함(저역통과) → 스피커 (+ 실내는 울림)
  const buses = {};
  for (const [name, wet] of Object.entries({ field: 0, outdoor: 0, classroom: 0.25, corridor: 0.6, office: 0.25, library: 0.3 })) {
    const input = c.createGain();
    const gain = c.createGain();
    gain.gain.value = 0;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 16000;
    input.connect(gain).connect(lp).connect(master);
    if (wet) {
      const send = c.createGain();
      send.gain.value = wet;
      lp.connect(send).connect(reverb);
    }
    buses[name] = { input, gain, lp, level: 0 };
  }

  const now = () => c.currentTime;
  const R = (a, b) => a + Math.random() * (b - a);

  // ── 소리 재료들 ──
  function env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function noiseHit(dest, t, { type = 'bandpass', freq = 1000, q = 1, peak = 0.3, a = 0.003, d = 0.08, rate = 1 }) {
    const s = c.createBufferSource();
    s.buffer = noise;
    s.playbackRate.value = rate;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    env(g, t, peak, a, d);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + a + d + 0.05);
  }

  const VOWELS = [[800, 1200], [400, 2000], [300, 2300], [500, 900], [350, 800], [600, 1700], [700, 1100]];

  // 웅얼웅얼 말소리 하나 (계속 켜져 있고 음절마다 소리 모양이 바뀜)
  function makeVoice(dest, { f0lo, f0hi, level, pause = 0.3, syl = [0.12, 0.26] }) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const f1 = c.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 7;
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 9;
    const g2 = c.createGain();
    g2.gain.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0;
    o.connect(f1).connect(g);
    o.connect(f2).connect(g2).connect(g);
    g.connect(dest);
    o.start();
    let next = 0;
    let phrase = 0;
    return {
      tick(t) {
        if (t < next) return;
        // 문장 사이 쉬는 시간
        if (phrase <= 0) {
          phrase = Math.floor(R(3, 12));
          g.gain.setTargetAtTime(0, t, 0.04);
          next = t + R(0.4, 2.5) * (1 + pause);
          return;
        }
        phrase--;
        const dur = R(syl[0], syl[1]);
        if (Math.random() < pause * 0.4) {
          g.gain.setTargetAtTime(0, t, 0.03);
        } else {
          const [a, b] = VOWELS[Math.floor(Math.random() * VOWELS.length)];
          f1.frequency.setTargetAtTime(a * R(0.9, 1.15), t, 0.02);
          f2.frequency.setTargetAtTime(b * R(0.9, 1.15), t, 0.02);
          const f0 = R(f0lo, f0hi);
          o.frequency.setTargetAtTime(f0, t, 0.03);
          o.frequency.setTargetAtTime(f0 * R(0.85, 1.1), t + dur * 0.5, 0.05);
          g.gain.setTargetAtTime(level * R(0.5, 1), t, 0.02);
          g.gain.setTargetAtTime(level * 0.15, t + dur * 0.75, 0.03);
        }
        next = t + dur;
      },
    };
  }

  // 아이 함성 ("와~!", "야!") / 웃음 ("하하하")
  function shout(dest, t, laugh = false) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const f1 = c.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = 6;
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = 8;
    const g = c.createGain();
    const [a, b] = laugh ? [750, 1250] : VOWELS[Math.floor(Math.random() * 3)];
    f1.frequency.value = a;
    f2.frequency.value = b;
    o.connect(f1).connect(g);
    o.connect(f2).connect(g);
    g.connect(dest);
    const base = R(380, 560);
    const peak = R(0.08, 0.16);
    g.gain.setValueAtTime(0.0001, t);
    if (laugh) {
      const n = Math.floor(R(3, 6));
      for (let i = 0; i < n; i++) {
        const tt = t + i * 0.16;
        o.frequency.setValueAtTime(base * (1.15 - i * 0.05), tt);
        g.gain.setTargetAtTime(peak, tt, 0.01);
        g.gain.setTargetAtTime(0.0001, tt + 0.08, 0.02);
      }
      o.start(t);
      o.stop(t + n * 0.16 + 0.3);
    } else {
      const dur = R(0.35, 0.8);
      o.frequency.setValueAtTime(base * 0.85, t);
      o.frequency.linearRampToValueAtTime(base * R(1.1, 1.35), t + dur * 0.4);
      o.frequency.linearRampToValueAtTime(base * 0.9, t + dur);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.05);
      g.gain.setTargetAtTime(0.0001, t + dur * 0.8, 0.06);
      o.start(t);
      o.stop(t + dur + 0.4);
    }
  }

  // 호루라기 (삐익~ 삐익)
  function whistle(dest, t) {
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.5;
      const o = c.createOscillator();
      o.frequency.value = 2900;
      const lfo = c.createOscillator();
      lfo.frequency.value = 28;
      const depth = c.createGain();
      depth.gain.value = 140;
      lfo.connect(depth).connect(o.frequency);
      const g = c.createGain();
      env(g, tt, 0.06, 0.02, i === n - 1 ? 0.6 : 0.25);
      o.connect(g).connect(dest);
      o.start(tt);
      lfo.start(tt);
      o.stop(tt + 0.9);
      lfo.stop(tt + 0.9);
    }
  }

  // 공 차는 소리 (퍽)
  function ballKick(dest, t) {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = c.createGain();
    env(g, t, 0.25, 0.002, 0.15);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.2);
    noiseHit(dest, t, { freq: 900, q: 0.8, peak: 0.12, d: 0.04 });
    // 통통 튀는 소리
    if (Math.random() < 0.5) for (let i = 1; i <= 3; i++) noiseHit(dest, t + 0.6 * i * (1 - i * 0.12), { type: 'lowpass', freq: 300, peak: 0.12 / i, d: 0.06 });
  }

  // 새소리 (짹짹)
  function bird(dest, t) {
    const n = Math.floor(R(2, 6));
    const base = R(2600, 4200);
    for (let i = 0; i < n; i++) {
      const tt = t + i * R(0.09, 0.16);
      const o = c.createOscillator();
      o.frequency.setValueAtTime(base, tt);
      o.frequency.exponentialRampToValueAtTime(base * R(1.2, 1.6), tt + 0.06);
      const g = c.createGain();
      env(g, tt, 0.04, 0.005, 0.06);
      o.connect(g).connect(dest);
      o.start(tt);
      o.stop(tt + 0.1);
    }
  }

  // 바람에 나뭇잎 스치는 소리
  function wind(dest, t) {
    noiseHit(dest, t, { type: 'bandpass', freq: R(600, 1400), q: 0.6, peak: 0.03, a: R(0.8, 1.5), d: R(1.5, 3), rate: 0.5 });
  }

  // 분필 (똑똑 딱딱 + 사각)
  function chalk(dest, t) {
    const n = Math.floor(R(5, 12));
    let tt = t;
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.3) noiseHit(dest, tt, { type: 'highpass', freq: 3000, q: 0.7, peak: 0.05, a: 0.01, d: R(0.08, 0.2) });
      else noiseHit(dest, tt, { freq: 2600, q: 3, peak: 0.14, d: 0.02 });
      tt += R(0.08, 0.35);
    }
  }

  // 의자 끄는 소리 (드르륵)
  function chairScrape(dest, t) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(R(80, 120), t);
    o.frequency.linearRampToValueAtTime(R(110, 170), t + 0.35);
    const lfo = c.createOscillator();
    lfo.frequency.value = 35;
    const am = c.createGain();
    am.gain.value = 0.5;
    const g = c.createGain();
    env(g, t, 0.05, 0.04, 0.4);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    lfo.connect(am).connect(g.gain);
    o.connect(f).connect(g).connect(dest);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.55);
    lfo.stop(t + 0.55);
  }

  // 연필 사각사각
  function pencil(dest, t) {
    const n = Math.floor(R(3, 8));
    for (let i = 0; i < n; i++) noiseHit(dest, t + i * R(0.12, 0.22), { type: 'highpass', freq: 4000, peak: 0.025, a: 0.02, d: 0.08 });
  }

  // 복도 발소리 (뚜벅뚜벅 / 다다다 뛰는 소리)
  function footsteps(dest, t) {
    const run = Math.random() < 0.35;
    const n = Math.floor(R(6, 14));
    const gap = run ? R(0.2, 0.26) : R(0.42, 0.55);
    for (let i = 0; i < n; i++) {
      const fade = Math.sin((i / (n - 1)) * Math.PI) * 0.8 + 0.2;
      noiseHit(dest, t + i * gap, { type: 'bandpass', freq: R(250, 450), q: 1.2, peak: 0.22 * fade, d: 0.06 });
      noiseHit(dest, t + i * gap, { type: 'highpass', freq: 2500, peak: 0.04 * fade, d: 0.02 });
    }
  }

  // 옛날 전화벨 (따르릉 따르릉)
  function phone(dest, t) {
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < 2; k++) {
        const tt = t + r * 2.6 + k * 0.45;
        const o = c.createOscillator();
        o.frequency.value = 1050;
        const o2 = c.createOscillator();
        o2.frequency.value = 1320;
        const lfo = c.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 22;
        const am = c.createGain();
        am.gain.value = 0.5;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.linearRampToValueAtTime(0.05, tt + 0.01);
        g.gain.setValueAtTime(0.05, tt + 0.35);
        g.gain.linearRampToValueAtTime(0.0001, tt + 0.4);
        lfo.connect(am).connect(g.gain);
        o.connect(g);
        o2.connect(g);
        g.connect(dest);
        [o, o2, lfo].forEach((x) => {
          x.start(tt);
          x.stop(tt + 0.42);
        });
      }
    }
  }

  // 타자 소리 (탁탁탁)
  function typing(dest, t) {
    const n = Math.floor(R(6, 18));
    let tt = t;
    for (let i = 0; i < n; i++) {
      noiseHit(dest, tt, { freq: R(1800, 3200), q: 2, peak: 0.07, d: 0.025 });
      tt += R(0.07, 0.2);
    }
  }

  // 책장 넘기는 소리 (사락)
  function page(dest, t) {
    noiseHit(dest, t, { type: 'bandpass', freq: R(3000, 5000), q: 0.6, peak: 0.05, a: 0.05, d: 0.25 });
  }

  // ── 장소별로 어떤 소리를 얼마나 자주 낼지 ──
  const fieldVoices = Array.from({ length: 6 }, () => makeVoice(buses.field.input, { f0lo: 280, f0hi: 470, level: 0.035, pause: 0.2 }));
  const teacher = makeVoice(buses.classroom.input, { f0lo: 140, f0hi: 230, level: 0.05, pause: 0.15, syl: [0.13, 0.24] });
  const whisper = Array.from({ length: 2 }, () => makeVoice(buses.classroom.input, { f0lo: 260, f0hi: 400, level: 0.008, pause: 0.6 }));
  const corridorVoice = makeVoice(buses.corridor.input, { f0lo: 250, f0hi: 420, level: 0.012, pause: 0.5 });
  const officeVoice = makeVoice(buses.office.input, { f0lo: 130, f0hi: 240, level: 0.02, pause: 0.5 });

  const events = [
    { bus: 'field', every: [1.2, 3.5], fn: (d, t) => shout(d, t, Math.random() < 0.35) },
    { bus: 'field', every: [2.5, 6], fn: ballKick },
    { bus: 'field', every: [14, 28], fn: whistle },
    { bus: 'outdoor', every: [3, 8], fn: bird },
    { bus: 'outdoor', every: [5, 10], fn: wind },
    { bus: 'classroom', every: [9, 18], fn: chalk },
    { bus: 'classroom', every: [8, 20], fn: chairScrape },
    { bus: 'classroom', every: [4, 9], fn: pencil },
    { bus: 'corridor', every: [5, 12], fn: footsteps },
    { bus: 'corridor', every: [8, 16], fn: (d, t) => shout(d, t, true) },
    { bus: 'office', every: [18, 35], fn: phone },
    { bus: 'office', every: [4, 9], fn: typing },
    { bus: 'library', every: [3, 8], fn: page },
  ].map((e) => ({ ...e, next: 0 }));

  let started = false;
  let timer = null;
  function loop() {
    const t = now() + 0.05;
    if (buses.field.level > 0.01) fieldVoices.forEach((v) => v.tick(t));
    if (buses.classroom.level > 0.01) {
      teacher.tick(t);
      whisper.forEach((v) => v.tick(t));
    }
    if (buses.corridor.level > 0.01) corridorVoice.tick(t);
    if (buses.office.level > 0.01) officeVoice.tick(t);
    for (const e of events) {
      if (t < e.next) continue;
      e.next = t + R(e.every[0], e.every[1]);
      if (buses[e.bus].level > 0.01) e.fn(buses[e.bus].input, t + Math.random() * 0.3);
    }
  }

  return {
    start() {
      if (started) return;
      started = true;
      timer = setInterval(loop, 50);
    },
    // mix: { field: [크기, 먹먹함Hz], ... }
    setMix(mix) {
      const t = now();
      for (const [name, bus] of Object.entries(buses)) {
        const [lvl, cutoff] = mix[name] || [0, 16000];
        bus.level = lvl;
        bus.gain.gain.setTargetAtTime(lvl, t, 0.4);
        bus.lp.frequency.setTargetAtTime(cutoff, t, 0.4);
      }
    },
    setMuted(m) {
      master.gain.setTargetAtTime(m ? 0 : 0.9, now(), 0.2);
    },
    stop() {
      clearInterval(timer);
    },
  };
}
